import type { PersistedReport } from "./report";

export type ApiStatus = "success" | "no_data" | "partial_success" | "error";

export interface ApiError {
  status: "error";
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

export interface ReportProjection {
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
  authors: Array<{
    name: string;
    email: string;
    activity: {
      level: PersistedReport["authors"][number]["activityLevel"];
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
      source: PersistedReport["authors"][number]["summarySource"];
      status: PersistedReport["authors"][number]["summaryStatus"];
      warning: string | null;
    };
    commits: Array<{
      commitHash: string;
      shortHash: string;
      authorName: string;
      authorEmail: string;
      authorTimestamp: string;
      committerTimestamp: string;
      subject: string;
      body: string | null;
      filesChanged: PersistedReport["authors"][number]["commits"][number]["filesChanged"];
      binary: boolean;
      fileCount: number;
      linesAdded: number;
      linesRemoved: number;
    }>;
  }>;
  warnings: PersistedReport["warnings"];
}

export interface SuccessResponse {
  status: "success" | "partial_success";
  report: ReportProjection;
}

export interface NoDataResponse {
  status: "no_data";
  message: string;
  requestId: string;
}

export type ApiResponse = SuccessResponse | NoDataResponse | ApiError;

export interface ReportRepositoryPort {
  findLatestReport(repositoryPath: string, branchName?: string): Promise<PersistedReport | null>;
}

export interface ReportProjectionPort {
  toProjection(report: PersistedReport): ReportProjection;
}

export interface ReportMarkdownPort {
  render(reportId: string): Promise<string | null>;
}

export interface ReportGenerationPort {
  generate(): Promise<ApiResponse>;
}
