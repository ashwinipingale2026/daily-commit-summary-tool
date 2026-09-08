# Daily Commit Summary Tool - MVP Implementation Plan

**Plan status:** Draft
**Plan version:** 1.1.0
**Date:** 2026-09-09
**Source specification:** [`specification.md`](./specification.md)
**Governing constitution:** [`constitution.md`](./constitution.md)

## 1. Delivery Strategy

The MVP will be delivered in four phases:

1. **Backend setup:** establish PostgreSQL, migrations, configuration, and API contracts.
2. **Frontend setup:** establish the React application shell, routing, and UI states.
3. **Feature implementation:** deliver the report workflow one feature at a time.
4. **Integration and testing:** validate the complete local workflow and release readiness.

Each phase has a milestone and exit criteria. Work must remain within the MVP boundaries defined in [`specification.md`](./specification.md).

## 2. MVP Scope

### Included

- One server-configured local repository from `REPOSITORY_PATH`.
- Checked-out `HEAD`; detached `HEAD` is rejected.
- Rolling 24-hour window filtered by committer timestamp.
- UTC storage and display.
- Deterministic author aggregation and activity scoring.
- PostgreSQL 15 persistence through Docker Compose.
- Express API:
  - `GET /health`
  - `POST /api/reports/generate`
  - `GET /api/reports/latest`
  - `GET /api/reports/:id/markdown`
- React daily summary screen with loading, empty, success, partial-success, and error states.
- Optional AI summaries with deterministic fallback text.
- Downloadable Markdown projection.

### Out of scope for MVP

Python CLI support, multiple repositories, remote/default-branch discovery, configurable timezones, advanced Git edge-case semantics, report deduplication, distributed locks, job queues, server-side pagination, mobile optimization, public deployment, authentication, automated retention/backups, production orchestration, and full browser E2E coverage.

## 3. Architecture and Folder Ownership

```text
apps/
|-- frontend/
|   `-- src/
|       |-- components/       # Reusable report and status components
|       |-- pages/            # Daily Summary page composition
|       |-- services/         # Typed API client
|       `-- types/            # API and UI models
|-- backend/
|   `-- src/
|       |-- config/           # Environment parsing and validation
|       |-- controllers/      # HTTP request/response coordination
|       |-- routes/           # Express route declarations
|       |-- services/
|       |   |-- git/          # Repository validation and snapshot collection
|       |   |-- scoring/      # Metrics, formula, thresholds, ordering
|       |   |-- ai/           # Provider adapter and fallback behavior
|       |   `-- reports/      # Orchestration and Markdown projection
|       |-- database/         # Connection, repositories, migrations
|       `-- types/            # Domain and API contracts
`-- docker-compose.yml        # PostgreSQL 15 local service
```

The backend service layer must not depend on Express request/response objects. The frontend must not connect directly to PostgreSQL. The API contract is the boundary between frontend and backend.

## 4. Phase 1 - Backend Setup

**Goal:** Establish a runnable backend with PostgreSQL persistence and stable API skeletons.

### 1.1 Environment and database foundation

- Confirm Node.js 22.x, Express 4.x, TypeScript, and package-manager lockfile conventions.
- Complete backend package scripts and startup entrypoint.
- Add validated configuration for:
  - `REPOSITORY_PATH`
  - `DATABASE_URL`
  - optional `GITHUB_TOKEN`
  - conditional `GITHUB_MODELS_ENDPOINT`
  - conditional `GITHUB_MODELS_MODEL`
  - `PORT`
  - `FRONTEND_ORIGIN`
  - `REPORT_TIMEZONE=UTC`
  - `DIFF_SIZE_LIMIT`
- Add `.env.example` with placeholders only and ensure `.env` is ignored.
- Add Docker Compose PostgreSQL 15 service with named volume and healthcheck.
- Add safe startup validation for required configuration and repository path.
- Add database connection and graceful shutdown handling.

### 1.2 Schema and persistence skeleton

- Create versioned migrations for:
  - `reports`;
  - `author_summaries`;
  - `commit_evidence`;
  - `report_warnings`.
- Add UUID keys, foreign keys, checks, cascading child deletion, and required indexes.
- Enforce `UNIQUE(report_id, commit_hash)`.
- Enforce author uniqueness on `(report_id, author_name, author_email)`.
- Persist `scoring_config`, timestamps, binary flags, and per-file JSON statistics.
- Implement parameterized database repositories.
- Implement transactional report insertion and latest-report retrieval.

### 1.3 API skeleton

- Add `GET /health` with a safe process-health response.
- Add route/controller/service boundaries for:
  - `POST /api/reports/generate`;
  - `GET /api/reports/latest`;
  - `GET /api/reports/:id/markdown`.
