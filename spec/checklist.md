# Specification Compliance Checklist

**Specification reviewed:** [`specification.md`](./specification.md)  
**Review date:** 2026-09-09  
**Scope:** Current implementation in `apps/backend`, `apps/frontend`, Docker/PostgreSQL configuration, and existing automated tests.

## Status meanings

- **Yes / Verified:** Implemented and supported by code plus a passing test or direct verification.
- **Yes / Partial verification:** Implemented, but full live verification is blocked or only indirectly tested.
- **Partial:** Some behavior exists, but one or more stated requirements are missing.
- **No:** Not implemented.

## Executive summary

| Area | Implemented | Works/verified | Notes |
|---|---:|---:|---|
| Git collection and evidence | Yes | Yes | Unit tests cover metadata, windows, binary files, renames, no-data, invalid repositories, and detached `HEAD`. |
| Aggregation and scoring | Yes | Yes | Formula, thresholds, ordering, identity grouping, and rounding are tested. |
| Persistence and API projection | Yes | Partial | Repository tests pass, but the current local live database password mismatch prevents end-to-end verification. |
| AI summaries | Partial | Partial | Provider adapter and fallback path exist, but the specification names retired GitHub Models; current Gemini configuration previously returned an invalid-key error. Output validation and diff-limit behavior are incomplete. |
| Frontend workflow | Yes | Yes | Existing frontend tests cover loading, success, no-data, partial success, errors, keyboard evidence expansion, and download behavior. |
| Docker and migrations | Partial | Partial | PostgreSQL 15 starts with Compose; migration applies to a clean database but is not repeatable because it lacks `IF NOT EXISTS`/version tracking. |
| Security and resilience | Yes | Partial | Secrets are environment-based and errors are sanitized; live database/provider verification remains incomplete. |

### Implementation status

| Status | Count | Functionalities |
|---|---:|---|
| Fully implemented | 75 | - Git collection and evidence<br>- Author grouping, scoring, ordering, and metrics<br>- PostgreSQL schema and transactional persistence<br>- Report generation, API routes, error handling, and concurrency protection<br>- Daily Summary UI, evidence expansion, accessibility behavior, and downloads<br>- Environment validation, secret redaction, safe Git execution, and Docker health checks |
| Partially implemented | 18 | - AI integration and provider configuration **[good to have]**<br>- Bounded AI input and output validation **[good to have]**<br>- Configurable windows, weights, thresholds, and diff-size enforcement **[good to have]**<br>- Complete error mapping, warning relationships, accessibility verification, and edge-case coverage **[good to have]**<br>- Structured logging, localhost binding, and live database/AI verification **[good to have]** |
| Not implemented | 2 | - Date-based Markdown output path: `reports/commit_summary_<YYYY-MM-DD>.md` **[out of scope]**<br>- Repeatable/versioned PostgreSQL migrations with rollback support **[out of scope]** |
| **Total** | **95** | - All implementation requirements reviewed |

### Verification status

| Status | Count | Functionalities |
|---|---:|---|
| Verified working | 68 | - Git collection, scoring, ordering, and evidence projection<br>- No-data handling and AI fallback behavior<br>- Persistence unit tests and API routes<br>- Frontend loading, warning, error, retry, keyboard, and download workflows<br>- Concurrency protection, Markdown escaping, safe errors, and health responses |
| Partially verified | 22 | - Live PostgreSQL persistence and Docker-to-backend connectivity<br>- AI provider operation with the configured key<br>- Accessibility and responsive behavior<br>- Operational logging and database-unavailable handling<br>- Malformed input/output and other edge cases with incomplete tests |
| Not verified/failed | 6 | - Successful live AI-generated summaries **[gaps]**<br>- Oversized-diff enforcement **[gaps]**<br>- Date-based Markdown file output **[gaps]**<br>- Repeatable migration execution **[gaps]**<br>- Full live report generation against the current PostgreSQL volume **[gaps]**<br>- Complete provider-adapter behavior for authentication, rate limits, server errors, timeouts, and malformed responses **[gaps]** |
| **Total** | **95** | - All verification results reviewed |

## 1. User scenarios and product behavior

| Requirement | Implemented? | Works? | Evidence / finding |
|---|---|---|---|
| US-001: Generate a current daily summary | Yes | Yes | `git-collector.ts`, `report-generation.ts`, API integration tests, and report-generation tests. |
| US-002: Inspect source evidence | Yes | Yes | API projection, `AuthorCard`, `CommitEvidence`, and frontend tests. |
| US-003: Understand activity level | Yes | Yes | `scoring.ts`, scoring tests, and `ActivityBadge`. |
| US-004: AI success produces a concise evidence-based summary | Partial | Partial | Provider adapter requests 2-4 sentences and evidence-only content, but there is no provider adapter test and output is not validated for sentence count or plain-text safety. |
| US-004: AI failure is isolated per author | Yes | Yes | `report-generation.test.ts` verifies one author can fail while others persist. |
| US-005: No recent commits | Yes | Yes | Collector and generation tests plus frontend no-data coverage. |
| US-005: Invalid repository/configuration state | Yes | Yes | Configuration, Git collector, API error, and frontend retry tests. |
| US-005: Missing/invalid AI token falls back | Yes | Partial | Fallback is implemented and tested indirectly; the currently configured provider key was rejected during live verification. |

