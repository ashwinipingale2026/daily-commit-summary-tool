# QA Report — Daily Commit Summary Tool

- **Date:** 2026-09-09
- **Environment:** Local dev — Postgres via Docker Compose, backend on `http://localhost:3000`, frontend on `http://localhost:5173`
- **Branch:** `main` (repo: `daily-commit-summary-tool`)
- **Tooling:** Manual/automated browser testing via headless Chrome + Playwright-core (driving the real Chrome install), backend verified via direct HTTP calls

## Scope

This session covered: environment startup, visual/functional review of the application UI, an end-to-end user-flow test (generate summary → download markdown), and two bug fixes with verification.

## Pages Visited

The application is a single-page app with one functional route; both `/` and unknown paths redirect here.

| Route | Purpose |
|---|---|
| `/daily-summary` | Main (and only) page — daily commit activity report for project managers |

## Elements Tested

### Static content
- Header: eyebrow label, "Daily summary" H1, subtitle
- "Latest report" panel: repository name, branch, generation window/timestamp
- "Notice" warning banner
- "Activity totals" panel: Commits, Authors, Files touched, Lines added, Lines removed
- "Author summaries" section (2 contributor cards): name, email, activity badge/score, metrics, AI/fallback summary text, commit-evidence disclosure

### Interactive elements
| Element | Test performed | Result |
|---|---|---|
| **Generate summary** button | Clicked; verified `POST /api/reports/generate` → `200`; page re-rendered with fresh timestamp/totals | ✅ Pass |
| **Download Markdown** button | Clicked; verified `GET /api/reports/{id}/markdown` → `200`; downloaded `.md` file saved and content-checked against on-screen data | ✅ Pass |
| **View N commit evidence items** (`<details>/<summary>`, per author) | Confirmed present and expandable in DOM; lists each commit with hash, subject, timestamp, file/line stats | ✅ Pass |
| **View changed files** (nested `<details>/<summary>`, per commit) | Confirmed present in DOM; lists exact changed file paths per commit | ✅ Pass |
| Forms/inputs | Searched DOM for `<form>`/`<input>` | None present — page has no data-entry forms |
| Links (`<a>` navigation) | Searched DOM for `<a>` tags | None present — download uses a programmatically-clicked Blob link, not a visible nav link |

### Non-functional checks
- Console errors/warnings captured during full flow (via CDP `Network`/`Console` domains)
- All `/api/*` and `/health` network calls captured and status-checked
- Full-page screenshots captured at each step for visual verification

## Bugs Found

| # | Bug | Severity | Root Cause | Status |
|---|---|---|---|---|
| 1 | **AI summary generation always failing** — every author fell back with warning "AI summary generation failed" | Functional (config) | `GITHUB_MODELS_ENDPOINT` in `.env` pointed to Google's Gemini OpenAI-compatible endpoint, but `GITHUB_TOKEN` (a GitHub PAT) is not a valid credential for that API. Further investigation found GitHub Models — the service these env vars were built for — was fully retired 2026-07-30, so reverting to it wasn't viable. | ✅ **Fixed** (see below) |
| 2 | **Duplicate warning text in Notice banner** — "AI summary generation failed"/"AI summaries are unavailable" rendered twice (and more, with more authors) | Cosmetic/UX | Backend emits one warning object per author that falls back (correct, since each author's attempt is independent), but the frontend's global Notice banner rendered every warning verbatim with no deduplication. The frontend's `Report["warnings"]` type has no `authorIndex`, so duplicate `{code, message}` pairs carried zero extra information. | ✅ **Fixed** (see below) |
| 3 | 404 for `/favicon.ico` | Trivial | No favicon file exists in the frontend `public/` assets | ⚠️ Not fixed (out of scope, cosmetic only) |
| 4 | Raw markdown download shows heavy escaping (e.g. `module03\-task`, `Ashwini\-Pingale\_epam`) | Not a bug | Intentional design in `markdown-renderer.ts`'s `escapeMarkdown()` to prevent Markdown injection from repo/commit data; renders correctly in any Markdown viewer | N/A — working as intended |

## Fixes Applied

### Fix 1 — Disable broken AI summary calls
- **File:** `.env` (git-ignored, not committed — by design, contains secrets)
- **Change:** Commented out `GITHUB_TOKEN`, `GITHUB_MODELS_ENDPOINT`, `GITHUB_MODELS_MODEL` with an explanatory note. Since `parseAiConfig()` in `apps/backend/src/config/environment.ts` requires all three set together or all omitted, clearing all three makes `config.ai` cleanly `undefined`.
- **Effect:** `apps/backend/src/server.ts` no longer constructs `GitHubModelsSummary`; `ReportGenerationService` uses its built-in `fallbackSummary` directly — no network calls, no exceptions, no wasted timeouts/retries.
- **Verification:** Restarted backend; confirmed clean startup; `POST /api/reports/generate` → `200` with warning code `AI_SUMMARY_FALLBACK` / message `"AI summaries are unavailable"` (previously a thrown HTTP-error message from the failed Gemini call).
- **Commit status:** Not committed (target file is git-ignored; user declined updating `.env.example` as a substitute).

### Fix 2 — Deduplicate repeated warnings in the Notice banner
- **Files:** `apps/frontend/src/pages/DailySummaryPage.tsx`, `apps/frontend/src/pages/DailySummaryPage.test.tsx`
- **Change:** Added a `dedupeWarnings()` helper that filters `report.warnings` by unique `code::message` before rendering the Notice banner. Per-author warning text inside `AuthorCard` is unchanged (that one is specific to that author and is not a duplicate).
- **Tests:** Added `"deduplicates identical warnings shared across authors in the notice banner"`; full suite run: **7/7 passed**.
- **Verification:** Visual screenshot confirmed the banner shows the message once instead of twice.
- **Commit status:** ✅ Committed — `4da5a8a` "Deduplicate repeated AI-summary warnings in the notice banner" (2 files changed, +27/-1). Not yet pushed to `origin`.

## Current Status

| Area | Status |
|---|---|
| Postgres (Docker Compose) | 🟢 Running, healthy |
| Backend (`localhost:3000`) | 🟢 Running, `/health` returns `200` |
| Frontend (`localhost:5173`) | 🟢 Running |
| Main user flow (navigate → generate → download) | 🟢 Passing end-to-end, no console/network errors |
| AI-generated author summaries | 🟡 Disabled — falls back to commit-evidence summaries by design decision; no AI provider currently configured |
| Notice banner duplication | 🟢 Fixed and committed |
| `favicon.ico` 404 | 🟡 Open, trivial, not addressed |

## Known Follow-Ups / Not Yet Done

- Choose and configure a real AI provider (e.g. Gemini with a valid API key, or Azure AI Foundry) if AI-generated author summaries are desired again.
- Add a `favicon.ico` to silence the harmless 404.
- Push commit `4da5a8a` to `origin` if ready.

## Testing Method Note

The `chrome-devtools` MCP server tool search was unavailable for the entire session (repeated "Language model unavailable" errors), so browser testing was performed via direct Chrome automation instead:
- Headless Chrome CLI (`--screenshot`, `--dump-dom`) for static page capture and DOM enumeration.
- A native Win32 screen-capture script for verifying the specific already-open Chrome window.
- Playwright-core (`npm install playwright-core`, scratch project since removed) driving the real Chrome executable for the full click-through user-flow test, with CDP `Network`/`Console` domains used to catch errors that Playwright's high-level API didn't surface (e.g. the `favicon.ico` 404).