- Define typed success, `no_data`, `partial_success`, and error envelopes.
- Implement the error shape:
  - `status`;
  - `code`;
  - `message`;
  - `retryable`;
  - `requestId`.
- Add request ID generation/propagation, safe JSON logging, and local CORS.
- Return explicit placeholder responses until feature services are connected.

### Milestone M1 - Backend foundation

- PostgreSQL starts successfully through Docker Compose.
- Migrations apply to a clean database.
- Backend starts with validated configuration.
- All required routes respond with documented placeholder or health responses.
- No secrets, repository paths, or database credentials are exposed in logs or health responses.

### Exit criteria

- Configuration unit tests cover missing values, invalid paths, and optional AI settings.
- Migration tests verify foreign keys, uniqueness, checks, indexes, and rollback.
- API contract tests verify route paths and error envelope shape.

## 5. Phase 2 - Frontend Setup

**Goal:** Establish the React/Vite application shell, routing, typed API client, and UI skeleton.

### 2.1 Application foundation

- Confirm React 18.x and Vite 5.x conventions.
- Complete frontend package scripts and development entrypoint.
- Create the application shell and primary Daily Summary route.
- Add a route boundary suitable for future screens without adding out-of-scope settings screens.
- Add typed frontend models matching the backend API projection.
- Add a typed API service for latest report, generation, and Markdown download.

### 2.2 UI skeleton

- Create the Daily Summary screen layout:
  - product/repository header;
  - report controls;
  - metadata and totals;
  - warning/notice region;
  - author summary list;
  - empty/error/loading regions.
- Add reusable components for:
  - report header;
  - totals;
  - author card;
  - activity badge;
  - commit evidence;
  - status and error messages.
- Add initial loading and route-level error boundaries.
- Add accessible names, keyboard focus states, live regions, and text labels for activity levels.
- Keep the frontend independent of PostgreSQL and server filesystem paths.

### Milestone M2 - Frontend shell

- The Daily Summary route loads successfully.
- The UI renders representative typed mock data.
- Loading, empty, error, and success skeletons are visible and accessible.
- API calls are isolated in the frontend service layer.

### Exit criteria

- Frontend component tests cover route rendering and primary UI states.
- Type-checking passes against the API models.
- The Generate button and Markdown download control have defined disabled/loading behavior.

## 6. Phase 3 - Feature Implementation

**Goal:** Implement the report workflow incrementally, integrating one feature at a time.

### 3.1 Feature A - Git collection

- Resolve `HEAD` once at generation start.
- Reject detached `HEAD` with a typed 422 error.
- Resolve repository name and branch.
- Calculate `window_end` at request start and `window_start = window_end - 24 hours`.
- Collect commits reachable from the captured `HEAD` using committer timestamps.
- Use safe argument-array process execution; never interpolate repository-derived values into shell commands.
- Parse hashes, author/committer metadata, timestamps, subject/body, file stats, additions, and deletions.
- Represent binary/unavailable line counts as zero with `binary=true`.
- Reject malformed or incomplete evidence.
- Return `no_data` without creating a report when no commits match.

**Milestone M3:** A fixture repository produces a validated, deterministic commit snapshot.

### 3.2 Feature B - Scoring and aggregation

- Group by exact author name and email.
- Calculate commits, unique files touched, additions, removals, and:

  `score = (commits * 3) + files_touched + ((lines_added + lines_removed) * 0.1)`

- Apply Low `< 10`, Medium `>= 10 and < 30`, and High `>= 30`.
- Store formula version, weights, and thresholds in `scoring_config`.
- Order authors by score descending, name ascending, then email ascending.
- Order commits newest first with full hash as a tie-breaker.

**Milestone M4:** Fixed evidence always produces identical metrics, scores, labels, and ordering.

### 3.3 Feature C - Report persistence and retrieval

- Persist reports, author summaries, commit evidence, and warnings in one transaction.
- Validate stored count snapshots against child rows before commit.
- Roll back all report data on persistence failure.
- Add latest-report retrieval ordered by `generated_at DESC`.
- Map persistence entities to the stable API projection.

**Milestone M5:** A completed report can be stored and retrieved with nested evidence and warnings.

### 3.4 Feature D - Report generation API

- Implement the orchestration sequence:
  1. reject concurrent generation with HTTP 409;
  2. collect the fixed Git snapshot;
  3. return `no_data` without persistence when appropriate;
  4. aggregate and score;
  5. obtain AI or fallback summaries;
  6. persist the report transaction;
  7. render Markdown;
  8. write Markdown after commit;
  9. record a safe warning if Markdown writing fails.
- Map required statuses: 400, 404, 409, 422, 503, and 500.
- Ensure the latest endpoint returns the newest completed report for the configured repository and branch.

**Milestone M6:** A valid generation request returns a persisted report through the API.

### 3.5 Feature E - Optional AI summaries

