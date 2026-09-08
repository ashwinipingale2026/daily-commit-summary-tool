# Daily Commit Summary Tool - MVP Task Breakdown

**Task plan version:** 1.0.0
**Source plan:** [`plan.md`](./plan.md)
**Source specification:** [`specification.md`](./specification.md)

Tasks are ordered by dependency. A task is complete only when all acceptance criteria pass.

## Phase 1 - Backend Setup

### TASK-001 - Bootstrap the backend workspace

**Description:** Create the Node.js 22/Express 4 backend application structure, package scripts, TypeScript configuration, entrypoint, and module boundaries described in the implementation plan.

**Acceptance criteria:**

- The backend has separate configuration, routes, controllers, services, database, and types areas.
- Development, build, start, type-check, and test scripts are defined using the project's package-manager conventions.
- The application starts through the documented backend command.
- Service modules do not import Express request/response objects.

**Dependencies:** None.

### TASK-002 - Add validated environment configuration

**Description:** Implement server-side configuration loading and validation for repository, database, frontend, port, timezone, diff-limit, and optional AI settings.

**Acceptance criteria:**

- `REPOSITORY_PATH`, `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`, `REPORT_TIMEZONE`, and `DIFF_SIZE_LIMIT` have documented defaults or required-value behavior.
- `REPORT_TIMEZONE` is fixed to UTC for MVP.
- AI endpoint/model settings are required only when AI is enabled.
- Missing or invalid required values produce a clear startup error.
- Secrets and repository paths are never printed in error messages or logs.
- `.env.example` contains placeholders only and `.env` is ignored.

**Dependencies:** TASK-001.

### TASK-003 - Provision PostgreSQL with Docker Compose

**Description:** Add the PostgreSQL 15 Docker service, named volume, healthcheck, and local connection settings.

**Acceptance criteria:**

- PostgreSQL 15 starts with the documented Docker Compose command.
- The service uses a named persistent volume.
- The healthcheck reports readiness.
- The connection string used by the backend is documented.
- Credentials are supplied through environment configuration rather than committed source.

**Dependencies:** TASK-002.

### TASK-004 - Create the database schema and migrations

**Description:** Create versioned migrations for `reports`, `author_summaries`, `commit_evidence`, and `report_warnings`.

**Acceptance criteria:**

- Migrations apply successfully to a clean PostgreSQL 15 database.
- UUID primary keys, required timestamps, foreign keys, checks, and cascading child deletion are defined.
- `UNIQUE(report_id, commit_hash)` is enforced.
- `(report_id, author_name, author_email)` uniqueness is enforced.
- Required indexes support latest-report, author-score, and commit-evidence retrieval.
- `scoring_config`, binary flags, timestamps, and per-file JSON statistics are persisted.
- Migrations can be rolled back or fail without leaving a partial schema.

**Dependencies:** TASK-003.

### TASK-005 - Implement database repositories and transactions

**Description:** Implement parameterized data-access modules for transactional report persistence and latest-report retrieval.

**Acceptance criteria:**

- Report, author summaries, evidence, and warnings are inserted in one transaction.
- Persistence failure rolls back all report rows.
- No-data results create no `reports` row.
- Latest reports are ordered by `generated_at DESC`.
- Retrieval maps persistence records to a stable domain/API model.
- Queries do not require N+1 database calls for one report.

**Dependencies:** TASK-004.

### TASK-006 - Define backend API contracts and error handling

**Description:** Define typed response models, route boundaries, request IDs, CORS, logging, and the standard error envelope.

**Acceptance criteria:**

- Routes exist for `GET /health`, `POST /api/reports/generate`, `GET /api/reports/latest`, and `GET /api/reports/:id/markdown`.
- Success, `no_data`, `partial_success`, and error response types are documented in code.
- Errors use `{ status, code, message, retryable, requestId }`.
- Request IDs are generated or propagated and included in responses and safe logs.
- Local CORS allows only the configured frontend origin.
- Health responses do not expose credentials, database details, or sensitive paths.

