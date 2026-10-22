'use client'

import React, { useState } from 'react'
import { UserTask } from '@/lib/api'
import {
  compareNonRoutineByDue,
  formatNonRoutineJatuhTempo,
  getNonRoutineUrgency,
} from '@/lib/work/nonRoutineDue'
import { Card, CardContent } from '@/components/ui/card'
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
import { Loader2, ChevronDown, ChevronRight, Play, Check, CheckCircle2, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface TaskListProps {
  userTasks: UserTask[]
  isLoading?: boolean
  onStartTask: (userTaskId: number) => Promise<void>
  onCompleteTask: (userTask: UserTask) => void
  onTaskClick?: (userTask: UserTask) => void
  /** non-rutin: tampilkan semua baris dengan task; urut berdasarkan start_at */
  variant?: 'routine' | 'non-routine'
  /** Saat array kosong */
  emptyListMessage?: string
  /** Saat tidak ada yang lolos filter (rutin: validasi/scan) */
  filterEmptyMessage?: string
  /** Jika false, tampilkan semua task dari endpoint tanpa filter requirement */
  filterByTaskRequirement?: boolean
}

export function TaskList({
  userTasks,
  isLoading,
  onStartTask,
  onCompleteTask,
  onTaskClick,
  variant = 'routine',
  emptyListMessage = 'Tidak ada task untuk hari ini',
  filterEmptyMessage,
  filterByTaskRequirement = true,
}: TaskListProps) {
  const defaultFilterEmpty =
    variant === 'non-routine'
      ? 'Tidak ada task non-rutin untuk hari ini'
      : 'Tidak ada task yang memerlukan validasi atau scan untuk hari ini'
  const resolvedFilterEmpty = filterEmptyMessage ?? defaultFilterEmpty
  const [expandedTasks, setExpandedTasks] = useState<Set<string | number>>(new Set())

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Memuat task...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (userTasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{emptyListMessage}</p>
        </CardContent>
      </Card>
    )
  }

  // Helper function to parse time string (HH:mm) to minutes for sorting
  const parseTimeToMinutes = (timeStr: string | undefined | null): number => {
    if (!timeStr) return 9999 // Put tasks without time at the end
    
    const parts = timeStr.split(':')
    if (parts.length !== 2) return 9999
    
    const hours = parseInt(parts[0], 10)
    const minutes = parseInt(parts[1], 10)
    
    if (isNaN(hours) || isNaN(minutes)) return 9999
    
    return hours * 60 + minutes
  }

  // Filter tasks yang bisa ditampilkan (is_need_validation atau is_scan)
  // Tampilkan main task jika memenuhi kriteria atau punya sub_task yang memenuhi kriteria
  const getDisplayableMainTasks = (tasks: UserTask[]): UserTask[] => {
    const filtered = tasks.filter((userTask) => {
      const task = userTask.task
      if (!task) return false

      if (variant === 'non-routine') {
        return true
      }

      if (!filterByTaskRequirement) {
        return true
      }

      if (task.is_need_validation || task.is_scan) {
        return true
      }

      if (userTask.sub_user_task && Array.isArray(userTask.sub_user_task)) {
        return userTask.sub_user_task.some((subTask) => {
          const subTaskData = subTask.task
          return subTaskData && (subTaskData.is_need_validation || subTaskData.is_scan)
        })
      }

      return false
    })

    if (variant === 'non-routine') {
      return filtered.sort(compareNonRoutineByDue)
    }

    return filtered.sort((a, b) => {
      const timeA = parseTimeToMinutes(a.time)
      const timeB = parseTimeToMinutes(b.time)
      return timeA - timeB
    })
  }

  const displayableMainTasks = getDisplayableMainTasks(userTasks)

  if (displayableMainTasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{resolvedFilterEmpty}</p>
        </CardContent>
      </Card>
    )
  }

  const toggleExpand = (taskId: string | number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const getSubTasks = (userTask: UserTask): UserTask[] => {
    if (!userTask.sub_user_task || !Array.isArray(userTask.sub_user_task)) {
      return []
    }
    
    const filtered = userTask.sub_user_task.filter(subTask => {
      const subTaskData = subTask.task
      if (!subTaskData) return false
      if (!filterByTaskRequirement) return true
      return subTaskData.is_need_validation || subTaskData.is_scan
    })
    
    // Sort by time first, then by task name
    return filtered.sort((a, b) => {
      const timeA = parseTimeToMinutes(a.time)
      const timeB = parseTimeToMinutes(b.time)
      
      // If times are different, sort by time
      if (timeA !== timeB) {
        return timeA - timeB
      }
      
      // If times are same or both missing, sort by name
      const nameA = a.task?.name || ''
      const nameB = b.task?.name || ''
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
    })
  }

  const nonRoutineBadgeClass = (urgency: ReturnType<typeof getNonRoutineUrgency>) => {
    if (urgency === 'overdue') return 'bg-red-600 hover:bg-red-600 text-white'
    if (urgency === 'week') return 'bg-yellow-500 hover:bg-yellow-500 text-black'
    if (urgency === 'twoweeks') return 'bg-blue-500 hover:bg-blue-500 text-white'
    return ''
  }

  const nonRoutineRowAccent = (
    notes: string | null | undefined,
    isCompleted: boolean
  ): string => {
    if (variant !== 'non-routine' || isCompleted) return ''
    const u = getNonRoutineUrgency(notes ?? null)
    if (u === 'overdue') return 'border-l-4 border-red-500'
    if (u === 'week') return 'border-l-4 border-yellow-500'
    if (u === 'twoweeks') return 'border-l-4 border-blue-500'
    return ''
  }

  const getStatusBadge = (userTask: UserTask) => {
    const isCompleted = userTask.status === 'completed' || userTask.completed_at
    const hasStarted =
      !!(userTask.started_at || userTask.start_at) ||
      userTask.status === 'inprogress' ||
      userTask.status === 'in_progress'
    const isInProgress =
      (userTask.status === 'in_progress' || userTask.status === 'inprogress') &&
      hasStarted &&
      !userTask.completed_at

    if (isCompleted) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Selesai
        </Badge>
      )
    }

    if (variant === 'non-routine') {
      const urgency = getNonRoutineUrgency(userTask.notes ?? null)
      const accent = nonRoutineBadgeClass(urgency)
      if (hasStarted || isInProgress) {
        return (
          <Badge variant="default" className={accent || 'bg-blue-600'}>
            <Clock className="h-3 w-3 mr-1" />
            Dalam Proses
          </Badge>
        )
      }
      return (
        <Badge variant={accent ? 'default' : 'secondary'} className={accent || undefined}>
          <XCircle className="h-3 w-3 mr-1" />
          Belum Dijalankan
        </Badge>
      )
    }

    if (isInProgress) {
      return (
        <Badge variant="default" className="bg-blue-600">
          <Clock className="h-3 w-3 mr-1" />
          Sedang Dikerjakan
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    )
  }

  const handleStartTaskInline = async (userTask: UserTask) => {
    const userTaskId = userTask.user_task_id || userTask.id
    if (!userTaskId) {
      toast.error('User task ID tidak ditemukan')
      return
    }
    try {
      await onStartTask(Number(userTaskId))
    } catch (error) {
      console.error('Error starting task:', error)
    }
  }

  const nonRoutineDueLabel = (ut: UserTask) =>
    formatNonRoutineJatuhTempo(ut.notes ?? null) ??
    (ut.start_at
      ? new Date(ut.start_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
      : null)

  const getTaskActions = (userTask: UserTask) => {
    const task = userTask.task
    if (!task) return null

    const isPending = userTask.status === 'pending' && !userTask.started_at && !userTask.start_at
    const hasStarted = !!(userTask.started_at || userTask.start_at)
    const isCompleted = userTask.status === 'completed' || userTask.completed_at
    const isInProgress = hasStarted && !isCompleted

    const canStart =
      isPending &&
      (variant === 'non-routine' || !filterByTaskRequirement || task.is_need_validation || task.is_scan)
    const canComplete = hasStarted && !isCompleted

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {canStart && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleStartTaskInline(userTask)
            }}
            size="sm"
            className="flex items-center gap-1 min-h-[36px] px-3"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Start</span>
          </Button>
        )}
        
        {canComplete && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onCompleteTask(userTask)
            }}
            size="sm"
            className="flex items-center gap-1 min-h-[36px] px-3"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Complete</span>
          </Button>
        )}

        {!canStart && !canComplete && getStatusBadge(userTask)}
      </div>
    )
  }

  // Mobile card view
  const renderMobileCard = (userTask: UserTask, isSubTask = false, parentTask?: UserTask) => {
    const task = userTask.task
    if (!task) return null

    const taskId = userTask.user_task_id || userTask.id || userTask.task_id
    const subTasks = getSubTasks(userTask)
    const hasSubTasks = subTasks.length > 0
    const isExpanded = expandedTasks.has(taskId)
    const shouldShowMainTask =
      variant === 'non-routine' || !filterByTaskRequirement || task.is_need_validation || task.is_scan

    if (isSubTask && !shouldShowMainTask) return null

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't trigger card click if clicking on buttons or expand button
      const target = e.target as HTMLElement
      if (target.closest('button')) {
        return
      }
      
      // If task has child tasks, expand/collapse them
      if (hasSubTasks) {
        toggleExpand(taskId)
        return
      }
      
      // If onTaskClick is provided, call it
      if (onTaskClick) {
        onTaskClick(userTask)
        return
      }
      
      // Otherwise, handle task actions
      const isPending = userTask.status === 'pending' && !userTask.started_at && !userTask.start_at
      const hasStarted = !!(userTask.started_at || userTask.start_at)
      const isCompleted = userTask.status === 'completed' || userTask.completed_at
      const isInProgress = hasStarted && !isCompleted
      const canComplete = hasStarted && !isCompleted

      if (canComplete) {
        onCompleteTask(userTask)
      } else if (
        isPending &&
        (variant === 'non-routine' || !filterByTaskRequirement || task.is_need_validation || task.is_scan)
      ) {
        handleStartTaskInline(userTask)
      }
    }

    return (
      <div key={taskId}>
        <button
          onClick={handleCardClick}
          className={`w-full text-left border rounded-lg p-4 space-y-3 transition-colors hover:bg-muted/50 active:bg-muted ${isSubTask ? 'ml-4 bg-muted/30' : 'bg-card'} ${nonRoutineRowAccent(userTask.notes, !!(userTask.status === 'completed' || userTask.completed_at))}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {hasSubTasks && !isSubTask && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(taskId)
                    }}
                    className="flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                )}
                {isSubTask && (
                  <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 flex-shrink-0"></div>
                )}
                <h3 className="font-medium text-sm md:text-base truncate">{task.name}</h3>
                {shouldShowMainTask && (
                  <div 
                    className="flex-shrink-0 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                  >
                    {getTaskActions(userTask)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
                {(userTask.time || (variant === 'non-routine' && nonRoutineDueLabel(userTask))) && (
                  <>
                    <span className="whitespace-nowrap">
                      {variant === 'non-routine' && !userTask.time
                        ? `Jatuh tempo: ${nonRoutineDueLabel(userTask) ?? '-'}`
                        : userTask.time
                          ? `Waktu: ${userTask.time}`
                          : ''}
                    </span>
                    {(task.is_main_task || task.asset?.name) &&
                      (userTask.time || (variant === 'non-routine' && nonRoutineDueLabel(userTask))) && (
                      <span>•</span>
                    )}
                  </>
                )}
                {task.is_main_task && (
                  <>
                    <span className="whitespace-nowrap">{task.duration} menit</span>
                    {task.asset?.name && <span>•</span>}
                  </>
                )}
                {!task.is_main_task && task.asset?.name && (
                  <span>•</span>
                )}
                {task.asset?.name && (
                  <span className="truncate whitespace-nowrap">{task.asset.name}</span>
                )}
              </div>
            </div>
          </div>
        </button>
        {hasSubTasks && isExpanded && !isSubTask && (
          <div className="mt-2 space-y-2">
            {subTasks.map((subTask) => renderMobileCard(subTask, true, userTask))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Main_task or Child_task</TableHead>
                <TableHead>Asset_name</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayableMainTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {resolvedFilterEmpty}
                  </TableCell>
                </TableRow>
              ) : (
                displayableMainTasks.map((userTask) => {
                  const task = userTask.task
                  if (!task) return null

                  const taskId = userTask.user_task_id || userTask.id || userTask.task_id
                  const subTasks = getSubTasks(userTask)
                  const hasSubTasks = subTasks.length > 0
                  const isExpanded = expandedTasks.has(taskId)
                  const shouldShowMainTask =
                    variant === 'non-routine' || !filterByTaskRequirement || task.is_need_validation || task.is_scan
                  const shouldShowMainTaskRow = shouldShowMainTask || hasSubTasks

                  if (!shouldShowMainTaskRow) return null

                  const handleRowClick = (e: React.MouseEvent) => {
                    // Don't trigger row click if clicking on buttons
                    const target = e.target as HTMLElement
                    if (target.closest('button')) {
                      return
                    }
                    
                    // If task has child tasks, expand/collapse them
                    if (hasSubTasks) {
                      toggleExpand(taskId)
                      return
                    }
                    
                    // If onTaskClick is provided, call it
                    if (onTaskClick) {
                      onTaskClick(userTask)
                    }
                  }

                  const rowCompleted = userTask.status === 'completed' || !!userTask.completed_at

                  return (
                    <React.Fragment key={taskId}>
                      {/* Main Task Row */}
                      <TableRow 
                        className={`${isExpanded && hasSubTasks ? 'bg-muted/50' : ''} ${onTaskClick ? 'cursor-pointer hover:bg-muted/30' : ''} ${nonRoutineRowAccent(userTask.notes, rowCompleted)}`}
                        onClick={onTaskClick ? handleRowClick : undefined}
                      >
                        <TableCell>
                          {hasSubTasks ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(taskId)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{task.name}</span>
                            {task.is_main_task && (
                              <span className="text-xs text-muted-foreground mt-1">
                                {task.duration} menit
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={task.is_main_task ? 'default' : 'outline'}>
                            {task.is_main_task ? 'Main Task' : 'Child Task'}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.asset?.name || '-'}</TableCell>
                        <TableCell>
                          {variant === 'non-routine'
                            ? nonRoutineDueLabel(userTask) ?? '-'
                            : userTask.time || '-'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {shouldShowMainTask ? getTaskActions(userTask) : '-'}
                        </TableCell>
                      </TableRow>

                      {/* Sub Tasks Rows */}
                      {hasSubTasks && isExpanded && subTasks.map((subTask) => {
                        const subTaskId = subTask.user_task_id || subTask.id || subTask.task_id
                        const subTaskData = subTask.task
                        
                        if (!subTaskData) return null

                        const handleSubTaskRowClick = (e: React.MouseEvent) => {
                          const target = e.target as HTMLElement
                          if (target.closest('button')) {
                            return
                          }
                          if (onTaskClick) {
                            onTaskClick(subTask)
                          }
                        }

                        return (
                          <TableRow 
                            key={subTaskId} 
                            className={`bg-muted/30 ${onTaskClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                            onClick={onTaskClick ? handleSubTaskRowClick : undefined}
                          >
                            <TableCell>
                              <div className="w-8 flex items-center justify-center">
                                <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300"></div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium pl-8">
                              {subTaskData.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant={subTaskData.is_main_task ? 'default' : 'outline'}>
                                {subTaskData.is_main_task ? 'Main Task' : 'Child Task'}
                              </Badge>
                            </TableCell>
                            <TableCell>{subTaskData.asset?.name || '-'}</TableCell>
                            <TableCell>{subTask.time || '-'}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {getTaskActions(subTask)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-3 overflow-x-hidden">
          {displayableMainTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {resolvedFilterEmpty}
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
              {displayableMainTasks.map((userTask) => renderMobileCard(userTask))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
