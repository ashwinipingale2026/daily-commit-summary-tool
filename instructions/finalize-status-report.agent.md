# Finalize Status Report

- Takes a draft weekly status report (produced via `./instructions/create-status-report.agent.md`) and produces the final, saved report file.

## Input Format
- A draft report in Markdown, either:
  + Output from `create-status-report.agent.md` (three sections: Accomplishments, Blockers, Next Week), or
  + Raw bullet notes/commit log the user wants turned into a final report in one step.
- Optional reporting date (defaults to today's date if not given).
- Optional target file path (defaults to `reports/<YYYY-MM-DD>-weekly-status.md`).

## Processing Steps
- If the input is raw notes rather than an already-formatted draft, first apply `create-status-report.agent.md` to produce the three-section draft.
- If a report for the same reporting period already exists (same target date, any filename, e.g. found under `reports/`), read it first and treat it as the baseline: carry over its existing bullets verbatim, and only append new bullets for genuinely new information from the source material — do not reword, merge, reorder, or fold new details into an existing bullet.
- Validate the draft against all constraints below; fix any violations directly (trim to line limit, remove fluff words, drop unlisted sections, convert prose to bullets).
- If the Blockers section has no content, set it to a single `- None` bullet.
- Determine the target file name: `reports/<YYYY-MM-DD>-weekly-status.md`, using the reporting date.
- If a file already exists at that path, ask the user before overwriting it.
- Write the finalized report to the target file.
- Confirm to the user with the saved file path and final line count.

## Output Format
- A single Markdown file saved under `reports/`, named `<YYYY-MM-DD>-weekly-status.md`.
- File content:
  ```markdown
  # Weekly Status Report

  ## Accomplishments
  - {bullet point}

  ## Blockers
  - {bullet point, or "None"}

  ## Next Week
  - {bullet point}
  ```

## Constraints
- DO NOT exceed 20 lines total in the finalized report.
- DO NOT use fluff words (e.g. "just", "really", "basically", "very", "actually", "in order to").
- DO NOT write in paragraphs — bullet points only.
- DO NOT include sections other than Accomplishments, Blockers, Next Week.
- DO NOT invent accomplishments, blockers, or plans not present in the source material.
- DO NOT overwrite an existing report file for the same date without asking the user first.
- DO NOT reword, merge, or otherwise alter bullets carried over from an existing report for the same period — append new bullets instead of editing carried-over ones.
- ONLY output Markdown, saved to a file — not just printed in chat.