**Dependencies:** TASK-001, TASK-002, TASK-005.

## Phase 2 - Frontend Setup

### TASK-007 - Bootstrap the React/Vite frontend

**Description:** Create the React 18/Vite 5 frontend application shell, scripts, TypeScript configuration, and primary route.

**Acceptance criteria:**

- The frontend starts with the documented development command.
- The application shell renders successfully.
- A primary Daily Summary route is registered.
- The route structure allows future screens without adding an out-of-scope settings screen.
- Frontend code does not connect directly to PostgreSQL or access server filesystem paths.

**Dependencies:** TASK-001.

### TASK-008 - Define frontend models and API client

**Description:** Add typed frontend models for the API projection and a service layer for latest report, generation, and Markdown download.

**Acceptance criteria:**

- Models represent report metadata, totals, authors, summaries, commits, warnings, no-data, partial-success, and errors.
- The API client uses the configured backend origin.
- HTTP errors are converted into typed user-facing error data.
- Markdown download is initiated through the API endpoint.
- Components do not contain duplicated fetch or response-parsing logic.

**Dependencies:** TASK-006, TASK-007.

### TASK-009 - Build the Daily Summary UI skeleton

**Description:** Create the initial report screen layout and reusable components using representative typed mock data.

**Acceptance criteria:**

- The screen contains header, repository metadata, controls, totals, warning region, author list, and status regions.
- Reusable components exist for report header, totals, author card, activity badge, commit evidence, and status/error messages.
- Loading, empty, success, and error states are visually distinguishable.
- Components have accessible names, keyboard focus states, and appropriate live regions.
- Generate and download controls expose defined disabled/loading behavior.

**Dependencies:** TASK-007, TASK-008.

## Phase 3 - Feature Implementation

### TASK-010 - Implement Git repository snapshot collection

**Description:** Collect a deterministic snapshot from the configured repository and captured checked-out `HEAD` for the rolling UTC 24-hour window.

**Acceptance criteria:**

- `HEAD` is resolved once at generation start.
- Detached `HEAD` returns a typed invalid-state error.
- Repository name and branch are resolved.
- The window uses `window_end` captured at request start and a 24-hour `window_start`.
- Commits are filtered by committer timestamp and reachable from captured `HEAD`.
- Git commands use argument arrays and never interpolate repository-derived values into a shell command.
- Hashes, author/committer metadata, timestamps, subject/body, file statistics, additions, and deletions are parsed.
- Binary or unavailable line counts are zero with `binary=true`.
- Malformed evidence is rejected.
- No matching commits produces a `no_data` result without persistence.

**Dependencies:** TASK-002, TASK-006.

### TASK-011 - Implement deterministic scoring and author aggregation

**Description:** Convert Git evidence into exact-author aggregates, activity levels, scores, and deterministic ordering.

**Acceptance criteria:**

- Authors are grouped by exact name and email.
- Metrics include commits, unique files touched, lines added, and lines removed.
- Score uses `(commits * 3) + files_touched + ((lines_added + lines_removed) * 0.1)`.
- Levels are Low `< 10`, Medium `>= 10 and < 30`, and High `>= 30`.
- Formula version, weights, and thresholds are included in `scoring_config`.
- Authors are ordered by score descending, name ascending, then email ascending.
- Commits are ordered newest first with full hash as a deterministic tie-breaker.

**Dependencies:** TASK-010.

### TASK-012 - Implement optional AI summaries and fallback behavior

**Description:** Add the AI provider adapter, bounded prompts, timeout/retry behavior, output validation, deterministic fallback summaries, and warning generation.

**Acceptance criteria:**

