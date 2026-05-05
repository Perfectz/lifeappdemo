# V01 — Quest Log: Create and Complete Task

## User outcome
Patrick can create a task, view it in the Quest Log, mark it complete, and archive it.

## Why this slice exists
Tasks are the backbone of the morning stand-up, evening postmortem, AI tool calls, and daily reports. This slice creates the first real domain object end-to-end.

## Scope
Implement task CRUD with local persistence.

Minimum supported actions:

- Create task.
- Edit task title/description/priority/tag/due date/planned date.
- Mark task complete.
- Reopen task.
- Archive task.
- Display active, completed, and archived tasks.

## Non-goals
Do not build AI task tools, DailyPlan, stand-up flow, reminders, recurring tasks, or complex filters yet.

## UI contract
Route: `/tasks`

Required UI:

- Task creation form.
- Task list grouped by:
  - Active Quests.
  - Cleared Quests.
  - Archived.
- Empty state: “No quests yet. Add one small win.”
- Priority display: low, medium, high.
- Tags: health, work, content, social, admin, learning.

## Data contract

```ts
type TaskStatus = 'todo' | 'done' | 'archived';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskTag = 'health' | 'work' | 'content' | 'social' | 'admin' | 'learning';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: TaskTag[];
  dueDate?: string;        // ISO date
  plannedForDate?: string; // ISO date
  completedAt?: string;    // ISO timestamp
  archivedAt?: string;     // ISO timestamp
  createdAt: string;
  updatedAt: string;
};
```

Persistence can be local storage or a simple local database abstraction, but it should be behind a small repository/service layer so future DB migration is easier.

## API contract
No backend API required unless the chosen architecture already uses server actions. Keep API minimal.

## Acceptance criteria

### AC1: Create task
Given Patrick is on `/tasks`, when he enters a title and submits the form, then the new task appears under Active Quests.

### AC2: Validate title
Given Patrick submits an empty task title, when the form is submitted, then the task is not created and a clear validation message appears.

### AC3: Complete task
Given an active task exists, when Patrick marks it complete, then it moves to Cleared Quests and receives a `completedAt` timestamp.

### AC4: Reopen task
Given a completed task exists, when Patrick reopens it, then it moves back to Active Quests and `completedAt` is cleared.

### AC5: Archive task
Given a task exists, when Patrick archives it, then it moves to Archived and receives an `archivedAt` timestamp.

### AC6: Persist task
Given Patrick creates a task, when he refreshes the page, then the task is still visible.

## Test criteria

### Unit tests
- Task schema accepts valid tasks.
- Task schema rejects empty titles.
- Completing a task sets `status='done'` and `completedAt`.
- Reopening clears `completedAt`.
- Archiving sets `status='archived'` and `archivedAt`.

### Component tests
- Create form validates title.
- Task list groups by status.

### E2E tests
- Create → refresh → complete → reopen → archive.

## Codex prompt

```txt
Implement V01 Quest Log Task CRUD only.

Use the Task data contract from the slice.
Create a typed task repository/service with local persistence.
Build /tasks with create, edit, complete, reopen, and archive behavior.
Add unit/component/e2e tests for the listed acceptance criteria.
Do not implement stand-up, AI, reports, reminders, metrics, or recurring tasks.
```

## Review checklist
- Can you create a real task quickly?
- Does task state survive refresh?
- Is the UI simple enough for daily use?
- Did Codex avoid adding AI or planning features too early?
