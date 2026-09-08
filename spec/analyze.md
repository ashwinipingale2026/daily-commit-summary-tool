# Daily Commit Summary Tool - Task Analysis

**Analysis version:** 1.0.0
**Date:** 2026-09-09
**Inputs reviewed:**

- [`constitution.md`](./constitution.md)
- [`specification.md`](./specification.md)
- [`plan.md`](./plan.md)
- [`tasks.md`](./tasks.md)

## 1. Executive Summary

The task breakdown covers the primary MVP workflow and has a generally sound dependency order. The highest-risk work is concentrated in Git parsing, transactional persistence, report orchestration, optional AI behavior, and end-to-end environment setup.

Before implementation begins, resolve these issues:

1. Add the missing dependency from Markdown projection to report orchestration and API endpoint work.
2. Resolve the contradiction between feature-level testing in the plan and all testing being deferred to Phase 4.
3. Define the Markdown artifact location, filename, write policy, and post-commit warning update behavior.
4. Define the `POST /api/reports/generate` request contract and validation rules.
5. Define the test fixtures, test database lifecycle, AI mock provider, accessibility tooling, and migration runner.
6. Reconcile the constitution's `spec/specifications` and `spec/plans` folder convention with the current flat `spec/` files.
7. Clarify whether health checks include database readiness or only process liveness.

## 2. Per-Task Assessment

| Task | Complexity | Primary risks | Dependencies |
|---|---|---|---|
| TASK-001 | Medium | Workspace/package structure may conflict with the existing repository; root scripts and app scripts are not specified. | None |
| TASK-002 | Medium | Secret leakage, inconsistent defaults, path validation, and unclear AI enablement rules. | TASK-001 |
| TASK-003 | Low | Docker version drift, port conflicts, persistent local data, and missing readiness behavior. | TASK-002 |
| TASK-004 | High | Schema omissions, migration rollback failures, incorrect constraints, and mismatch with API nesting. | TASK-003 |
| TASK-005 | High | Transaction boundaries, N+1 retrieval, rollback correctness, and mapping database rows to domain models. | TASK-004 |
| TASK-006 | Medium | Contract drift, inconsistent error status mapping, request-ID propagation, and CORS misconfiguration. | TASK-001, TASK-002, TASK-005 |
| TASK-007 | Medium | Frontend setup may be incorrectly coupled to backend bootstrap; routing and root workspace conventions are not defined. | TASK-001 |
| TASK-008 | Medium | API models can diverge from backend types; download and error handling need browser-safe behavior. | TASK-006, TASK-007 |
| TASK-009 | Medium | Accessibility regressions, duplicated state logic, and mock data that does not reflect real response variants. | TASK-007, TASK-008 |
| TASK-010 | High | Git output parsing, timestamp boundaries, renames/binaries, detached `HEAD`, malformed output, and command injection. | TASK-002, TASK-006 |
| TASK-011 | Medium | Score reproducibility, unique-file semantics, floating-point rounding, and author identity grouping. | TASK-010 |
| TASK-012 | High | Provider protocol uncertainty, prompt injection, timeout/retry behavior, output validation, and per-author isolation. | TASK-002, TASK-010, TASK-011 |
| TASK-013 | High | Cross-service sequencing, concurrency lock cleanup, partial success, and Markdown warning persistence after commit. | TASK-005, TASK-006, TASK-010, TASK-011, TASK-012 |
| TASK-014 | Medium | Incorrect HTTP mapping, empty/latest report semantics, content disposition, and endpoint contract drift. | TASK-006, TASK-013 |
| TASK-015 | Medium | Escaping Markdown correctly, deterministic output, artifact paths, and warning representation. | TASK-005, TASK-011, TASK-012 |
| TASK-016 | Medium | Preserving stale data during refresh, async race conditions, partial-success rendering, and safe text rendering. | TASK-008, TASK-009, TASK-014, TASK-015 |
| TASK-017 | High | Test environment complexity, fixture realism, flaky time-dependent tests, and database cleanup. | TASK-004, TASK-005, TASK-010, TASK-011, TASK-012, TASK-015 |
| TASK-018 | High | Full HTTP dependency orchestration, concurrent request testing, and reliable failure injection. | TASK-006, TASK-013, TASK-014, TASK-017 |
| TASK-019 | Medium | Browser test setup, accessibility rule coverage, and correctly mocking API state transitions. | TASK-009, TASK-016 |
| TASK-020 | High | Cross-process environment failures, fixture setup, provider/database failure injection, and browser reproducibility. | TASK-003, TASK-014, TASK-016, TASK-018, TASK-019 |
| TASK-021 | Medium | Release checks may be subjective; documentation can become stale; secret scanning and clean-machine validation are not assigned tools. | TASK-017, TASK-018, TASK-019, TASK-020 |

