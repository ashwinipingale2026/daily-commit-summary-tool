# Daily Commit Summary Tool - Feature Specification

**Status:** Draft
**Version:** 1.1.0
**Date:** 2026-09-09
**Constitution:** [`spec/constitution.md`](./constitution.md)

## 1. Overview

### 1.1 Problem

A project manager overseeing a six-person time-and-materials team needs a fast, consistent way to understand what changed in the repository during the last day. Raw Git history is detailed but time-consuming to interpret, while commit counts alone do not explain the nature or spread of the work.

### 1.2 Product

The Daily Commit Summary Tool collects commits from one local Git repository and its current/default branch for a rolling 24-hour window. It presents a Markdown-compatible report grouped by author, including source commits, changed files, line statistics, a transparent Low/Medium/High activity indicator, and an optional AI-generated plain-English summary.

The React frontend provides the project manager's report view. The Node.js/Express backend performs Git collection, scoring, AI integration, persistence, and report retrieval. PostgreSQL stores auditable report data.

### 1.3 Goals

- Make daily repository activity understandable in under two minutes.
- Keep every report statement traceable to collected Git data.
- Make the activity indicator deterministic and explainable.
- Continue producing useful reports when AI is unavailable.
- Provide a reproducible local environment using Dockerized PostgreSQL 15.

### 1.4 Non-goals

- Billing, timesheet replacement, effort-to-hours conversion, or performance evaluation.
- Multiple repositories, remote Git-provider APIs, or branch comparison.
- Automatic scheduling, email, Slack, or other delivery integrations.
- Author roster management or identity normalization beyond Git's recorded name/email.
- Editing commits or writing back to the source repository.

## 2. Users and User Scenarios

### 2.1 Primary user

**Project manager:** needs an on-demand, plain-English view of team activity for daily status visibility.

### 2.2 User stories

#### US-001: Generate a current daily summary

As a project manager, I want to request a report for the last 24 hours so that I can understand recent team activity without manually inspecting Git history.

**Acceptance scenarios**

```gherkin
Scenario: Generate a report with recent commits
  Given the configured repository is a valid Git repository
  And the current branch contains commits from the last 24 hours
  When the project manager requests a summary
  Then the system collects only commits whose commit timestamp is within the rolling 24-hour window
  And the system groups the collected commits by Git author
  And the system persists and displays the generated report
```

#### US-002: Inspect source evidence

As a project manager, I want to see each author's commits, files, and line changes so that I can verify the report against the underlying work.

**Acceptance scenarios**

```gherkin
Scenario: Display source details
  Given a generated report contains commits for an author
  When the report is displayed
  Then the author section shows the author name and email
  And each commit shows its short hash, local timestamp, subject, changed-file count, additions, and deletions
  And the report shows the repository, branch, reporting window, total commits, and contributing-author count
```

#### US-003: Understand activity level

As a project manager, I want a consistent activity label with its raw inputs so that I can use it as a quick indicator without treating it as an unexplained judgment.

**Acceptance scenarios**

```gherkin
Scenario: Calculate and display activity
  Given an author has commits, touched files, additions, and deletions
  When the report is generated
  Then the system calculates score = (commits * 3) + files_touched + ((additions + deletions) * 0.1)
  And score below 10 is labeled Low
  And score from 10 up to but excluding 30 is labeled Medium
  And score of 30 or greater is labeled High
  And the raw metrics are displayed beside the label
```

#### US-004: Receive an AI summary without losing the report

As a project manager, I want a concise plain-English summary of each author's changes so that I can scan the report quickly.

**Acceptance scenarios**

```gherkin
Scenario: Generate a supported AI summary
  Given an author has collected commit messages and bounded diff input
  When the GitHub Models API succeeds
  Then the report contains a plain-text summary of 2 to 4 sentences
  And the summary describes only information present in the supplied input

Scenario: Continue when an author summary fails
  Given the GitHub Models API fails for one author
  When report generation continues
  Then that author receives "_AI summary unavailable - see commit list below._"
  And other authors are still processed
  And the report is still persisted and returned
  And a warning is recorded without exposing the token
```

