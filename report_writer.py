"""Report template: renders the Markdown daily commit summary report (spec section 4)."""
from __future__ import annotations

from datetime import datetime

from activity_score import AuthorActivity

FALLBACK_SUMMARY = "_AI summary unavailable — see commit list below._"


def render_report(
    repo_name: str,
    branch: str,
    window_start: datetime,
    window_end: datetime,
    authors: list[AuthorActivity],
    summaries: dict[str, str] | None = None,
) -> str:
    """Render the full Markdown report.

    `summaries` maps author email -> AI-generated summary text; authors missing
    an entry fall back to `FALLBACK_SUMMARY`.
    """
    summaries = summaries or {}
    total_commits = sum(a.commit_count for a in authors)

    lines = [
        f"# Daily Commit Summary — {window_end:%Y-%m-%d}",
        "",
        f"Repository: {repo_name}",
        f"Branch: {branch}",
        f"Window: {window_start:%Y-%m-%d %H:%M} \u2192 {window_end:%Y-%m-%d %H:%M} (last 24 hours)",
        f"Total commits: {total_commits}",
        f"Contributing authors: {len(authors)}",
        "",
    ]

    for author in authors:
        lines.append(f"## Author: {author.name} <{author.email}>")
        lines.append(
            f"Activity: **{author.activity_label}** | Commits: {author.commit_count} "
            f"| Files touched: {author.files_touched} "
            f"| Lines: +{author.lines_added} / -{author.lines_removed}"
        )
        lines.append("")
        lines.append("### Summary of changes")
        lines.append(summaries.get(author.email, FALLBACK_SUMMARY))
        lines.append("")
        lines.append("### Commits")
        for commit in author.commits:
            lines.append(f"- `{commit.hash}` ({commit.timestamp:%H:%M}) — {commit.subject}")
            lines.append(
                f"  - Files changed: {len(commit.files_changed)} "
                f"| +{commit.lines_added} / -{commit.lines_removed}"
            )
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"
