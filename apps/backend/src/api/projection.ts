import type { PersistedReport } from "../types/report";
import type { ReportProjection, ReportProjectionPort } from "../types/api";

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

export const reportProjection: ReportProjectionPort = {
  toProjection(report: PersistedReport): ReportProjection {
    return {
      id: report.id,
      repository: report.repositoryName,
      branch: report.branchName,
      window: {
        start: report.windowStart.toISOString(),
        end: report.windowEnd.toISOString(),
      },
      generatedAt: report.generatedAt.toISOString(),
      totals: {
        commits: report.totalCommits,
        authors: report.contributingAuthors,
        filesTouched: sum(report.authors, (author) => author.filesTouched),
        linesAdded: sum(report.authors, (author) => author.linesAdded),
        linesRemoved: sum(report.authors, (author) => author.linesRemoved),
      },
      authors: report.authors.map((author) => ({
        name: author.authorName,
        email: author.authorEmail,
        activity: {
          level: author.activityLevel,
          score: author.activityScore,
        },
        metrics: {
          commits: author.commitCount,
          filesTouched: author.filesTouched,
          linesAdded: author.linesAdded,
          linesRemoved: author.linesRemoved,
        },
        summary: {
          text: author.summaryText,
          source: author.summarySource,
          status: author.summaryStatus,
          warning: author.summaryWarning,
        },
        commits: author.commits.map((commit) => ({
          ...commit,
          authorTimestamp: commit.authorTimestamp.toISOString(),
          committerTimestamp: commit.committerTimestamp.toISOString(),
        })),
      })),
      warnings: report.warnings,
    };
  },
};
