"""Data fetching module: collects commit data from the local git repository.

Reads commit history via the `git` CLI (argument lists only, no shell
interpolation) and parses it into `Commit` records for downstream reporting.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from datetime import datetime

_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"
# Record separator must precede each header: `--numstat` output is appended
# after the pretty-format line with no separator of its own.
_LOG_FORMAT = _RECORD_SEP + _FIELD_SEP.join(["%H", "%an", "%ae", "%aI", "%s", "%b"])


@dataclass
class Commit:
    hash: str
    author_name: str
    author_email: str
    timestamp: datetime
    subject: str
    body: str
    files_changed: list[str] = field(default_factory=list)
    lines_added: int = 0
    lines_removed: int = 0


class NotAGitRepositoryError(RuntimeError):
    """Raised when the target path is not inside a git working tree."""


class GitNotFoundError(RuntimeError):
    """Raised when the `git` executable is not available on PATH."""


def _run_git(args: list[str], cwd: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
        )
    except FileNotFoundError as exc:
        raise GitNotFoundError("git executable not found on PATH") from exc
    except subprocess.CalledProcessError as exc:
        raise NotAGitRepositoryError(exc.stderr.strip() or str(exc)) from exc
    return result.stdout


def is_git_repository(repo_path: str) -> bool:
    try:
        _run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_path)
        return True
    except NotAGitRepositoryError:
        return False


def current_branch(repo_path: str) -> str:
    return _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_path).strip()


def collect_recent_commits(repo_path: str, hours: int = 24) -> list[Commit]:
    """Return commits on HEAD made within the last `hours` hours, newest first."""
    log_output = _run_git(
        [
            "log",
            f"--since={hours} hours ago",
            f"--pretty=format:{_LOG_FORMAT}",
            "--numstat",
        ],
        cwd=repo_path,
    )

    commits: list[Commit] = []
    for entry in filter(None, log_output.split(_RECORD_SEP)):
        header, _, numstat_block = entry.lstrip("\n").partition("\n")
        parts = header.split(_FIELD_SEP)
        if len(parts) < 6:
            continue
        commit_hash, author_name, author_email, iso_ts, subject, body = parts[:6]

        files_changed: list[str] = []
        lines_added = 0
        lines_removed = 0
        for line in numstat_block.splitlines():
            line = line.strip()
            if not line:
                continue
            added, removed, filename = (line.split("\t") + ["", "", ""])[:3]
            files_changed.append(filename)
            lines_added += int(added) if added.isdigit() else 0
            lines_removed += int(removed) if removed.isdigit() else 0

        commits.append(
            Commit(
                hash=commit_hash[:7],
                author_name=author_name,
                author_email=author_email,
                timestamp=datetime.fromisoformat(iso_ts),
                subject=subject,
                body=body.strip(),
                files_changed=files_changed,
                lines_added=lines_added,
                lines_removed=lines_removed,
            )
        )
    return commits
