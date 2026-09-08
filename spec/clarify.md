# Specification Review - Gaps, Contradictions, and Clarifications

**Reviewed documents**

- [`constitution.md`](./constitution.md), version 1.1.0
- [`specification.md`](./specification.md), version 1.1.0

**Review date:** 2026-09-09

## Executive Summary

The specification provides a strong product intent, user workflow, data outline, and UI state model. It is not yet implementation-ready because several decisions are deferred to the implementation plan without defining the behavior that the implementation plan must preserve. The highest-risk areas are:

1. The web application scope is not reconciled with the original CLI-oriented product behavior.
2. Git branch, timestamp, timezone, diff, rename, binary-file, and merge-commit semantics are underspecified.
3. The proposed relational model contains a uniqueness rule that cannot be enforced from the listed columns.
4. API contracts, status codes, request parameters, configuration, and error codes are not defined.
5. AI privacy, prompt limits, provider behavior, and retry/timeout policy are incomplete.
6. Markdown-file persistence and PostgreSQL persistence can become inconsistent.

## Critical Contradictions and Blocking Decisions

### C-001 - Web application versus CLI ownership

**References:** Constitution lines 10-12, specification lines 16-18, 185-188; original project behavior is described as a CLI in the repository's earlier technical specification.

The constitution and current specification require React, Express, and PostgreSQL, while the original behavior is a Python command-line tool invoked with `python summarize_commits.py`. The current specification does not say whether:

- the CLI is being replaced by the web application;
- the CLI remains a supported client of the backend;
- both clients must generate identical reports; or
- the Python implementation is legacy and out of scope.

**Clarify:** Choose the supported product surfaces. If both CLI and web remain, define the shared service/API boundary and parity requirements. If the web app replaces the CLI, explicitly deprecate the CLI and update the scope, folder structure, and acceptance checklist.

### C-002 - "Current/default branch" is ambiguous

**References:** Constitution lines 10, 107, 125; specification lines 146-148.

`HEAD` can refer to a checked-out branch, a detached commit, or a repository whose configured default branch is not checked out. "Current branch," "default branch," and `HEAD` are used as if they were equivalent.

**Clarify:** Define whether collection uses:

- the checked-out branch containing `HEAD`;
- the repository's configured default branch, even when not checked out; or
- only `HEAD`, with detached-head behavior explicitly rejected or supported.

Define the displayed branch value for detached `HEAD`.

### C-003 - Author date versus committer date is unresolved

**References:** Specification lines 148-149, 265.

The window is described as using commit timestamps, but the required evidence field is specifically the author timestamp. Git's common `--since` behavior and commit traversal may use committer dates unless an explicit format and comparison are implemented.

**Clarify:** State whether the 24-hour filter uses author date or committer date. Define which timestamp is displayed and how amended/cherry-picked commits are treated.

### C-004 - Local timezone is not defined

**References:** Specification line 148 and lines 265, 312.

"Local timezone" could mean the backend host, Docker container, database session, browser, or project manager's timezone. DST boundaries can change the displayed window.

**Clarify:** Select the source timezone for filtering and display. Prefer storing UTC instants and defining a configured display timezone. Specify the behavior when the frontend and backend machines use different timezones.

### C-005 - Idempotency requirement is not actionable

**References:** Specification lines 181 and 228.

Idempotency is a MUST, but the proposed key includes `window_end`, which is the request timestamp. Two requests for the same logical 24-hour period will therefore normally have different keys. The spec also leaves reuse versus a new generation as an open question.

**Clarify:** Define the canonical window boundaries and whether a repeated request returns an existing report, creates a new generation, or creates a version. Define behavior when `HEAD` changes during generation.

### C-006 - Markdown output and database persistence can diverge

**References:** Constitution lines 175, 170; specification lines 177-181, 297, 367.

The database transaction and filesystem Markdown write cannot be atomic together. The spec does not define what happens if database persistence succeeds but file writing fails, or vice versa. The UI also receives a filesystem output path that may not be browser-accessible.

**Clarify:** Choose a source of truth and a consistency strategy. Define whether Markdown is generated before or after the DB transaction, how failed/partial output is repaired, and whether the UI uses a secure download endpoint instead of exposing a local path.

## Data Model Gaps and Contradictions

### D-001 - Commit uniqueness cannot be enforced as specified

**References:** Specification lines 260-261, 274.

`commit_evidence` does not list `report_id`, but the requirement says `commit_hash` must be unique within a report. A normal table constraint cannot enforce uniqueness across the parent relationship through `author_summary_id` alone.