- AI is skipped cleanly when credentials or provider configuration are absent.
- Commit content is treated as untrusted data and input size is limited by `DIFF_SIZE_LIMIT`.
- Provider requests have a 15-second timeout and one retry for transient 429/5xx errors.
- Non-empty plain-text output of 1-4 sentences is accepted.
- Missing credentials, invalid output, timeout, authorization, rate-limit, and provider failures use fallback text.
- One author failure does not abort other authors or report persistence.
- Warnings do not contain tokens, raw provider responses, or prompt content.

**Dependencies:** TASK-002, TASK-010, TASK-011.

### TASK-013 - Implement report generation orchestration

**Description:** Connect collection, aggregation, summaries, persistence, concurrency protection, and report status handling into the generation service.

**Acceptance criteria:**

- Only one generation runs per backend process; concurrent requests receive HTTP 409.
- The service follows collection, no-data, aggregation, summary, persistence, and projection ordering.
- A no-data result does not persist a report.
- Completed and partial-success reports are persisted transactionally.
- Database and dependency failures map to the specified error codes/statuses.
- Markdown failure leaves the API report available and records a warning.

**Dependencies:** TASK-005, TASK-006, TASK-010, TASK-011, TASK-012.

### TASK-014 - Implement report API endpoints

**Description:** Connect the orchestration and persistence services to the generation, latest-report, health, and Markdown routes.

**Acceptance criteria:**

- `POST /api/reports/generate` returns the documented success, no-data, partial-success, and error shapes.
- `GET /api/reports/latest` returns the newest completed report or HTTP 404 when none exists.
- `GET /api/reports/:id/markdown` returns a downloadable Markdown response or HTTP 404.
- `GET /health` returns a safe process-health response.
- Required statuses 400, 404, 409, 422, 503, and 500 are mapped consistently.
- The API never returns a server filesystem path for Markdown.

**Dependencies:** TASK-006, TASK-013.

### TASK-015 - Implement deterministic Markdown projection

**Description:** Render persisted report data into the canonical Markdown format with safe escaping and warning sections.

**Acceptance criteria:**

- Markdown includes repository, branch, UTC window, generation time, totals, author summaries, commit evidence, and warnings.
- Author and commit ordering matches the API projection.
- Repository-derived text is escaped at the rendering boundary.
- Fallback summaries and warning states are represented clearly.
- Identical report data produces identical Markdown.
- Snapshot fixtures cover normal, fallback, partial-success, and warning output.

**Dependencies:** TASK-005, TASK-011, TASK-012.

### TASK-016 - Connect the frontend to the report workflow

**Description:** Replace mock data with API integration and implement the complete Daily Summary interaction.

**Acceptance criteria:**

- Initial load calls `GET /api/reports/latest`.
- Generate calls `POST /api/reports/generate`.
- The previous report remains visible while generation is running.
- Authors render in backend-provided order without client-side reordering.
- Metrics, activity badges, summaries, warnings, and expandable commit evidence render correctly.
- No-data, partial-success, and recoverable error states are displayed.
- Download invokes the Markdown endpoint.
- Commit-derived text is rendered as text, not unsanitized HTML.

**Dependencies:** TASK-008, TASK-009, TASK-014, TASK-015.

## Phase 4 - Integration and Testing

### TASK-017 - Add backend unit and database integration tests

**Description:** Test configuration, Git parsing, scoring, AI fallback, Markdown rendering, persistence constraints, rollback, and query behavior.

**Acceptance criteria:**

- Tests cover missing/invalid configuration and optional AI settings.
- Git tests cover multiple authors, empty bodies, binary files, renames, malformed output, no data, unavailable Git, and detached `HEAD`.
- Scoring tests cover threshold boundaries, duplicate paths, tie ordering, identity grouping, and rounding.
- AI tests cover success, missing token, 401, 429, 5xx, timeout, malformed output, oversized input, and author isolation.
- Database tests cover constraints, foreign keys, cascade behavior, rollback, latest ordering, and no-data non-persistence.
- Markdown snapshots cover escaping, ordering, fallback text, and warnings.

