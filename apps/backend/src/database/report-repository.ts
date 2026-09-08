import { randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  AuthorSummaryRecord,
  CommitEvidenceRecord,
  FileChange,
  PersistedReport,
  ReportRecord,
} from "../types/report";

interface ReportRow extends QueryResultRow {
  id: string;
  repository_path: string;
  repository_name: string;
  branch_name: string;
  head_commit_hash: string;
  window_start: Date;
  window_end: Date;
  scoring_config: Record<string, unknown>;
  generated_at: Date;
  total_commits: number;
  contributing_authors: number;
  output_path: string | null;
  generation_status: ReportRecord["generationStatus"];
  authors: unknown;
  warnings: unknown;
}

interface RawAuthorSummary {
  id: string;
  authorName: string;
  authorEmail: string;
  commitCount: number;
  filesTouched: number;
  linesAdded: number;
  linesRemoved: number;
  activityScore: number;
  activityLevel: AuthorSummaryRecord["activityLevel"];
  summaryText: string;
  summarySource: AuthorSummaryRecord["summarySource"];
  summaryStatus: "available";
  summaryWarning: string | null;
  commits: RawCommitEvidence[];
}

interface RawCommitEvidence {
  commitHash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authorTimestamp: string;
  committerTimestamp: string;
  subject: string;
  body: string | null;
  filesChanged: FileChange[];
  binary: boolean;
  fileCount: number;
  linesAdded: number;
  linesRemoved: number;
}

interface RawWarning {
  code: string;
  message: string;
  authorSummaryId: string | null;
}

function assertReportCounts(report: ReportRecord): void {
  if (report.totalCommits <= 0 || report.contributingAuthors <= 0) {
    throw new Error("A persisted report must contain at least one commit and one author");
  }

  const evidenceCount = report.authors.reduce((count, author) => count + author.commits.length, 0);

  if (report.totalCommits !== evidenceCount) {
    throw new Error("Report total_commits must equal the number of commit evidence records");
  }

  if (report.contributingAuthors !== report.authors.length) {
    throw new Error("Report contributing_authors must equal the number of author summaries");
  }
}

