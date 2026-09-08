export type ApiStatus = "success" | "no_data" | "partial_success" | "error";
export type ActivityLevel = "low" | "medium" | "high";
export type SummarySource = "ai" | "fallback";
export type SummaryStatus = "available";

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
  renamedFrom?: string;
}

export interface CommitEvidence {
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

export interface AuthorSummary {
  name: string;
  email: string;
  activity: {
    level: ActivityLevel;
    score: number;
  };
  metrics: {
    commits: number;
    filesTouched: number;
    linesAdded: number;
    linesRemoved: number;
  };
  summary: {
    text: string;
    source: SummarySource;
    status: SummaryStatus;
    warning: string | null;
  };
  commits: CommitEvidence[];
}

export interface Report {
  id: string;
  repository: string;
  branch: string;
  window: {
    start: string;
    end: string;
  };
  generatedAt: string;
  totals: {
    commits: number;
    authors: number;
    filesTouched: number;
    linesAdded: number;
    linesRemoved: number;
  };
  authors: AuthorSummary[];
  warnings: Array<{
    code: string;
    message: string;
  }>;
}

export interface SuccessResponse {
  status: "success" | "partial_success";
  report: Report;
}

export interface NoDataResponse {
  status: "no_data";
  message: string;
  requestId: string;
}

export interface ApiError {
  status: "error";
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

export type ApiResponse = SuccessResponse | NoDataResponse | ApiError;

export function isApiError(value: ApiResponse): value is ApiError {
  return value.status === "error";
}

export function isNoDataResponse(value: ApiResponse): value is NoDataResponse {
  return value.status === "no_data";
}

export function isSuccessResponse(value: ApiResponse): value is SuccessResponse {
  return value.status === "success" || value.status === "partial_success";
}
