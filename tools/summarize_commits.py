"""Summarize git commits made on a specific date."""

import argparse
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"
_LOG_FORMAT = _RECORD_SEP + _FIELD_SEP.join(["%H", "%an", "%ae", "%aI", "%s"])


def find_repo_root(start: Path) -> Path:
    """Walk upward from `start` to find the nearest git repository root."""
    for path in [start.resolve(), *start.resolve().parents]:
        if (path / ".git").exists():
            return path
    raise SystemExit(f"Error: no git repository found at or above {start}")


def parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d-%m-%y")
    except ValueError:
        raise SystemExit(f"Error: invalid date '{date_str}', expected format dd-mm-yy (e.g. 08-09-26)")


def collect_commits_for_date(repo_root: Path, day: datetime) -> list[dict]:
    """Return commits made on `day` (local time), parsed from `git log --numstat`."""
    since = day.strftime("%Y-%m-%d 00:00:00")
    until = (day + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
    try:
        result = subprocess.run(
            ["git", "log", f"--since={since}", f"--until={until}",
             f"--pretty=format:{_LOG_FORMAT}", "--numstat"],
            cwd=repo_root, capture_output=True, text=True, check=True,
        )
    except FileNotFoundError:
        raise SystemExit("Error: git executable not found on PATH")
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"Error: git log failed: {exc.stderr.strip()}")

    commits: list[dict] = []
    for entry in filter(None, result.stdout.split(_RECORD_SEP)):
        header, _, numstat_block = entry.lstrip("\n").partition("\n")
        parts = header.split(_FIELD_SEP)
        if len(parts) < 5:
            continue
        commit_hash, author_name, author_email, iso_ts, subject = parts[:5]

        files_changed = 0
        lines_added = 0
        lines_removed = 0
        for line in numstat_block.splitlines():
            line = line.strip()
            if not line:
                continue
            added, removed, _filename = (line.split("\t") + ["", "", ""])[:3]
            files_changed += 1
            lines_added += int(added) if added.isdigit() else 0
            lines_removed += int(removed) if removed.isdigit() else 0

        commits.append({
            "hash": commit_hash[:7],
            "author_name": author_name,
            "author_email": author_email,
            "timestamp": iso_ts,
            "subject": subject,
            "files_changed": files_changed,
            "lines_added": lines_added,
            "lines_removed": lines_removed,
        })
    return commits


def group_by_author(commits: list[dict]) -> list[tuple[tuple[str, str], list[dict]]]:
    """Group commits by (author_name, author_email), sorted by commit count desc, then name asc."""
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for commit in commits:
        grouped[(commit["author_name"], commit["author_email"])].append(commit)
    return sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0][0]))


def print_summary(day: datetime, repo_root: Path, commits: list[dict]) -> None:
    print(f"Commit Summary - {day:%Y-%m-%d}")
    print(f"Repository:      {repo_root.name}")
    print(f"Total commits:   {len(commits)}")

    if not commits:
        print("No commits found for this date.")
        return

    authors = group_by_author(commits)
    print(f"Contributing authors: {len(authors)}")
    print()

    for (name, email), author_commits in authors:
        files_touched = sum(c["files_changed"] for c in author_commits)
        lines_added = sum(c["lines_added"] for c in author_commits)
        lines_removed = sum(c["lines_removed"] for c in author_commits)
        print(f"## {name} <{email}>")
        print(
            f"Commits: {len(author_commits)} | Files touched: {files_touched} "
            f"| Lines: +{lines_added} / -{lines_removed}"
        )
        for commit in author_commits:
            ts = datetime.fromisoformat(commit["timestamp"])
            print(f"  - {commit['hash']} ({ts:%H:%M}) - {commit['subject']}")
        print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize git commits made on a specific date.")
    parser.add_argument("date", help="Date to summarize, format dd-mm-yy (e.g. 08-09-26)")
    parser.add_argument(
        "--repo", default=".",
        help="Path inside the git repository to summarize (default: current directory)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    day = parse_date(args.date)
    repo_root = find_repo_root(Path(args.repo))
    commits = collect_commits_for_date(repo_root, day)
    print_summary(day, repo_root, commits)


if __name__ == "__main__":
    main()