**Clarify:** Add `report_id` to `commit_evidence` and enforce `UNIQUE(report_id, commit_hash)`, or define a database-level design that makes the parent-scoped uniqueness enforceable.

### D-002 - Report counts are denormalized without a consistency mechanism

**References:** Specification lines 219-220, 226-227.

`total_commits` and `contributing_authors` duplicate counts derived from child rows. The spec says they must equal child counts but does not say whether the application, a trigger, or a view enforces this.

**Clarify:** Define whether these are stored snapshots or calculated projections. If stored, require service-level transactional validation and reconciliation tests; if calculated, remove the duplicated columns or define a view.

### D-003 - Report status does not cover failed or in-progress generations

**References:** Specification lines 201-205 and 222.

A report is defined as an attempt, but `generation_status` only allows `completed` and `partial_success`. Failed and in-progress attempts are not represented, while the UI and API describe errors and loading states.

**Clarify:** Decide whether failed/in-progress attempts are persisted. If yes, add statuses and failure metadata. If no, redefine "report" as a successfully collected report and document that failed attempts are log-only.

### D-004 - Author identity and nullability rules are incomplete

**References:** Specification lines 202, 237-253.

The uniqueness key uses name and email, but nullability, whitespace, case sensitivity, Unicode normalization, and invalid Git identity values are unspecified. Exact identity preservation can conflict with normalization needed for uniqueness.

**Clarify:** Make name/email required or define fallback values. Specify whether comparisons are byte-exact, case-sensitive, trimmed, or normalized. Define how an empty Git email is represented.

### D-005 - File statistics are not defined for Git edge cases

**References:** Specification lines 149, 268-277.

The model assumes integer additions/deletions and a JSON file-stat shape but does not define binary files, renames, copies, submodules, deleted files, generated files, or Git's `-` numstat values.

**Clarify:** Define the per-file JSON schema and rules for:

- binary files with no line counts;
- rename/copy old and new paths;
- deleted and mode-only changes;
- submodule changes;
- merge commits and combined diffs;
- whether a rename counts as one or two touched files.

### D-006 - Aggregate "files touched" semantics are unclear

**References:** Specification lines 156, 162, 240, 320, 366.

The author metric is a unique file count, but the report-level totals are described as "total files touched." It is unclear whether report totals sum author counts or count unique paths across all authors. The same file changed by multiple commits/authors has different possible totals.

**Clarify:** Define per-author and report-level aggregation independently, including whether paths are normalized and whether renames are deduplicated.

### D-007 - Snapshot and reproducibility boundaries are incomplete

**References:** Specification lines 215, 228, 297.

Recording `head_commit_hash` does not guarantee reproducibility if the repository changes during collection or if Git configuration affects output. The spec does not say whether collection resolves the head once and uses that object for every command.

**Clarify:** Require one resolved commit/ref snapshot before collection and use it for all Git commands. Define behavior if the ref moves or the object disappears during execution.

### D-008 - Retention and sensitive source-data storage are deferred too late

**References:** Specification lines 268, 299; Constitution lines 134-139.

The database stores commit bodies, file paths, and possibly diffs-derived data, but retention, deletion, access control, and backup handling are not defined. "Before production deployment" is too late for schema and privacy decisions.

**Clarify:** Define retention duration, deletion process, backup treatment, and who may retrieve stored reports. Decide whether full commit bodies and file paths should be persisted indefinitely.

## API and Integration Gaps

### A-001 - Endpoint contracts are not implementable

**References:** Specification lines 185-188 and 303-330.

The spec does not define route names, HTTP methods, request payloads, query parameters, authentication, CORS, content types, pagination, maximum response size, or status codes. "Exact route names are finalized in the implementation plan" leaves the feature contract unstable.

**Clarify:** Define the initial API contract in this specification, including:

- `POST` generation request shape;
- `GET` latest-report request and no-report behavior;
- optional report ID/download endpoints;
- HTTP status for success, no-data, partial success, validation, Git, AI, and database failures;
- correlation/request ID behavior;
- authentication and browser CORS policy.

### A-002 - Error response shape is missing

**References:** Specification lines 186, 330, 414-419.

Only the success response is shown. The frontend must distinguish configuration errors from temporary failures, but no stable error code, message, details, or retryability fields are defined.

**Clarify:** Define a typed error envelope such as `status`, `code`, `message`, `retryable`, `requestId`, and safe details. Define which messages are user-facing and which remain server logs.

