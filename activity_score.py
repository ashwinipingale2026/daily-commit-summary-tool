"""Formatting logic: per-author activity scoring and Low/Medium/High classification.

score = (commits * 3) + (files_touched * 1) + (lines_changed * 0.1)
Thresholds are tunable defaults; raw numbers are always shown alongside the label.
"""
from __future__ import annotations

from dataclasses import dataclass

from commit_collector import Commit

LOW_THRESHOLD = 10
MEDIUM_THRESHOLD = 30

COMMIT_WEIGHT = 3
FILE_WEIGHT = 1
LINE_WEIGHT = 0.1


@dataclass
class AuthorActivity:
    name: str
    email: str
    commits: list[Commit]

    @property
    def commit_count(self) -> int:
        return len(self.commits)

    @property
    def files_touched(self) -> int:
        return len({f for c in self.commits for f in c.files_changed})

    @property
    def lines_added(self) -> int:
        return sum(c.lines_added for c in self.commits)

    @property
    def lines_removed(self) -> int:
        return sum(c.lines_removed for c in self.commits)

    @property
    def score(self) -> float:
        lines_changed = self.lines_added + self.lines_removed
        return (
            self.commit_count * COMMIT_WEIGHT
            + self.files_touched * FILE_WEIGHT
            + lines_changed * LINE_WEIGHT
        )

    @property
    def activity_label(self) -> str:
        score = self.score
        if score < LOW_THRESHOLD:
            return "Low"
        if score < MEDIUM_THRESHOLD:
            return "Medium"
        return "High"


def group_by_author(commits: list[Commit]) -> list[AuthorActivity]:
    """Group commits by author, sorted by activity score desc, then name asc."""
    grouped: dict[tuple[str, str], list[Commit]] = {}
    for commit in commits:
        key = (commit.author_name, commit.author_email)
        grouped.setdefault(key, []).append(commit)

    authors = [
        AuthorActivity(name=name, email=email, commits=author_commits)
        for (name, email), author_commits in grouped.items()
    ]
    authors.sort(key=lambda a: (-a.score, a.name))
    return authors
