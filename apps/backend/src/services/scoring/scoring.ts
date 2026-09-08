import type { ActivityLevel, AuthorSummaryRecord, CommitEvidenceRecord } from "../../types/report";

export interface ScoringConfig {
  formulaVersion: string;
  weights: {
    commits: number;
    filesTouched: number;
    linesChanged: number;
  };
  thresholds: {
    medium: number;
    high: number;
  };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  formulaVersion: "activity-score-v1",
  weights: {
    commits: 3,
    filesTouched: 1,
    linesChanged: 0.1,
  },
  thresholds: {
    medium: 10,
    high: 30,
  },
};

function activityLevel(score: number, config: ScoringConfig): ActivityLevel {
  if (score >= config.thresholds.high) {
    return "high";
  }
  if (score >= config.thresholds.medium) {
    return "medium";
  }
  return "low";
}

function roundedScore(score: number): number {
  return Math.round((score + Number.EPSILON) * 100) / 100;
}

function compareCommits(left: CommitEvidenceRecord, right: CommitEvidenceRecord): number {
  return right.committerTimestamp.valueOf() - left.committerTimestamp.valueOf()
    || right.authorTimestamp.valueOf() - left.authorTimestamp.valueOf()
    || left.commitHash.localeCompare(right.commitHash);
}

function compareAuthors(left: AuthorSummaryRecord, right: AuthorSummaryRecord): number {
  return right.activityScore - left.activityScore
    || left.authorName.localeCompare(right.authorName)
    || left.authorEmail.localeCompare(right.authorEmail);
}

export function aggregateAuthors(
  commits: CommitEvidenceRecord[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): AuthorSummaryRecord[] {
  const grouped = new Map<string, { name: string; email: string; commits: CommitEvidenceRecord[] }>();

  for (const commit of commits) {
    const key = `${commit.authorName}\0${commit.authorEmail}`;
    const group = grouped.get(key);
    if (group) {
      group.commits.push(commit);
    } else {
      grouped.set(key, { name: commit.authorName, email: commit.authorEmail, commits: [commit] });
    }
  }

  return [...grouped.values()]
    .map((group): AuthorSummaryRecord => {
      const orderedCommits = [...group.commits].sort(compareCommits);
      const uniqueFiles = new Set(orderedCommits.flatMap((commit) => commit.filesChanged.map((file) => file.path)));
      const linesAdded = orderedCommits.reduce((total, commit) => total + commit.linesAdded, 0);
      const linesRemoved = orderedCommits.reduce((total, commit) => total + commit.linesRemoved, 0);
      const activityScore = roundedScore(
        (orderedCommits.length * config.weights.commits)
        + (uniqueFiles.size * config.weights.filesTouched)
        + ((linesAdded + linesRemoved) * config.weights.linesChanged),
      );

      return {
        authorName: group.name,
        authorEmail: group.email,
        commitCount: orderedCommits.length,
        filesTouched: uniqueFiles.size,
        linesAdded,
        linesRemoved,
        activityScore,
        activityLevel: activityLevel(activityScore, config),
        summaryText: "AI summary pending.",
        summarySource: "fallback",
        summaryStatus: "available",
        summaryWarning: null,
        commits: orderedCommits,
      };
    })
    .sort(compareAuthors);
}