#### US-005: Handle no-data and configuration states

As a project manager, I want clear feedback when no report can be generated so that I know whether to retry or investigate configuration.

**Acceptance scenarios**

```gherkin
Scenario: No recent commits
  Given the repository has no commits in the rolling 24-hour window
  When the project manager requests a summary
  Then the system returns a successful no-data result
  And no empty report file or report record is created
  And the UI displays "No commits in the last 24 hours - report not generated."

Scenario: Invalid repository
  Given the configured path is not a Git repository
  When the project manager requests a summary
  Then the backend returns a clear non-success error
  And the UI identifies the repository configuration problem

Scenario: Missing AI token
  Given the GitHub Models token is absent or invalid
  When the project manager requests a summary
  Then the system warns that AI summaries are unavailable
  And the report uses the fallback text for each author
  And Git collection, scoring, and report generation still succeed
```

## 3. Functional Requirements

### 3.1 Repository collection

- **FR-001:** The backend MUST operate on the configured single local repository.
- **FR-002:** Collection MUST use the current/default branch (`HEAD`) and MUST NOT scan remote or unrelated local branches.
- **FR-003:** The default window MUST be the preceding 24 hours from request time, using commit timestamps and local timezone presentation.
- **FR-004:** Each collected commit MUST include short hash, author name, author email, author timestamp, full message, changed-file list/count, additions, and deletions.
- **FR-005:** Git processes MUST receive argument arrays and MUST expose clear errors when Git is unavailable or returns an unexpected failure.
- **FR-006:** A no-commit result MUST not create a report record or output file.

### 3.2 Aggregation and ordering

- **FR-007:** Commits MUST be grouped by the exact Git author name and email recorded in the commit.
- **FR-008:** Author totals MUST include commit count, unique files touched, total additions, total deletions, and calculated score.
- **FR-009:** Authors MUST be ordered by score descending, then name alphabetically.
- **FR-010:** Commits within an author section MUST be ordered newest first.

### 3.3 Scoring

- **FR-011:** The default formula MUST be `score = (commits * 3) + files_touched + ((lines_added + lines_removed) * 0.1)`.
- **FR-012:** Default thresholds MUST be Low `< 10`, Medium `>= 10 and < 30`, and High `>= 30`.
- **FR-013:** Window size, score weights, and thresholds MUST be configuration values, not constants buried in collection or presentation logic.
- **FR-014:** The API and report MUST expose raw metrics so the score can be independently checked.

### 3.4 AI summaries

- **FR-015:** The backend MUST isolate GitHub Models API access behind an AI summarizer service.
- **FR-016:** Per-author input MUST include concatenated commit messages and either bounded diffs or file-level statistics when the configured diff limit is exceeded.
- **FR-017:** The prompt MUST request a 2-4 sentence plain-English project-manager summary and prohibit unsupported details.
- **FR-018:** An AI failure MUST be isolated to the affected author and MUST NOT prevent report persistence.
- **FR-019:** Tokens MUST be loaded from environment configuration (`GITHUB_TOKEN` or the finalized project variable) and MUST never appear in logs, API responses, or reports.

### 3.5 Reports and persistence

- **FR-020:** A report MUST contain generation date, repository, branch, start/end timestamps, total commits, contributing authors, author sections, AI/fallback summary, and commit evidence.
- **FR-021:** Markdown output MUST use `reports/commit_summary_<YYYY-MM-DD>.md`, creating `reports/` when needed.
- **FR-022:** PostgreSQL records MUST retain report metadata, author aggregates, summaries, and source commit details sufficient for audit or reproduction.
- **FR-023:** Generated Markdown and API data MUST escape or safely render commit-derived text.
- **FR-024:** Report generation MUST be idempotent for the same repository, branch, and reporting window, or MUST define a documented duplicate policy before implementation.

