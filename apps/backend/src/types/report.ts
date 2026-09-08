export type GenerationStatus = "completed" | "partial_success";
export type ActivityLevel = "low" | "medium" | "high";
export type SummarySource = "ai" | "fallback";

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
  renamedFrom?: string;
}

export interface CommitEvidenceRecord {
  commitHash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authorTimestamp: Date;
  committerTimestamp: Date;
  subject: string;
  body: string | null;
  filesChanged: FileChange[];
  binary: boolean;
  fileCount: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface AuthorSummaryRecord {
  authorName: string;
  authorEmail: string;
  commitCount: number;
  filesTouched: number;
  linesAdded: number;
  linesRemoved: number;
  activityScore: number;
  activityLevel: ActivityLevel;
  summaryText: string;
  summarySource: SummarySource;
  summaryStatus: "available";
  summaryWarning: string | null;
  commits: CommitEvidenceRecord[];
}

export interface ReportWarningRecord {
  code: string;
  message: string;
  authorIndex?: number;
}

export interface ReportRecord {
  repositoryPath: string;
  repositoryName: string;
  branchName: string;
  headCommitHash: string;
  windowStart: Date;
  windowEnd: Date;
  scoringConfig: Record<string, unknown>;
  generatedAt: Date;
  totalCommits: number;
  contributingAuthors: number;
  outputPath: string | null;
  generationStatus: GenerationStatus;
  authors: AuthorSummaryRecord[];
  warnings: ReportWarningRecord[];
}

export interface PersistedReport extends ReportRecord {
  id: string;
  authorIds: string[];
}