### TASK-001 - Bootstrap the backend workspace

- **Assessment:** Medium because it establishes the backend structure, scripts, TypeScript settings, and runtime lifecycle.
- **Key risk:** The task assumes a root workspace and package-manager convention without defining whether there is a root `package.json`, workspaces, or separate application lockfiles.
- **Dependency observation:** It is correctly foundational, but it should not be used as the implicit prerequisite for frontend-only bootstrap unless a shared workspace task is introduced.

### TASK-002 - Add validated environment configuration

- **Assessment:** Medium because validation is straightforward but security-sensitive.
- **Key risk:** The specification says `GITHUB_TOKEN` enables AI, while endpoint and model are conditional. The exact rule for partially supplied AI configuration is not defined.
- **Dependency observation:** It requires the backend runtime from TASK-001 and should produce a typed configuration object reused by every service.

### TASK-003 - Provision PostgreSQL with Docker Compose

- **Assessment:** Low for the Compose file, medium if readiness, initialization, and test isolation are included.
- **Key risk:** A named volume makes local state persistent, but the plan does not define reset instructions or a separate test database strategy.
- **Dependency observation:** It can technically proceed in parallel with most configuration work, but the declared dependency is acceptable for documented connection settings.

### TASK-004 - Create the database schema and migrations

- **Assessment:** High because this is the durable audit model and errors are expensive to change later.
- **Key risk:** The specification does not fully define column types, nullability, JSON shape, generated timestamps, or the exact check constraints in one authoritative schema artifact.
- **Dependency observation:** It correctly follows PostgreSQL provisioning, but it needs a migration tool and naming convention that are currently unspecified.

### TASK-005 - Implement database repositories and transactions

- **Assessment:** High because it combines transaction correctness, nested retrieval, and API projection mapping.
- **Key risk:** Markdown failures occur after commit, but the task only defines insertion and retrieval. Updating a warning after commit needs a separate update operation and failure policy.
- **Dependency observation:** Correctly depends on migrations. It should also depend on finalized domain/API types, which are currently spread across the specification rather than assigned to a task.

### TASK-006 - Define backend API contracts and error handling

- **Assessment:** Medium because the shapes are mostly specified, but cross-layer consistency is important.
- **Key risk:** `POST /api/reports/generate` has no explicit request body, headers, or idempotency behavior. The meaning of HTTP 400 is therefore unclear.
- **Dependency observation:** It depends on persistence in the current list, although route and contract design could begin earlier using schema-independent DTOs.

### TASK-007 - Bootstrap the React/Vite frontend

- **Assessment:** Medium because it establishes routing, scripts, and a separate runtime boundary.
- **Key risk:** The task depends on TASK-001, which bootstraps the backend rather than a shared repository workspace. This creates unnecessary coupling and does not define root-level scripts.
- **Dependency observation:** Replace the dependency with a shared workspace/bootstrap task if the repository is a monorepo; otherwise make it independent of backend implementation.

### TASK-008 - Define frontend models and API client

