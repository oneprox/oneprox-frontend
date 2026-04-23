'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Clock, CheckCircle2, Calendar, MapPin, ClipboardList } from 'lucide-react'
import { attendanceApi, dashboardApi, userTasksApi, Attendance, UserTask } from '@/lib/api'
import {
  normalizeFlatUserTask,
} from '@/lib/work/userTasksSplit'
import toast from 'react-hot-toast'
import LoadingSkeleton from '@/components/loading-skeleton'
import AttendanceCard from '@/components/attendance/attendance-card'
import { TaskList } from '@/components/work/TaskList'
import { CompleteTaskDialog } from '@/components/work/CompleteTaskDialog'

function DashboardWorkerContent() {
  const router = useRouter()
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([])
  const [routineUserTasks, setRoutineUserTasks] = useState<UserTask[]>([])
  const [nonRoutineUserTasks, setNonRoutineUserTasks] = useState<UserTask[]>([])
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [selectedUserTask, setSelectedUserTask] = useState<UserTask | null>(null)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)

  // Load attendance history
  const loadAttendanceHistory = async () => {
    try {
      setIsLoadingAttendance(true)
      const response = await attendanceApi.getUserAttendanceHistory(10)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const history = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setAttendanceHistory(history)
      } else {
        console.error('Failed to load attendance history:', response.error)
        setAttendanceHistory([])
      }
    } catch (error) {
      console.error('Error loading attendance history:', error)
      toast.error('Terjadi kesalahan saat memuat riwayat absensi')
      setAttendanceHistory([])
    } finally {
      setIsLoadingAttendance(false)
    }
  }

  const loadUserTasks = async () => {
    try {
      setIsLoadingTasks(true)
      const response = await dashboardApi.getWorkerUserTasks({ limit: 100 })
      const responseData = response.success && response.data ? (response.data as any) : null
      const payload = responseData?.data ?? responseData
      const routine = Array.isArray(payload?.routine_tasks) ? payload.routine_tasks : []
      const nonRoutineRaw = Array.isArray(payload?.non_routine_tasks) ? payload.non_routine_tasks : []
      const nonRoutine = nonRoutineRaw.map(normalizeFlatUserTask)

      setRoutineUserTasks(routine)
      setNonRoutineUserTasks(nonRoutine)
    } catch (error) {
      console.error('Error loading user tasks:', error)
      toast.error('Terjadi kesalahan saat memuat data task')
      setRoutineUserTasks([])
      setNonRoutineUserTasks([])
    } finally {
      setIsLoadingTasks(false)
    }
  }

  useEffect(() => {
    loadAttendanceHistory()
    loadUserTasks()
  }, [])

  // Format date untuk display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get route based on task group or role
  const getTaskRoute = (task: UserTask): string | null => {
    const taskData = task.task
    if (!taskData) return null

    // Check task_group name first
    const taskGroupName = taskData.task_group?.name?.toLowerCase() || ''
    if (taskGroupName.includes('security') || taskGroupName.includes('keamanan')) {
      return '/security-guard'
    }
    if (taskGroupName.includes('cleaning') || taskGroupName.includes('kebersihan')) {
      return '/cleaning-program'
    }

    // Fallback to role name
    const roleName = taskData.role?.name?.toLowerCase() || ''
    if (roleName.includes('security') || roleName.includes('keamanan')) {
      return '/security-guard'
    }
    if (roleName.includes('cleaning') || roleName.includes('kebersihan')) {
      return '/cleaning-program'
    }

    return null
  }

  const handleStartTask = async (userTaskId: number) => {
    try {
      const response = await userTasksApi.startUserTask(userTaskId)
      
      if (response.success) {
        toast.success('Task berhasil dimulai')
        await loadUserTasks()
      } else {
        throw new Error(response.error || 'Gagal memulai task')
      }
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan saat memulai task')
      throw error
    }
  }

  const handleCompleteTask = (userTask: UserTask) => {
    setSelectedUserTask(userTask)
    setIsCompleteDialogOpen(true)
  }

  const handleCompleteSuccess = () => {
    loadUserTasks()
  }

  const handleTaskClick = (task: UserTask) => {
    const route = getTaskRoute(task)
    if (route) {
      router.push(route)
    }
  }

  const flattenRoutineTasks = (tasks: UserTask[]): UserTask[] => {
    return tasks.flatMap((task) => {
      const mainTaskId = task.user_task_id ?? task.id
      const normalizedMain: UserTask = {
        ...task,
        user_task_id: mainTaskId,
      }
      const subTasks = Array.isArray(task.sub_user_task)
        ? task.sub_user_task.map((subTask) => ({
            ...subTask,
            user_task_id: subTask.user_task_id ?? subTask.id,
          }))
        : []
      return [normalizedMain, ...subTasks]
    })
  }

  const allTasksForStats = [...flattenRoutineTasks(routineUserTasks), ...nonRoutineUserTasks]
  const isTaskCompleted = (t: UserTask) => t.status === 'completed' || !!t.completed_at
  const isTaskInProgress = (t: UserTask) =>
    (t.status === 'in_progress' || t.status === 'inprogress') &&
    !!(t.started_at || t.start_at) &&
    !t.completed_at
  const isTaskPending = (t: UserTask) =>
    t.status === 'pending' && !(t.started_at || t.start_at) && !t.completed_at

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Worker</h1>
        <p className="text-muted-foreground">
          Informasi absensi dan tugas Anda
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Section */}
        <div className="space-y-6">
          {/* Today's Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Absensi Hari Ini
              </CardTitle>
              <CardDescription>
                Status absensi masuk dan keluar Anda hari ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LoadingSkeleton height="h-64" text="Memuat..." />}>
                <AttendanceCard />
              </Suspense>
            </CardContent>
          </Card>

          {/* Attendance History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Riwayat Absensi
              </CardTitle>
              <CardDescription>
                Riwayat absensi 10 hari terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttendance ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-muted-foreground">Memuat riwayat absensi...</p>
                  </div>
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Belum ada riwayat absensi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attendanceHistory.map((attendance) => (
                    <div
                      key={attendance.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-sm">
                            {attendance.asset?.name || 'Asset'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 font-medium">Masuk:</span>
                            <span>{formatDate(attendance.check_in_time)}</span>
                            <span>{formatTime(attendance.check_in_time)}</span>
                          </div>
                          {attendance.check_out_time && (
                            <div className="flex items-center gap-2">
                              <span className="text-red-600 font-medium">Keluar:</span>
                              <span>{formatDate(attendance.check_out_time)}</span>
                              <span>{formatTime(attendance.check_out_time)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {attendance.status === 'checked_out' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Tasks Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Tugas Saya
              </CardTitle>
              <CardDescription>
                Daftar tugas yang perlu dikerjakan. Klik task untuk membuka halaman detail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Task non-rutin</h3>
                    <TaskList
                      userTasks={nonRoutineUserTasks}
                      isLoading={false}
                      onStartTask={handleStartTask}
                      onCompleteTask={handleCompleteTask}
                      onTaskClick={handleTaskClick}
                      variant="non-routine"
                      emptyListMessage="Belum ada task non-rutin"
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Task rutin (generate)</h3>
                    <TaskList
                      userTasks={routineUserTasks}
                      isLoading={false}
                      onStartTask={handleStartTask}
                      onCompleteTask={handleCompleteTask}
                      onTaskClick={handleTaskClick}
                      variant="routine"
                      emptyListMessage="Belum ada task rutin"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Task Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Statistik Tugas
              </CardTitle>
              <CardDescription>
                Ringkasan status tugas Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-gray-50">
                    <div className="text-2xl font-bold text-gray-900">
                      {allTasksForStats.filter(isTaskPending).length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Pending</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-blue-50">
                    <div className="text-2xl font-bold text-blue-900">
                      {allTasksForStats.filter(isTaskInProgress).length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Sedang Dikerjakan</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-green-50">
                    <div className="text-2xl font-bold text-green-900">
                      {allTasksForStats.filter(isTaskCompleted).length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Selesai</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Task Dialog */}
      <CompleteTaskDialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
        userTask={selectedUserTask}
        onComplete={handleCompleteSuccess}
      />
    </div>
  )
}

export default function DashboardWorkerPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Memuat dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <DashboardWorkerContent />
    </Suspense>
  )
}