### 3.6 API and frontend

- **FR-025:** The Express API MUST expose an endpoint to generate a report and an endpoint to retrieve the latest report; exact route names are finalized in the implementation plan.
- **FR-026:** API responses MUST distinguish `success`, `no_data`, `partial_success`, and `error` outcomes using stable typed shapes.
- **FR-027:** The frontend MUST provide a manual generate action, latest-report view, loading state, empty state, partial-AI-warning state, and actionable error state.
- **FR-028:** The UI MUST display report metadata, author ordering, activity labels, raw metrics, AI/fallback summary, and source commit details.

## 4. Data Model Requirements

The implementation plan MUST define repeatable PostgreSQL 15 migrations for the following entities. The database is the audit store for generated reports; derived values MUST remain reproducible from the stored source evidence.

### 4.1 Entity relationships

```text
report 1 ---- * author_summary 1 ---- * commit_evidence
report 1 ---- * report_warning
```

- A `report` is one generation attempt that has collected at least one commit.
- An `author_summary` belongs to exactly one report and represents one exact Git author identity within that report.
- A `commit_evidence` row belongs to exactly one author summary and stores the source data used for aggregation.
- A `report_warning` records non-fatal conditions such as an AI failure or fallback.
- Foreign keys MUST enforce these relationships; deleting a report MUST cascade to its child rows.

### 4.2 `reports`

| Column | Type | Rules and purpose |
|---|---|---|
| `id` | `uuid` | Primary key, generated by the application or database |
| `repository_path` | `text` | Sanitized local path; MUST NOT contain credentials |
| `repository_name` | `text` | Display name derived from the repository |
| `branch_name` | `text` | Branch resolved from `HEAD` |
| `head_commit_hash` | `text` | Full hash used as the collection snapshot |
| `window_start` | `timestamptz` | Inclusive start of the reporting window |
| `window_end` | `timestamptz` | Exclusive end/request timestamp |
| `generated_at` | `timestamptz` | Report completion timestamp |
| `total_commits` | `integer` | Must be greater than zero |
| `contributing_authors` | `integer` | Must be greater than zero |
| `output_path` | `text` | Relative Markdown output path, if generated |
| `generation_status` | `text` | `completed` or `partial_success`; constrained enum/check |
| `created_at` | `timestamptz` | Row creation timestamp |

- `window_start` MUST be earlier than `window_end`.
- `total_commits` MUST equal the count of child `commit_evidence` rows.
- `contributing_authors` MUST equal the count of child `author_summary` rows.
- The implementation MUST choose and document an idempotency key, recommended as `(repository_path, branch_name, head_commit_hash, window_start, window_end)`.
- `repository_path` MUST be normalized consistently before uniqueness checks.

### 4.3 `author_summaries`

| Column | Type | Rules and purpose |
|---|---|---|
| `id` | `uuid` | Primary key |
| `report_id` | `uuid` | Required foreign key to `reports(id)` |
| `author_name` | `text` | Exact Git author name |
| `author_email` | `text` | Exact Git author email |
| `commit_count` | `integer` | Greater than zero |
| `files_touched` | `integer` | Unique file count, zero or greater |
| `lines_added` | `integer` | Zero or greater |
| `lines_removed` | `integer` | Zero or greater |
| `activity_score` | `numeric` | Formula result retained for audit |
| `activity_level` | `text` | `low`, `medium`, or `high`; constrained enum/check |
| `summary_text` | `text` | AI-generated or deterministic fallback text |
| `summary_source` | `text` | `ai` or `fallback`; constrained enum/check |
| `summary_status` | `text` | `available`, `unavailable`, or `not_requested` |
| `summary_warning` | `text` | Safe, non-secret warning detail; nullable |
| `created_at` | `timestamptz` | Row creation timestamp |

- Uniqueness MUST be enforced on `(report_id, author_name, author_email)`.
- `activity_score` MUST be calculated by the service and independently testable; it MUST NOT be accepted as an unvalidated client value.
- Email values MUST be validated as Git metadata but MUST NOT be used to infer identity beyond the report.