### A-003 - Latest-report behavior is undefined

**References:** Specification lines 185, 359, 417.

The UI displays the latest successful report, but the behavior when none exists, when the latest generation failed, or when multiple repositories/configurations exist is not specified.

**Clarify:** Define the selection order and response for no prior report. State whether "latest" means latest completed report for the configured repository and branch.

### A-004 - Repository configuration has no owner or input contract

**References:** Specification lines 146, 274; UI line 349.

The backend needs a repository path, but the specification does not say whether it comes from an environment variable, server config, startup argument, or API request. The UI has no settings screen and the path must be constrained.

**Clarify:** Define the configuration source, allowed path roots, startup validation, reload behavior, and safe display name. If the path is request-supplied, define authorization and traversal protection.

### A-005 - GitHub Models integration is materially underspecified

**References:** Specification lines 169-173, 505, 524-527.

Endpoint, model, SDK, request schema, response schema, timeout, retry policy, rate-limit behavior, token scope, maximum input/output tokens, and provider data-retention expectations are unresolved.

**Clarify:** Select the provider contract and define:

- model and endpoint;
- authentication header;
- timeout and retry limits;
- handling of 401, 429, 5xx, malformed output, and content-policy responses;
- maximum input/output size;
- whether prompts/diffs may leave the local environment;
- output validation and sentence-count fallback.

### A-006 - Prompt injection and untrusted commit content are not addressed

**References:** Constitution lines 105, 138; specification lines 170-173.

Commit messages and diffs are untrusted text. The spec prohibits invented details but does not define how instructions embedded in commit content are treated.

**Clarify:** Require a fixed system instruction that treats commit content as data, delimit untrusted input, prohibit tool/action execution from model output, validate plain-text output, and define whether suspicious content is redacted or merely passed as evidence.

### A-007 - AI summary status combinations are contradictory

**References:** Specification lines 245-248 and 321.

`summary_source` can be `fallback` while `summary_status` can be `available` or `unavailable`, but valid combinations are not defined. The UI checks both fields.

**Clarify:** Define a state matrix. For example: successful AI = `source=ai,status=available`; deterministic fallback = `source=fallback,status=available`; no attempt = `source=fallback,status=not_requested`; failure with fallback = `source=fallback,status=unavailable` or use one unambiguous status model.

## UI and UX Gaps

### U-001 - No screen-level data-fetch lifecycle is defined

**References:** Specification lines 349, 357-419.

The screen requirements describe generation but not initial page load, request cancellation, browser refresh, stale data, retry backoff, or navigation away during generation.

**Clarify:** Define initial `GET latest` behavior, cancellation/abort semantics, stale-report labeling, refresh behavior, and whether generation survives navigation.

### U-002 - Report size and rendering strategy are missing

**References:** Specification lines 377-382, 478.

A repository can have many commits, files, or very large messages. The spec allows scrolling but does not define pagination, virtualization, maximum rendered items, or truncation rules for commit bodies.

**Clarify:** Define maximum report size and whether evidence is paginated server-side or client-side. Ensure truncation never breaks auditability without an explicit "truncated" indicator.

### U-003 - Markdown rendering and download behavior are unclear

**References:** Specification lines 177-180, 367, 380, 423-429.

The report is Markdown-compatible, but the UI appears to render structured API data. It is unclear whether Markdown is rendered in the browser, displayed as escaped text, or downloaded only.

**Clarify:** Define the canonical rendering path, Markdown sanitization policy, download filename/content type, and whether raw Markdown is exposed to the browser.

### U-004 - Accessibility and browser support are incomplete

**References:** Constitution lines 157-160; specification lines 421-429.

"Project accessibility contrast standard" is not named, and browser support, mobile behavior, reduced-motion behavior, and keyboard order are unspecified.

**Clarify:** Name the target accessibility standard/version, supported browsers, minimum viewport, and reduced-motion behavior.

### U-005 - Activity score presentation lacks precision rules

**References:** Specification lines 162-165, 319, 372.

The stored score is numeric but display precision, rounding mode, and tie-breaking when scores are equal are not defined. Author names are only one tie-breaker, so identical names with different emails remain ambiguous.

**Clarify:** Define score precision/rounding and a complete deterministic order, such as score descending, normalized name ascending, email ascending, then author-summary ID.

## Security, Operations, and Delivery Gaps

### O-001 - Authentication is both absent and implied

