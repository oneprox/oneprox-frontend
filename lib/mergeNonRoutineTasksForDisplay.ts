import type { Task } from '@/lib/api'

/**
 * Satu task non-rutin baru: satu baris DB dengan `non_routine_items`.
 * Legacy: beberapa task terpisah (create bulk lama) — digabung jadi satu baris tampilan.
 */
export function mergeNonRoutineTasksForDisplay(tasks: Task[]): Task[] {
  const keyOf = (t: Task) => {
    if (t.is_routine === false && t.non_routine_group_id) {
      return `nrgroup:${t.non_routine_group_id}`
    }
    return `legacy:${t.name ?? ''}||${t.asset_id ?? ''}||${String(t.role_id ?? '')}`
  }

  const groupMap = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.is_routine === false) {
      const k = keyOf(t)
      const arr = groupMap.get(k) ?? []
      arr.push(t)
      groupMap.set(k, arr)
    }
  }

  const consumedKey = new Set<string>()
  const out: Task[] = []

  for (const t of tasks) {
    if (t.is_routine !== false) {
      out.push(t)
      continue
    }

    const k = keyOf(t)
    if (consumedKey.has(k)) continue
    consumedKey.add(k)

    const group = groupMap.get(k) ?? [t]
    if (group.length === 1) {
      out.push(group[0])
      continue
    }

    const sorted = [...group].sort((a, b) => Number(a.id) - Number(b.id))
    const legacySplit =
      sorted.every(
        (g) =>
          (!g.parent_task_ids || g.parent_task_ids.length === 0) &&
          Boolean(g.is_main_task) &&
          (!g.non_routine_items || g.non_routine_items.length === 0)
      )

    if (!legacySplit) {
      out.push(...sorted)
      continue
    }

    const first = sorted[0]
    const sharedGroupId = sorted.map((g) => g.non_routine_group_id).find(Boolean)
    const merged: Task = {
      ...first,
      ...(sharedGroupId ? { non_routine_group_id: sharedGroupId } : {}),
      monthly_frequency: sorted.length,
      non_routine_items: sorted.map((g) => ({
        due_date:
          g.due_date !== undefined && g.due_date !== null && String(g.due_date) !== ''
            ? String(g.due_date)
            : '',
        area: (g.area && String(g.area).trim()) || '',
        assigned_user_id: g.assigned_user_id || '',
      })),
    }
    ;(merged as Task & { _mergedNonRoutineTaskIds?: number[] })._mergedNonRoutineTaskIds =
      sorted.map((g) => Number(g.id))
    out.push(merged)
  }

  return out
}