### 4.4 `commit_evidence`

| Column | Type | Rules and purpose |
|---|---|---|
| `id` | `uuid` | Primary key |
| `author_summary_id` | `uuid` | Required foreign key to `author_summaries(id)` |
| `commit_hash` | `text` | Full Git hash; unique within the report |
| `short_hash` | `text` | Display hash derived from the full hash |
| `author_name` | `text` | Snapshot of Git metadata |
| `author_email` | `text` | Snapshot of Git metadata |
| `author_timestamp` | `timestamptz` | Commit author date |
| `subject` | `text` | Commit subject |
| `body` | `text` | Commit body; nullable |
| `files_changed` | `jsonb` | Array of path/stat objects |
| `file_count` | `integer` | Number of changed files |
| `lines_added` | `integer` | Zero or greater |
| `lines_removed` | `integer` | Zero or greater |
| `created_at` | `timestamptz` | Row creation timestamp |

- `commit_hash` MUST be unique within a report.
- `files_changed` MUST preserve changed paths and per-file additions/deletions where Git provides them.
- Repository-derived text MUST be stored as data and safely escaped at rendering boundaries.
- The system MUST reject malformed or incomplete evidence rather than persisting unverifiable aggregates.

### 4.5 `report_warnings`

| Column | Type | Rules and purpose |
|---|---|---|
| `id` | `uuid` | Primary key |
| `report_id` | `uuid` | Required foreign key to `reports(id)` |
| `author_summary_id` | `uuid` | Optional foreign key for author-specific warnings |
| `code` | `text` | Stable machine-readable warning code |
| `message` | `text` | Safe user-facing explanation |
| `created_at` | `timestamptz` | Warning timestamp |

- Warning codes MUST NOT contain tokens, raw provider responses, or sensitive prompt content.
- Author-specific AI failures SHOULD reference the affected `author_summary`.

### 4.6 Indexing and lifecycle

- Add indexes on `reports(generated_at DESC)`, `reports(repository_path, branch_name, window_end DESC)`, `author_summaries(report_id, activity_score DESC)`, and `commit_evidence(author_summary_id, author_timestamp DESC)`.
- API retrieval MUST return one report with its nested author summaries, evidence, and warnings without N+1 database queries.
- A report MUST be written transactionally: create the report, child summaries, evidence, and warnings together; rollback when collection or persistence fails.
- No-data requests MUST not create a `reports` row.
- Retention and archival policy MUST be documented before production deployment.

### 4.7 API projection

The persistence model MUST be mapped to a stable API model rather than exposed directly:

```json
{
  "status": "success",
  "report": {
    "id": "uuid",
    "repository": "module03-task",
    "branch": "main",
    "window": { "start": "ISO-8601", "end": "ISO-8601" },
    "generatedAt": "ISO-8601",
    "totals": { "commits": 5, "authors": 2 },
    "authors": [
      {
        "name": "Author Name",
        "email": "author@example.com",
        "activity": { "level": "high", "score": 42.5 },
        "metrics": { "commits": 3, "filesTouched": 8, "linesAdded": 240, "linesRemoved": 35 },
        "summary": { "text": "Summary text.", "source": "ai", "status": "available" },
        "commits": []
      }
    ],
    "warnings": []
  }
}
```

The `no_data`, `partial_success`, and `error` response shapes MUST be documented alongside this success shape.

## 5. UI Screen Requirements

The frontend MUST be a focused, responsive report experience for a project manager. It MUST not require command-line interaction for the primary workflow.

### 5.1 Screen map

```text
Application shell
+-- Daily Summary screen
    +-- Report controls
    +-- Report metadata and totals
    +-- Warning/notice region
    +-- Author summary list
    |   +-- Author detail/commit evidence expansion
    +-- Empty/error/loading states
```

The first release requires one primary screen. A separate settings screen is out of scope; repository configuration and secrets remain backend/environment configuration.