**References:** Constitution line 126 says "protected data"; specification line 498 excludes authentication; specification lines 185-188 require a browser API.

The system may expose repository paths, commit bodies, and file names, but access control is explicitly out of scope while "protected data" suggests controls.

**Clarify:** Decide whether the first release is trusted local-only use. Define network binding, authentication expectations, CSRF/CORS protections, and whether the API may listen beyond localhost.

### O-002 - Health checks are required but not specified

**References:** Constitution line 149; specification lines 469-479.

Health checks are a constitutional requirement, but no liveness/readiness endpoints, dependency checks, response shape, or Docker healthcheck command is defined.

**Clarify:** Define `/health` and `/ready` semantics, whether readiness checks PostgreSQL/Git configuration, and how Docker Compose uses them.

### O-003 - Docker and migration tooling are not specified

**References:** Constitution lines 24-25, 166-169; specification lines 192, 475.

The required database version is stated, but the image, ports, volume, credentials, healthcheck, migration runner, startup ordering, and local reset workflow are missing.

**Clarify:** Define Docker Compose services, non-secret local defaults, healthcheck behavior, migration technology, and how schema migrations run in development/test/production.

### O-004 - Testing requirements lack measurable coverage

**References:** Constitution lines 145-150; specification lines 509-520.

The spec names test areas but does not define unit/integration/E2E boundaries, fixtures, required edge cases, minimum coverage, or CI commands.

**Clarify:** Define the test matrix for Git parsing, timestamps/timezones, binary/rename files, scoring boundaries, AI failures, transaction rollback, API envelopes, and each UI state. Define required checks and whether coverage thresholds apply.

### O-005 - Observability requirements are not operationally actionable

**References:** Constitution line 149; specification line 479.

"Structured logging" is required without a schema, levels, correlation IDs, redaction rules, metrics, or log retention.

**Clarify:** Define JSON log fields, request ID propagation, severity levels, sensitive-field redaction, metrics for generation duration/failures, and retention.

### O-006 - Configuration and secret naming are unresolved

**References:** Constitution lines 134-136; specification line 173 and open question 524.

The documents alternate between `GITHUB_TOKEN` and a "finalized project variable" and do not define database URL, repository path, diff limit, score thresholds, timezone, port, or frontend API URL.

**Clarify:** Define a complete environment-variable table with required/optional status, defaults, validation, and `.env.example` ownership. Choose one token variable name.

### O-007 - Dependency/version requirements are incomplete

**References:** Constitution lines 18-29; specification line 476.

React, Vite, Node, Express, and PostgreSQL major versions are defined, but TypeScript, database client/migration library, validation library, test runner, Markdown sanitizer, HTTP client, and package-manager versions are not.

**Clarify:** Define the supported package manager and lockfile policy, minimum TypeScript version, runtime compatibility, and approved libraries where security-sensitive behavior is involved.

### O-008 - Operational concurrency is undefined

**References:** Specification lines 181, 360, 391.

The UI prevents duplicate button submissions, but multiple browser tabs, concurrent API clients, and backend restarts can still trigger concurrent generation and conflicting writes.

**Clarify:** Define server-side locking/idempotency, whether only one generation may run at a time, queueing/rejection behavior, and how stale concurrent results are handled.

## Content and Requirement Quality Issues

### Q-001 - "Optional AI summary" conflicts with per-author AI requirements

**References:** Specification line 16 versus lines 169-173 and 245-248.

AI is called optional in the product description, but every author has an AI/fallback summary and missing-token behavior is mandatory. It is unclear whether users can disable AI, whether fallback-only mode is a supported configuration, and how status is represented.

**Clarify:** State whether AI is enabled by default, configurable, or always attempted when credentials exist. Define a deliberate fallback-only mode.

### Q-002 - "Plain-English summary of 2-4 sentences" is not validated

**References:** Specification lines 102-103, 171.

There is no output length, sentence-count parser, empty-output handling, language policy, or retry/repair behavior.

**Clarify:** Define validation and fallback when the provider returns zero, one, more than four sentences, Markdown, JSON, or unsupported claims.

### Q-003 - Exact Markdown report contract is absent

**References:** Specification lines 177-178; constitution lines 156-160.

The specification requires content but does not define headings, ordering of metadata, timestamp format, escaping rules, summary placement, or the fallback marker for generated Markdown.

**Clarify:** Include a canonical Markdown template or a snapshot fixture and define whether the UI and downloaded report must be byte-for-byte consistent.

### Q-004 - "Default thresholds, tunable via config" lacks change/version semantics

