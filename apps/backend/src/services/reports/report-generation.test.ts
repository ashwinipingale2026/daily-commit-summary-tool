import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../../config/environment";
import type { ReportProjectionPort, ReportPersistencePort } from "../../types/api";
import type { CommitEvidenceRecord, PersistedReport, ReportRecord } from "../../types/report";
import { ReportGenerationService, type ReportSummaryPort } from "./report-generation";
import type { GitSnapshot } from "../git-collector";

const config: AppConfig = {
  repositoryPath: "C:\\repositories\\daily-summary",
  databaseUrl: "postgresql://localhost/daily_summary",
  port: 3000,
  frontendOrigin: "http://localhost:5173",
  reportTimezone: "UTC",
  diffSizeLimit: 100_000,
};

function commit(hash: string, authorName = "Ada Lovelace"): CommitEvidenceRecord {
  return {
    commitHash: hash,
    shortHash: hash.slice(0, 7),
    authorName,
    authorEmail: `${authorName.toLowerCase().replace(" ", ".")}@example.com`,
    authorTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    committerTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    subject: "Update report",
    body: null,
    filesChanged: [{ path: "src/report.ts", additions: 2, deletions: 1, binary: false }],
    binary: false,
    fileCount: 1,
    linesAdded: 2,
    linesRemoved: 1,
  };
}

function snapshot(commits: CommitEvidenceRecord[] = [commit("abcdef1")]): GitSnapshot {
  return {
    repositoryPath: config.repositoryPath,
    repositoryName: "daily-summary",
    branchName: "main",
    headCommitHash: "abcdef123456",
    windowStart: new Date("2026-09-08T03:00:00.000Z"),
    windowEnd: new Date("2026-09-09T03:00:00.000Z"),
    commits,
  };
}

function ports() {
  const saved: ReportRecord[] = [];
  const persistence: ReportPersistencePort = {
    async findLatestReport() {
      return null;
    },
    async findReportById() {
      return null;
    },
    async saveReport(report) {
      saved.push(report);
      return { ...report, id: "report-id", authorIds: report.authors.map((_, index) => `author-${index}`) };
    },
    async appendWarning(_reportId, warning) {
      saved[0]?.warnings.push(warning);
    },
  };
  const projection: ReportProjectionPort = {
    toProjection(report: PersistedReport) {
      return { id: report.id, repository: report.repositoryName, branch: report.branchName, window: { start: report.windowStart.toISOString(), end: report.windowEnd.toISOString() }, generatedAt: report.generatedAt.toISOString(), totals: { commits: report.totalCommits, authors: report.contributingAuthors, filesTouched: 0, linesAdded: 0, linesRemoved: 0 }, authors: [], warnings: report.warnings };
    },
  };
  return { saved, persistence, projection };
}

test("returns no_data without persistence", async () => {
  const { saved, persistence, projection } = ports();
  const service = new ReportGenerationService({ config, persistence, projection, collect: async () => null });

  const result = await service.generate();

  assert.equal(result.status, "no_data");
  assert.equal(saved.length, 0);
});

test("aggregates, summarizes, persists, and projects a completed report", async () => {
  const { saved, persistence, projection } = ports();
  const summaries: ReportSummaryPort = {
    async summarize() {
      return { text: "Implemented report improvements.", source: "ai", warning: null };
    },
  };
  const service = new ReportGenerationService({
    config,
    persistence,
    projection,
    summarize: summaries,
    collect: async () => snapshot(),
    now: () => new Date("2026-09-09T03:00:00.000Z"),
  });

  const result = await service.generate();

  assert.equal(result.status, "success");
  assert.equal(saved[0]?.authors[0]?.summarySource, "ai");
  assert.equal(saved[0]?.generationStatus, "completed");
});

test("isolates summary failure and returns partial_success", async () => {
  const { saved, persistence, projection } = ports();
  const service = new ReportGenerationService({
    config,
    persistence,
    projection,
    summarize: { async summarize() { throw new Error("provider failed"); } },
    collect: async () => snapshot(),
  });

  const result = await service.generate();

  assert.equal(result.status, "partial_success");
  assert.equal(saved[0]?.authors[0]?.summarySource, "fallback");
  assert.equal(saved[0]?.warnings[0]?.code, "AI_SUMMARY_FAILED");
});

test("keeps other authors available when one summary provider call fails", async () => {
  const { saved, persistence, projection } = ports();
  const service = new ReportGenerationService({
    config,
    persistence,
    projection,
    collect: async () => snapshot([commit("ada", "Ada Lovelace"), commit("grace", "Grace Hopper")]),
    summarize: {
      async summarize(author) {
        if (author.authorName === "Ada Lovelace") {
          throw new Error("provider returned 429");
        }
        return { text: "Reviewed the report changes.", source: "ai", warning: null };
      },
    },
  });

  const result = await service.generate();

  assert.equal(result.status, "partial_success");
  const ada = saved[0]?.authors.find((author) => author.authorName === "Ada Lovelace");
  const grace = saved[0]?.authors.find((author) => author.authorName === "Grace Hopper");
  assert.equal(ada?.summarySource, "fallback");
  assert.equal(grace?.summarySource, "ai");
  assert.equal(saved[0]?.warnings.length, 1);
});

test("rejects concurrent generation and releases the lock after failure", async () => {
  const { persistence, projection } = ports();
  let release!: () => void;
  const blocked = new Promise<GitSnapshot | null>((resolve) => { release = () => resolve(snapshot()); });
  const service = new ReportGenerationService({ config, persistence, projection, collect: async () => blocked });

  const first = service.generate();
  await assert.rejects(service.generate(), (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 409);
  release();
  await first;
  await service.generate();
});

test("records a safe Markdown warning without hiding the report", async () => {
  const { saved, persistence, projection } = ports();
  const service = new ReportGenerationService({
    config,
    persistence,
    projection,
    collect: async () => snapshot(),
    markdown: { async render() { return null; } },
  });

  const result = await service.generate();

  assert.equal(result.status, "partial_success");
  assert.equal(saved[0]?.warnings.at(-1)?.code, "MARKDOWN_WRITE_FAILED");
});