### 5.2 Daily Summary screen

**Purpose:** Generate and review the latest report.

**Header and controls**

- Display the product name and the currently configured repository name.
- Provide a primary `Generate summary` button.
- Display the last successful generation timestamp when available.
- Disable the button while generation is in progress and prevent duplicate submissions.
- Show the active reporting window as `last 24 hours` and the resolved branch.

**Report overview**

- Display repository, branch, window start/end, generation time, total commits, and contributing authors.
- Display a compact totals row for total files touched, lines added, and lines removed when those totals are available.
- Provide a clear link or control to the generated Markdown report path when the backend returns one.

**Author summary list**

- Render authors in backend-provided score-descending order; the client MUST NOT reorder by display name.
- Each author card or row MUST show name, email, activity badge, score, commit count, files touched, additions, and deletions.
- Show the AI/fallback summary prominently beneath the metrics.
- Show a visible fallback or warning indicator when `summary.source` is `fallback` or `summary.status` is unavailable.
- Allow the user to expand an author to inspect commit evidence.

**Commit evidence expansion**

- Each commit item MUST show short hash, local timestamp, subject, file count, additions, and deletions.
- The full commit body and changed-file list MAY be collapsed by default.
- Commit hashes SHOULD link to a local or configured repository viewer only when a safe URL is available; the UI MUST not fabricate remote links.
- Long file lists MUST remain readable through wrapping, truncation with an accessible expand action, or a scrollable region.

### 5.3 Loading state

When a report is being generated:

- Keep the page shell visible.
- Show a progress indicator and text such as `Collecting commits and generating summary...`.
- Disable generation controls.
- Do not replace an existing successful report until the new request succeeds.
- If generation completes with warnings, transition to the partial-success state rather than a generic success state.

### 5.4 Empty/no-data state

When the API returns `no_data`:

- Display `No commits in the last 24 hours - report not generated.`
- Show the evaluated repository, branch, and time window.
- Keep `Generate summary` available.
- Do not render empty author cards, zero-valued activity labels, or a misleading report timestamp.

### 5.5 Partial-success and warning state

When the report succeeds but one or more AI summaries fail:

- Render the complete report and source evidence.
- Show a non-blocking warning banner stating that some summaries use fallback text.
- Identify affected authors at their summary locations.
- Never display provider stack traces, tokens, or raw request payloads.

### 5.6 Error state

For invalid repository, unavailable Git, database failure, or other non-success errors:

- Show a clear human-readable explanation and a retry action.
- Preserve the previous successful report, if one exists, with an indication that it is not the result of the failed request.
- Distinguish configuration errors from temporary service failures when the API supplies an error code.
- Do not expose stack traces, filesystem secrets, database credentials, or provider credentials.

### 5.7 Responsive and accessibility requirements

- The screen MUST work at desktop and tablet widths; author metrics MAY stack on narrow screens.
- All controls MUST be keyboard accessible with visible focus states.
- Activity badges MUST use text in addition to color; Low/Medium/High cannot be color-only.
- Status and warning changes MUST be announced to assistive technology through an appropriate live region.
- Expand/collapse controls MUST expose their state and relationship to the controlled content.
- Tables or lists MUST have usable headings/labels, and timestamps MUST have machine-readable full values with human-readable display text.
- Text, controls, and warnings MUST meet the project accessibility contrast standard.

### 5.8 UI acceptance scenarios

```gherkin
Scenario: Generate from the primary screen
  Given the Daily Summary screen is loaded
  When the project manager selects Generate summary
  Then the button is disabled
  And progress feedback is visible
  And the previous report remains visible until the request completes

Scenario: Review an author
  Given a successful report is displayed
  When the project manager expands an author
  Then the author's summary and metrics remain visible
  And the author's commits are shown newest first
  And each commit exposes its source evidence

Scenario: Recover from an API error
  Given the generate request fails
  When the error state is displayed
  Then the UI shows a safe explanation and retry action
  And an existing report is not silently replaced
```

