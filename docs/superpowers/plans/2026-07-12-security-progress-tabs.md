# Progress Harian Keamanan Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the stacked, per-task-group patrol tables on the "Progress Harian Keamanan" dashboard card into a tabbed layout, one tab per task group, so the card no longer grows tall with a long vertical scroll.

**Architecture:** `daily-work-status.tsx` already computes `patrolScheduleTables: PatrolScheduleTable[]` (one entry per security task group) via `buildPatrolScheduleTables()`. Today it `.map()`s that array into stacked `<Table>` blocks inside a `space-y-4` container. This plan extracts the per-group `<Table>` markup into a small local component (`PatrolGroupTable`) and wraps the group list in the project's existing shadcn/Radix `Tabs` component instead of a stacked list, reusing `PatrolGroupTable` for both the tabbed case and a still-supported single-group case.

**Tech Stack:** Next.js (React, TypeScript), Tailwind CSS, shadcn/ui `Tabs` on `@radix-ui/react-tabs` (`components/ui/tabs.tsx`, already in the project — no new dependency).

## Global Constraints

- No changes to `lib/patrol-schedule.ts` grouping/data logic (per spec `docs/superpowers/specs/2026-07-12-security-progress-tabs-design.md`).
- No changes to the separate "Task Completions" chart card (`daily-task-completion.tsx`).
- No new dependencies — reuse `components/ui/tabs.tsx`.
- This repo has no frontend test runner configured (no Jest/Vitest/RTL in `package.json`) — verification uses `npm run lint`, `npx tsc --noEmit`, and manual browser check via the dev server instead of automated component tests.

---

### Task 1: Tabbed "Progress Harian Keamanan" card

**Files:**
- Modify: `app/(dashboard)/(homes)/dashboard/components/daily-work-status.tsx`
  - Import block (line 7-14)
  - Insert new `PatrolGroupTable` local component after the `PatrolIcon` definition (currently lines 574-601)
  - Replace the `CardContent` block that maps `patrolScheduleTables` (currently lines 878-953)

**Interfaces:**
- Consumes: `patrolScheduleTables: PatrolScheduleTable[]` (already computed in the component via `useMemo`, unchanged), `PatrolIcon` local component (unchanged, defined at line 574), types `PatrolScheduleTable`/`CellStatus` from `@/lib/patrol-schedule` (already imported).
- Produces: no new exports — `PatrolGroupTable` is a file-local component used only within `DailyWorkStatus`.

- [ ] **Step 1: Add the `Tabs` import**

Modify the import block at the top of `app/(dashboard)/(homes)/dashboard/components/daily-work-status.tsx`. Change:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { assetsApi, userTasksApi, type Asset, type UserTask } from '@/lib/api'
import LoadingSkeleton from '@/components/loading-skeleton'
import { buildPatrolScheduleTables, type CellStatus } from '@/lib/patrol-schedule'
```

to:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { assetsApi, userTasksApi, type Asset, type UserTask } from '@/lib/api'
import LoadingSkeleton from '@/components/loading-skeleton'
import { buildPatrolScheduleTables, type CellStatus, type PatrolScheduleTable } from '@/lib/patrol-schedule'
```

- [ ] **Step 2: Insert the `PatrolGroupTable` local component**

In the same file, the `PatrolIcon` local component currently ends at line 601:

```tsx
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300">
        <Circle className="h-3 w-3" />
      </span>
    )
  }

  const toggleCleaningExpand = (mainKey: string) => {
```

Insert a new `PatrolGroupTable` component between the closing `}` of `PatrolIcon` and `toggleCleaningExpand`, so it reads:

```tsx
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300">
        <Circle className="h-3 w-3" />
      </span>
    )
  }

  const PatrolGroupTable = ({ table }: { table: PatrolScheduleTable }) => (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 text-xs font-semibold uppercase text-slate-500">No</TableHead>
            <TableHead className="min-w-[100px] text-xs font-semibold uppercase text-slate-500">
              Titik patroli
            </TableHead>
            {table.columns.length > 0 ? (
              table.columns.map((t) => (
                <TableHead key={t} className="whitespace-nowrap text-center text-xs font-semibold uppercase text-slate-500">
                  {t}
                </TableHead>
              ))
            ) : (
              <TableHead className="text-center text-xs font-semibold uppercase text-slate-500">Status</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, idx) => (
            <TableRow key={row.key}>
              <TableCell className="text-slate-600">{idx + 1}</TableCell>
              <TableCell className="max-w-[140px] text-sm text-slate-800">{row.titik}</TableCell>
              {table.columns.length > 0 ? (
                row.cells.map((c, j) => (
                  <TableCell key={j} className="text-center">
                    {c.users.length > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="mx-auto flex cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={`Lihat petugas ${row.titik} jam ${table.columns[j]}`}
                          >
                            <PatrolIcon status={c.status} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-auto max-w-xs px-3 py-2 text-sm">
                          <p className="font-medium text-slate-700">Petugas</p>
                          <p className="text-slate-600">{c.users.join(', ')}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex justify-center">
                        <PatrolIcon status={c.status} />
                      </div>
                    )}
                  </TableCell>
                ))
              ) : (
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <PatrolIcon status={row.overallStatus} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const toggleCleaningExpand = (mainKey: string) => {
```