- **Assessment:** Medium because typed models must cover all response states and browser download behavior.
- **Key risk:** There is no shared contract generation or compatibility test, so frontend and backend can silently diverge.
- **Dependency observation:** It correctly follows the API contract and frontend shell, but should explicitly depend on the final response examples for `no_data` and `partial_success`.

### TASK-009 - Build the Daily Summary UI skeleton

- **Assessment:** Medium because the component structure and accessibility states require deliberate design.
- **Key risk:** Mock data may omit warnings, stale-report preservation, and error-code distinctions that are required by the specification.
- **Dependency observation:** Correctly follows frontend models and the API client.

### TASK-010 - Implement Git repository snapshot collection

- **Assessment:** High and the highest core-domain risk.
- **Key risk:** Git's machine-readable formats, timezone offsets, NUL/newline escaping, rename records, binary statistics, and commit boundary filtering can invalidate audit data if parsed incorrectly.
- **Dependency observation:** It depends on configuration and error contracts. It also needs a dedicated fixture repository artifact and a policy for Git version support.

### TASK-011 - Implement deterministic scoring and author aggregation

- **Assessment:** Medium.
- **Key risk:** The specification does not clearly define whether a file touched by multiple commits counts once per author, how renames affect uniqueness, or the exact persisted precision versus display precision.
- **Dependency observation:** Correctly follows the normalized Git snapshot.

### TASK-012 - Implement optional AI summaries and fallback behavior

- **Assessment:** High because it integrates an external service while preserving reliable report generation.
- **Key risk:** The task says AI is skipped cleanly when credentials are absent, while the specification requires missing/invalid AI configuration to produce warning plus fallback summaries. These behaviors need reconciliation.
- **Dependency observation:** Correctly follows evidence and scoring, but requires a concrete provider protocol, mock server, and configuration validation decision.

### TASK-013 - Implement report generation orchestration

- **Assessment:** High because it is the main consistency boundary across Git, scoring, AI, database, Markdown, and concurrency.
- **Key risk:** The in-process lock must be released on every failure path. Markdown warning persistence after the main transaction is not fully defined.
- **Dependency observation:** The declared dependencies omit TASK-015 even though orchestration renders Markdown and handles Markdown-write failure. This is a dependency-graph gap.

### TASK-014 - Implement report API endpoints

- **Assessment:** Medium.
- **Key risk:** Endpoint behavior depends on unresolved orchestration and Markdown details, especially whether Markdown is generated on demand or read from a stored artifact.
- **Dependency observation:** It should depend on TASK-015, not only TASK-013, because the Markdown endpoint requires the projection implementation.

### TASK-015 - Implement deterministic Markdown projection

- **Assessment:** Medium.
- **Key risk:** Markdown escaping is context-sensitive; the plan does not define a canonical escaping library or exact output template. The artifact write path is also unresolved.
- **Dependency observation:** It can be developed from report domain data before AI is complete if fallback summary fields are modeled, but its current dependency is acceptable.

### TASK-016 - Connect the frontend to the report workflow

- **Assessment:** Medium.
- **Key risk:** Refreshes, retries, and a second generation can create stale responses overwriting newer state unless request ordering is controlled.
- **Dependency observation:** Correctly waits for API and Markdown behavior, but it also needs explicit frontend state-management conventions.

### TASK-017 - Add backend unit and database integration tests

- **Assessment:** High because it combines multiple test layers and requires infrastructure.
- **Key risk:** The task is too broad for a single implementation unit and lacks test fixture, database reset, clock, and provider mock artifacts.
- **Dependency observation:** It conflicts with the plan's requirement that each feature have targeted tests before the next feature. Tests should be split or moved into feature tasks, with TASK-017 reserved for cross-feature and regression coverage.

### TASK-018 - Add API integration tests

- **Assessment:** High.
- **Key risk:** Reliable testing of concurrent generation, database outage, and Markdown write failure requires controllable seams and environment isolation.
- **Dependency observation:** Correctly follows the API implementation and lower-level tests, but it should explicitly depend on a test server/bootstrap fixture.