function assertAuthorEvidence(report: ReportRecord): void {
  for (const author of report.authors) {
    if (author.commitCount !== author.commits.length) {
      throw new Error(`Author ${author.authorEmail || author.authorName} has inconsistent commit_count`);
    }

    for (const commit of author.commits) {
      if (commit.authorName !== author.authorName || commit.authorEmail !== author.authorEmail) {
        throw new Error("Commit evidence author metadata must match its author summary");
      }
    }
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function mapCommitEvidence(commit: RawCommitEvidence): CommitEvidenceRecord {
  return {
    ...commit,
    authorTimestamp: new Date(commit.authorTimestamp),
    committerTimestamp: new Date(commit.committerTimestamp),
  };
}

function mapReportRow(row: ReportRow): PersistedReport {
  const authors = asArray<RawAuthorSummary>(row.authors).map((author) => ({
    authorName: author.authorName,
    authorEmail: author.authorEmail,
    commitCount: author.commitCount,
    filesTouched: author.filesTouched,
    linesAdded: author.linesAdded,
    linesRemoved: author.linesRemoved,
    activityScore: author.activityScore,
    activityLevel: author.activityLevel,
    summaryText: author.summaryText,
    summarySource: author.summarySource,
    summaryStatus: author.summaryStatus,
    summaryWarning: author.summaryWarning,
    commits: asArray<RawCommitEvidence>(author.commits).map(mapCommitEvidence),
  }));

  const warnings = asArray<RawWarning>(row.warnings).map((warning) => ({
    code: warning.code,
    message: warning.message,
  }));

  return {
    id: row.id,
    repositoryPath: row.repository_path,
    repositoryName: row.repository_name,
    branchName: row.branch_name,
    headCommitHash: row.head_commit_hash,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    scoringConfig: row.scoring_config,
    generatedAt: row.generated_at,
    totalCommits: row.total_commits,
    contributingAuthors: row.contributing_authors,
    outputPath: row.output_path,
    generationStatus: row.generation_status,
    authors,
    warnings,
    authorIds: asArray<RawAuthorSummary>(row.authors).map((author) => author.id),
  };
}

export class ReportRepository {
  constructor(private readonly pool: Pool) {}

  async saveReport(report: ReportRecord): Promise<PersistedReport> {
    assertReportCounts(report);
    assertAuthorEvidence(report);

    const client = await this.pool.connect();
    const reportId = randomUUID();
    const authorIds: string[] = [];

    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO reports (
          id, repository_path, repository_name, branch_name, head_commit_hash,
          window_start, window_end, scoring_config, generated_at, total_commits,
          contributing_authors, output_path, generation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)`,
        [
          reportId,
          report.repositoryPath,
          report.repositoryName,
          report.branchName,
          report.headCommitHash,
          report.windowStart,
          report.windowEnd,
          JSON.stringify(report.scoringConfig),
          report.generatedAt,
          report.totalCommits,
          report.contributingAuthors,
          report.outputPath,
          report.generationStatus,
        ],
      );

      for (const [authorIndex, author] of report.authors.entries()) {
        const authorId = randomUUID();
        authorIds.push(authorId);
        await client.query(
          `INSERT INTO author_summaries (
            id, report_id, author_name, author_email, commit_count, files_touched,
            lines_added, lines_removed, activity_score, activity_level, summary_text,
            summary_source, summary_status, summary_warning
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            authorId,
            reportId,
            author.authorName,
            author.authorEmail,
            author.commitCount,
            author.filesTouched,
            author.linesAdded,
            author.linesRemoved,
            author.activityScore,
            author.activityLevel,
            author.summaryText,
            author.summarySource,
            author.summaryStatus,
            author.summaryWarning,
          ],
        );

        for (const commit of author.commits) {
          await client.query(
            `INSERT INTO commit_evidence (
              author_summary_id, report_id, commit_hash, short_hash, author_name,
              author_email, author_timestamp, committer_timestamp, subject, body,
              files_changed, binary, file_count, lines_added, lines_removed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)`,
            [
              authorId,
              reportId,
              commit.commitHash,
              commit.shortHash,
              commit.authorName,
              commit.authorEmail,
              commit.authorTimestamp,
              commit.committerTimestamp,
              commit.subject,
              commit.body,
              JSON.stringify(commit.filesChanged),
              commit.binary,
              commit.fileCount,
              commit.linesAdded,
              commit.linesRemoved,
            ],
          );
        }

        for (const warning of report.warnings.filter((item) => item.authorIndex === authorIndex)) {
          await client.query(
            `INSERT INTO report_warnings (report_id, author_summary_id, code, message)
             VALUES ($1, $2, $3, $4)`,
            [reportId, authorId, warning.code, warning.message],
          );
        }
      }

      for (const warning of report.warnings.filter((item) => item.authorIndex === undefined)) {
        await client.query(
          `INSERT INTO report_warnings (report_id, code, message)
           VALUES ($1, $2, $3)`,
          [reportId, warning.code, warning.message],
        );
      }

      await client.query("COMMIT");
      return { ...report, id: reportId, authorIds };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findLatestReport(repositoryPath: string, branchName?: string): Promise<PersistedReport | null> {
    const result = await this.pool.query<ReportRow>(
      `SELECT
        r.*,
        COALESCE(author_data.authors, '[]'::jsonb) AS authors,
        COALESCE(warning_data.warnings, '[]'::jsonb) AS warnings
      FROM reports r
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'authorName', a.author_name,
            'authorEmail', a.author_email,
            'commitCount', a.commit_count,
            'filesTouched', a.files_touched,
            'linesAdded', a.lines_added,
            'linesRemoved', a.lines_removed,
            'activityScore', a.activity_score::double precision,
            'activityLevel', a.activity_level,
            'summaryText', a.summary_text,
            'summarySource', a.summary_source,
            'summaryStatus', a.summary_status,
            'summaryWarning', a.summary_warning,
            'commits', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'commitHash', c.commit_hash,
                  'shortHash', c.short_hash,
                  'authorName', c.author_name,
                  'authorEmail', c.author_email,
                  'authorTimestamp', c.author_timestamp,
                  'committerTimestamp', c.committer_timestamp,
                  'subject', c.subject,
                  'body', c.body,
                  'filesChanged', c.files_changed,
                  'binary', c.binary,
                  'fileCount', c.file_count,
                  'linesAdded', c.lines_added,
                  'linesRemoved', c.lines_removed
                )
                ORDER BY c.committer_timestamp DESC, c.commit_hash ASC
              )
              FROM commit_evidence c
              WHERE c.author_summary_id = a.id AND c.report_id = r.id
            ), '[]'::jsonb)
          )
          ORDER BY a.activity_score DESC, a.author_name ASC, a.author_email ASC
        ) AS authors
        FROM author_summaries a
        WHERE a.report_id = r.id
      ) author_data ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'code', w.code,
            'message', w.message,
            'authorSummaryId', w.author_summary_id
          )
          ORDER BY w.created_at ASC, w.id ASC
        ) AS warnings
        FROM report_warnings w
        WHERE w.report_id = r.id
      ) warning_data ON true
      WHERE r.repository_path = $1 AND ($2::text IS NULL OR r.branch_name = $2)
      ORDER BY r.generated_at DESC, r.id DESC
      LIMIT 1`,
      [repositoryPath, branchName ?? null],
    );

    return result.rows[0] ? mapReportRow(result.rows[0]) : null;
  }
}
