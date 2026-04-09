import type { UserTask } from '@/lib/api'

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

/** Task rutin (generate): filter created_at hari ini (Jakarta). */
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