This is a verbatim extraction of the existing per-group table markup (previously inlined inside the `.map()` at lines 890-950) into a reusable local component, so behavior for a single group is byte-for-byte identical to today.

- [ ] **Step 3: Replace the stacked list with `Tabs`**

Still in `app/(dashboard)/(homes)/dashboard/components/daily-work-status.tsx`, replace the `CardContent` block that currently reads (lines 878-953):

```tsx
          <CardContent className="space-y-4">
            {patrolScheduleTables.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada tugas keamanan hari ini.
              </p>
            ) : (
              patrolScheduleTables.map((table) => (
                <div key={table.key} className="space-y-2">
                  {patrolScheduleTables.length > 1 && (
                    <h4 className="text-sm font-semibold text-slate-700">{table.title}</h4>
                  )}
                  <div className="overflow-x-auto">
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 text-xs font-semibold uppercase text-slate-500">No</TableHead>
                          <TableHead className="min-w-[100px] text-xs font-semibold uppercase text-slate-500">
                            Titik patroli
                          </TableHead>
                          {table.columns.length > 0 ? (
                            table.columns.map((t) => (
                              <TableHead key={t} className="whitespace-nowrap text-center text-xs font-semibold uppercase text-slate-500">
                                {t}
                              </TableHead>
                            ))
                          ) : (
                            <TableHead className="text-center text-xs font-semibold uppercase text-slate-500">Status</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.rows.map((row, idx) => (
                          <TableRow key={row.key}>
                            <TableCell className="text-slate-600">{idx + 1}</TableCell>
                            <TableCell className="max-w-[140px] text-sm text-slate-800">{row.titik}</TableCell>
                            {table.columns.length > 0 ? (
                              row.cells.map((c, j) => (
                                <TableCell key={j} className="text-center">
                                  {c.users.length > 0 ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="mx-auto flex cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                          aria-label={`Lihat petugas ${row.titik} jam ${table.columns[j]}`}
                                        >
                                          <PatrolIcon status={c.status} />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent side="top" className="w-auto max-w-xs px-3 py-2 text-sm">
                                        <p className="font-medium text-slate-700">Petugas</p>
                                        <p className="text-slate-600">{c.users.join(', ')}</p>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    <div className="flex justify-center">
                                      <PatrolIcon status={c.status} />
                                    </div>
                                  )}
                                </TableCell>
                              ))
                            ) : (
                              <TableCell className="text-center">
                                <div className="flex justify-center">
                                  <PatrolIcon status={row.overallStatus} />
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))
            )}
```

with:

```tsx
          <CardContent className="space-y-4">
            {patrolScheduleTables.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada tugas keamanan hari ini.
              </p>
            ) : patrolScheduleTables.length === 1 ? (
              <PatrolGroupTable table={patrolScheduleTables[0]} />
            ) : (
              <Tabs defaultValue={patrolScheduleTables[0].key} className="w-full">
                <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
                  {patrolScheduleTables.map((table) => (
                    <TabsTrigger key={table.key} value={table.key} className="shrink-0">
                      {table.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {patrolScheduleTables.map((table) => (
                  <TabsContent key={table.key} value={table.key} className="space-y-2">
                    <PatrolGroupTable table={table} />
                  </TabsContent>
                ))}
              </Tabs>
            )}
```

Everything below this block (the status-legend `<div>` starting `<div className="flex flex-wrap gap-4 border-t ...">`) is unchanged.

- [ ] **Step 4: Typecheck and lint**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: both complete with no new errors/warnings attributable to `daily-work-status.tsx`.

- [ ] **Step 5: Manual verification in the browser**

Run:
```bash
npm run dev
```
Open the dashboard page in a browser. On the "Progress Harian Keamanan" card, confirm:
- If there are 2+ security task groups today, a row of tabs appears (one per task group name) instead of stacked tables; the first tab is active by default and shows its patrol table; clicking another tab swaps the visible table.
- If there's a wide set of task groups, the tab row scrolls horizontally rather than wrapping or growing the card height.
- If there's exactly 1 task group, the table renders directly (no tab row), matching prior behavior.
- If there are 0 task groups, the "Tidak ada tugas keamanan hari ini." message still shows.
- Clicking a status icon still opens the officer-name popover as before.

Stop the dev server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/(homes)/dashboard/components/daily-work-status.tsx"
git commit -m "feat: tab security progress card by task group"
```