## 2. Functional requirements

| ID | Requirement | Implemented? | Works? | Evidence / finding |
|---|---|---:|---:|---|
| FR-001 | Operate on one configured local repository | Yes | Yes | `REPOSITORY_PATH` is required and validated at startup; browser does not submit it. |
| FR-002 | Use checked-out `HEAD`; reject detached `HEAD` | Yes | Yes | Collector test covers detached `HEAD`. |
| FR-003 | Rolling 24-hour committer window; UTC storage/display | Yes | Yes | Collector uses request-time window and committer timestamps; config enforces UTC. |
| FR-004 | Collect complete commit metadata and file statistics | Yes | Yes | Collector tests verify hashes, authors, timestamps, messages, files, additions, deletions. |
| FR-005 | Argument-safe Git commands and clear Git errors | Yes | Yes | Git commands use argument arrays; collector tests cover invalid repository and failure paths. |
| FR-006 | No-data creates no report or output file | Yes | Yes | Generation and repository tests cover no-data non-persistence. |
| FR-007 | Group by exact author name and email | Yes | Yes | Scoring tests cover exact identity grouping. |
| FR-008 | Calculate author totals and score | Yes | Yes | Scoring implementation and tests. |
| FR-009 | Order authors by score then name | Yes | Yes | Scoring implementation and ordering tests. |
| FR-010 | Order commits newest first | Yes | Yes | Scoring implementation and tests. |
| FR-010a | Include email tie-breaker and two-decimal scores | Yes | Yes | Scoring tests verify tie-breakers and rounding. |
| FR-011 | Use documented scoring formula | Yes | Yes | `DEFAULT_SCORING_CONFIG` and scoring tests. |
| FR-012 | Use Low/Medium/High thresholds | Yes | Yes | Threshold boundary tests pass. |
| FR-013 | Make window, weights, and thresholds configurable | Partial | No | `DIFF_SIZE_LIMIT` is configurable, but window size and scoring weights/thresholds are fixed in code rather than loaded configuration. |
| FR-014 | Expose raw metrics | Yes | Yes | API projection and UI totals/author metrics. |
| FR-014a | Persist scoring version, weights, thresholds | Yes | Yes | `scoring_config` is persisted and repository tests cover it. |
| FR-015 | Isolate AI access behind a summarizer service | Yes | Partial | `GitHubModelsSummary` exists and is wired, but it is provider-specific despite the retired GitHub Models name. |
| FR-016 | Send messages plus bounded diffs or file statistics | Partial | No | Commit messages and file statistics are sent; `DIFF_SIZE_LIMIT` is not used to choose bounded diffs/stat-only input. |
| FR-017 | Request 2-4 sentence evidence-only summary | Partial | Partial | Prompt requests this, but response validation does not enforce it. |
| FR-018 | Isolate AI failure and persist report | Yes | Yes | Generation catches per-author provider failures and persists fallback results. |
| FR-019 | Load token from environment and never expose it | Yes | Partial | Environment loading and sanitized errors exist; no dedicated provider secret-leak test exists. |
| FR-019a | Endpoint/model required; 15-second timeout and one transient retry | Yes | Yes | Configuration validation and adapter constants implement this behavior. |
| FR-019b | Treat commit content as untrusted and validate output | Partial | No | No tools are provided and input is bounded by character count, but output is only checked for non-empty string; 1-4 sentence/plain-text validation is missing. |
| FR-020 | Persist complete report and evidence | Yes | Partial | Schema/repository tests pass; live verification is blocked by the current database authentication mismatch. |
| FR-021 | Write `reports/commit_summary_<YYYY-MM-DD>.md` | No | No | Current Markdown download renders by report ID and does not implement the specified date-based output path. |
| FR-022 | Retain auditable PostgreSQL data | Yes | Partial | Schema and repository implementation exist; live database connection currently fails until credentials are synchronized. |
| FR-023 | Safely escape commit-derived text | Yes | Yes | Markdown escaping and React text rendering are implemented and tested. |
| FR-024 | New report per request; latest by generated time | Yes | Yes | Repository query orders by `generated_at DESC`; tests cover latest retrieval. |
| FR-025 | Expose all required API endpoints | Yes | Yes | `/health`, generate, latest, and Markdown routes exist; API tests cover them. |
| FR-026 | Distinguish success/no-data/partial/error | Yes | Yes | Typed API models, route handling, and API tests. |
| FR-027 | Provide generate, latest, loading, empty, warning, and error UI | Yes | Yes | `DailySummaryPage` and frontend tests. |
| FR-028 | Display metadata, ordering, labels, metrics, summaries, evidence | Yes | Yes | Frontend components and page tests. |
| FR-029 | No browser repository/config body; one generation at a time | Yes | Yes | Generate route ignores body; service lock and HTTP 409 test exist. |
| FR-030 | Stable error envelope and HTTP status mapping | Partial | Partial | Error envelope is implemented and 400/409/500/503 paths are tested. Explicit 422 invalid-Git-state mapping and complete 404/422 coverage are not fully demonstrated. |

