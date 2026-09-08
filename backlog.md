# Implementation Backlog — Daily Commit Summary Tool

Source: [project_spec.md](project_spec.md)

**Current state:** `commit_collector.py`, `activity_score.py`, and `report_writer.py` are already implemented and functional (git log parsing, scoring/classification, Markdown rendering). Missing: AI integration, config, CLI entry point, packaging files, and docs. Backlog below reflects that — done groundwork is checked off, remaining gaps are prioritized with **AI integration first** (highest risk), open spec questions resolved with sensible defaults (revisit later if needed), manual testing only (no automated test suite), and docs limited to README + `.env.example` + inline docstrings.

---

## Phase 1: Setup

- [x] Git log collection via `subprocess` (argument lists, no shell interpolation) — `commit_collector.py`
- [x] `Commit` dataclass (hash, author, timestamp, subject/body, files, +/- lines) — `commit_collector.py`
- [x] `.gitignore` includes `.env`
- [ ] Decide and document defaults for open spec items (Section 13), to revisit later if wrong (GitHub issue #8)
  - [ ] GitHub Models API endpoint + model name + auth header format (GitHub issue #4)
  - [ ] Env var name: `GITHUB_TOKEN` (GitHub issue #1)
  - [ ] `reports/` output — gitignored (not committed) (GitHub issue #5)
  - [ ] Diff size limit for LLM prompt truncation (e.g. 4000 chars per author) (GitHub issue #6)
- [ ] Create `config.py` with tunable constants (time window hours, activity thresholds, output dir, diff size limit) sourced from existing hardcoded values in `activity_score.py` (GitHub issue #7; delegated to GitHub coding agent)
- [ ] Add `requirements.txt` (`python-dotenv`, `requests`) (GitHub issue #2)
- [ ] Add `.env.example` documenting `GITHUB_TOKEN` (placeholder value only) (GitHub issue #9)
- [ ] Verify `.env` is populated locally and never committed (`git status` check) (GitHub issue #10)
- [ ] Install dependencies (`pip install -r requirements.txt`) in project venv (GitHub issue #3)

## Phase 2: Core Features

- [x] Parse `git log --numstat` output into files changed / lines added / removed
- [x] Group commits by author — `commit_collector.py` → `group_by_author()`
- [x] Compute per-author activity score (`commits*3 + files*1 + lines*0.1`) — `activity_score.py`
- [x] Classify Low/Medium/High against thresholds — `activity_score.py`
- [x] Sort authors by score desc, then name asc — `activity_score.py`
- [x] Render Markdown report per spec Section 4 (header, per-author sections, commit list) — `report_writer.py`
- [ ] **`ai_summarizer.py`** — GitHub Models API integration (priority: build/validate this first)
  - [ ] Confirm working API call against GitHub Models (endpoint, model, auth header) with a real token
  - [ ] Build per-author prompt: commit messages + subject/body concatenation
  - [ ] Add diff/stat aggregation input, respecting the diff size limit from `config.py`
  - [ ] Implement truncation fallback: send file names + stat summaries only when diff content exceeds the limit
  - [ ] Call API and return plain-text 2–4 sentence summary per author
  - [ ] Handle auth errors, network errors, rate limits — return `None`/raise a typed exception, do not crash
  - [ ] Unit-verify (manually) that prompt does not invent details beyond commit/diff input
- [ ] Wire fallback text `_AI summary unavailable — see commit list below._` when a per-author call fails (verify `report_writer.py` already supports via `summaries` dict — confirm caller passes `None`/missing entries correctly)
- [ ] `reports/` directory auto-created if missing when writing output

## Phase 3: Integration

- [ ] **`summarize_commits.py`** — main CLI entry point (replace placeholder `main.py`, which currently still contains unrelated calculator demo code)
  - [ ] Detect current repo + branch (`is_git_repository`, `current_branch`)
  - [ ] Exit non-zero with clear error if not run inside a git repo
  - [ ] Exit non-zero with clear error if `git` CLI is not on PATH
  - [ ] Call `collect_recent_commits()` with configured window (default 24h)
  - [ ] If zero commits: print "No commits in the last 24 hours — report not generated." and exit 0 (skip file write)
  - [ ] Group commits by author, compute activity via `activity_score.py`
  - [ ] Load `.env` via `python-dotenv`; warn (not fail) if token missing/invalid, proceed with fallback summaries for all authors
  - [ ] Call `ai_summarizer.py` per author, collect summaries dict (email → text), catching per-author failures without aborting the run
  - [ ] Log per-author AI summary failures as warnings to console
  - [ ] Render report via `report_writer.render_report()` and write to `reports/commit_summary_<YYYY-MM-DD>.md`
  - [ ] Print console summary: repo/branch detected, commit count, output file path (or skip message)
- [ ] End-to-end manual run against `module03-task`'s own repo history to confirm full pipeline works with a real token
- [ ] End-to-end manual run with token removed/invalid to confirm fallback-only path works
- [ ] Confirm no API token value appears in console output or generated report (security check per spec Section 10)

## Phase 4: Testing

*(Manual testing checklist only — no automated test suite for this pass.)*

- [ ] Run with commits present on current branch within last 24h → verify report generated with correct author grouping, scores, labels, and commit details
- [ ] Run with zero commits in last 24h → verify no file written, correct console message, exit code 0
- [ ] Run outside a git repository → verify clear error message and non-zero exit code
- [ ] Run with `git` temporarily removed from PATH (or simulate) → verify clear error and non-zero exit code
- [ ] Run with missing/invalid `GITHUB_TOKEN` → verify warning printed and report still generated using fallback summaries for all authors
- [ ] Manually force one author's AI call to fail (e.g. bad model name) → verify only that author gets fallback text, others still get real summaries, run completes
- [ ] Verify activity score boundaries (score exactly 10 and exactly 30) classify as expected (Medium, High respectively)
- [ ] Verify author with no commits in window is omitted entirely, not shown with zero row
- [ ] Verify `reports/` directory is created automatically when it doesn't exist
- [ ] Verify report filename matches `commit_summary_<YYYY-MM-DD>.md` using local generation date

## Phase 5: Documentation

- [ ] Update `README.md` with usage instructions: `python summarize_commits.py`, prerequisites (Python 3.x, `git` on PATH, `.env` setup)
- [ ] Document required env var(s) and setup steps for `.env` (copy from `.env.example`)
- [ ] Confirm/add module-level docstrings for `ai_summarizer.py`, `config.py`, and `summarize_commits.py` (existing modules already have them)
- [ ] Add brief troubleshooting notes to README for the error conditions in spec Section 9 (not a git repo, missing token, git not found)
- [ ] Note in README whether `reports/` output is committed or gitignored, per the Setup-phase decision