**Dependencies:** TASK-004, TASK-005, TASK-010, TASK-011, TASK-012, TASK-015.

### TASK-018 - Add API integration tests

**Description:** Verify route behavior, response contracts, status mappings, request IDs, concurrency handling, and dependency failures.

**Acceptance criteria:**

- Every required endpoint has success and failure coverage.
- Response envelopes match the documented types.
- 400, 404, 409, 422, 503, and 500 mappings are verified.
- Concurrent generation returns HTTP 409 without corrupting report state.
- Markdown write failure returns an available report with a warning.
- Logs and responses do not expose secrets or sensitive provider data.

**Dependencies:** TASK-006, TASK-013, TASK-014, TASK-017.

### TASK-019 - Add frontend component and accessibility tests

**Description:** Validate routing, API states, report rendering, interactions, keyboard behavior, and accessible announcements.

**Acceptance criteria:**

- Tests cover initial loading, success, no-data, partial-success, and error states.
- Generate button disables while a request is active and preserves the previous report.
- Author expansion and commit evidence are keyboard accessible.
- Activity levels have text labels in addition to visual styling.
- Live regions announce loading and errors appropriately.
- Download behavior is verified through the frontend API service.

**Dependencies:** TASK-009, TASK-016.

### TASK-020 - Execute the integrated local workflow

**Description:** Run the complete Docker-to-browser workflow against a fixture repository and verify all MVP scenarios.

**Acceptance criteria:**

- PostgreSQL starts and migrations apply from a clean environment.
- The browser can load the latest report, generate a report, inspect evidence, and download Markdown.
- Scenarios cover recent commits, multiple authors, no data, detached `HEAD`, invalid repository, missing AI token, provider failure, binary files, Markdown failure, concurrency, and database unavailability.
- Startup and graceful shutdown complete cleanly.
- Localhost binding and configured CORS behave as specified.

**Dependencies:** TASK-003, TASK-014, TASK-016, TASK-018, TASK-019.

### TASK-021 - Complete security, documentation, and release validation

**Description:** Perform the final security review, update local setup documentation, confirm MVP boundaries, and validate release readiness.

**Acceptance criteria:**

- Formatting, linting, type-checking, and targeted tests pass.
- Logs contain no tokens, raw provider responses, prompt content, or unnecessary sensitive paths.
- Git command execution remains argument-safe.
- Failed persistence leaves no partial report rows.
- README documents prerequisites, environment setup, Docker startup, migrations, application startup, and troubleshooting.
- MVP configuration and out-of-scope capabilities are documented.
- A clean-machine setup can reproduce the local workflow.
- All MVP acceptance items in `specification.md` are checked.
- No secrets or unrelated files are included.

**Dependencies:** TASK-017, TASK-018, TASK-019, TASK-020.

## Dependency Summary

```text
TASK-001
  |-- TASK-002
  |     `-- TASK-003
  |           `-- TASK-004
  |                 `-- TASK-005
  |-- TASK-006
  |-- TASK-007
        `-- TASK-008
              `-- TASK-009

TASK-002 + TASK-006 -> TASK-010
TASK-010 -> TASK-011 -> TASK-012
TASK-005 + TASK-006 + TASK-010 + TASK-011 + TASK-012 -> TASK-013
TASK-013 -> TASK-014
TASK-005 + TASK-011 + TASK-012 -> TASK-015
TASK-008 + TASK-009 + TASK-014 + TASK-015 -> TASK-016
TASK-004 + TASK-005 + TASK-010 + TASK-011 + TASK-012 + TASK-015 -> TASK-017
TASK-006 + TASK-013 + TASK-014 + TASK-017 -> TASK-018
TASK-009 + TASK-016 -> TASK-019
TASK-003 + TASK-014 + TASK-016 + TASK-018 + TASK-019 -> TASK-020
TASK-017 + TASK-018 + TASK-019 + TASK-020 -> TASK-021
```

