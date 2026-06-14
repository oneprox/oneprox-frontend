import type { UserTask } from '@/lib/api'

/** 1 jam dalam milidetik. */
export const ONE_HOUR_MS = 60 * 60 * 1000

/** Parse array dari GET /api/user-tasks (bentuk response bermacam-macam). */
export function parseRoutineUserTasksResponse(responseData: unknown): UserTask[] {
  if (!responseData || typeof responseData !== 'object') return []
  const d = responseData as Record<string, unknown>
  if (Array.isArray(responseData)) return responseData as UserTask[]
  if (Array.isArray(d.data)) return d.data as UserTask[]
  if (Array.isArray(d.tasks)) return d.tasks as UserTask[]
  return []
}

/** Parse daftar dari GET /api/user-tasks/non-routine (data = { user_tasks, total, ... }). */
export function parseNonRoutineUserTasksResponse(responseData: unknown): UserTask[] {
  if (!responseData || typeof responseData !== 'object') return []
  const d = responseData as Record<string, unknown>
  if (Array.isArray(d.user_tasks)) return d.user_tasks as UserTask[]
  const inner = d.data as Record<string, unknown> | undefined
  if (inner && Array.isArray(inner.user_tasks)) return inner.user_tasks as UserTask[]
  return []
}

/** Samakan id agar kompatibel dengan komponen yang mengharapkan user_task_id. */
export function normalizeFlatUserTask(row: UserTask): UserTask {
  return {
    ...row,
    user_task_id: row.user_task_id ?? row.id,
  }
}

export function jakartaDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function addDaysJakarta(jakartaDate: string, days: number): string | null {
  const m = jakartaDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  const next = new Date(Date.UTC(y, mo - 1, d + days))
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
}

function parseHmToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(mm)) return null
  return h * 60 + mm
}