**References:** Specification lines 162-164 and data model line 243.

The report stores a score but not the formula version, weights, or thresholds used. A later configuration change can make historical labels impossible to reproduce.

**Clarify:** Store a scoring configuration/version snapshot per report, or explicitly define that historical reports are recalculated under current configuration.

### Q-005 - No explicit data validation rules at trust boundaries

**References:** Constitution lines 137; specification lines 150, 235-238.

The specification calls for validation but does not define maximum lengths or allowed characters for paths, branch names, commit messages, author fields, file paths, API bodies, or UUIDs.

**Clarify:** Define limits and rejection behavior for every external/configuration input, including resource limits to prevent oversized reports or prompt abuse.

## MVP Decisions

The following decisions answer the review findings for the minimum viable product. They are intentionally biased toward a small, local, auditable implementation.

### Product and Git behavior

| Finding | MVP decision |
|---|---|
| C-001 | The React/Express web application is the MVP product. The earlier Python CLI is legacy and **Out of scope of MVP**; CLI/report parity is deferred. |
| C-002 | Collect from the checked-out `HEAD`. The displayed branch is the checked-out branch name. A detached `HEAD` is rejected with a clear configuration error. Repository default-branch discovery is **Out of scope of MVP**. |
| C-003 | Use committer timestamp for the rolling-window filter because it matches Git traversal semantics. Store and display both author and committer timestamps. Cherry-pick/amend history is treated as Git supplies it. |
| C-004 | Store timestamps as UTC `timestamptz` and display UTC in the MVP. User-configurable timezones and DST-specific presentation are **Out of scope of MVP**. |
| C-005 | Each generate request creates a new completed report. The latest report is selected by `generated_at DESC`. Request deduplication, reusable report versions, and cross-process job idempotency are **Out of scope of MVP**. |
| C-006 | PostgreSQL is the source of truth. The database transaction commits first; Markdown is written afterward. If Markdown writing fails, the report remains retrievable through the API and receives a safe warning. Browser access uses a backend download endpoint, not a filesystem path. |

### Data model and Git evidence

| Finding | MVP decision |
|---|---|
| D-001 | Add `report_id` to `commit_evidence` and enforce `UNIQUE(report_id, commit_hash)`. |
| D-002 | Store counts as report snapshots and validate them against child rows in the same transaction. Database triggers are **Out of scope of MVP**. |
| D-003 | Persist only successful reports with status `completed` or `partial_success`. Failed/in-progress attempts are log-only and are **Out of scope of MVP** for persistence. |
| D-004 | Preserve Git name/email exactly as returned, except no surrounding whitespace normalization. Store empty email as an empty string. Use case-sensitive uniqueness within a report. |
| D-005 | Use Git numstat. Binary or unavailable line counts are stored as zero with a `binary` flag. A rename counts as one touched file using the new path. Detailed copy detection, submodule semantics, mode-only changes, and combined merge diffs are **Out of scope of MVP**. |
| D-006 | `files_touched` is the count of unique normalized paths per author. Report totals are the sum of author metrics and are labeled as aggregate author totals, not globally unique paths. |
| D-007 | Resolve and store `HEAD` once before collection; all Git commands use that commit. If the ref changes during collection, the captured snapshot remains authoritative. |
| D-008 | MVP is for trusted local use. Store source commit metadata needed for the report. Automated retention, deletion, backup policy, and multi-user access controls are **Out of scope of MVP**. |

### API, AI, and UI behavior

