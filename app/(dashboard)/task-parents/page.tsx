'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Task, tasksApi, TaskGroup, taskGroupsApi, Asset, assetsApi, Role, rolesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Home, GitBranch, Plus, Search, RefreshCw, Loader2, ChevronRight, ChevronDown, Trash2, Edit, Eye } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import TaskDetailDialog from '@/components/dialogs/task-detail-dialog'
import { mergeNonRoutineTasksForDisplay } from '@/lib/mergeNonRoutineTasksForDisplay'

interface TaskWithChildren extends Task {
  children?: TaskWithChildren[]
  parent_task_ids?: number[]
}

export default function TaskParentsPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [taskGroupFilter, setTaskGroupFilter] = useState<string>('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [order, setOrder] = useState<string>('newest')
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false)
  const [selectedParentIds, setSelectedParentIds] = useState<number[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    try {
      // Build filter parameters for backend
      const filterParams: {
        name?: string
        asset_id?: string
        role_id?: number
        task_group_id?: number
        order?: string
      } = {}
      
      // Add order if provided
      if (order) {
        filterParams.order = order
      }

      // Add search term if provided
      if (searchTerm.trim()) {
        filterParams.name = searchTerm.trim()
      }

      // Add asset filter if selected
      if (assetFilter !== 'all') {
        filterParams.asset_id = assetFilter
      }

      // Add role filter if selected
      if (roleFilter !== 'all') {
        filterParams.role_id = parseInt(roleFilter)
      }

      // Add task group filter if selected
      if (taskGroupFilter !== 'all') {
        filterParams.task_group_id = parseInt(taskGroupFilter)
      }

      const response = await tasksApi.getTasks(filterParams)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        let tasksData: Task[] = []
        
        if (responseData && typeof responseData === 'object') {
          if (responseData.data && Array.isArray(responseData.data.tasks)) {
            tasksData = responseData.data.tasks
          } else if (Array.isArray(responseData.tasks)) {
            tasksData = responseData.tasks
          } else if (Array.isArray(responseData.data)) {
            tasksData = responseData.data
          } else if (Array.isArray(responseData)) {
            tasksData = responseData
          }
        }
        
        if (!Array.isArray(tasksData)) {
          tasksData = []
        }
        
        // Normalize task data
        tasksData = tasksData.map((task: any) => ({
          ...task,
          id: typeof task.id === 'string' ? parseInt(task.id) : task.id,
          role_id: typeof task.role_id === 'string' ? parseInt(task.role_id) : task.role_id,
          duration: typeof task.duration === 'string' ? parseInt(task.duration) : task.duration,
          task_group_id: task.task_group_id ? (typeof task.task_group_id === 'string' ? parseInt(task.task_group_id) : task.task_group_id) : undefined,
          parent_task_ids: task.parent_task_ids ? (Array.isArray(task.parent_task_ids) ? task.parent_task_ids.map((id: any) => typeof id === 'string' ? parseInt(id) : id) : []) : [],
        }))

        tasksData = mergeNonRoutineTasksForDisplay(tasksData)
        
        setTasks(tasksData)
      } else {
        toast.error(response.error || 'Gagal memuat tasks')
        setTasks([])
      }
    } catch (error) {
      console.error('Load tasks error:', error)
      toast.error('Terjadi kesalahan saat memuat tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const loadTaskGroups = async () => {
    try {
      // Fetch all task groups for the filter dropdown
      // Try with parameters first to get all task groups
      const response = await taskGroupsApi.getTaskGroups({
        limit: 100, // Get a large number to ensure we get all task groups
        offset: 0
      })
      if (response.success && response.data) {
        const responseData = response.data as any
        // Handle different response structures
        let taskGroupsData: TaskGroup[] = []
        
        // Check if responseData is directly an array
        if (Array.isArray(responseData)) {
          taskGroupsData = responseData
        } else if (responseData && typeof responseData === 'object') {
          // Check nested structures
          if (responseData.data && Array.isArray(responseData.data.taskGroups)) {
            // Format: responseData.data.taskGroups
            taskGroupsData = responseData.data.taskGroups
          } else if (Array.isArray(responseData.taskGroups)) {
            // Format: responseData.taskGroups
            taskGroupsData = responseData.taskGroups
          } else if (Array.isArray(responseData.data)) {
            taskGroupsData = responseData.data
          }
        }
        
        if (!Array.isArray(taskGroupsData)) {
          taskGroupsData = []
        }
        
        setTaskGroups(taskGroupsData)
      } else {
        console.error('Failed to load task groups:', response.error)
        setTaskGroups([])
      }
    } catch (error) {
      console.error('Load task groups error:', error)
      setTaskGroups([])
    }
  }

  const loadAssets = async () => {
    try {
      const response = await assetsApi.getAssets()
      if (response.success && response.data) {
        const responseData = response.data as any
        const assetsData = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setAssets(assetsData)
      }
    } catch (error) {
      console.error('Load assets error:', error)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await rolesApi.getRoles()
      if (response.success && response.data) {
        const responseData = response.data as any
        const rolesData = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setRoles(rolesData)
      }
    } catch (error) {
      console.error('Load roles error:', error)
    }
  }

  useEffect(() => {
    loadTaskGroups()
    loadAssets()
    loadRoles()
  }, [])


  // Reload tasks when filters change
  useEffect(() => {
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, assetFilter, roleFilter, taskGroupFilter, order])

  // Build hierarchy from tasks
  const buildHierarchy = (): TaskWithChildren[] => {
    const taskMap = new Map<number, TaskWithChildren>()
    const rootTasks: TaskWithChildren[] = []

    // First pass: create map of all tasks
    tasks.forEach(task => {
      taskMap.set(task.id as number, {
        ...task,
        children: [],
        parent_task_ids: (task.parent_task_ids || []).map((id: any) => typeof id === 'string' ? parseInt(id) : id) as number[]
      })
    })

    // Second pass: build hierarchy
    tasks.forEach(task => {
      const taskWithChildren = taskMap.get(task.id as number)!
      const parentIds = (task.parent_task_ids || []).map((id: any) => typeof id === 'string' ? parseInt(id) : id) as number[]
      
      if (parentIds.length === 0) {
        // Root task (no parents)
        rootTasks.push(taskWithChildren)
      } else {
        // Child task - add to each parent's children
        let hasParentInResults = false
        parentIds.forEach(parentId => {
          const parent = taskMap.get(parentId)
          if (parent) {
            hasParentInResults = true
            if (!parent.children) {
              parent.children = []
            }
            // Avoid duplicates
            if (!parent.children.some(t => t.id === task.id)) {
              parent.children.push(taskWithChildren)
            }
          }
        })
        
        // If none of the parents are in the filtered results, show the child task as root
        // This ensures child tasks are visible even when their parents don't match the filter
        if (!hasParentInResults) {
          rootTasks.push(taskWithChildren)
        }
      }
    })

    return rootTasks
  }

  // Build hierarchy from filtered tasks (filtering is done on backend)
  const getFilteredHierarchy = (): TaskWithChildren[] => {
    return buildHierarchy()
  }

  const toggleExpand = (taskId: number) => {
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

  const handleManageParents = (task: Task) => {
    setSelectedTask(task)
    const normalizedParentIds = (task.parent_task_ids || []).map((id: any) => typeof id === 'string' ? parseInt(id) : id) as number[]
    setSelectedParentIds(normalizedParentIds)
    setIsManageDialogOpen(true)
  }

  const handleEdit = (task: Task) => {
    router.push(`/tasks/edit/${task.id}`)
  }

  const handleView = (task: Task) => {
    setSelectedTask(task)
    setViewDialogOpen(true)
  }

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
          : [taskToDelete.id as number]

      const results = await Promise.all(idsToDelete.map((id) => tasksApi.deleteTask(id)))
      const allOk = results.every((r) => r.success)

      if (allOk) {
        toast.success(
          idsToDelete.length > 1
            ? `${idsToDelete.length} task non-rutin berhasil dihapus`
            : 'Task berhasil dihapus'
        )
        setDeleteDialogOpen(false)
        setTaskToDelete(null)
        await loadTasks()
      } else {
        const err = results.find((r) => !r.success)
        toast.error(err?.error || 'Gagal menghapus task')
      }
    } catch (error) {
      console.error('Delete task error:', error)
      toast.error('Terjadi kesalahan saat menghapus task')
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveParents = async () => {
    if (!selectedTask) return

    try {
      setIsSaving(true)
      const response = await tasksApi.updateTask(selectedTask.id as number, {
        parent_task_ids: selectedParentIds
      })

      if (response.success) {
        toast.success('Relasi parent task berhasil diperbarui')
        setIsManageDialogOpen(false)
        setSelectedTask(null)
        await loadTasks()
      } else {
        toast.error(response.error || 'Gagal memperbarui relasi parent task')
      }
    } catch (error) {
      console.error('Error updating parent tasks:', error)
      toast.error('Terjadi kesalahan saat memperbarui relasi')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveParent = async (childTaskId: number, parentTaskId: number) => {
    try {
      const childTask = tasks.find(t => t.id === childTaskId)
      if (!childTask) return

      const currentParentIds = (childTask.parent_task_ids || []).map((id: any) => typeof id === 'string' ? parseInt(id) : id) as number[]
      const updatedParentIds = currentParentIds.filter(id => id !== parentTaskId)

      const response = await tasksApi.updateTask(childTaskId as number, {
        parent_task_ids: updatedParentIds
      })

      if (response.success) {
        toast.success('Relasi parent task berhasil dihapus')
        await loadTasks()
      } else {
        toast.error(response.error || 'Gagal menghapus relasi parent task')
      }
    } catch (error) {
      console.error('Error removing parent task:', error)
      toast.error('Terjadi kesalahan saat menghapus relasi')
    }
  }

  const renderTaskRows = (task: TaskWithChildren, level: number = 0): React.ReactNode[] => {
    const hasChildren = task.children && task.children.length > 0
    const isExpanded = expandedTasks.has(task.id as number)

    const rows: React.ReactNode[] = []

    // Main task row
    rows.push(
      <TableRow key={task.id} className={isExpanded && hasChildren ? 'bg-muted/50' : level > 0 ? 'bg-muted/30' : ''}>
        <TableCell>
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpand(task.id as number)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : level > 0 ? (
            <div className="w-8 flex items-center justify-center">
              <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300"></div>
            </div>
          ) : null}
        </TableCell>
        <TableCell className="font-medium max-w-[300px]" style={{ paddingLeft: level > 0 ? `${level * 2}rem` : undefined }}>
          <div className="space-y-1 min-w-0">
            <div className="truncate" title={task.name}>
              {task.name}
            </div>
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
        <TableCell>{task.duration} menit</TableCell>
        <TableCell>
          <Badge variant={task.is_main_task ? 'default' : 'outline'}>
            {task.is_main_task ? 'Main Task' : 'Child Task'}
          </Badge>
        </TableCell>
        <TableCell>{task.role?.name || '-'}</TableCell>
        <TableCell>{task.asset?.name || '-'}</TableCell>
        <TableCell>
          <div className="flex justify-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleView(task)}
              className="rounded-[50%] text-blue-500 bg-blue-500/10"
            >
              <Eye className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEdit(task)}
              className="rounded-[50%] text-green-600 bg-green-600/10"
            >
              <Edit className="w-5 h-5" />
            </Button>
            {task.is_routine !== false && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleManageParents(task)}
                className="rounded-[50%] text-blue-500 bg-blue-500/10"
              >
                <GitBranch className="w-5 h-5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDeleteClick(task)}
              className="rounded-[50%] text-red-500 bg-red-500/10"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )

    // Child task rows
    if (hasChildren && isExpanded) {
      task.children!.forEach(child => {
        const childRows = renderTaskRows(child, level + 1)
        rows.push(...childRows)
      })
    }

    return rows
  }

  const filteredHierarchy = getFilteredHierarchy()


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
            <BreadcrumbPage className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Task
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Task</h1>
              <p className="text-muted-foreground">
                Kelola task dan relasi parent-child
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => router.push('/tasks/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Buat Task Baru
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari task..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>
            
            <Select value={taskGroupFilter} onValueChange={setTaskGroupFilter}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Task Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Task Group</SelectItem>
                {taskGroups.map((tg) => (
                  <SelectItem key={tg.id} value={tg.id.toString()}>
                    {tg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assetFilter} onValueChange={setAssetFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Asset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Asset</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={order} onValueChange={setOrder}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
                <SelectItem value="a-z">Nama A-Z</SelectItem>
                <SelectItem value="z-a">Nama Z-A</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                loadTasks()
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Memuat tasks...</span>
              </div>
            </div>
          ) : filteredHierarchy.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Tidak ada task ditemukan</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Task Type</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHierarchy.map(task => renderTaskRows(task)).flat()}
                </TableBody>
              </Table>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Manage Parents Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Parent Tasks: {selectedTask?.name}</DialogTitle>
            <DialogDescription>
              Pilih parent tasks untuk task ini. Task akan menjadi child dari parent yang dipilih.
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pilih Parent Tasks</Label>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  {tasks
                    .filter(t => t.id !== selectedTask.id)
                    .map(task => {
                      const taskId = task.id as number
                      const isChecked = selectedParentIds.includes(taskId)
                      
                      return (
                        <div key={task.id} className="flex items-center space-x-2 py-2">
                          <Checkbox
                            id={`parent-${task.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedParentIds([...selectedParentIds, taskId])
                              } else {
                                setSelectedParentIds(selectedParentIds.filter(id => id !== taskId))
                              }
                            }}
                          />
                          <label
                            htmlFor={`parent-${task.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium truncate" title={task.name}>{task.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {taskGroups.find(tg => tg.id === task.task_group_id)?.name || 'No group'}
                            </div>
                          </label>
                        </div>
                      )
                    })}
                </div>
              </div>

              {selectedParentIds.length > 0 && (
                <div className="space-y-2">
                  <Label>Parent Tasks yang Dipilih:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedParentIds.map(parentId => {
                      const parent = tasks.find(t => t.id === parentId)
                      return parent ? (
                        <span
                          key={parentId}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm truncate max-w-[200px] inline-block"
                          title={parent.name}
                        >
                          {parent.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsManageDialogOpen(false)}
                  disabled={isSaving}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSaveParents}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <TaskDetailDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        task={selectedTask}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Task</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus task &quot;{taskToDelete?.name}&quot;?
              {taskToDelete?._mergedNonRoutineTaskIds &&
              taskToDelete._mergedNonRoutineTaskIds.length > 1
                ? ` Ini akan menghapus ${taskToDelete._mergedNonRoutineTaskIds.length} task terkait (gabungan tampilan non-rutin).`
                : ' Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait task ini.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
