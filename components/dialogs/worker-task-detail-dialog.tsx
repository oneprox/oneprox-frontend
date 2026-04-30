'use client'

import React, { useState, useEffect } from 'react'
import { UserTask, User, usersApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Calendar, Clock, Building2, CheckCircle2, XCircle, Play, User as UserIcon, Users, Loader2 } from 'lucide-react'

interface WorkerTaskDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userTask: UserTask | null
}

export default function WorkerTaskDetailDialog({
  open,
  onOpenChange,
  userTask
}: WorkerTaskDetailDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load active users when dialog opens
  useEffect(() => {
    if (open) {
      loadActiveUsers()
    }
  }, [open])

  const loadActiveUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await usersApi.getUsers({ 
        status: 'active',
        limit: 1000 
      })
      if (response.success && response.data) {
        const responseData = response.data as any
        const users = Array.isArray(responseData.data) 
          ? responseData.data 
          : (Array.isArray(responseData) ? responseData : [])
        setActiveUsers(users.filter((user: User) => user.status === 'active'))
      }
    } catch (error) {
      console.error('Error loading active users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!userTask || !open) return null

  const formatDate = (dateString: string | undefined | null) => {
    if (!mounted) return 'Loading...'
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (dateString: string | undefined | null) => {
    if (!mounted) return 'Loading...'
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getStatusBadge = () => {
    const isPending = userTask.status === 'pending' && !userTask.started_at && !userTask.start_at
    const isInProgress = (userTask.status === 'in_progress' || userTask.status === 'inprogress') && 
                         (userTask.started_at || userTask.start_at) && 
                         !userTask.completed_at
    const isCompleted = userTask.status === 'completed' || userTask.completed_at

    if (isCompleted) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Selesai
        </Badge>
      )
    }
    if (isInProgress) {
      return (
        <Badge variant="default" className="bg-blue-600">
          <Play className="h-3 w-3 mr-1" />
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

  const task = userTask.task

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">
              {task?.name || 'Detail Task'}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {task?.duration && (
                <span className="text-xs text-muted-foreground">
                  {task.duration} menit
                </span>
              )}
            </div>

            {/* Task Information - Compact */}
            {task && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {task.scan_code && (
                  <div>
                    <span className="text-muted-foreground">Scan Code: </span>
                    <span className="font-medium">{task.scan_code}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Tipe: </span>
                  <Badge variant={task.is_main_task ? 'default' : 'outline'} className="text-xs">
                    {task.is_main_task ? 'Main' : 'Child'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Timeline - Compact */}
            <div className="space-y-2 text-sm border-t pt-3">
              {userTask.scheduled_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Jadwal: </span>
                  <span className="font-medium">{formatDate(userTask.scheduled_at)}</span>
                </div>
              )}
              {userTask.time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Waktu: </span>
                  <span className="font-medium">{userTask.time}</span>
                </div>
              )}
              {(userTask.started_at || userTask.start_at) && (
                <div className="flex items-center gap-2">
                  <Play className="h-3 w-3 text-blue-600" />
                  <span className="text-muted-foreground">Tanggal & Jam Dimulai: </span>
                  <span className="font-medium">{formatDateTime(userTask.started_at || userTask.start_at || null)}</span>
                </div>
              )}
              {userTask.completed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-muted-foreground">Tanggal & Jam Selesai: </span>
                  <span className="font-medium">{formatDateTime(userTask.completed_at)}</span>
                </div>
              )}
            </div>

            {/* Asset & User - Compact */}
            <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
              {task?.asset && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Asset:</span>
                  </div>
                  <p className="font-medium">{task.asset.name}</p>
                  {task.asset.code && (
                    <p className="text-xs text-muted-foreground">Code: {task.asset.code}</p>
                  )}
                </div>
              )}
              {userTask.user && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Pekerja:</span>
                  </div>
                  <p className="font-medium">{userTask.user.name}</p>
                  {userTask.user.email && (
                    <p className="text-xs text-muted-foreground">{userTask.user.email}</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {userTask.notes && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-1">Catatan:</p>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded">{userTask.notes}</p>
              </div>
            )}

            {/* Evidence */}
            {userTask.evidences && userTask.evidences.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-2">Bukti Pengerjaan:</p>
                <div className="grid grid-cols-2 gap-2">
                  {userTask.evidences.map((evidence: any, index: number) => (
                    <div key={index} className="space-y-1">
                      {evidence.photo_url && (
                        <img
                          src={evidence.photo_url}
                          alt={`Evidence ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                      )}
                      {evidence.notes && (
                        <p className="text-xs text-muted-foreground">{evidence.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Users List */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Daftar Pekerja Aktif</h3>
              </div>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : activeUsers.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {activeUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                      {user.role && (
                        <Badge variant="outline" className="text-xs">
                          {user.role.name}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tidak ada pekerja aktif
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