/** Bangun Date pada zona Jakarta (UTC+07:00) dari string tanggal `YYYY-MM-DD` dan jam `HH:mm`. */
function jakartaDateTime(jakartaDate: string, time: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const iso = `${jakartaDate}T${pad2(parseInt(m[1], 10))}:${m[2]}:00+07:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function jakartaTimeMinutes(d: Date): number {
  const parts = d
    .toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .split(':')
  const h = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(mm)) return 0
  return h * 60 + mm
}

/**
 * Tanggal anchor shift (WIB).
 * Shift malam (19:00–07:00): bila generate terjadi di dini hari (00:00–end_time),
 * shift dimulai hari sebelumnya — bukan malam hari yang sama.
 */
function resolveShiftAnchorDate(
  createdJakarta: string,
  createdAt: Date,
  startMin: number,
  endMin: number
): string {
  if (endMin > startMin) return createdJakarta

  const createdMin = jakartaTimeMinutes(createdAt)
  if (createdMin <= endMin) {
    return addDaysJakarta(createdJakarta, -1) ?? createdJakarta
  }
  return createdJakarta
}

interface TaskGroupTimes {
  start_time?: string
  end_time?: string
}

/** Backend kadang mengirim `task_group` (snake) atau `taskGroup` (camel). Cek keduanya. */
function readTaskGroupTimes(task: UserTask): TaskGroupTimes | null {
  const t = task.task as
    | (UserTask['task'] & {
        task_group?: TaskGroupTimes | null
        taskGroup?: TaskGroupTimes | null
      })
    | undefined
  const tg = t?.task_group ?? t?.taskGroup ?? null
  if (!tg) return null
  if (!tg.start_time || !tg.end_time) return null
  return tg
}

export interface ShiftWindow {
  /** Mulai shift (Date absolut). */
  start: Date
  /** Akhir shift (Date absolut). */
  end: Date
  /** True bila end_time <= start_time, mis. shift 19:00-07:00. */
  crossesMidnight: boolean
}

function isWithinShiftWindow(window: ShiftWindow, nowMs: number): boolean {
  return nowMs >= window.start.getTime() && nowMs <= window.end.getTime()
}

/**
 * Hitung jendela shift berdasarkan task_group.start_time/end_time
 * dan waktu generate (`created_at`, zona Jakarta).
 *
 * - Shift malam (19:00–07:00): bila generate di dini hari (00:00–end_time),
 *   anchor shift = hari sebelumnya (shift yang sedang berjalan).
 * - Bila end_time <= start_time, end di-anchor ke hari setelah anchor.
 * - Mengembalikan `null` bila task_group atau `created_at` tidak tersedia.
 */
export function getShiftWindowForTask(task: UserTask): ShiftWindow | null {
  const tg = readTaskGroupTimes(task)
  if (!tg || !tg.start_time || !tg.end_time) return null
  if (!task.created_at) return null

  const createdAt = new Date(task.created_at)
  let createdJakarta: string
  try {
    createdJakarta = jakartaDateString(createdAt)
  } catch {
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(createdJakarta)) return null

  const startMin = parseHmToMinutes(tg.start_time)
  const endMin = parseHmToMinutes(tg.end_time)
  if (startMin == null || endMin == null) return null

  const crossesMidnight = endMin <= startMin
  const anchorDate = resolveShiftAnchorDate(createdJakarta, createdAt, startMin, endMin)

  const start = jakartaDateTime(anchorDate, tg.start_time)
  if (!start) return null

  const endDate = crossesMidnight
    ? addDaysJakarta(anchorDate, 1)
    : anchorDate
  if (!endDate) return null
  const end = jakartaDateTime(endDate, tg.end_time)
  if (!end) return null

  return { start, end, crossesMidnight }
}

/**
 * Task rutin (generate): filter created_at hari ini (Jakarta).
 *
 * Catatan: untuk shift yang melewati tengah malam (mis. 19:00 - 07:00),
 * gunakan {@link filterRoutineTasksForActiveShift}.
 */
export function filterRoutineTasksForToday(tasks: UserTask[]): UserTask[] {
  if (tasks.length === 0) return []
  const today = jakartaDateString(new Date())
  return tasks.filter((task) => {
    if (!task.created_at) return false
    try {
      const createdDateStr = jakartaDateString(new Date(task.created_at))
      return createdDateStr === today
    } catch {
      return false
    }
  })
}

/**
 * Filter task rutin yang masih relevan ditampilkan sekarang.
 *
 * Task ditampilkan hanya bila waktu sekarang (WIB) masih dalam jendela shift
 * task group-nya. Shift malam (19:00–07:00) tetap tampil di dini hari (mis.
 * jam 04:00) selama belum melewati end_time.
 */
export function filterRoutineTasksForActiveShift(
  tasks: UserTask[],
  now: Date = new Date()
): UserTask[] {
  if (tasks.length === 0) return []
  const t = now.getTime()
  const today = jakartaDateString(now)
  return tasks.filter((task) => {
    if (!task.created_at) return false

    const window = getShiftWindowForTask(task)
    if (window) {
      return isWithinShiftWindow(window, t)
    }

    try {
      return jakartaDateString(new Date(task.created_at)) === today
    } catch {
      return false
    }
  })
}

/**
 * Apakah ada shift yang sedang aktif dan akan berakhir <= `graceMs` lagi?
 *
 * Dipakai untuk menampilkan tombol Generate Task saat pergantian shift,
 * sehingga shift berikutnya bisa langsung di-generate (default 1 jam sebelum
 * end_time).
 */
export function isAnyShiftEndingSoon(
  tasks: UserTask[],
  now: Date = new Date(),
  graceMs: number = ONE_HOUR_MS
): boolean {
  if (tasks.length === 0) return false
  const t = now.getTime()
  for (const task of tasks) {
    const window = getShiftWindowForTask(task)
    if (!window) continue
    if (t < window.start.getTime()) continue
    if (t > window.end.getTime()) continue
    if (window.end.getTime() - t <= graceMs) return true
  }
  return false
}
