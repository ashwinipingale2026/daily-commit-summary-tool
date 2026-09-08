import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { collectGitSnapshot, GitCollectionError } from "./git-collector";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], { windowsHide: true });
}

async function createRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "daily-summary-git-"));
  await runGit(repositoryPath, ["init", "-b", "main"]);
  await runGit(repositoryPath, ["config", "user.name", "Ada Lovelace"]);
  await runGit(repositoryPath, ["config", "user.email", "ada@example.com"]);
  await writeFile(join(repositoryPath, "README.md"), "Daily summary\n");
  await runGit(repositoryPath, ["add", "README.md"]);
  await runGit(repositoryPath, ["commit", "-m", "Initial report"]);
  return repositoryPath;
}

test("collects commit metadata and numstat evidence for the captured HEAD", async (t) => {
  const repositoryPath = await createRepository();
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const windowEnd = new Date(Date.now() + 60_000);

  await writeFile(join(repositoryPath, "report.txt"), "line one\nline two\n");
  await runGit(repositoryPath, ["add", "report.txt"]);
  await runGit(repositoryPath, ["commit", "-m", "Add report evidence"]);

  const snapshot = await collectGitSnapshot(repositoryPath, windowEnd);

  assert.ok(snapshot);
  assert.equal(snapshot.branchName, "main");
  assert.equal(snapshot.repositoryName, repositoryPath.split(/[\\/]/).at(-1));
  assert.equal(snapshot.commits.length, 2);
  const reportCommit = snapshot.commits.find((commit) => commit.subject === "Add report evidence");
  assert.ok(reportCommit);
  assert.equal(reportCommit.authorName, "Ada Lovelace");
  assert.equal(reportCommit.filesChanged[0]?.path, "report.txt");
  assert.equal(reportCommit.linesAdded, 2);
});

test("returns null when no commit is in the rolling window", async (t) => {
  const repositoryPath = await createRepository();
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const snapshot = await collectGitSnapshot(repositoryPath, new Date("2020-01-02T00:00:00.000Z"));

  assert.equal(snapshot, null);
});

test("rejects detached HEAD with a typed error", async (t) => {
  const repositoryPath = await createRepository();
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));
  await runGit(repositoryPath, ["checkout", "--detach", "HEAD"]);

  await assert.rejects(
    collectGitSnapshot(repositoryPath),
    (error: unknown) => error instanceof GitCollectionError && error.code === "DETACHED_HEAD",
  );
});

test("rejects a non-repository path with a typed error", async () => {
  const repositoryPath = await mkdtemp(join(tmpdir(), "daily-summary-not-git-"));
  try {
    await assert.rejects(
      collectGitSnapshot(repositoryPath),
      (error: unknown) => error instanceof GitCollectionError && error.code === "INVALID_REPOSITORY",
    );
  } finally {
    await rm(repositoryPath, { recursive: true, force: true });
  }
});

test("collects multiple authors, empty bodies, binary files, and renames", async (t) => {
  const repositoryPath = await createRepository();
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));

  await runGit(repositoryPath, ["config", "user.name", "Grace Hopper"]);
  await runGit(repositoryPath, ["config", "user.email", "grace@example.com"]);
  await writeFile(join(repositoryPath, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  await runGit(repositoryPath, ["add", "binary.bin"]);
  await runGit(repositoryPath, ["commit", "-m", "Add binary evidence"]);
  await runGit(repositoryPath, ["mv", "README.md", "RENAMED.md"]);
  await runGit(repositoryPath, ["commit", "-m", "Rename report file"]);

  const snapshot = await collectGitSnapshot(repositoryPath, new Date(Date.now() + 60_000));

  assert.ok(snapshot);
  assert.equal(snapshot.commits.length, 3);
  const binaryCommit = snapshot.commits.find((commit) => commit.subject === "Add binary evidence");
  assert.ok(binaryCommit);
  assert.equal(binaryCommit.binary, true);
  assert.equal(binaryCommit.filesChanged[0]?.binary, true);
  assert.equal(binaryCommit.linesAdded, 0);
  assert.equal(binaryCommit.linesRemoved, 0);
  assert.equal(snapshot.commits.some((commit) => commit.subject === "Initial report" && commit.body === null), true);
  assert.equal(snapshot.commits.some((commit) => commit.authorEmail === "grace@example.com"), true);
  const renameCommit = snapshot.commits.find((commit) => commit.subject === "Rename report file");
  assert.equal(renameCommit?.filesChanged[0]?.path, "RENAMED.md");
  assert.equal(renameCommit?.filesChanged[0]?.renamedFrom, "README.md");
});

test("rejects an invalid collection window before invoking Git", async (t) => {
  const repositoryPath = await createRepository();
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));

  await assert.rejects(
    collectGitSnapshot(repositoryPath, new Date("not-a-date")),
    (error: unknown) => error instanceof GitCollectionError && error.code === "MALFORMED_EVIDENCE",
  );
});