| Finding | MVP decision |
|---|---|
| A-001 | Use `POST /api/reports/generate`, `GET /api/reports/latest`, `GET /api/reports/:id/markdown`, and `GET /health`. Generation takes no body; repository configuration is server-side. |
| A-002 | Use `{ status, code, message, retryable, requestId }` for errors. Details are omitted from browser responses unless explicitly safe. HTTP status codes are 400 validation, 404 no report, 409 generation already running, 422 invalid Git/repository state, 503 dependency failure, and 500 unexpected failure. |
| A-003 | Latest means the most recent completed report for the configured repository and captured branch. No prior report returns 404 with code `REPORT_NOT_FOUND`. |
| A-004 | Repository path comes from `REPOSITORY_PATH`; it is validated at startup and is never accepted from the browser. The display name is the final directory name. |
| A-005 | AI is optional and disabled when `GITHUB_TOKEN` is absent. When enabled, the endpoint/model come from configuration, with a 15-second timeout and one retry for transient 429/5xx responses. Provider-specific model optimization is **Out of scope of MVP**. |
| A-006 | Commit text is untrusted data delimited in the prompt. The model receives no tools and its output is validated as plain text. Prompt-injection resistance beyond this boundary is **Out of scope of MVP**. |
| A-007 | Valid summary states are: AI success = `source=ai,status=available`; fallback due to disabled/failed AI = `source=fallback,status=available`; warning text explains the reason. `unavailable` and `not_requested` combinations are **Out of scope of MVP**. |
| U-001 | Initial load calls `GET /api/reports/latest`. Generation is not cancellable; refresh during generation is allowed and the previous report remains visible. |
| U-002 | MVP renders the complete report without pagination. Maximum commit/message/file limits are configured server-side; truncation is marked explicitly. Virtualization and server-side evidence pagination are **Out of scope of MVP**. |
| U-003 | The UI renders structured API data; Markdown is downloaded through the backend endpoint and is not rendered as HTML in the browser. |
| U-004 | Target WCAG 2.1 AA for the MVP. Desktop and tablet browsers are supported; mobile optimization and reduced-motion polish are **Out of scope of MVP**. |
| U-005 | Scores display rounded to two decimal places. Order is score descending, author name ascending, then email ascending. |

### Operations and delivery

| Finding | MVP decision |
|---|---|
| O-001 | Bind the backend to localhost for trusted local use. Authentication, public deployment, CSRF protection, and multi-user authorization are **Out of scope of MVP**. CORS allows only the configured local frontend origin. |
| O-002 | `/health` reports process health only. Database readiness checks and production monitoring are **Out of scope of MVP**. |
| O-003 | Use `postgres:15` in Docker Compose, a named local volume, a healthcheck, and versioned SQL migrations run by an npm script. Production orchestration and automated backup are **Out of scope of MVP**. |
| O-004 | Provide unit tests for scoring/parsing, integration tests for PostgreSQL/API/report generation, and frontend tests for the primary UI states. A numeric coverage threshold and full browser E2E suite are **Out of scope of MVP**. |
| O-005 | Use JSON logs with level, timestamp, request ID, event, and safe error code. Metrics, centralized log shipping, and log retention are **Out of scope of MVP**. |
| O-006 | Required configuration: `REPOSITORY_PATH`, `DATABASE_URL`, `GITHUB_TOKEN` (optional), `GITHUB_MODELS_ENDPOINT` (required only when AI is enabled), `GITHUB_MODELS_MODEL` (required only when AI is enabled), `PORT`, `FRONTEND_ORIGIN`, `REPORT_TIMEZONE=UTC`, and `DIFF_SIZE_LIMIT`. |
| O-007 | Use the repository package manager and lockfiles. TypeScript, HTTP client, validation library, migration runner, test runner, and sanitizer choices are implementation-plan decisions constrained by the constitution. |
| O-008 | Allow one generation at a time per backend process. A concurrent request receives 409. Distributed locking and job queues are **Out of scope of MVP**. |

### Content and quality

| Finding | MVP decision |
|---|---|
| Q-001 | AI is optional; deterministic fallback text is always supported and is the baseline behavior. There is no user-facing AI toggle in the MVP. |
| Q-002 | Accept provider output only when it is non-empty plain text with 1-4 sentences; otherwise use fallback text. Strict grammar validation is **Out of scope of MVP**. |
| Q-003 | The implementation plan must add a canonical Markdown fixture. The API/UI data is authoritative; downloaded Markdown is a deterministic projection. |
| Q-004 | Store the scoring formula version, weights, and thresholds on each report. Historical reports are never recalculated. |
| Q-005 | Apply fixed MVP limits: repository path 1,000 characters, branch 255, author name/email 320 each, commit subject 500, commit body 20,000, file path 1,000, and request body 10 KB. Requests exceeding limits fail validation. |

## Out of Scope of MVP Summary

The following are explicitly deferred: Python CLI support, multiple repositories, remote/default-branch discovery, configurable timezones, advanced Git edge-case interpretation, report deduplication/versioning, user authentication, public deployment, multi-user access control, retention/backup automation, distributed locks, job queues, server-side pagination, mobile optimization, full browser E2E coverage, provider-specific AI optimization, metrics/log shipping, and production orchestration.

## Next Step

The MVP decisions above are authoritative for implementation planning. Update `specification.md` to reflect them, then create the implementation plan and task breakdown. New scope or behavior requires a specification change rather than an implicit implementation choice.
