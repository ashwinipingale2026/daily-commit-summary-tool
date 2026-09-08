import assert from "node:assert/strict";
import test from "node:test";
import { aggregateAuthors } from "./scoring";
import type { CommitEvidenceRecord } from "../../types/report";

function commit(overrides: Partial<CommitEvidenceRecord>): CommitEvidenceRecord {
  return {
    commitHash: "0000000000000000000000000000000000000001",
    shortHash: "0000000",
    authorName: "Ada Lovelace",
    authorEmail: "ada@example.com",
    authorTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    committerTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    subject: "Update report",
    body: null,
    filesChanged: [{ path: "src/report.ts", additions: 10, deletions: 2, binary: false }],
    binary: false,
    fileCount: 1,
    linesAdded: 10,
    linesRemoved: 2,
    ...overrides,
  };
}

test("groups exact author identities and counts unique files", () => {
  const authors = aggregateAuthors([
    commit({ commitHash: "b", shortHash: "b", subject: "Older", linesAdded: 3, linesRemoved: 1, filesChanged: [{ path: "src/report.ts", additions: 3, deletions: 1, binary: false }] }),
    commit({ commitHash: "a", shortHash: "a", subject: "Newer", committerTimestamp: new Date("2026-09-09T02:00:00.000Z"), linesAdded: 5, linesRemoved: 2, filesChanged: [
      { path: "src/report.ts", additions: 5, deletions: 2, binary: false },
      { path: "src/app.ts", additions: 1, deletions: 0, binary: false },
    ] }),
    commit({ commitHash: "c", shortHash: "c", authorName: "Grace Hopper", authorEmail: "ada@example.com" }),
  ]);

  assert.equal(authors.length, 2);
  assert.equal(authors[0]?.authorName, "Ada Lovelace");
  assert.equal(authors[0]?.commitCount, 2);
  assert.equal(authors[0]?.filesTouched, 2);
  assert.equal(authors[0]?.linesAdded, 8);
  assert.equal(authors[0]?.linesRemoved, 3);
  assert.equal(authors[0]?.activityScore, 9.1);
  assert.deepEqual(authors[0]?.commits.map(({ commitHash }) => commitHash), ["a", "b"]);
});

test("applies low, medium, and high thresholds", () => {
  const authors = aggregateAuthors([
    commit({ authorName: "Low", authorEmail: "low@example.com", linesAdded: 0, linesRemoved: 0, filesChanged: [] }),
    commit({ authorName: "Medium", authorEmail: "medium@example.com", linesAdded: 70, linesRemoved: 0, filesChanged: [] }),
    commit({ authorName: "High", authorEmail: "high@example.com", linesAdded: 270, linesRemoved: 0, filesChanged: [] }),
  ]);

  assert.deepEqual(
    authors.map(({ authorName, activityScore, activityLevel }) => ({ authorName, activityScore, activityLevel })),
    [
      { authorName: "High", activityScore: 30, activityLevel: "high" },
      { authorName: "Medium", activityScore: 10, activityLevel: "medium" },
      { authorName: "Low", activityScore: 3, activityLevel: "low" },
    ],
  );
});

test("uses name and email as deterministic tie-breakers", () => {
  const authors = aggregateAuthors([
    commit({ authorName: "Zoe", authorEmail: "z@example.com" }),
    commit({ authorName: "Ada", authorEmail: "z@example.com" }),
    commit({ authorName: "Ada", authorEmail: "a@example.com" }),
  ]);

  assert.deepEqual(authors.map(({ authorName, authorEmail }) => `${authorName}:${authorEmail}`), [
    "Ada:a@example.com",
    "Ada:z@example.com",
    "Zoe:z@example.com",
  ]);
});

test("rounds scores to two decimals while retaining deterministic commit order", () => {
  const authors = aggregateAuthors([
    commit({
      commitHash: "z",
      shortHash: "z",
      linesAdded: 1,
      linesRemoved: 2,
      filesChanged: [{ path: "a.ts", additions: 1, deletions: 2, binary: false }],
      committerTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    }),
    commit({
      commitHash: "a",
      shortHash: "a",
      linesAdded: 0,
      linesRemoved: 0,
      filesChanged: [{ path: "a.ts", additions: 0, deletions: 0, binary: false }],
      committerTimestamp: new Date("2026-09-09T01:00:00.000Z"),
    }),
  ]);

  assert.equal(authors[0]?.activityScore, 7.3);
  assert.deepEqual(authors[0]?.commits.map(({ commitHash }) => commitHash), ["a", "z"]);
});
