# Acceptance Criteria Summary

This is a quick checklist version. The detailed Given/When/Then criteria are in each slice file.

## MVP-0 local app

### V00 Walking Skeleton
- App loads.
- Core routes exist.
- `/api/health` works.
- PWA basics exist.
- No secrets exposed.

### V01 Quest Log
- Create task.
- Validate empty title.
- Complete task.
- Reopen task.
- Archive task.
- Persist through refresh.

### V02 Dashboard
- Shows today.
- Shows planned tasks.
- Shows backlog count.
- Shows completed-today count.
- CTA navigation works.

### V03 Morning Stand-Up Manual
- Shows active tasks.
- Quick task creation works.
- Saves DailyPlan.
- Enforces max Side Quests.
- Dashboard reflects plan.
- Edits existing plan instead of duplicating.

### V04 Evening Postmortem Manual
- Shows planned tasks.
- Marks tasks complete.
- Defers tasks.
- Captures reflection.
- Closes plan.
- Handles no-plan fallback.

### V05 Metrics
- Logs morning metrics.
- Logs evening metrics.
- Validates values.
- Shows recent entries.
- Updates dashboard snapshot.
- Shows health boundary.

### V06 Journal
- Creates entry.
- Prompt picker works.
- Edits entry.
- Deletes entry.
- Supports date filtering/highlighting.

### V07 Markdown Report
- Generates from real stored data.
- Labels missing data honestly.
- Downloads `.md` file.
- Copies to clipboard.
- Persists latest report.

## MVP-1 AI coach

### V08 AI Chat Read-Only
- Sends chat message.
- Uses app context.
- Does not mutate data.
- Keeps key server-side.
- Handles errors safely.

### V09 AI Task Tools
- Proposes task creation.
- Confirm applies.
- Reject does not apply.
- Completes task via proposal.
- Validates payload.
- Shows audit trail.

### V10 AI Metrics/Journal Tools
- Proposes metric from chat.
- Confirm metric applies.
- Reject metric blocks mutation.
- Proposes journal entry.
- Validates health values.
- Does not diagnose.

### V11 AI Morning Stand-Up
- Starts AI stand-up.
- Suggests priorities.
- Proposes new tasks.
- Confirms plan.
- Reject/edit plan works.
- Controls overload.

### V12 AI Evening Postmortem
- Starts AI postmortem.
- Closes tasks via confirmation.
- Captures lessons.
- Creates tomorrow follow-ups.
- Generates report.
- Labels missing data honestly.
- Closes DailyPlan.

## MVP-1.5 polish/integrations

### V13 PWA
- Manifest valid.
- Installable.
- Offline shell works.
- Offline AI boundary works.
- No cache secrets.

### V14 Voice
- Voice entry point visible.
- Server creates ephemeral session.
- Permanent key not exposed.
- Permission handling works.
- Transcript handoff works.

### V15 Health Import
- Upload file.
- Preview before import.
- Confirm import.
- Invalid files fail safely.
- Duplicate protection.
- Dashboard updates.

### V16 Portfolio polish
- Demo mode seed.
- Demo label visible.
- Reset demo data.
- Screenshot-ready dashboard.
- Report presentation polished.
- Accessibility baseline.