- Add an AI provider adapter behind the service boundary.
- Enable AI only when required configuration is present.
- Treat commit content as untrusted data in bounded prompts.
- Enforce `DIFF_SIZE_LIMIT`.
- Apply a 15-second timeout and one retry for transient 429/5xx responses.
- Validate output as non-empty plain text with 1-4 sentences.
- Use deterministic fallback text for missing credentials, invalid output, timeout, authorization, rate-limit, and provider failures.
- Record safe per-author warning codes.
- Ensure one author failure does not abort the report.

**Milestone M7:** AI success and all fallback paths produce usable summaries without making AI mandatory.

### 3.6 Feature F - Markdown projection and download

- Implement the canonical Markdown template.
- Include report metadata, totals, author summaries, evidence, and warnings.
- Escape repository-derived text at the rendering boundary.
- Add Markdown snapshot fixtures.
- Serve Markdown through a download response; never expose a server filesystem path.

**Milestone M8:** Every persisted report has a deterministic downloadable Markdown projection.

### 3.7 Feature G - React report experience

- Connect the Daily Summary screen to `GET /api/reports/latest`.
- Connect Generate to `POST /api/reports/generate`.
- Preserve the previous report while a new generation is running.
- Render API-provided author order without client-side reordering.
- Render metrics, activity badges, summaries, fallback indicators, warnings, and expandable commit evidence.
- Add no-data, partial-success, and recoverable error behavior.
- Connect the download control to the Markdown endpoint.

**Milestone M9:** A project manager can load, generate, inspect, and download a report from the browser.

### Feature exit criteria

- Each feature has targeted unit or integration tests before the next feature begins.
- Backend and frontend contracts remain synchronized.
- Error behavior is surfaced to the user rather than silently ignored.
- No feature introduces deferred MVP scope.

## 7. Phase 4 - Integration and Testing

**Goal:** Validate the complete local workflow and prepare the MVP release candidate.

### 4.1 Automated validation

- Run formatting, linting, and type-checking commands already defined by the project.
- Run backend unit tests for configuration, Git parsing, scoring, AI fallback, Markdown, and errors.
- Run database integration tests against PostgreSQL 15.
- Run API integration tests for every required status and response envelope.
- Run frontend component and accessibility tests.
- Verify no N+1 retrieval queries are introduced.

### 4.2 End-to-end local workflow

Against a fixture/local repository, verify:

- recent commits from multiple authors;
- no commits in the rolling window;
- detached `HEAD`;
- invalid repository path;
- missing AI token;
- provider success and provider failure;
- binary file changes;
- Markdown write failure;
- concurrent generation;
- database unavailability;
- latest report retrieval;
- browser report generation and Markdown download.

### 4.3 Security and reliability review

- Verify localhost binding and configured local CORS.
- Review logs for tokens, raw provider responses, prompt content, and sensitive paths.
- Confirm Git commands use argument arrays.
- Confirm commit-derived text is escaped in Markdown and UI rendering.
- Confirm failed persistence leaves no partial report rows.
- Confirm startup and shutdown behavior is clean.

### 4.4 Documentation and release readiness

- Update README with prerequisites, environment setup, Docker startup, migrations, frontend/backend start commands, and troubleshooting.
- Document the MVP configuration and known out-of-scope capabilities.
- Verify a clean-machine setup reproduces the workflow.
- Confirm only intended files are included and no secrets are present.
- Check every MVP acceptance item in `specification.md`.

### Milestone M10 - MVP release candidate

- Docker startup through browser report generation and Markdown download passes.
- All MVP acceptance criteria pass.
- Deferred capabilities are not presented as supported behavior.
- The local setup is reproducible from the documented instructions.

### Exit criteria

- Formatting, linting, type-checking, and targeted tests pass.
- Integration failures are fixed or explicitly documented as blockers.
- The implementation remains consistent with the constitution and specification.

## 8. Cross-Phase Dependencies

| Dependency | Required before |
|---|---|
| Backend configuration and Docker foundation | Database tests and frontend API integration |
| Database schema and API types | Frontend service and UI integration |
| Git collection | Scoring and report persistence |
| Scoring model | Author metrics in persistence and UI |
| Persistence | Latest-report and generation endpoints |
| AI adapter contract | Partial-success summaries and warning UI |
| Markdown projection | Download endpoint and final acceptance |
| Frontend shell and API client | Browser workflow validation |

## 9. Definition of Done

A task or phase is complete only when:

- Its behavior is implemented within the specified module boundary.
- Success and failure paths have targeted tests.
- API, database, and UI contracts remain consistent.
- No secrets or unsafe repository-derived shell arguments are introduced.
- Documentation and configuration examples are updated when behavior changes.
- Formatting, linting, type-checking, and relevant tests pass.
- The implementation remains within MVP scope or has an explicit specification change.