## 6. Error and Edge-Case Requirements

| Condition | Required behavior |
|---|---|
| Not a Git repository | Clear backend error, non-success response, no report |
| Git executable unavailable | Clear backend error, non-success response, no report |
| No commits in window | Successful `no_data`, no empty report |
| Missing/invalid AI token | Warning plus fallback summaries |
| AI failure for one author | Per-author fallback; continue other authors |
| Empty or malformed Git output | Validation error; do not persist unverifiable data |
| Database unavailable | Clear server error; do not claim report persistence |
| Unsafe path or request input | Reject at the boundary and log a safe diagnostic |
| Oversized diff | Use file names and diff statistics instead of full diff |

## 7. Non-Functional Requirements

- **NFR-001 Security:** Secrets MUST be environment-only; `.env` MUST be ignored; no token or sensitive prompt data may be logged.
- **NFR-002 Safety:** Git invocations MUST avoid shell interpolation and command injection.
- **NFR-003 Reliability:** An AI provider outage MUST degrade to deterministic fallback output.
- **NFR-004 Auditability:** Every displayed aggregate MUST be traceable to persisted source evidence.
- **NFR-005 Reproducibility:** PostgreSQL 15 MUST run through Docker Compose with documented readiness behavior.
- **NFR-006 Maintainability:** React 18/Vite frontend, Node 22/Express 4 backend, and persistence code MUST follow the folder and naming conventions in the constitution.
- **NFR-007 Usability:** A user MUST be able to request and understand a report without command-line interaction.
- **NFR-008 Performance:** The UI MUST show request progress, and the backend MUST enforce a configurable diff/prompt size limit.
- **NFR-009 Observability:** Backend logs MUST identify request, collection, AI, and persistence failures without secrets.

## 8. Scope Boundaries

### In scope

- One local repository and current/default branch.
- Manual on-demand generation.
- Rolling 24-hour collection.
- React report UI and Express API.
- PostgreSQL persistence.
- Markdown report generation.
- GitHub Models summaries with bounded input and deterministic fallback.

### Out of scope

- Multiple repositories or branch comparison.
- GitHub/GitLab/Azure DevOps remote history APIs.
- Scheduled jobs, notifications, exports other than Markdown.
- User authentication and multi-tenant access control unless added by a future specification.
- Billing, time tracking, effort estimation, or performance ranking.

## 9. Assumptions and Decisions Needed

- The configured repository path is available to the backend process and points to the one intended local repository.
- Git author identity is used as recorded; no roster mapping is required.
- The exact GitHub Models endpoint, model, and finalized environment variable name MUST be confirmed in the implementation plan.
- The report duplicate/idempotency policy MUST be confirmed before database migrations are finalized.
- The version-control policy for generated `reports/` output MUST be confirmed before release.

## 10. Acceptance Checklist

- [ ] A valid current-branch repository produces a persisted report for only the last 24 hours.
- [ ] No recent commits produce no report and a clear no-data result.
- [ ] Commit evidence includes hashes, author data, timestamps, messages, files, additions, and deletions.
- [ ] Author ordering and score thresholds match the documented formula.
- [ ] AI input is bounded and unsupported claims are prohibited.
- [ ] AI failures produce per-author fallback text without aborting the report.
- [ ] Secrets are excluded from source, logs, responses, and generated reports.
- [ ] Frontend loading, empty, warning, success, and error states are covered.
- [ ] PostgreSQL 15 starts through Docker Compose and schema migrations are repeatable.
- [ ] Targeted tests cover collection, scoring, report formatting, API contracts, persistence, and fallback behavior.

## 11. Open Questions

1. What exact GitHub Models endpoint and model should be used?
2. Should generated Markdown reports be committed or ignored?
3. What maximum diff/prompt size should trigger stat-only AI input?
4. Should repeated requests for the same window reuse an existing report or create a new generation record?
5. Is authentication required before the first production deployment?
