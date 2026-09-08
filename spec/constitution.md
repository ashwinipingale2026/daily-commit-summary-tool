# Daily Commit Summary Tool Constitution

## Purpose

This constitution defines the engineering principles and non-negotiable standards for the Daily Commit Summary Tool. It governs product decisions, implementation plans, code reviews, and validation. When a design choice is ambiguous, these principles take precedence over convenience or implementation preference.

## Project Profile

- **Project name:** Daily Commit Summary Tool
- **Purpose:** Give a project manager a reliable, on-demand view of recent Git activity by collecting commits from the current repository and branch, grouping them by author, calculating transparent activity indicators, and generating concise plain-English summaries.
- **Target user:** A project manager overseeing a six-person team on a time-and-materials project who needs daily status visibility. The tool is for visibility only; it does not calculate billable hours, replace timesheets, or measure individual performance.
- **Primary workflow:** The user requests a report for the rolling last 24 hours. The backend collects Git data, calculates deterministic metrics, optionally obtains bounded AI summaries, persists report data, and exposes it to the frontend.

## Technology Stack

The following versions are the project baseline. Package manifests, the `.nvmrc`, and Docker Compose configuration MUST pin or constrain versions consistently with this section.

| Layer | Technology | Required version |
|---|---|---|
| Frontend runtime | React | 18.x |
| Frontend tooling | Vite | 5.x |
| Backend runtime | Node.js | 22.x |
| Backend framework | Express | 4.x |
| Database | PostgreSQL | 15.x |
| Local database environment | Docker Compose | Compose specification compatible with the repository tooling |

- TypeScript MUST be used for frontend and backend application code.
- The backend MUST remain the only application layer that connects to PostgreSQL.
- Dependency upgrades MUST be intentional, tested, and reflected in this constitution or the relevant specification.

## Repository and Folder Conventions

The repository MUST use the following top-level organization:

```text
module03-task/
├── apps/
│   ├── frontend/
│   │   ├── public/
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── services/
│   │       ├── types/
│   │       └── App.tsx
│   ├── backend/
│   │   └── src/
│   │       ├── config/
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── services/
│   │       └── types/
│   └── docker-compose.yml
├── spec/
│   ├── constitution.md
│   ├── specifications/
│   └── plans/
├── reports/
└── README.md
```

- Frontend-only code MUST remain under `apps/frontend/src`.
- Backend-only code MUST remain under `apps/backend/src`.
- Shared API contracts or types MUST be deliberately versioned and documented; frontend and backend MUST NOT import from each other's private implementation folders.
- `components/` MUST contain reusable presentation components; `pages/` MUST contain route-level compositions.
- `services/` MUST contain integrations and business-facing service modules, not UI components or route declarations.
- Backend `routes/` MUST declare endpoints, `controllers/` MUST coordinate request/response handling, and `services/` MUST contain business and integration logic.
- Database migrations or schema definitions MUST live in a clearly named backend database/migrations area when introduced.
- Generated reports MUST be written under `reports/`; generated output MUST NOT be mixed into source directories.
- Specifications and implementation plans MUST be stored under `spec/` using descriptive kebab-case filenames.

## Coding Standards

### Naming

- TypeScript variables, functions, methods, and parameters MUST use `camelCase`.
- React components, classes, interfaces, and type aliases MUST use `PascalCase`.
- React component files MUST use `PascalCase.tsx`; non-component TypeScript files MUST use `kebab-case.ts` unless an established framework convention requires otherwise.
- Constants that are immutable and module-wide MUST use `UPPER_SNAKE_CASE`; local values MUST use `camelCase`.
- Express route paths MUST use lowercase kebab-case nouns, for example `/api/commit-summaries`.
- Database tables and columns MUST use lowercase `snake_case`; primary and foreign key names MUST be explicit and consistent.
- Boolean names MUST use a predicate prefix such as `is`, `has`, `can`, or `should`.
- Names MUST describe domain intent; unexplained abbreviations and single-letter identifiers are prohibited outside short loop scopes.

### File Organization

- Each module MUST have one clear responsibility and MUST keep unrelated concerns in separate files.
- Imports MUST be grouped consistently: external packages, internal absolute/aliased imports, then relative imports; unused imports are prohibited.
- Public module APIs MUST be explicit. Internal helpers SHOULD remain unexported unless reused.
- React components SHOULD keep rendering, state orchestration, and API calls separated; API calls belong in frontend services, not JSX.
- Backend controllers MUST validate or delegate validation before invoking services; services MUST NOT depend on Express request or response objects.
- Types for API payloads and domain models MUST be defined in dedicated `types` modules and reused at call boundaries.
- Files MUST remain reasonably focused; when a file combines routing, persistence, formatting, and external calls, it MUST be split by responsibility.
- Comments MUST explain non-obvious decisions or constraints, not restate the code.
- Formatting, linting, and type-checking MUST be applied consistently using the project’s configured tooling.

## Core Principles

### I. Evidence-First, Visibility-Only Reporting

The product provides project visibility from repository activity; it is not a billing, time-tracking, productivity-surveillance, or timesheet-replacement system.

- Reports MUST be derived from observable Git commit data.
- The tool MUST preserve traceability from every summary to its underlying commits, authors, files, and diff statistics.
- AI-generated prose MUST not invent work, effort, intent, or outcomes that are not supported by the supplied commit data.
- Raw metrics MUST be shown alongside any derived activity classification.
- The default reporting window MUST be the rolling last 24 hours, with the current/default branch as the source.

