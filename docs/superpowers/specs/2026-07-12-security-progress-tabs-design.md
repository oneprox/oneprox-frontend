# Progress Harian Keamanan — Tab per Task Group

## Problem

The "Progress Harian Keamanan" card on the dashboard (`app/(dashboard)/(homes)/dashboard/components/daily-work-status.tsx`) renders one patrol schedule table per security task group, all stacked vertically inside a `space-y-4` container. With several task groups this makes the card grow very tall, forcing a long vertical scroll.

## Goal

Replace the stacked layout with a tabbed layout: one tab per task group, showing only the active group's table at a time.

## Scope

- Only the "Progress Harian Keamanan" card body in `daily-work-status.tsx` (currently ~lines 862–953).
- No changes to grouping/data logic in `lib/patrol-schedule.ts` (`buildPatrolScheduleTables`, `scheduleGroupKeyOf`, `scheduleGroupTitleOf`).
- No changes to the separate "Task Completions" chart card (`daily-task-completion.tsx`).

## Design

- Use the existing shadcn/Radix `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components from `components/ui/tabs.tsx` (already in the codebase, no new dependency).
- For each entry in `patrolScheduleTables`:
  - One `TabsTrigger` labeled with `table.title`, keyed by `table.key`.
  - One `TabsContent` (keyed by `table.key`) rendering the existing `<Table>` markup for that group, unchanged from today's per-group rendering.
- `Tabs` defaults to the first group: `defaultValue={patrolScheduleTables[0].key}`.
- `TabsList` is horizontally scrollable (`overflow-x-auto`, `flex-nowrap`, no wrap) so many task groups stay on one row instead of pushing content down or wrapping to a second line.
- Edge case — single task group: render the table directly without the `Tabs` wrapper (mirrors the current behavior where the group `<h4>` title is only shown when there is more than one group).
- Edge case — zero task groups: keep existing empty-state behavior unchanged.

## Out of scope / non-goals

- Persisting the last-selected tab across reloads.
- Auto-selecting a tab based on incomplete progress.
- Any change to how patrol status/columns/rows are computed or rendered inside a single table.
