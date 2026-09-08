import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { ReportRepository } from "./report-repository";
import type { ReportRecord } from "../types/report";

type QueryCall = {
  text: string;
  values?: unknown[];
};

class FakeClient {
  readonly calls: QueryCall[] = [];
  released = false;
  failOnEvidence = false;

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ text, values });
    if (this.failOnEvidence && text.includes("INSERT INTO commit_evidence")) {
      throw new Error("evidence insert failed");
    }

    return { rows: [] };
  }

  release(): void {
    this.released = true;
  }
}

class FakePool {
  readonly client = new FakeClient();
  readonly calls: QueryCall[] = [];
  latestRows: unknown[] = [];

  async connect(): Promise<PoolClient> {
    return this.client as unknown as PoolClient;
  }

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ text, values });
    return { rows: this.latestRows };
  }
}

function createReport(): ReportRecord {
  return {
    repositoryPath: "C:\\repositories\\daily-summary",
    repositoryName: "daily-summary",
    branchName: "main",
    headCommitHash: "abcdef123456",
    windowStart: new Date("2025-01-01T00:00:00.000Z"),
    windowEnd: new Date("2025-01-02T00:00:00.000Z"),
    scoringConfig: { formulaVersion: "1" },
    generatedAt: new Date("2025-01-02T00:00:01.000Z"),
    totalCommits: 1,
    contributingAuthors: 1,
    outputPath: null,
    generationStatus: "completed",
    authors: [
      {
        authorName: "Ada Lovelace",
        authorEmail: "ada@example.com",
        commitCount: 1,
        filesTouched: 1,
        linesAdded: 3,
        linesRemoved: 1,
        activityScore: 4.4,
        activityLevel: "low",
        summaryText: "Implemented the daily summary foundation.",
        summarySource: "fallback",
        summaryStatus: "available",
        summaryWarning: null,
        commits: [
          {
            commitHash: "abcdef123456",
            shortHash: "abcdef1",
            authorName: "Ada Lovelace",
            authorEmail: "ada@example.com",
            authorTimestamp: new Date("2025-01-01T12:00:00.000Z"),
            committerTimestamp: new Date("2025-01-01T12:01:00.000Z"),
            subject: "Add report persistence",
            body: null,
            filesChanged: [{ path: "src/report.ts", additions: 3, deletions: 1, binary: false }],
            binary: false,
            fileCount: 1,
            linesAdded: 3,
            linesRemoved: 1,
          },
        ],
      },
    ],
    warnings: [{ code: "AI_UNAVAILABLE", message: "Fallback summary used" }],
  };
}

test("persists a report transactionally and returns generated identifiers", async () => {
  const pool = new FakePool();
  const repository = new ReportRepository(pool as unknown as Pool);

  const persisted = await repository.saveReport(createReport());

  assert.match(persisted.id, /^[0-9a-f-]{36}$/);
  assert.equal(persisted.authorIds.length, 1);
  assert.equal(pool.client.released, true);
  assert.equal(pool.client.calls[0]?.text, "BEGIN");
  assert.equal(pool.client.calls.at(-1)?.text, "COMMIT");
  assert.equal(pool.client.calls.filter(({ text }) => text.includes("INSERT INTO")).length, 4);
});

test("rolls back and releases the client when persistence fails", async () => {
  const pool = new FakePool();
  pool.client.failOnEvidence = true;
  const repository = new ReportRepository(pool as unknown as Pool);

  await assert.rejects(repository.saveReport(createReport()), /evidence insert failed/);

  assert.equal(pool.client.calls.at(-1)?.text, "ROLLBACK");
  assert.equal(pool.client.released, true);
  assert.equal(pool.client.calls.some(({ text }) => text === "COMMIT"), false);
});

test("rejects empty reports before opening a database transaction", async () => {
  const pool = new FakePool();
  const repository = new ReportRepository(pool as unknown as Pool);
  const report = createReport();
  report.totalCommits = 0;
  report.authors = [];
  report.contributingAuthors = 0;

  await assert.rejects(repository.saveReport(report), /at least one commit and one author/);
  assert.equal(pool.client.calls.length, 0);
});

test("retrieves and maps the latest report with one database query", async () => {
  const pool = new FakePool();
  pool.latestRows = [
    {
      id: "report-id",
      repository_path: "C:\\repositories\\daily-summary",
      repository_name: "daily-summary",
      branch_name: "main",
      head_commit_hash: "abcdef123456",
      window_start: new Date("2025-01-01T00:00:00.000Z"),
      window_end: new Date("2025-01-02T00:00:00.000Z"),
      scoring_config: { formulaVersion: "1" },
      generated_at: new Date("2025-01-02T00:00:01.000Z"),
      total_commits: 1,
      contributing_authors: 1,
      output_path: null,
      generation_status: "completed",
      authors: [
        {
          id: "author-id",
          authorName: "Ada Lovelace",
          authorEmail: "ada@example.com",
          commitCount: 1,
          filesTouched: 1,
          linesAdded: 3,
          linesRemoved: 1,
          activityScore: 4.4,
          activityLevel: "low",
          summaryText: "Implemented the daily summary foundation.",
          summarySource: "fallback",
          summaryStatus: "available",
          summaryWarning: null,
          commits: [
            {
              commitHash: "abcdef123456",
              shortHash: "abcdef1",
              authorName: "Ada Lovelace",
              authorEmail: "ada@example.com",
              authorTimestamp: "2025-01-01T12:00:00.000Z",
              committerTimestamp: "2025-01-01T12:01:00.000Z",
              subject: "Add report persistence",
              body: null,
              filesChanged: [],
              binary: false,
              fileCount: 0,
              linesAdded: 0,
              linesRemoved: 0,
            },
          ],
        },
      ],
      warnings: [{ code: "AI_UNAVAILABLE", message: "Fallback summary used", authorSummaryId: "author-id" }],
    },
  ];
  const repository = new ReportRepository(pool as unknown as Pool);

  const report = await repository.findLatestReport("C:\\repositories\\daily-summary", "main");

  assert.equal(pool.calls.length, 1);
  assert.equal(report?.id, "report-id");
  assert.deepEqual(report?.authorIds, ["author-id"]);
  assert.equal(report?.authors[0]?.commits[0]?.authorTimestamp.toISOString(), "2025-01-01T12:00:00.000Z");
  assert.deepEqual(report?.warnings, [{ code: "AI_UNAVAILABLE", message: "Fallback summary used" }]);
});

test("returns null when no latest report exists", async () => {
  const pool = new FakePool();
  const repository = new ReportRepository(pool as unknown as Pool);

  assert.equal(await repository.findLatestReport("C:\\repositories\\daily-summary", "main"), null);
});
