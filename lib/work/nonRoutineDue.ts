import type { UserTask } from '@/lib/api'

function parseNotes(notes: string | null | undefined): Record<string, unknown> {
  if (!notes || typeof notes !== 'string') return {}
  try {
    const o = JSON.parse(notes) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

/** Awal hari jatuh tempo di Asia/Jakarta (ms epoch). */
export function nonRoutineDueStartMs(notes: string | null | undefined): number | null {
  const o = parseNotes(notes)
  const period = o.period
  const dueDay = o.due_day
  if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return null
  const ddn = Number(dueDay)
  if (!Number.isInteger(ddn) || ddn < 1) return null
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return null
  const last = daysInMonth(y, m)
  const day = Math.min(ddn, last)
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000+07:00`
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/** Akhir hari jatuh tempo di Asia/Jakarta (ms epoch). */
export function nonRoutineDueEndMs(notes: string | null | undefined): number | null {
  const o = parseNotes(notes)
  const period = o.period
  const dueDay = o.due_day
  if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return null
  const ddn = Number(dueDay)
  if (!Number.isInteger(ddn) || ddn < 1) return null
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return null
  const last = daysInMonth(y, m)
  const day = Math.min(ddn, last)
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+07:00`
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

function jakartaDayStartMs(ref: Date): number {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(ref)
  const y = Number(parts.find((p) => p.type === 'year')!.value)
  const mo = Number(parts.find((p) => p.type === 'month')!.value)
  const d = Number(parts.find((p) => p.type === 'day')!.value)
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00.000+07:00`
  return Date.parse(iso)
}

/** Selisih hari kalender (Jakarta): hari jatuh tempo − hari referensi. */
export function nonRoutineDaysUntilDue(notes: string | null | undefined, ref = new Date()): number | null {
  const dueStart = nonRoutineDueStartMs(notes)
  if (dueStart == null) return null
  const todayStart = jakartaDayStartMs(ref)
  return Math.round((dueStart - todayStart) / 86400000)
}

export function formatNonRoutineJatuhTempo(notes: string | null | undefined): string | null {
  const start = nonRoutineDueStartMs(notes)
  if (start == null) return null
  return new Date(start).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
}

export type NonRoutineUrgency = 'overdue' | 'week' | 'twoweeks' | 'none'

export function getNonRoutineUrgency(notes: string | null | undefined, ref = new Date()): NonRoutineUrgency {
  const endMs = nonRoutineDueEndMs(notes)
  if (endMs == null) return 'none'
  if (ref.getTime() > endMs) return 'overdue'
  const daysLeft = nonRoutineDaysUntilDue(notes, ref)
  if (daysLeft == null) return 'none'
  if (daysLeft >= 0 && daysLeft <= 7) return 'week'
  if (daysLeft >= 8 && daysLeft <= 14) return 'twoweeks'
  return 'none'
}

/** Urut non-rutin: jatuh tempo dari notes; tanpa notes di akhir. */
export function compareNonRoutineByDue(a: UserTask, b: UserTask): number {
  const ta = nonRoutineDueStartMs(a.notes ?? null)
  const tb = nonRoutineDueStartMs(b.notes ?? null)
  const fa = ta ?? Number.MAX_SAFE_INTEGER
  const fb = tb ?? Number.MAX_SAFE_INTEGER
  if (fa !== fb) return fa - fb
  const ida = Number(a.user_task_id ?? a.id ?? 0)
  const idb = Number(b.user_task_id ?? b.id ?? 0)
  return ida - idb
}