### II. Specification Before Implementation

User-visible behavior MUST be defined before implementation begins, and implementation MUST remain traceable to the specification.

- Each feature MUST have clear user intent, scope, acceptance criteria, and error behavior.
- Plans MUST identify affected frontend, backend, database, and integration boundaries.
- Tasks MUST be independently actionable and ordered by dependency.
- Changes that alter behavior, data handling, or API contracts MUST update the relevant specification and tests.
- Implementation is complete only when it converges with the specification, plan, and task list.

### III. Clear Full-Stack Boundaries

The system MUST use explicit boundaries between the React client, Express API, and PostgreSQL persistence layer.

- The frontend MUST be implemented with React 18.x and Vite 5.x.
- The backend MUST be implemented with Node.js 22.x and Express 4.x.
- PostgreSQL 15.x MUST be the system of record and MUST run through Docker for local development.
- Frontend code MUST access protected data through documented backend API contracts, not direct database access.
- Backend modules MUST separate routing, validation, business logic, persistence, and external-service integration.
- API responses and errors MUST use stable, documented shapes suitable for typed frontend consumption.

### IV. Secure Handling of Repository and AI Data

Security and confidentiality MUST be preserved throughout collection, storage, transmission, and presentation.

- Credentials and tokens MUST come from environment configuration and MUST never be committed, logged, or rendered in reports.
- `.env` files MUST remain excluded from version control; `.env.example` MUST document required configuration without real secrets.
- Git commands MUST use argument arrays or equivalent safe process APIs; shell-string interpolation MUST NOT be used for repository-derived values.
- The application MUST validate and constrain repository paths, request payloads, and identifiers at trust boundaries.
- Diff content sent to an AI provider MUST be limited, size-bounded, and explicitly documented.
- AI-provider failures MUST be surfaced as warnings and isolated per author or request; they MUST NOT expose secrets or abort unrelated report generation.

### V. Reliable, Testable, and Observable Behavior

Correctness takes priority over speed of delivery, and failures MUST be explicit and diagnosable.

- Business rules such as the activity score and Low/Medium/High thresholds MUST be deterministic, unit tested, and configurable.
- API validation, repository collection, report generation, persistence, and AI fallback behavior MUST have automated tests at the appropriate level.
- A repository with no commits in the reporting window MUST produce a clear no-data result and MUST NOT create an empty report.
- Missing repositories, unavailable Git, invalid configuration, database failures, and provider failures MUST return clear actionable errors.
- Health checks and structured server-side logging MUST make operational failures distinguishable without logging sensitive data.
- Changes MUST pass formatting, linting, type-checking, and targeted tests available in the project before review.

### VI. Usable and Honest Product Experience

The interface MUST help a project manager understand activity quickly without overstating certainty.

- Reports MUST be grouped by author and ordered by activity score descending, then author name alphabetically.
- The UI MUST display the reporting period, repository/branch, total commits, contributing authors, raw metrics, and source commit details.
- Loading, empty, partial-failure, and error states MUST be explicit and usable.
- Activity labels MUST be presented as indicators derived from the documented formula, not as judgments of individual performance.
- Markdown and user-visible text MUST be safely rendered or escaped to prevent injection.

### VII. Reproducible Development Environment

Development and deployment workflows MUST be reproducible across team machines.

- Docker Compose MUST define the PostgreSQL 15 development service and its required health/readiness behavior.
- Database schema changes MUST be versioned and repeatable; ad hoc production-only edits are prohibited.
- Required Node.js, package-manager, and database setup steps MUST be documented.
- Configuration MUST distinguish development, test, and production values without embedding environment-specific secrets.
- Generated reports and other derived artifacts MUST have an explicit version-control policy.

## Architecture and Data Rules

1. The backend is the only component allowed to connect directly to PostgreSQL.
2. Database records MUST retain enough source metadata to reproduce or audit a generated summary.
3. External AI calls MUST be isolated behind a service boundary so the provider can be changed without rewriting collection, scoring, or presentation logic.
4. The system MUST support deterministic fallback output when AI is unavailable.
5. API and database schemas MUST evolve through backward-compatible migrations where practical; breaking changes require an explicit versioning or migration plan.

## Delivery Workflow

Every meaningful change follows this sequence:

1. Establish or update the relevant specification.
2. Identify affected contracts, data models, risks, and acceptance criteria.
3. Produce an implementation plan.
4. Break the plan into testable tasks.
5. Implement frontend, backend, and database changes within the defined boundaries.
6. Validate behavior with targeted tests and checks.
7. Review security, observability, documentation, and specification alignment.

## Governance

- This constitution is the authoritative source for project-wide engineering principles.
- A pull request that violates a MUST requirement requires either remediation or an explicitly documented exception.
- Exceptions MUST state the affected principle, rationale, risk, mitigation, owner, and expiration or review date.
- New principles or changes to MUST requirements require team review and an update to this file before implementation proceeds.
- Feature specifications may add stricter requirements, but MUST NOT weaken this constitution without an approved exception.
- The constitution MUST be reviewed when the architecture, data sensitivity, AI provider, or deployment model changes.

**Version:** 1.1.0
**Ratified:** 2026-09-09
**Last Amended:** 2026-09-09
