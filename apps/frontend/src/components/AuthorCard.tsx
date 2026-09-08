import type { AuthorSummary } from "../types/api";
import { ActivityBadge } from "./ActivityBadge";
import { CommitEvidence } from "./CommitEvidence";

interface AuthorCardProps {
  author: AuthorSummary;
}

export function AuthorCard({ author }: AuthorCardProps) {
  return (
    <article className="author-card">
      <div className="author-heading">
        <div>
          <h3>{author.name}</h3>
          <p className="muted">{author.email}</p>
        </div>
        <div className="author-score">
          <ActivityBadge level={author.activity.level} />
          <strong>{author.activity.score.toFixed(2)}</strong>
          <span>score</span>
        </div>
      </div>

      <div className="author-metrics">
        <span>{author.metrics.commits} commits</span>
        <span>{author.metrics.filesTouched} files</span>
        <span className="added">+{author.metrics.linesAdded}</span>
        <span className="removed">-{author.metrics.linesRemoved}</span>
      </div>

      <div className="summary-copy">
        <span className={`summary-source source-${author.summary.source}`}>{author.summary.source}</span>
        <p>{author.summary.text}</p>
        {author.summary.warning ? <p className="warning-text">{author.summary.warning}</p> : null}
      </div>

      <details className="commit-details">
        <summary>View {author.commits.length} commit evidence items</summary>
        <ul className="commit-list">
          {author.commits.map((commit) => (
            <CommitEvidence commit={commit} key={commit.commitHash} />
          ))}
        </ul>
      </details>
    </article>
  );
}
