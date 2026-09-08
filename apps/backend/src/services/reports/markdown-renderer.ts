import type { ReportMarkdownPort, ReportRepositoryPort } from "../../types/api";
import type { CommitEvidenceRecord, FileChange, PersistedReport } from "../../types/report";

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|>~-])/g, "\\$1")
    .replace(/\r?\n/g, " ");
}

function formatDate(value: Date): string {
  return value.toISOString();
}

function renderFileChange(file: FileChange): string {
  const binaryLabel = file.binary ? " (binary)" : "";
  const renameLabel = file.renamedFrom ? ` (renamed from \`${escapeMarkdown(file.renamedFrom)}\`)` : "";
  return `- \`${escapeMarkdown(file.path)}\`: +${file.additions} / -${file.deletions}${binaryLabel}${renameLabel}`;
}

function renderCommit(commit: CommitEvidenceRecord): string {
  const body = commit.body ? `\n\n${escapeMarkdown(commit.body)}` : "";
  const files = commit.filesChanged.length > 0
    ? `\n${commit.filesChanged.map(renderFileChange).join("\n")}`
    : "\n- No changed files";
  return [
    `### \`${escapeMarkdown(commit.shortHash)}\` - ${escapeMarkdown(commit.subject)}`,
    `- Author: ${escapeMarkdown(commit.authorName)} <${escapeMarkdown(commit.authorEmail)}>`,
    `- Author time: ${formatDate(commit.authorTimestamp)}`,
    `- Committer time: ${formatDate(commit.committerTimestamp)}`,
    `- Files: ${commit.fileCount}; additions: ${commit.linesAdded}; deletions: ${commit.linesRemoved}`,
    body,
    "**Changed files:**",
    files,
  ].join("\n");
}

export function renderReportMarkdown(report: PersistedReport): string {
  const authors = report.authors.map((author) => [
    `## ${escapeMarkdown(author.authorName)} <${escapeMarkdown(author.authorEmail)}>`,
    `- Activity: **${author.activityLevel}** (${author.activityScore.toFixed(2)})`,
    `- Commits: ${author.commitCount}; files touched: ${author.filesTouched}; additions: ${author.linesAdded}; deletions: ${author.linesRemoved}`,
    `- Summary (${author.summarySource}): ${escapeMarkdown(author.summaryText)}`,
    author.summaryWarning ? `- Summary warning: ${escapeMarkdown(author.summaryWarning)}` : "",
    author.commits.map(renderCommit).join("\n\n"),
  ].filter(Boolean).join("\n")).join("\n\n");

  const warnings = report.warnings.length > 0
    ? `\n## Warnings\n${report.warnings.map((warning) => `- **${escapeMarkdown(warning.code)}:** ${escapeMarkdown(warning.message)}`).join("\n")}`
    : "";

  return [
    "# Daily Commit Summary",
    "",
    `- Repository: ${escapeMarkdown(report.repositoryName)}`,
    `- Branch: ${escapeMarkdown(report.branchName)}`,
    `- Window: ${formatDate(report.windowStart)} to ${formatDate(report.windowEnd)}`,
    `- Generated: ${formatDate(report.generatedAt)}`,
    `- Status: ${report.generationStatus}`,
    "",
    "## Totals",
    `- Commits: ${report.totalCommits}`,
    `- Authors: ${report.contributingAuthors}`,
    `- Files touched: ${report.authors.reduce((total, author) => total + author.filesTouched, 0)}`,
    `- Lines added: ${report.authors.reduce((total, author) => total + author.linesAdded, 0)}`,
    `- Lines removed: ${report.authors.reduce((total, author) => total + author.linesRemoved, 0)}`,
    "",
    authors,
    warnings,
    "",
  ].join("\n");
}

export class MarkdownRenderer implements ReportMarkdownPort {
  constructor(private readonly repository: ReportRepositoryPort) {}

  async render(reportId: string): Promise<string | null> {
    const report = await this.repository.findReportById(reportId);
    return report ? renderReportMarkdown(report) : null;
  }
}
