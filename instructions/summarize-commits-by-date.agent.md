# Summarize Commits By Date

- Use `tools/summarize_commits.py` when the user asks to summarize, list, or review git commits made on a specific date.
- Applies whenever the request gives a specific date (not a rolling window like "last 24 hours" — that's the separate `summarize_commits.py`/`report_writer.py` pipeline planned in `module03-task/backlog.md`).
- Invoke via command line with the date as a positional argument, in this exact order:
  ```
  python tools/summarize_commits.py <date> [--repo <path>]
  ```
  + `date` — required, format `dd-mm-yy` (e.g. `08-09-26` for September 8, 2026).
  + `--repo` — optional, path to (or inside) the git repository to summarize; defaults to the current directory. The script walks upward to find the nearest `.git` folder.
- Convert any date given by the user in another format (e.g. "September 8, 2026", "2026-09-08") to `dd-mm-yy` before passing it as the argument.
- Run the command in a terminal and capture its output — do not recompute or invent commit data manually.
- The script prints, per matching date:
  + Total commit count and number of contributing authors.
  + Per-author breakdown: commit count, files touched, lines added/removed.
  + Per-author commit list with short hash, time, and subject line.
- If the script reports "No commits found for this date," tell the user plainly — do not fabricate commits.
- Present results to the user as a concise summary, not a raw terminal dump, unless they ask for the full output.
- If the target repository path is missing or ambiguous, ask the user before running the script.
