import type { CommitEvidence as CommitEvidenceData } from "../types/api";

interface CommitEvidenceProps {
  commit: CommitEvidenceData;
}

export function CommitEvidence({ commit }: CommitEvidenceProps) {
  return (
    <li className="commit-item">
      <div className="commit-main">
        <code>{commit.shortHash}</code>
        <strong>{commit.subject}</strong>
      </div>
      <div className="commit-meta">
        <span>{new Date(commit.committerTimestamp).toLocaleString()}</span>
        <span>{commit.fileCount} files</span>
        <span className="added">+{commit.linesAdded}</span>
        <span className="removed">-{commit.linesRemoved}</span>
      </div>
      {commit.filesChanged.length > 0 ? (
        <details className="file-details">
          <summary>View changed files</summary>
          <ul>
            {commit.filesChanged.map((file) => (
              <li key={`${commit.commitHash}-${file.path}`}>
                {file.path}
                {file.binary ? " (binary)" : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
