# Meeting Notes Validation Rules

Use these rules to validate every file in the `meeting-notes` folder.

## Required sections

Each meeting note file must contain all of the following sections:

- Attendees
- Risks
- Issues
- Dependencies
- Action Items

## Matching rules

A section is considered present when the heading appears as a standalone line, using case-insensitive matching.

Accepted variations:

- `Attendees` and `Attendies` (legacy typo variant)
- `Risks`
- `Issues`
- `Dependencies`
- `Action Items`

Examples of valid headings:

```text
Attendees:
Risks:
Issues:
Dependencies:
Action Items:
```

## Validation outcome

A file passes validation only if all five sections are present.

If any section is missing, the file should be flagged as invalid and reported with the missing section names.

## Action Items table rule

If the file includes an Action Items section, it should contain a table with rows in the format:

```text
| Action Item | Owner | Due Date |
```

This confirms the action-item section is structured and usable for downstream tracking.

## Example validation summary

```text
realistic_meeting_notes_07.txt => Missing: Action Items
realistic_meeting_notes_10.txt => Missing: Issues, Dependencies
realistic_meeting_notes_17.txt => Missing: Attendees
```

## Implementation note

Validation should check for headings before accepting the file as complete. It should not rely on keywords appearing in paragraphs alone.
