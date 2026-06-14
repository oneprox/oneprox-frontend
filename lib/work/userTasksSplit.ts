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
  /** Mulai shift (Date absolut, anchor pada `created_at` di Jakarta). */
  start: Date
  /** Akhir shift (Date absolut). */
  end: Date
  /** True bila end_time <= start_time, mis. shift 19:00-07:00. */
  crossesMidnight: boolean
}

/**
 * Hitung jendela shift berdasarkan task_group.start_time/end_time
 * dan tanggal `created_at` (zona Jakarta).
 *
 * - Bila end_time <= start_time, end di-anchor ke hari berikutnya
 *   (mis. 19:00 - 07:00 hari berikutnya).
 * - Mengembalikan `null` bila task_group atau `created_at` tidak tersedia.
 */
export function getShiftWindowForTask(task: UserTask): ShiftWindow | null {
  const tg = readTaskGroupTimes(task)
  if (!tg || !tg.start_time || !tg.end_time) return null
  if (!task.created_at) return null

  let createdJakarta: string
  try {
    createdJakarta = jakartaDateString(new Date(task.created_at))
  } catch {
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(createdJakarta)) return null

  const startMin = parseHmToMinutes(tg.start_time)
  const endMin = parseHmToMinutes(tg.end_time)
  if (startMin == null || endMin == null) return null

  const start = jakartaDateTime(createdJakarta, tg.start_time)
  if (!start) return null

  const crossesMidnight = endMin <= startMin
  const endDate = crossesMidnight
    ? addDaysJakarta(createdJakarta, 1)
    : createdJakarta
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
 * - Task yang `created_at`-nya hari ini (Jakarta) tetap ditampilkan.
 * - Task dari shift kemarin yang melewati tengah malam (mis. 19:00 - 07:00)
 *   tetap ditampilkan selama waktu sekarang masih sebelum end_time-nya
 *   (mis. jam 03:00 hari ini, shift kemarin yang berakhir jam 07:00 masih aktif).
 */
export function filterRoutineTasksForActiveShift(
  tasks: UserTask[],
  now: Date = new Date()
): UserTask[] {
  if (tasks.length === 0) return []
  const today = jakartaDateString(now)
  return tasks.filter((task) => {
    if (!task.created_at) return false

    let createdJakarta: string
    try {
      createdJakarta = jakartaDateString(new Date(task.created_at))
    } catch {
      return false
    }

    if (createdJakarta === today) return true

    const window = getShiftWindowForTask(task)
    if (!window || !window.crossesMidnight) return false
    return now.getTime() <= window.end.getTime()
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
