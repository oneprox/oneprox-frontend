'use client'

import React, { useState, useEffect } from 'react'
import { Task, tasksApi } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Edit, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface TasksTableProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onView: (task: Task) => void
  onRefresh: () => void
  loading?: boolean
}

export default function TasksTable({ 
  tasks, 
  onEdit, 
  onView, 
  onRefresh, 
  loading = false 
}: TasksTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [tasks])

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return

    setDeleting(true)
    try {
      const mergedIds = taskToDelete._mergedNonRoutineTaskIds
      const idsToDelete =
        mergedIds && mergedIds.length > 0
          ? mergedIds
          : [typeof taskToDelete.id === 'string' ? parseInt(taskToDelete.id, 10) : taskToDelete.id]

      const results = await Promise.all(idsToDelete.map((id) => tasksApi.deleteTask(id)))
      const allOk = results.every((r) => r.success)

      if (allOk) {
        toast.success(
          idsToDelete.length > 1
            ? `${idsToDelete.length} task non-rutin berhasil dihapus`
            : 'Task deleted successfully'
        )
        onRefresh()
      } else {
        const err = results.find((r) => !r.success)
        toast.error(err?.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Delete task error:', error)
      toast.error('An error occurred while deleting task')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setTaskToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    if (!mounted) return 'Loading...'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Main Task</TableHead>
              <TableHead>Scan</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No tasks found
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task, index) => {
                const isLast = index === tasks.length - 1;
                return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{String(index + 1)}</TableCell>
                  <TableCell className="font-medium">
                    <div className="space-y-1 min-w-0">
                      <div className="truncate">{task.name || '-'}</div>
                      {task.is_routine === false && (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs font-normal">
                            Non-rutin
                          </Badge>
                          <Badge variant="outline" className="text-xs font-normal">
                            {task.monthly_frequency ??
                              task.non_routine_items?.length ??
                              1}
                            × / bulan
                          </Badge>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.asset?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {task.role?.name || '-'}
                  </TableCell>
                  <TableCell>{task.duration} min</TableCell>
                  <TableCell>
                    <Badge variant={task.is_main_task ? 'default' : 'outline'}>
                      {task.is_main_task ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.is_scan ? 'default' : 'outline'}>
                      {task.is_scan ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.created_at ? formatDate(task.created_at) : '-'}
                  </TableCell>
                  <TableCell
                      className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                          }`}
                  >
                      <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => onView(task)} className="rounded-[50%] text-blue-500 bg-blue-500/10">
                              <Eye className="w-5 h-5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onEdit(task)} className="rounded-[50%] text-green-600 bg-green-600/10">
                              <Edit className="w-5 h-5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(task)} className="rounded-[50%] text-red-500 bg-red-500/10">
                              <Trash2 className="w-5 h-5" />
                          </Button>
                      </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete task <strong>{taskToDelete?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

