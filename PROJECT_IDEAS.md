# Jira/Confluence Automation Ideas

## 1. Stale Ticket Watchdog

**Problem it solves:** Tickets often sit in "In Progress" or "In Review" for weeks without updates, silently blocking sprints and hiding risk from managers until standup or sprint review. This automation scans for tickets that haven't been updated in N days, auto-flags them with a label/comment, and posts a digest to a Slack/Teams channel or a Confluence "Stale Tickets" page so managers can intervene early.

**Data needed:**
- Jira issue fields: status, assignee, last updated timestamp, priority, sprint
- Project/board configuration (which statuses count as "active")
- Notification channel webhook (Slack/Teams) or Confluence page ID to post the digest
- Threshold settings (days of inactivity per status/priority)

## 2. Sprint Report & Confluence Auto-Publisher

**Problem it solves:** Managers spend time manually compiling sprint summaries (completed vs. carried-over stories, velocity, blockers) for stakeholders. This automation generates a sprint report at sprint close and publishes it directly as a Confluence page, saving manual reporting effort and ensuring consistent, timely visibility for leadership.

**Data needed:**
- Jira sprint data: issues in sprint, story points, status changes, burndown history
- Velocity/history from past sprints (for trend comparison)
- Confluence space and parent page ID for publishing
- Report template (sections/format the manager wants, e.g., completed, spillover, blockers, risks)

## 3. Cross-Team Dependency & Risk Tracker

**Problem it solves:** Managers overseeing multiple teams struggle to see cross-team blockers (e.g., Team A waiting on Team B's ticket) until they cause delays. This automation detects "blocked by"/"depends on" issue links across projects, tracks their status, and maintains a live Confluence dashboard showing at-risk dependencies and who owns resolving them.

**Data needed:**
- Jira issue links (blocks/is blocked by, depends on) across projects
- Issue metadata: due dates, assignee, project/team ownership
- Confluence dashboard page for rendering the live table (via macro or scheduled update)
- Escalation rules (e.g., how many days overdue before flagging as high risk)