## 3. Data model and persistence

| Requirement | Implemented? | Works? | Evidence / finding |
|---|---:|---:|---|
| Report-to-author-to-evidence relationships | Yes | Yes | Foreign keys and cascading deletes in migration; repository transaction tests. |
| Report metadata constraints | Yes | Yes | UUIDs, timestamps, positive counts, status checks, and window ordering are defined. |
| Author summary constraints | Yes | Yes | Identity uniqueness, metric checks, activity/source/status checks are defined. |
| Commit evidence constraints | Yes | Yes | Report/hash uniqueness, JSON file data, binary flag, and non-negative metrics are defined. |
| Warning records and safe messages | Yes | Yes | Warning table and safe warning projection exist. |
| Required indexes | Yes | Yes | Four documented indexes exist in the migration. |
| One-query nested retrieval/no N+1 | Yes | Yes | Repository query builds nested JSON; repository test verifies one query. |
| Transactional persistence and rollback | Yes | Yes | Repository rollback test passes. |
| No-data non-persistence | Yes | Yes | Repository and generation tests pass. |
| Repeatable PostgreSQL migration | No | No | Migration uses plain `CREATE TABLE`/`CREATE INDEX` and rerunning it produces “relation already exists”; no migration version table or rollback exists. |

## 4. UI requirements

| Requirement | Implemented? | Works? | Evidence / finding |
|---|---:|---:|---|
| Focused Daily Summary screen without settings screen | Yes | Yes | Route and page implementation. |
| Product/repository header and generate control | Yes | Yes | `ReportHeader` and page tests. |
| Disable duplicate generation and show progress | Yes | Yes | Page state and frontend tests. |
| Show report metadata, totals, and download | Yes | Yes | `ReportHeader`, `Totals`, API client, and tests. |
| Preserve backend author ordering | Yes | Yes | Page maps authors without client sorting. |
| Show author metrics, score, badge, and summary | Yes | Yes | `AuthorCard` and tests. |
| Expand commit evidence with newest-first commits | Yes | Yes | `details/summary`, scoring order, and keyboard test. |
| Loading state preserves previous report | Yes | Yes | Frontend test covers this scenario. |
| No-data state is clear and non-misleading | Yes | Yes | Page and frontend test. |
| Partial-success warning identifies affected authors | Partial | Partial | Global warning banner and author warning text render, but current warning records use an author index rather than a persisted author-summary foreign key. |
| Error state preserves previous report and offers retry | Yes | Yes | Page state and frontend tests. |
| Keyboard, live regions, labels, timestamps, contrast | Partial | Partial | Keyboard/live-region/text-label coverage exists. Full WCAG 2.1 AA contrast and responsive browser verification are not automated. |

## 5. Error and edge cases

| Condition | Implemented? | Works? | Evidence / finding |
|---|---:|---:|---|
| Not a Git repository | Yes | Yes | Collector and frontend/API tests. |
| Git executable unavailable | Partial | Partial | Errors are surfaced through the collector boundary, but no dedicated executable-unavailable test is present. |
| No commits | Yes | Yes | No-data tests. |
| Missing/invalid AI token | Yes | Partial | Safe fallback exists; live configured-key verification failed. |
| One-author AI failure | Yes | Yes | Per-author isolation test. |
| Empty/malformed Git output | Partial | Partial | Collector validates several malformed states; complete malformed-output coverage is not present. |
| Database unavailable | Yes | Partial | Error mapping exists; current live database auth failure demonstrates non-success behavior, but a dedicated integration test is absent. |
| Unsafe path/request input | Partial | Partial | Server-side repository validation and argument-safe Git calls exist; no focused unsafe-input test is present. |
| Oversized diff | No | No | `DIFF_SIZE_LIMIT` is parsed but not applied to collection/prompt construction. |
| Detached `HEAD` | Yes | Yes | Collector test. |
| Concurrent generation | Yes | Yes | HTTP 409 and state-preservation test. |
| Markdown write failure | Yes | Yes | Generation test verifies persisted report plus warning. |