### TASK-019 - Add frontend component and accessibility tests

- **Assessment:** Medium.
- **Key risk:** The constitution requires accessibility, but the exact test runner, browser environment, and WCAG rule set are not selected.
- **Dependency observation:** Correctly follows the UI and live API integration behavior.

### TASK-020 - Execute the integrated local workflow

- **Assessment:** High because it spans Docker, backend, frontend, Git fixtures, AI behavior, and browser interaction.
- **Key risk:** It is described as an end-to-end workflow while full browser E2E coverage is explicitly out of scope. The boundary between manual smoke testing and automated E2E must be explicit.
- **Dependency observation:** Correctly depends on all production surfaces and their tests.

### TASK-021 - Complete security, documentation, and release validation

- **Assessment:** Medium.
- **Key risk:** "No secrets" and "clean-machine setup" need concrete checks, owners, and commands; otherwise this task is difficult to verify consistently.
- **Dependency observation:** Correctly follows integrated validation, but documentation should be updated incrementally when configuration and commands are introduced.

## 3. Gaps and Contradictions Across Documents

### 3.1 Folder convention contradiction

The constitution specifies `spec/specifications/` and `spec/plans/`, while the actual governed files are stored directly under `spec/` and the tasks reference `./plan.md` and `./specification.md`. Choose one convention and update the constitution, links, and task references consistently.

### 3.2 Test timing contradiction

The plan says each feature must have targeted tests before the next feature begins. The task breakdown places nearly all tests in Phase 4. This creates a late-feedback risk. Add test subtasks beside TASK-010 through TASK-016, or revise the plan to require only unit tests during implementation and cross-feature tests in Phase 4.

### 3.3 Missing Markdown dependency

TASK-013 renders Markdown but does not depend on TASK-015. TASK-014 exposes the Markdown endpoint but also does not depend on TASK-015. The dependency summary therefore permits API work to finish before its projection implementation. Add:

```text
TASK-015 -> TASK-013 -> TASK-014
```

If orchestration owns only the projection interface, create a separate Markdown service-contract task and keep the implementation dependency explicit.

### 3.4 Undefined Markdown artifact policy

The documents say Markdown is written after database commit and downloadable, but do not define:

- whether the file is stored under `reports/`;
- the filename and report ID mapping;
- whether the endpoint renders on demand or reads a file;
- behavior when the file is missing;
- how a post-commit warning is persisted;
- whether generated Markdown is committed, ignored, or retained.

This is also inconsistent with the constitution's requirement for an explicit generated-artifact version-control policy.

### 3.5 Incomplete API request contract

The response shape is described, but the generation request does not define whether the body is empty, whether a client request ID is accepted, or what input produces HTTP 400. Add an explicit request schema, content type, maximum body size, and validation behavior.

### 3.6 Ambiguous AI enablement and fallback

The specification says an absent token causes fallback summaries and the task says AI is skipped cleanly. Decide whether missing credentials creates:

- a warning plus `summary.source=fallback`;
- fallback without a warning;
- or a distinct disabled state.

Also define how partially configured endpoint/model values are handled.

### 3.7 Health-check semantics are incomplete

The plan calls `/health` a process-health endpoint, but database readiness is not defined. Document whether database outages make `/health` fail, whether a separate readiness endpoint is needed, and how Docker health differs from API health.

### 3.8 Domain contract artifacts are missing

The documents describe API examples and database entities but do not identify the canonical TypeScript files or a generated OpenAPI/JSON Schema artifact. Without one source of truth, frontend and backend model drift is likely.

### 3.9 Time and clock behavior is under-specified

The rolling window is defined, but tests need an injectable clock. Define whether `window_end` uses server UTC time, how future-dated commits are handled, and how exact boundary timestamps are included.

### 3.10 Git fixture and compatibility policy is missing

