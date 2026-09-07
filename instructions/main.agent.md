# Instructions Catalog

Each entry below is an instruction file with a one-line description. Optional sub-fields after `+`:
- **Keywords** — trigger words/phrases: if user's request matches, load this instruction.
- **Target** — file glob pattern: if current file or context matches, consider this instruction relevant.
- **Exceptions** — edge cases or clarifications that don't fit in the one-liner.

---

- [`./instructions/creating-instructions.agent.md`](./creating-instructions.agent.md) — How to create/update instructions, skills, and IDE wrappers (VSCode, Cursor, Claude Code) for this workspace.
  + Keywords: create instruction, new instruction, add instruction, skill, bootstrap instructions, prompt wrapper
- [`./instructions/create-status-report.agent.md`](./create-status-report.agent.md) — Generate a weekly status report (Markdown, accomplishments/blockers/next week, bullets only, max 20 lines, professional tone, no fluff words).
  + Keywords: status report, weekly report, standup, accomplishments, blockers
- [`./instructions/finalize-status-report.agent.md`](./finalize-status-report.agent.md) — Validate a draft weekly status report against constraints and save it to `reports/<YYYY-MM-DD>-weekly-status.md`.
  + Keywords: finalize status report, save report, publish report, weekly report file
