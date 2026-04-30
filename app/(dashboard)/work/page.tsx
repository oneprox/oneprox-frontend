'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { userTasksApi, UserTask } from '@/lib/api'
import toast from 'react-hot-toast'
import { GenerateTaskButton } from '../../../components/work/GenerateTaskButton'
import { TaskList } from '../../../components/work/TaskList'
import { CompleteTaskDialog } from '../../../components/work/CompleteTaskDialog'
import {
  filterRoutineTasksForToday,
  normalizeFlatUserTask,
  parseNonRoutineUserTasksResponse,
  parseRoutineUserTasksResponse,
} from '@/lib/work/userTasksSplit'

function WorkContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [routineUserTasks, setRoutineUserTasks] = useState<UserTask[]>([])
  const [nonRoutineUserTasks, setNonRoutineUserTasks] = useState<UserTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserTask, setSelectedUserTask] = useState<UserTask | null>(null)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)

  const loadUserTasks = async () => {
    try {
      setIsLoading(true)
      const [routineRes, nonRoutineRes] = await Promise.all([
        userTasksApi.getUserTasks({ limit: 10000 }),
        userTasksApi.getNonRoutineUserTasks(),
      ])

      let routine: UserTask[] = []
      if (routineRes.success && routineRes.data != null) {
        routine = parseRoutineUserTasksResponse(routineRes.data)
      } else if (!routineRes.success) {
        console.error('Failed to load routine user tasks:', routineRes.error)
      }

      let nonRoutine: UserTask[] = []
      if (nonRoutineRes.success && nonRoutineRes.data != null) {
        nonRoutine = parseNonRoutineUserTasksResponse(nonRoutineRes.data).map(normalizeFlatUserTask)
      } else if (!nonRoutineRes.success) {
        console.error('Failed to load non-routine user tasks:', nonRoutineRes.error)
      }

      setRoutineUserTasks(routine)
      setNonRoutineUserTasks(nonRoutine)
    } catch (error) {
      console.error('Error loading user tasks:', error)
      toast.error('Terjadi kesalahan saat memuat data')
      setRoutineUserTasks([])
      setNonRoutineUserTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUserTasks()
  }, [])

  const handleGenerateSuccess = () => {
    loadUserTasks()
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

  const getPageTitle = () => {
    // Check if there's a taskGroup query parameter
    const taskGroup = searchParams?.get('taskGroup')
    
    if (taskGroup) {
      const routeTitleMap: Record<string, string> = {
        'security-guard': 'Security Guard',
        'cleaning-program': 'Cleaning Program',
      }
      
      // Return mapped title or format the taskGroup parameter
      return routeTitleMap[taskGroup] || taskGroup.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    } else {
      return 'Pekerjaan'
    }
    
  }

  const routineTasksForToday = filterRoutineTasksForToday(routineUserTasks)
  const hasRoutineTasksToday = routineTasksForToday.length > 0
  const hasNonRoutineThisMonth = nonRoutineUserTasks.length > 0

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {getPageTitle()}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Task non-rutin (bulanan) dan task rutin (generate shift) ditampilkan terpisah
          </p>
        </div>
      </div>

      {/* Generate rutin — hanya jika tidak ada task rutin hari ini (non-rutin tidak pakai generate) */}
      {!isLoading && !hasRoutineTasksToday && (
        <Card>
          <CardContent className="flex items-center justify-center py-8 md:py-12 px-4">
            <div className="text-center space-y-4 w-full max-w-md">
              <p className="text-sm md:text-base text-muted-foreground">
                {hasNonRoutineThisMonth
                  ? 'Belum ada task rutin (shift) untuk hari ini. Task non-rutin bulan ini ada di bawah.'
                  : 'Belum ada user task rutin untuk hari ini'}
              </p>
              <div className="flex justify-center">
                <GenerateTaskButton onGenerateSuccess={handleGenerateSuccess} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Task rutin (generate)</h2>
          <p className="text-sm text-muted-foreground">
            Dari generate task shift; tampil jika dibuat hari ini
          </p>
          <TaskList
            userTasks={routineTasksForToday}
            isLoading={isLoading}
            onStartTask={handleStartTask}
            onCompleteTask={handleCompleteTask}
            variant="routine"
            emptyListMessage="Tidak ada task rutin untuk hari ini"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Task non-rutin</h2>
          <p className="text-sm text-muted-foreground">
            Dari API non-rutin: filter bulan berjalan (created_at), jatuh tempo di kolom tanggal
          </p>
          <TaskList
            userTasks={nonRoutineUserTasks}
            isLoading={isLoading}
            onStartTask={handleStartTask}
            onCompleteTask={handleCompleteTask}
            variant="non-routine"
            emptyListMessage="Tidak ada task non-rutin untuk hari ini"
          />
        </section>
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

export default function WorkPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Memuat...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <WorkContent />
    </Suspense>
  )
}
