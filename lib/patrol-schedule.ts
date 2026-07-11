export type CellStatus = 'selesai' | 'terlewat' | 'proses' | 'belum'

export interface PatrolTaskLike {
  time?: string
  scheduled_at?: string
  start_at?: string
  created_at?: string
  task_id?: number | string
  task?: {
    id?: number | string
    name?: string
    times?: string[]
    task_group_id?: number | string | null
    task_group?: { name?: string }
    taskGroup?: { name?: string }
  }
}

export interface PatrolScheduleCell {
  status: CellStatus
  users: string[]
}

export interface PatrolScheduleRow {
  key: string
  titik: string
  cells: PatrolScheduleCell[]
  /** Status agregat lintas jam, dipakai saat `columns` kosong. */
  overallStatus: CellStatus
}

export interface PatrolScheduleTable {
  key: string
  title: string
  columns: string[]
  rows: PatrolScheduleRow[]
}

function parseHour(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null
  const [h] = timeStr.split(':')
  const hour = parseInt(h, 10)
  return Number.isNaN(hour) ? null : hour
}

/** Jam efektif satu instance user_task: `time` eksplisit, lalu scheduled_at/start_at/created_at (Asia/Jakarta). */
export function resolvedHourOf(ut: PatrolTaskLike): number | null {
  const fromTime = parseHour(ut.time)
  if (fromTime !== null) return fromTime

  const raw = ut.scheduled_at || ut.start_at || ut.created_at
  if (!raw) return null

  const hourPart = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
    .formatToParts(new Date(raw))
    .find((p) => p.type === 'hour')?.value

  const hour = hourPart != null ? parseInt(hourPart, 10) : NaN
  return Number.isNaN(hour) ? null : hour
}

/** Jam-jam yang dikonfigurasi pada definisi task (`task.times`), dedup & urut naik. */
export function configuredHoursOf(task: PatrolTaskLike['task']): number[] {
  const times = task?.times
  if (!Array.isArray(times)) return []
  const hours = new Set<number>()
  times.forEach((t) => {
    const h = parseHour(String(t))
    if (h !== null) hours.add(h)
  })
  return [...hours].sort((a, b) => a - b)
}

export function scheduleGroupKeyOf(main: PatrolTaskLike): string {
  const t = main.task
  const groupId = t?.task_group_id
  if (groupId != null && groupId !== '') return `tg-${groupId}`
  const taskId = main.task_id ?? t?.id
  if (taskId != null && taskId !== '') return `task-${taskId}`
  const name = (t?.name || '').trim().toLowerCase()
  return name ? `name-${name}` : 'unknown'
}

export function scheduleGroupTitleOf(main: PatrolTaskLike, fallback: string): string {
  const t = main.task
  const g = (t?.task_group?.name || t?.taskGroup?.name || '').trim()
  if (g) return g
  const n = (t?.name || '').trim()
  return n || fallback
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function aggregateStatuses(statuses: CellStatus[]): CellStatus {
  if (statuses.length === 0) return 'belum'
  if (statuses.every((s) => s === 'selesai')) return 'selesai'
  if (statuses.some((s) => s === 'proses')) return 'proses'
  if (statuses.some((s) => s === 'terlewat')) return 'terlewat'
  return 'belum'
}

export interface BuildPatrolScheduleTablesOptions<T extends PatrolTaskLike> {
  isRole: (ut: T) => boolean
  classifyStatus: (ut: T) => CellStatus
  getUsers?: (ut: T) => string[]
  getTitikKey: (ut: T, main: T, indexInGroup: number) => string
  getTitikTitle: (ut: T, main: T, indexInGroup: number) => string
  sortRows?: (a: { key: string; titik: string }, b: { key: string; titik: string }) => number
  sortTables?: (a: PatrolScheduleTable, b: PatrolScheduleTable) => number
  fallbackTitle?: string
}

/**
 * Bagi grup main+children keamanan per jadwal patroli (schedule group), lalu turunkan
 * kolom jam masing-masing dari `task.times` (fallback: jam yang tercatat hari itu).
 * Satu tabel per schedule group, bukan satu grid global.
 */
export function buildPatrolScheduleTables<T extends PatrolTaskLike>(
  groups: { main: T; children: T[] }[],
  opts: BuildPatrolScheduleTablesOptions<T>
): PatrolScheduleTable[] {
  const { isRole, classifyStatus, getUsers, getTitikKey, getTitikTitle } = opts
  const fallbackTitle = opts.fallbackTitle ?? 'Patroli'

  type Entry = { ut: T; main: T; titik: string; titikKey: string }
  const buckets = new Map<string, { title: string; entries: Entry[] }>()

  groups.forEach((group) => {
    const { main, children } = group
    const visibleChildren = isRole(main) ? children : children.filter(isRole)
    const points = visibleChildren.length > 0 ? visibleChildren : isRole(main) ? [main] : []
    if (points.length === 0) return

    const groupKey = scheduleGroupKeyOf(main)
    if (!buckets.has(groupKey)) {
      buckets.set(groupKey, { title: scheduleGroupTitleOf(main, fallbackTitle), entries: [] })
    }
    const bucket = buckets.get(groupKey)!

    points.forEach((pt, idx) => {
      bucket.entries.push({
        ut: pt,
        main,
        titik: getTitikTitle(pt, main, idx),
        titikKey: getTitikKey(pt, main, idx),
      })
    })
  })

  const tables: PatrolScheduleTable[] = [...buckets.entries()].map(([groupKey, { title, entries }]) => {
    const configuredHours = new Set<number>()
    entries.forEach((e) => configuredHoursOf(e.main.task).forEach((h) => configuredHours.add(h)))

    let hours = [...configuredHours].sort((a, b) => a - b)
    if (hours.length === 0) {
      const observedHours = new Set<number>()
      entries.forEach((e) => {
        const h = resolvedHourOf(e.ut) ?? resolvedHourOf(e.main)
        if (h !== null) observedHours.add(h)
      })
      hours = [...observedHours].sort((a, b) => a - b)
    }

    const columns = hours.map(formatHour)

    const rowMap = new Map<string, { titik: string; entries: Entry[]; byHour: Map<number, Entry[]> }>()
    entries.forEach((e) => {
      if (!rowMap.has(e.titikKey)) rowMap.set(e.titikKey, { titik: e.titik, entries: [], byHour: new Map() })
      const row = rowMap.get(e.titikKey)!
      row.entries.push(e)
      const hour = resolvedHourOf(e.ut) ?? resolvedHourOf(e.main)
      if (hour === null) return
      if (!row.byHour.has(hour)) row.byHour.set(hour, [])
      row.byHour.get(hour)!.push(e)
    })

    const rows: PatrolScheduleRow[] = [...rowMap.entries()].map(([key, { titik, entries: rowEntries, byHour }]) => ({
      key,
      titik,
      cells: hours.map((hour) => {
        const matched = byHour.get(hour) || []
        const users = getUsers
          ? [...new Set(matched.flatMap((e) => getUsers(e.ut)).filter(Boolean))]
          : []
        return { status: aggregateStatuses(matched.map((e) => classifyStatus(e.ut))), users }
      }),
      overallStatus: aggregateStatuses(rowEntries.map((e) => classifyStatus(e.ut))),
    }))

    if (opts.sortRows) rows.sort(opts.sortRows)
    else rows.sort((a, b) => a.titik.localeCompare(b.titik, 'id'))

    return { key: groupKey, title, columns, rows }
  })

  if (opts.sortTables) tables.sort(opts.sortTables)
  else tables.sort((a, b) => a.title.localeCompare(b.title, 'id'))

  return tables
}
