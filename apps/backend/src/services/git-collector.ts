import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { CommitEvidenceRecord, FileChange } from "../types/report";

const execFileAsync = promisify(execFile);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface GitSnapshot {
  repositoryPath: string;
  repositoryName: string;
  branchName: string;
  headCommitHash: string;
  windowStart: Date;
  windowEnd: Date;
  commits: CommitEvidenceRecord[];
}

export type GitCollectionErrorCode =
  | "GIT_UNAVAILABLE"
  | "INVALID_REPOSITORY"
  | "DETACHED_HEAD"
  | "MALFORMED_EVIDENCE";

export class GitCollectionError extends Error {
  constructor(
    readonly code: GitCollectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GitCollectionError";
  }
}

interface GitCommandOptions {
  cwd: string;
  allowFailure?: boolean;
}

async function runGit(args: string[], options: GitCommandOptions): Promise<string> {
  try {
    const result = await execFileAsync("git", ["-C", options.cwd, ...args], {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout;
  } catch (error: unknown) {
    if (options.allowFailure) {
      return "";
    }

    const errorCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (errorCode === "ENOENT") {
      throw new GitCollectionError("GIT_UNAVAILABLE", "Git is not available on the server");
    }
    throw new GitCollectionError("INVALID_REPOSITORY", "Git could not read the configured repository");
  }
}

function parseRequiredFields(output: string, expectedFields: number, context: string): string[] {
  const fields = output.split("\0");
  while (fields.at(-1) === "") {
    fields.pop();
  }

  if (fields.length < expectedFields || fields.slice(0, expectedFields).some((field) => field === "")) {
    throw new GitCollectionError("MALFORMED_EVIDENCE", `Git returned malformed ${context} evidence`);
  }
  return fields;
}

function parseCommitMetadata(output: string): CommitEvidenceRecord {
  const fields = parseRequiredFields(output, 8, "commit");
  const [commitHash, shortHash, authorName, authorEmail, authorTimestamp, committerTimestamp, subject, body] = fields;
  const authorDate = new Date(authorTimestamp);
  const committerDate = new Date(committerTimestamp);

  if (!commitHash || !shortHash || !authorName || !authorEmail || !subject || Number.isNaN(authorDate.valueOf()) || Number.isNaN(committerDate.valueOf())) {
    throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned incomplete commit metadata");
  }

  const bodyLines = body.split(/\r?\n/);
  if (bodyLines[0]?.trim() === subject) {
    bodyLines.shift();
  }

  return {
    commitHash,
    shortHash,
    authorName,
    authorEmail,
    authorTimestamp: authorDate,
    committerTimestamp: committerDate,
    subject,
    body: bodyLines.join("\n").trim() || null,
    filesChanged: [],
    binary: false,
    fileCount: 0,
    linesAdded: 0,
    linesRemoved: 0,
  };
}

function parseNumstat(output: string): { filesChanged: FileChange[]; binary: boolean; linesAdded: number; linesRemoved: number } {
  const tokens = output.split("\0").filter(Boolean);
  const filesChanged: FileChange[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let binary = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const match = token.match(/^([0-9-]+)\t([0-9-]+)\t(.*)$/s);
    if (!match) {
      throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned malformed file statistics");
    }

    const [, additionsText, deletionsText, parsedPath] = match;
    let path = parsedPath;
    let renamedFrom: string | undefined;
    if (!path) {
      renamedFrom = tokens[index + 1];
      path = tokens[index + 2];
      if (!renamedFrom || !path) {
        throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned an incomplete rename");
      }
      index += 2;
    }
    if (!path) {
      throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned a file without a path");
    }

    const isBinary = additionsText === "-" || deletionsText === "-";
    const additions = isBinary ? 0 : Number(additionsText);
    const deletions = isBinary ? 0 : Number(deletionsText);
    if (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions)) {
      throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned invalid line statistics");
    }

    filesChanged.push({ path, additions, deletions, binary: isBinary, ...(renamedFrom ? { renamedFrom } : {}) });
    linesAdded += additions;
    linesRemoved += deletions;
    binary ||= isBinary;
  }

  return { filesChanged, binary, linesAdded, linesRemoved };
}

async function collectCommit(repositoryPath: string, commitHash: string): Promise<CommitEvidenceRecord> {
  const metadata = await runGit(
    ["show", "-s", "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%cI%x00%s%x00%B%x00", commitHash],
    { cwd: repositoryPath },
  );
  const commit = parseCommitMetadata(metadata);
  const numstat = await runGit(["diff-tree", "--root", "--no-commit-id", "--numstat", "-z", "-r", "--find-renames", commitHash], {
    cwd: repositoryPath,
  });
  const statistics = parseNumstat(numstat);

  return {
    ...commit,
    ...statistics,
    fileCount: statistics.filesChanged.length,
  };
}

export async function collectGitSnapshot(repositoryPath: string, windowEnd = new Date()): Promise<GitSnapshot | null> {
  const normalizedWindowEnd = new Date(windowEnd);
  if (Number.isNaN(normalizedWindowEnd.valueOf())) {
    throw new GitCollectionError("MALFORMED_EVIDENCE", "The collection window end is invalid");
  }
  const windowStart = new Date(normalizedWindowEnd.valueOf() - DAY_IN_MS);
  const topLevel = (await runGit(["rev-parse", "--show-toplevel"], { cwd: repositoryPath })).trim();
  if (!topLevel) {
    throw new GitCollectionError("INVALID_REPOSITORY", "The configured path is not a Git repository");
  }

  const branchName = (await runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repositoryPath, allowFailure: true })).trim();
  if (!branchName) {
    throw new GitCollectionError("DETACHED_HEAD", "The repository has a detached HEAD");
  }

  const headCommitHash = (await runGit(["rev-parse", "HEAD"], { cwd: repositoryPath })).trim();
  if (!headCommitHash) {
    throw new GitCollectionError("MALFORMED_EVIDENCE", "Git did not return the checked-out HEAD");
  }

  const hashesOutput = await runGit(
    ["log", headCommitHash, `--since=${windowStart.toISOString()}`, `--until=${normalizedWindowEnd.toISOString()}`, "--date-order", "--format=%H%x00%cI%x00"],
    { cwd: repositoryPath },
  );
  const logFields = hashesOutput.split("\0").map((field) => field.trim()).filter(Boolean);
  if (logFields.length % 2 !== 0) {
    throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned malformed commit list evidence");
  }
  const hashesWithDates = [];
  for (let index = 0; index < logFields.length; index += 2) {
    const commitHash = logFields[index];
    const committerDate = new Date(logFields[index + 1]);
    if (!commitHash || Number.isNaN(committerDate.valueOf())) {
      throw new GitCollectionError("MALFORMED_EVIDENCE", "Git returned incomplete commit list evidence");
    }
    hashesWithDates.push({ commitHash, committerDate });
  }
  hashesWithDates.sort((left, right) => right.committerDate.valueOf() - left.committerDate.valueOf() || left.commitHash.localeCompare(right.commitHash));
  const hashes = hashesWithDates.map(({ commitHash }) => commitHash);
  if (hashes.length === 0) {
    return null;
  }

  const commits = await Promise.all(hashes.map((hash) => collectCommit(repositoryPath, hash)));
  commits.sort((left, right) => right.committerTimestamp.valueOf() - left.committerTimestamp.valueOf() || left.commitHash.localeCompare(right.commitHash));

  return {
    repositoryPath: topLevel,
    repositoryName: basename(topLevel),
    branchName,
    headCommitHash,
    windowStart,
    windowEnd: normalizedWindowEnd,
    commits,
  };
}
