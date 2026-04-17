'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Calendar, Clock, MapPin, CheckCircle2, Eye, RefreshCw, ArrowLeft, User as UserIcon, ChevronDown, ChevronRight, Home, UserRoundPen } from 'lucide-react'
import { attendanceApi, userTasksApi, usersApi, Attendance, UserTask, User } from '@/lib/api'
import toast from 'react-hot-toast'
import WorkerTaskDetailDialog from '@/components/dialogs/worker-task-detail-dialog'

function WorkerDetailContent() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('attendance')
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([])
  const [userTasks, setUserTasks] = useState<UserTask[]>([])
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [selectedUserTask, setSelectedUserTask] = useState<UserTask | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const toLocalDateInputValue = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Initialize date range to start and end of current month
  // Default dari tanggal selalu tanggal 1
  const getStartOfMonth = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    // Always return date 1 of current month
    const date1 = new Date(year, month, 1)
    return toLocalDateInputValue(date1)
  }
  
  const getEndOfMonth = () => {
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return toLocalDateInputValue(endOfMonth)
  }
  
  const [dateFrom, setDateFrom] = useState<string>(getStartOfMonth())
  const [dateTo, setDateTo] = useState<string>(getEndOfMonth())
  
  // Separate date filters for tasks - default dari tanggal 1
  const [taskDateFrom, setTaskDateFrom] = useState<string>(getStartOfMonth())
  const [taskDateTo, setTaskDateTo] = useState<string>(getEndOfMonth())
  const [dateError, setDateError] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [allUserTasks, setAllUserTasks] = useState<UserTask[]>([])
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const getJakartaDateKey = (value?: string | Date): string | null => {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (!year || !month || !day) return null

    return `${year}-${month}-${day}`
  }

  const parseYmdToUtcDate = (ymd?: string): Date | null => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
    const [year, month, day] = ymd.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(Date.UTC(year, month - 1, day))
  }

  useEffect(() => {
    setMounted(true)
    // Ensure default dates are set to first day of month
    const startDate = getStartOfMonth()
    const endDate = getEndOfMonth()
    setDateFrom(startDate)
    setDateTo(endDate)
    setTaskDateFrom(startDate)
    setTaskDateTo(endDate)
  }, [])

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      if (!userId) {
        toast.error('User ID tidak ditemukan')
        router.push('/worker')
        return
      }
      
      setIsLoadingUser(true)
      try {
        const response = await usersApi.getUser(userId)
        
        if (response.success && response.data) {
          const responseData = response.data as any
          setUser(responseData.data || responseData)
        } else {
          toast.error('User tidak ditemukan')
          router.push('/worker')
        }
      } catch (error) {
        console.error('Load user error:', error)
        toast.error('Gagal memuat data user')
        router.push('/worker')
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()
  }, [userId, router])

  // Load attendance history
  const loadAttendanceHistory = async () => {
    if (!userId) return
    if (!validateDateRange(dateFrom, dateTo)) {
      return
    }

    setIsLoadingAttendance(true)
    try {
      console.log('Loading attendance for userId:', userId, 'dateFrom:', dateFrom, 'dateTo:', dateTo)
      const response = await attendanceApi.getUserAttendanceHistoryByDate(
        userId,
        dateFrom,
        dateTo
      ) as any
      
      console.log('Attendance API Response:', response)
      
      if (response.success) {
        // Handle different response structures
        let history: Attendance[] = []
        
        if (response.data) {
          const responseData = response.data as any
          
          // Check if responseData is directly an array
          if (Array.isArray(responseData)) {
            history = responseData
          } 
          // Check if responseData has a nested data property
          else if (responseData.data && Array.isArray(responseData.data)) {
            history = responseData.data
          }
          // Check if responseData has a nested history property
          else if (responseData.history && Array.isArray(responseData.history)) {
            history = responseData.history
          }
        }
        
        console.log('Parsed attendance history:', history)
        setAttendanceHistory(history)
        
        if (history.length === 0) {
          // No toast for empty results - just show empty table
        }
      } else {
        console.error('Failed to load attendance history:', response)
        setAttendanceHistory([])
        toast.error(response.error || response.message || 'Gagal memuat riwayat absensi')
      }
    } catch (error: any) {
      console.error('Error loading attendance history:', error)
      toast.error(error.message || 'Terjadi kesalahan saat memuat riwayat absensi')
      setAttendanceHistory([])
    } finally {
      setIsLoadingAttendance(false)
    }
  }

  // Load user tasks with date filter
  const loadUserTasks = async () => {
    if (!userId) return
    if (!validateDateRange(taskDateFrom, taskDateTo)) {
      return
    }
    
    setIsLoadingTasks(true)
    try {
      console.log('Loading user tasks for userId:', userId, 'dateFrom:', taskDateFrom, 'dateTo:', taskDateTo)
      const response = await userTasksApi.getUserTasks({ 
        limit: 1000, 
        user_id: userId,
        date_from: taskDateFrom,
        date_to: taskDateTo
      })
      
      console.log('User Tasks API Response:', response)
      
      if (response.success) {
        // Handle different response structures
        let tasks: UserTask[] = []
        const responseData = response.data as any
        
        if (Array.isArray(responseData)) {
          tasks = responseData
        } else if (responseData && typeof responseData === 'object' && Array.isArray(responseData.data)) {
          tasks = responseData.data
        } else if (responseData && typeof responseData === 'object' && responseData.tasks && Array.isArray(responseData.tasks)) {
          tasks = responseData.tasks
        }
        
        console.log('All tasks from API:', tasks)
        setUserTasks(tasks)
        
        if (tasks.length === 0) {
          // No toast for empty results - just show empty table
        }
      } else {
        console.error('Failed to load user tasks:', response)
        setUserTasks([])
        toast.error(response.error || 'Gagal memuat data kerja harian')
      }
    } catch (error: any) {
      console.error('Error loading user tasks:', error)
      toast.error(error.message || 'Terjadi kesalahan saat memuat data kerja harian')
      setUserTasks([])
    } finally {
      setIsLoadingTasks(false)
    }
  }

  // Load all user tasks for daily work statistics
  const loadAllUserTasks = async () => {
    if (!userId) return
    if (!validateDateRange(taskDateFrom, taskDateTo)) {
      return
    }
    
    setIsLoadingAllTasks(true)
    try {
      console.log('Loading all user tasks for userId:', userId, 'dateFrom:', taskDateFrom, 'dateTo:', taskDateTo)
      const response = await userTasksApi.getUserTasks({ 
        limit: 1000, 
        user_id: userId,
        date_from: taskDateFrom,
        date_to: taskDateTo
      })
      
      console.log('All User Tasks API Response:', response)
      
      if (response.success) {
        // Handle different response structures
        let tasks: UserTask[] = []
        const responseData = response.data as any
        
        if (Array.isArray(responseData)) {
          tasks = responseData
        } else if (responseData && typeof responseData === 'object' && Array.isArray(responseData.data)) {
          tasks = responseData.data
        } else if (responseData && typeof responseData === 'object' && responseData.tasks && Array.isArray(responseData.tasks)) {
          tasks = responseData.tasks
        }
        
        console.log('All tasks from API:', tasks)
        console.log('Number of tasks:', tasks.length)
        
        // Flatten tasks including sub_user_task for statistics
        const flattenedTasks: UserTask[] = []
        
        tasks.forEach(task => {
          // Add main task if it has created_at
          if (task.created_at) {
            const taskId = task.user_task_id || task.id
            flattenedTasks.push({
              ...task,
              id: typeof taskId === 'string' ? parseInt(taskId) : taskId,
              is_main_task: task.is_main_task !== false // Default to true if not specified
            })
          }
          
          // Add sub tasks if they exist
          if (task.sub_user_task && Array.isArray(task.sub_user_task)) {
            task.sub_user_task.forEach((subTask: UserTask) => {
              if (subTask.created_at) {
                const subTaskId = subTask.user_task_id || subTask.id
                flattenedTasks.push({
                  ...subTask,
                  id: typeof subTaskId === 'string' ? parseInt(subTaskId) : subTaskId,
                  is_main_task: subTask.is_main_task || false
                })
              }
            })
          }
        })
        
        console.log('Flattened tasks for statistics:', flattenedTasks)
        console.log('Number of flattened tasks:', flattenedTasks.length)
        
        setAllUserTasks(flattenedTasks)
      } else {
        console.error('Failed to load all user tasks:', response)
        setAllUserTasks([])
      }
    } catch (error: any) {
      console.error('Error loading all user tasks:', error)
      setAllUserTasks([])
    } finally {
      setIsLoadingAllTasks(false)
    }
  }

  // Check if main task is completed based on child tasks
  const isMainTaskCompletedByChildren = (mainTask: UserTask, allTasks: UserTask[]): boolean => {
    // Check if main task has validation or scan requirement
    const task = mainTask.task
    const hasValidationOrScan = task && ((task.is_need_validation === true) || (task.is_scan === true))
    
    // If main task has validation or scan, use its own status
    if (hasValidationOrScan) {
      return mainTask.status === 'completed' || (mainTask.completed_at !== null && mainTask.completed_at !== undefined)
    }
    
    // If main task doesn't have validation or scan, check child tasks
    // Find child tasks for this main task
    const mainTaskId = mainTask.user_task_id || mainTask.id
    const childTasks = allTasks.filter(t => {
      const parentId = t.parent_user_task_id
      return parentId && (parentId === mainTaskId || parentId === mainTask.id)
    })
    
    // If no child tasks, use main task's own status
    if (childTasks.length === 0) {
      return mainTask.status === 'completed' || (mainTask.completed_at !== null && mainTask.completed_at !== undefined)
    }
    
    // Check if all child tasks are completed
    const allChildrenCompleted = childTasks.every(childTask => {
      return childTask.status === 'completed' || (childTask.completed_at !== null && childTask.completed_at !== undefined)
    })
    
    return allChildrenCompleted
  }

  // Group tasks by date and calculate statistics
  const getDailyWorkStatistics = () => {
    console.log('Calculating statistics from allUserTasks:', allUserTasks.length)
    const dailyStats: Record<string, { date: string; completed: number; pending: number; total: number; percentage: number }> = {}
    
    // Group tasks by date first
    const tasksByDate: Record<string, UserTask[]> = {}
    
    allUserTasks.forEach(task => {
      if (!task.created_at) {
        console.log('Task without created_at:', task)
        return
      }
      
      try {
        const dateStr = getJakartaDateKey(task.created_at)
        if (!dateStr) return
        
        if (!tasksByDate[dateStr]) {
          tasksByDate[dateStr] = []
        }
        
        tasksByDate[dateStr].push(task)
      } catch (error) {
        console.error('Error processing task date:', error, task)
      }
    })
    
    // Process each date
    Object.keys(tasksByDate).forEach(dateStr => {
      const tasksForDate = tasksByDate[dateStr]
      
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          completed: 0,
          pending: 0,
          total: 0,
          percentage: 0
        }
      }
      
      // Get main tasks only
      const mainTasks = tasksForDate.filter(task => {
        return task.is_main_task === true || task.is_main_task === undefined
      })
      
      // Process each main task
      mainTasks.forEach(mainTask => {
        dailyStats[dateStr].total++
        
        // Check if completed (considering child tasks for tasks without validation/scan)
        const isCompleted = isMainTaskCompletedByChildren(mainTask, tasksForDate)
        
        if (isCompleted) {
          dailyStats[dateStr].completed++
        } else {
          dailyStats[dateStr].pending++
        }
      })
    })
    
    // Ensure all dates in selected filter range are represented, even if no task exists.
    const fromUtc = parseYmdToUtcDate(taskDateFrom)
    const toUtc = parseYmdToUtcDate(taskDateTo)
    if (fromUtc && toUtc && fromUtc.getTime() <= toUtc.getTime()) {
      const cursor = new Date(fromUtc)
      while (cursor.getTime() <= toUtc.getTime()) {
        const key = cursor.toISOString().slice(0, 10)
        if (!dailyStats[key]) {
          dailyStats[key] = {
            date: key,
            completed: 0,
            pending: 0,
            total: 0,
            percentage: 0
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }

    console.log('Daily stats before percentage calculation:', dailyStats)
    
    // Calculate percentage for each day
    Object.keys(dailyStats).forEach(date => {
      const stats = dailyStats[date]
      stats.percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    })
    
    const result = Object.values(dailyStats).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    
    console.log('Final statistics result:', result)
    return result
  }

  useEffect(() => {
    if (activeTab === 'attendance' && mounted && userId) {
      loadAttendanceHistory()
    } else if (activeTab === 'work' && mounted && userId) {
      loadUserTasks()
      loadAllUserTasks()
    }
  }, [activeTab, mounted, userId, dateFrom, dateTo, taskDateFrom, taskDateTo])

  // Validate date range (max 1 month)
  const validateDateRange = (from: string, to: string): boolean => {
    if (!from || !to) {
      setDateError('Tanggal dari dan sampai harus diisi')
      return false
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)

    if (fromDate > toDate) {
      setDateError('Tanggal dari tidak boleh lebih besar dari tanggal sampai')
      return false
    }

    // No maximum date range validation - removed as per user request
    setDateError('')
    return true
  }

  const handleDateFromChange = (value: string) => {
    setDateFrom(value)
    if (value && dateTo) {
      validateDateRange(value, dateTo)
    }
  }

  const handleDateToChange = (value: string) => {
    setDateTo(value)
    if (dateFrom && value) {
      validateDateRange(dateFrom, value)
    }
  }

  const handleTaskDateFromChange = (value: string) => {
    setTaskDateFrom(value)
    if (value && taskDateTo) {
      validateDateRange(value, taskDateTo)
    }
  }

  const handleTaskDateToChange = (value: string) => {
    setTaskDateTo(value)
    if (taskDateFrom && value) {
      validateDateRange(taskDateFrom, value)
    }
  }

  const formatTime = (timeString?: string) => {
    if (!timeString || !mounted) return '-'
    return new Date(timeString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (dateString?: string) => {
    if (!dateString || !mounted) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateShort = (dateString?: string) => {
    if (!dateString || !mounted) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getAttendanceStatusBadge = (attendance: Attendance) => {
    if (attendance.status === 'checked_out') {
      return <Badge variant="default" className="bg-green-600">Checked Out</Badge>
    }
    return <Badge variant="default" className="bg-blue-600">Checked In</Badge>
  }

  const getTaskStatusBadge = (userTask: UserTask) => {
    // Check if this is a main task without validation/scan
    const task = userTask.task
    const isMainTask = userTask.is_main_task === true || userTask.is_main_task === undefined
    const hasValidationOrScan = task && ((task.is_need_validation === true) || (task.is_scan === true))
    
    let isCompleted = false
    let isInProgress = false
    let isPending = false
    
    if (isMainTask && !hasValidationOrScan) {
      // For main task without validation/scan, check child tasks
      const mainTaskId = userTask.user_task_id || userTask.id
      const childTasks = allUserTasks.filter(t => {
        const parentId = t.parent_user_task_id
        return parentId && (parentId === mainTaskId || parentId === userTask.id)
      })
      
      if (childTasks.length > 0) {
        // Check if all child tasks are completed
        const allChildrenCompleted = childTasks.every(childTask => {
          return childTask.status === 'completed' || (childTask.completed_at !== null && childTask.completed_at !== undefined)
        })
        const anyChildInProgress = childTasks.some(childTask => {
          return (childTask.status === 'in_progress' || childTask.status === 'inprogress') && 
                 (childTask.started_at || childTask.start_at) && 
                 !childTask.completed_at
        })
        
        isCompleted = allChildrenCompleted
        isInProgress = anyChildInProgress && !allChildrenCompleted
        isPending = !isCompleted && !isInProgress
      } else {
        // No child tasks, use main task's own status
        isPending = (userTask.status === 'pending' && !userTask.started_at && !userTask.start_at) || false
        isInProgress = ((userTask.status === 'in_progress' || userTask.status === 'inprogress') && 
                       (userTask.started_at || userTask.start_at) && 
                       !(userTask.completed_at !== null && userTask.completed_at !== undefined)) || false
        isCompleted = (userTask.status === 'completed' || (userTask.completed_at !== null && userTask.completed_at !== undefined)) || false
      }
    } else {
      // For tasks with validation/scan or child tasks, use their own status
      isPending = (userTask.status === 'pending' && !userTask.started_at && !userTask.start_at) || false
      isInProgress = ((userTask.status === 'in_progress' || userTask.status === 'inprogress') && 
                     (userTask.started_at || userTask.start_at) && 
                     !(userTask.completed_at !== null && userTask.completed_at !== undefined)) || false
      isCompleted = (userTask.status === 'completed' || (userTask.completed_at !== null && userTask.completed_at !== undefined)) || false
    }

    if (isCompleted) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Selesai
        </Badge>
      )
    } else if (isInProgress) {
      return (
        <Badge variant="default" className="bg-blue-600">
          <Clock className="h-3 w-3 mr-1" />
          Sedang Dikerjakan
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary">
          Pending
        </Badge>
      )
    }
  }

  const handleViewTaskDetail = (userTask: UserTask) => {
    setSelectedUserTask(userTask)
    setIsDetailDialogOpen(true)
  }

  const toggleExpandDate = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  // Get tasks for a specific date
  const getTasksByDate = (date: string): UserTask[] => {
    return allUserTasks.filter(task => {
      if (!task.created_at) return false
      try {
        const taskDateStr = getJakartaDateKey(task.created_at)
        return taskDateStr === date
      } catch {
        return false
      }
    })
  }

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Memuat data pekerja...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Data pekerja tidak ditemukan</p>
        <Button onClick={() => router.push('/worker')}>
          Kembali ke Daftar Pekerja
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/worker" className="flex items-center gap-2">
              <UserRoundPen className="h-4 w-4" />
              Data Pekerja
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Detail: {user.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detail Pekerja</h1>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Informasi Pekerja
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nama</Label>
              <p className="font-medium">{user.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Email</Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">No. Telepon</Label>
              <p className="font-medium">{user.phone || '-'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Role</Label>
              <p className="font-medium">{user.role?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <p className="font-medium">{user.status || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="px-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-slate-600">
              <TabsList className='bg-transparent dark:bg-transparent rounded-none h-[50px] p-0'>
                <TabsTrigger 
                  value="attendance" 
                  className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'
                >
                  <Calendar className="h-4 w-4" />
                  Attendance
                </TabsTrigger>
                <TabsTrigger 
                  value="work" 
                  className='py-2.5 px-4 font-medium text-base inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 border-0 border-b-1 border-transparent dark:border-transparent data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 dark:data-[state=active]:bg-transparent rounded-[0] data-[state=active]:shadow-none cursor-pointer translate-y-px'
                >
                  <Clock className="h-4 w-4" />
                  Data Kerja Harian
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content: Attendance */}
            <TabsContent value="attendance" className="mt-0">
              <div className="p-6 space-y-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Data Attendance Harian
                  </CardTitle>
                  <CardDescription>
                    Riwayat absensi berdasarkan tanggal
                  </CardDescription>
                </CardHeader>

                {/* Date Filter */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="date-from">Dari Tanggal</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => handleDateFromChange(e.target.value)}
                        className="w-full"
                        max={dateTo}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="date-to">Sampai Tanggal</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => handleDateToChange(e.target.value)}
                        className="w-full"
                        min={dateFrom}
                      />
                    </div>
                    <Button
                      onClick={loadAttendanceHistory}
                      disabled={isLoadingAttendance || !!dateError}
                      variant="outline"
                    >
                      {isLoadingAttendance ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Memuat...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </div>
                  {dateError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {dateError}
                    </div>
                  )}
                </div>

                {/* Attendance Table */}
                {isLoadingAttendance ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Memuat riwayat absensi...</span>
                  </div>
                ) : attendanceHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Tidak ada riwayat absensi untuk tanggal yang dipilih</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Check In</TableHead>
                          <TableHead>Check Out</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceHistory.map((attendance) => (
                          <TableRow key={attendance.id}>
                            <TableCell>
                              {formatDateShort(attendance.check_in_time)}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{formatTime(attendance.check_in_time)}</p>
                            </TableCell>
                            <TableCell>
                              {attendance.check_out_time ? (
                                <p className="font-medium">{formatTime(attendance.check_out_time)}</p>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getAttendanceStatusBadge(attendance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab Content: Data Kerja Harian */}
            <TabsContent value="work" className="mt-0">
              <div className="p-6 space-y-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Data Kerja Harian
                  </CardTitle>
                  <CardDescription>
                    Statistik dan daftar tugas pekerja
                  </CardDescription>
                </CardHeader>

                {/* Date Filter for Tasks */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="task-date-from">Dari Tanggal</Label>
                      <Input
                        id="task-date-from"
                        type="date"
                        value={taskDateFrom}
                        onChange={(e) => handleTaskDateFromChange(e.target.value)}
                        className="w-full"
                        max={taskDateTo}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="task-date-to">Sampai Tanggal</Label>
                      <Input
                        id="task-date-to"
                        type="date"
                        value={taskDateTo}
                        onChange={(e) => handleTaskDateToChange(e.target.value)}
                        className="w-full"
                        min={taskDateFrom}
                      />
                    </div>
                    <Button
                      onClick={loadAllUserTasks}
                      disabled={isLoadingAllTasks || !!dateError}
                      variant="outline"
                    >
                      {isLoadingAllTasks ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Memuat...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </div>
                  {dateError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {dateError}
                    </div>
                  )}
                </div>

                {/* Daily Work Statistics Table with Expandable Task List */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Statistik Kerja Harian</h3>
                    {isLoadingAllTasks ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Memuat statistik...</span>
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Tanggal</TableHead>
                              <TableHead>Task Selesai</TableHead>
                              <TableHead>Task Belum Selesai</TableHead>
                              <TableHead>Total Task</TableHead>
                              <TableHead>Persentase</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getDailyWorkStatistics().length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  Tidak ada data kerja
                                </TableCell>
                              </TableRow>
                            ) : (
                              getDailyWorkStatistics().map((stat, index) => {
                                const isExpanded = expandedDates.has(stat.date)
                                const tasksForDate = getTasksByDate(stat.date)
                                const hasTasks = tasksForDate.length > 0
                                
                                return (
                                  <React.Fragment key={index}>
                                    <TableRow className={isExpanded ? 'bg-muted/50' : ''}>
                                      <TableCell>
                                        {hasTasks ? (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleExpandDate(stat.date)}
                                            className="h-8 w-8 p-0"
                                          >
                                            {isExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </Button>
                                        ) : (
                                          <div className="w-8"></div>
                                        )}
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {formatDateShort(stat.date)}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="default" className="bg-green-600">
                                          {stat.completed}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">
                                          {stat.pending}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">
                                          {stat.total}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                            <div
                                              className={`h-2 rounded-full ${
                                                stat.percentage >= 80
                                                  ? 'bg-green-600'
                                                  : stat.percentage >= 50
                                                  ? 'bg-yellow-600'
                                                  : 'bg-red-600'
                                              }`}
                                              style={{ width: `${stat.percentage}%` }}
                                            />
                                          </div>
                                          <span className="text-sm font-medium">{stat.percentage}%</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                    
                                    {/* Expanded Task List */}
                                    {isExpanded && hasTasks && (
                                      <TableRow>
                                        <TableCell colSpan={6} className="p-0 bg-muted/30">
                                          <div className="p-4">
                                            <h4 className="text-sm font-semibold mb-3">Daftar Task - {formatDateShort(stat.date)}</h4>
                                            <div className="rounded-md border bg-background max-h-[200px] overflow-y-auto overflow-x-auto">
                                              <Table>
                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                  <TableRow>
                                                    <TableHead>Nama Task</TableHead>
                                                    <TableHead>Waktu</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Aksi</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {tasksForDate.map((userTask) => {
                                                    const taskId = userTask.user_task_id || userTask.id || userTask.task_id
                                                    return (
                                                      <TableRow key={taskId}>
                                                        <TableCell className="font-medium">
                                                          {userTask.task?.name || 'Task'}
                                                          {userTask.is_main_task === false && (
                                                            <Badge variant="outline" className="ml-2 text-xs">
                                                              Sub Task
                                                            </Badge>
                                                          )}
                                                        </TableCell>
                                                        <TableCell>
                                                          {userTask.time || '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                          {getTaskStatusBadge(userTask)}
                                                        </TableCell>
                                                        <TableCell>
                                                          <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewTaskDetail(userTask)}
                                                            className="flex items-center gap-2"
                                                          >
                                                            <Eye className="h-4 w-4" />
                                                            Detail
                                                          </Button>
                                                        </TableCell>
                                                      </TableRow>
                                                    )
                                                  })}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <WorkerTaskDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        userTask={selectedUserTask}
      />
    </div>
  )
}

export default function WorkerDetailPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Memuat detail pekerja...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <WorkerDetailContent />
    </Suspense>
  )
}

