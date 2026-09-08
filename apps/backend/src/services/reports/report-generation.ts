import { HttpError } from "../../api/errors";
import type { AppConfig } from "../../config/environment";
import { aggregateAuthors, DEFAULT_SCORING_CONFIG } from "../scoring/scoring";
import { collectGitSnapshot, type GitSnapshot } from "../git-collector";
import type { ReportProjectionPort, ReportPersistencePort, ReportMarkdownPort, ApiResponse } from "../../types/api";
import type { AuthorSummaryRecord, ReportRecord, ReportWarningRecord } from "../../types/report";

export interface AuthorSummaryResult {
  text: string;
  source: AuthorSummaryRecord["summarySource"];
  warning: string | null;
  warningCode?: string;
}

export interface ReportSummaryPort {
  summarize(author: AuthorSummaryRecord): Promise<AuthorSummaryResult>;
}

export interface ReportGenerationDependencies {
  config: AppConfig;
  persistence: ReportPersistencePort;
  projection: ReportProjectionPort;
  markdown?: ReportMarkdownPort;
  collect?: (repositoryPath: string, windowEnd: Date) => Promise<GitSnapshot | null>;
  summarize?: ReportSummaryPort;
  now?: () => Date;
}

const FALLBACK_SUMMARY = "AI summary unavailable - see commit list below.";

export const fallbackSummary: ReportSummaryPort = {
  async summarize(): Promise<AuthorSummaryResult> {
    return { text: FALLBACK_SUMMARY, source: "fallback", warning: "AI summaries are unavailable" };
  },
};

function toDependencyError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  return new HttpError(503, "REPORT_DEPENDENCY_UNAVAILABLE", "A report dependency is unavailable", true);
}

function warningForAuthor(index: number, result: AuthorSummaryResult): ReportWarningRecord | null {
  if (!result.warning) {
    return null;
  }
  return { code: result.warningCode ?? "AI_SUMMARY_FALLBACK", message: result.warning, authorIndex: index };
}

export class ReportGenerationService {
  private running = false;

  constructor(private readonly dependencies: ReportGenerationDependencies) {}

  async generate(): Promise<ApiResponse> {
    if (this.running) {
      throw new HttpError(409, "GENERATION_ALREADY_RUNNING", "A report generation is already in progress", true);
    }

    this.running = true;
    try {
      const now = this.dependencies.now?.() ?? new Date();
      const snapshot = await this.collectSnapshot(now);
      if (!snapshot) {
        return {
          status: "no_data",
          message: "No commits in the last 24 hours - report not generated.",
          requestId: "",
        };
      }

      const authors = aggregateAuthors(snapshot.commits, DEFAULT_SCORING_CONFIG);
      const warnings: ReportWarningRecord[] = [];
      const summarizedAuthors: AuthorSummaryRecord[] = [];
      const summarize = this.dependencies.summarize ?? fallbackSummary;

      for (const [index, author] of authors.entries()) {
        let result: AuthorSummaryResult;
        try {
          result = await summarize.summarize(author);
        } catch {
          result = {
            text: FALLBACK_SUMMARY,
            source: "fallback",
            warning: "AI summary generation failed",
            warningCode: "AI_SUMMARY_FAILED",
          };
        }
        const warning = warningForAuthor(index, result);
        if (warning) {
          warnings.push(warning);
        }
        summarizedAuthors.push({
          ...author,
          summaryText: result.text,
          summarySource: result.source,
          summaryWarning: result.warning,
        });
      }

      const report: ReportRecord = {
        repositoryPath: snapshot.repositoryPath,
        repositoryName: snapshot.repositoryName,
        branchName: snapshot.branchName,
        headCommitHash: snapshot.headCommitHash,
        windowStart: snapshot.windowStart,
        windowEnd: snapshot.windowEnd,
        scoringConfig: {
          formulaVersion: DEFAULT_SCORING_CONFIG.formulaVersion,
          weights: { ...DEFAULT_SCORING_CONFIG.weights },
          thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds },
        },
        generatedAt: now,
        totalCommits: snapshot.commits.length,
        contributingAuthors: summarizedAuthors.length,
        outputPath: null,
        generationStatus: warnings.length > 0 ? "partial_success" : "completed",
        authors: summarizedAuthors,
        warnings,
      };

      const persisted = await this.dependencies.persistence.saveReport(report);
      const markdownWarning = await this.renderMarkdown(persisted.id);
      if (markdownWarning) {
        warnings.push(markdownWarning);
        await this.dependencies.persistence.appendWarning?.(persisted.id, markdownWarning);
        persisted.warnings = [...persisted.warnings, markdownWarning];
      }

      if (warnings.length > 0 && persisted.generationStatus === "completed") {
        persisted.generationStatus = "partial_success";
      }
      return {
        status: persisted.generationStatus === "partial_success" ? "partial_success" : "success",
        report: this.dependencies.projection.toProjection(persisted),
      };
    } catch (error) {
      throw toDependencyError(error);
    } finally {
      this.running = false;
    }
  }

  private async collectSnapshot(windowEnd: Date): Promise<GitSnapshot | null> {
    try {
      return await (this.dependencies.collect ?? collectGitSnapshot)(this.dependencies.config.repositoryPath, windowEnd);
    } catch (error) {
      throw toDependencyError(error);
    }
  }

  private async renderMarkdown(reportId: string): Promise<ReportWarningRecord | null> {
    if (!this.dependencies.markdown) {
      return null;
    }
    try {
      const markdown = await this.dependencies.markdown.render(reportId);
      return markdown === null
        ? { code: "MARKDOWN_WRITE_FAILED", message: "Markdown output was unavailable" }
        : null;
    } catch {
      return { code: "MARKDOWN_WRITE_FAILED", message: "Markdown output could not be written" };
    }
  }
}