## 6. Non-functional requirements

| ID | Requirement | Implemented? | Works? | Evidence / finding |
|---|---|---:|---:|---|
| NFR-001 | Secrets environment-only and not logged | Yes | Partial | `.env` is ignored and errors are sanitized; provider secret-leak tests are missing. |
| NFR-002 | Argument-safe Git execution | Yes | Yes | Collector uses `execFile`-style argument arrays and tests pass. |
| NFR-003 | AI outage degrades to fallback | Yes | Yes | Report-generation isolation tests pass. |
| NFR-004 | Aggregates trace to persisted evidence | Yes | Yes | Persistence model and API evidence support this. |
| NFR-005 | PostgreSQL 15 via Docker Compose with readiness | Yes | Partial | Compose healthcheck works; clean startup was verified, but current credentials prevent backend DB access. |
| NFR-006 | Required stack/folder/naming conventions | Yes | Yes | React/Node/PostgreSQL stack and project structure match the constitution. |
| NFR-007 | Primary workflow without CLI | Yes | Yes | Frontend provides load, generate, inspect, and download controls. |
| NFR-008 | Progress UI and configurable diff/prompt limit | Partial | Partial | Progress exists; configuration exists, but enforcement is missing. |
| NFR-009 | Safe operational logs for failures | Partial | Partial | Standard request IDs and sanitized API errors exist; structured collection/AI/persistence failure logging is limited. |
| NFR-010 | Localhost binding and restricted CORS | Partial | Partial | CORS is tested; explicit localhost-only server binding is not configured, since `app.listen` uses the default host binding. |
| NFR-011 | Safe `/health` response | Yes | Yes | Health test verifies no credentials or repository contents are exposed. |

## 7. Specification acceptance checklist

| Acceptance item | Implemented? | Works? | Result |
|---|---:|---:|---|
| Valid current-branch repository produces a persisted 24-hour report | Yes | Partial | Automated tests pass; live verification is blocked by database authentication. |
| No recent commits produce no report and clear no-data result | Yes | Yes | Tested. |
| Evidence includes hashes, author data, timestamps, messages, files, additions, deletions | Yes | Yes | Tested. |
| Author ordering and score thresholds match formula | Yes | Yes | Tested. |
| AI input bounded and unsupported claims prohibited | Partial | Partial | Prompt and character cap exist; diff-limit enforcement and output validation are incomplete. |
| AI failures produce per-author fallback without aborting | Yes | Yes | Tested. |
| Secrets excluded from source/logs/responses/reports | Yes | Partial | No secret exposure found in current API/error paths; dedicated provider log test is missing. |
| Frontend loading, empty, warning, success, error states covered | Yes | Yes | Frontend tests pass. |
| PostgreSQL starts and schema migrations are repeatable | Partial | No | Startup works with explicit env file; migration is not repeatable. |
| Targeted tests cover collection, scoring, formatting, API, persistence, fallback | Partial | Yes | Existing backend/frontend suites pass, but provider adapter and several edge cases lack dedicated tests. |
| Detached HEAD, concurrency, Markdown failure, binary, oversized input defined | Partial | Partial | All except oversized-input enforcement are defined; oversized behavior is not implemented. |

## 8. Verification run

The existing backend validation completed successfully:

- Backend type-check: passed.
- Backend tests: 40 passed.
- Frontend tests: previously recorded as 6 passed.
- Backend and frontend builds: previously recorded as passed.
- PostgreSQL 15 container: starts healthy with Docker Compose when `--env-file .env` is supplied.

Current live verification limitation:

- The backend cannot authenticate to the existing PostgreSQL volume when the `.env` password differs from the password used to initialize that volume.
- The configured Gemini-compatible AI endpoint was reached, but the configured key previously returned HTTP 400 (`Please pass a valid API key`).
- Therefore, a live end-to-end report with `summary.source=ai` is not marked verified.

## 9. Priority follow-up gaps

1. Synchronize or recreate the PostgreSQL volume so live report persistence can be verified.
2. Use a valid supported AI provider key and add provider adapter tests with mocked success, 401/400, 429, 5xx, timeout, malformed output, and oversized input cases.
3. Enforce `DIFF_SIZE_LIMIT` when constructing AI input and validate output as non-empty plain text with 1-4 sentences.
4. Replace the retired GitHub Models terminology/configuration with provider-neutral AI configuration or document the supported replacement.
5. Make migrations repeatable with version tracking and explicit rollback strategy.
6. Implement the specified date-based Markdown output path or update FR-021 to match the current download-by-report-ID design.