The tasks require detailed Git tests but no fixture repository, fixture creation script, Git minimum version, or machine-readable format contract is listed. Add a checked-in fixture generator or fixture repository and document how tests avoid depending on the working repository.

### 3.11 Error taxonomy is incomplete

The documents list HTTP statuses but not all stable error codes, retryability values, or the distinction between configuration, Git, persistence, provider, and Markdown failures. Define an error-code table and map every required condition to it.

### 3.12 Migration and test-environment artifacts are missing

The plan requires repeatable migrations and PostgreSQL integration tests, but no migration runner, migration metadata table, test database naming/reset strategy, or Docker test profile is assigned.

### 3.13 Accessibility validation tooling is missing

WCAG 2.1 AA is required, but no accessibility test library, browser runner, or manual keyboard checklist artifact is specified. TASK-019 needs a concrete validation method.

### 3.14 Repository path and generated reports need lifecycle rules

The constitution requires generated reports under `reports/`, while the MVP says PostgreSQL is authoritative and Markdown is a projection. Decide whether `reports/` contains generated files, fixtures only, or no runtime output, and define cleanup/retention behavior for local development.

### 3.15 Observability artifacts are missing

Structured logging is required, but there is no log schema, logger selection, log level policy, or request-ID field convention. Add a small observability contract and redaction test.

## 4. Recommended Corrections Before Implementation

### Priority 1 - Blocking contract decisions

1. Resolve the Markdown artifact and warning-persistence design.
2. Define the generation request and complete error-code matrix.
3. Resolve AI missing-token behavior and provider configuration rules.
4. Define health versus readiness semantics.
5. Correct TASK-013/TASK-014 dependencies on Markdown projection.

### Priority 2 - Build and test foundations

1. Define root workspace/package-manager structure and correct TASK-007's dependency.
2. Add canonical shared API/domain types or an API schema artifact.
3. Add Git fixture repository, injectable clock, migration runner, and test database strategy.
4. Select frontend accessibility and browser test tooling.
5. Split feature tests from Phase 4 regression/integration tests.

### Priority 3 - Release and governance

1. Reconcile the constitution's `spec/` folder convention with the current files.
2. Define generated Markdown version-control and retention policy.
3. Add structured logging and secret-redaction validation artifacts.
4. Update README requirements earlier rather than waiting for TASK-021.

## 5. Suggested Corrected Dependency Edges

```text
TASK-001 -> TASK-002
TASK-001 -> TASK-007
TASK-002 -> TASK-003
TASK-003 -> TASK-004 -> TASK-005
TASK-001 + TASK-002 + API/domain contract -> TASK-006
TASK-006 + TASK-007 -> TASK-008 -> TASK-009
TASK-002 + TASK-006 -> TASK-010 -> TASK-011
TASK-002 + TASK-010 + TASK-011 -> TASK-012
TASK-005 + TASK-010 + TASK-011 + TASK-012 -> TASK-013
TASK-005 + TASK-011 + TASK-012 -> TASK-015
TASK-013 + TASK-015 -> TASK-014
TASK-008 + TASK-009 + TASK-014 + TASK-015 -> TASK-016
feature-specific tests -> TASK-017
TASK-013 + TASK-014 + TASK-017 -> TASK-018
TASK-009 + TASK-016 -> TASK-019
TASK-003 + TASK-014 + TASK-016 + TASK-018 + TASK-019 -> TASK-020
TASK-017 + TASK-018 + TASK-019 + TASK-020 -> TASK-021
```

## 6. Overall Readiness Assessment

**Status:** Ready for refinement, not yet ready for implementation.

The backlog is sufficiently complete to estimate and sequence engineering work, but the Priority 1 contract decisions should be resolved first. The most important implementation safeguard is to establish test and artifact conventions before TASK-010 and TASK-004 begin, because Git parsing and database shape are the two foundations that determine whether later API and UI work remains auditable and compatible.

