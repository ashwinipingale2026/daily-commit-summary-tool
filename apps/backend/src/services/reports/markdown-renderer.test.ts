import assert from "node:assert/strict";
import test from "node:test";
import { renderReportMarkdown } from "./markdown-renderer";
import type { PersistedReport } from "../../types/report";

function report(): PersistedReport {
  return {
    id: "report-id",
    authorIds: ["author-id"],
    repositoryPath: "C:\\repo",
    repositoryName: "repo * unsafe",
    branchName: "feature/[demo]",
    headCommitHash: "abcdef",
    windowStart: new Date("2026-09-08T03:00:00.000Z"),
    windowEnd: new Date("2026-09-09T03:00:00.000Z"),
    scoringConfig: { formulaVersion: "activity-score-v1" },
    generatedAt: new Date("2026-09-09T03:01:00.000Z"),
    totalCommits: 1,
    contributingAuthors: 1,
    outputPath: null,
    generationStatus: "partial_success",
    warnings: [{ code: "AI_SUMMARY_FALLBACK", message: "Provider unavailable" }],
    authors: [{
      authorName: "Ada *",
      authorEmail: "ada@example.com",
      commitCount: 1,
      filesTouched: 1,
      linesAdded: 2,
      linesRemoved: 1,
      activityScore: 4.3,
      activityLevel: "low",
      summaryText: "Fallback **summary**",
      summarySource: "fallback",
      summaryStatus: "available",
      summaryWarning: "AI unavailable",
      commits: [{
        commitHash: "abcdef123456",
        shortHash: "abcdef1",
        authorName: "Ada *",
        authorEmail: "ada@example.com",
        authorTimestamp: new Date("2026-09-09T01:00:00.000Z"),
        committerTimestamp: new Date("2026-09-09T01:01:00.000Z"),
        subject: "Fix [report]",
        body: "Body with # heading",
        filesChanged: [{ path: "src/[report].ts", additions: 2, deletions: 1, binary: false }],
        binary: false,
        fileCount: 1,
        linesAdded: 2,
        linesRemoved: 1,
      }],
    }],
  };
}

test("renders deterministic report Markdown with escaped repository data and warnings", () => {
  const first = renderReportMarkdown(report());
  const second = renderReportMarkdown(report());

  assert.equal(first, second);
  assert.ok(first.includes("Repository: repo \\* unsafe"));
  assert.ok(first.includes("Branch: feature/\\[demo\\]"));
  assert.ok(first.includes("Fallback \\*\\*summary\\*\\*"));
  assert.match(first, /## Warnings/);
  assert.ok(first.includes("AI\\_SUMMARY\\_FALLBACK"));
});
