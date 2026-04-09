'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Task, tasksApi, Asset, assetsApi, Role, rolesApi, TaskGroup, taskGroupsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, StickyNote, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import TasksTable from '@/components/table/tasks-table'
import TaskDetailDialog from '@/components/dialogs/task-detail-dialog'
import toast from 'react-hot-toast'
import { mergeNonRoutineTasksForDisplay } from '@/lib/mergeNonRoutineTasksForDisplay'

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  
  // Filter states
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [taskGroupFilter, setTaskGroupFilter] = useState<string>('all')
  const [mainTaskFilter, setMainTaskFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<string>('asc')
  
  // Options for filters
  const [assets, setAssets] = useState<Asset[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])

  const loadTasks = async () => {
    setLoading(true)
    try {
      // const filterParams: any = {}
      // if (searchTerm.trim()) {
      //   filterParams.name = searchTerm.trim()
      // }
      // if (assetFilter !== 'all') {
      //   filterParams.asset_id = assetFilter
      // }
      // if (roleFilter !== 'all') {
      //   filterParams.role_id = parseInt(roleFilter)
      // }
      // if (taskGroupFilter !== 'all') {
      //   filterParams.task_group_id = parseInt(taskGroupFilter)
      // }
      // if (mainTaskFilter !== 'all') {
      //   filterParams.is_main_task = mainTaskFilter === 'yes'
      // }
      // if (sortBy && sortOrder) {
      //   filterParams.order = `${sortBy}_${sortOrder}`
      // }
      
      const response = await tasksApi.getTasks({})
      
      console.log('Tasks API Response:', response)
      
      if (response.success && response.data) {
        // Handle new nested structure: response.data.data contains the array (same as assets)
        const responseData = response.data as any
        console.log('Response data structure:', responseData)
        
        // Try multiple structures - backend might return different formats
        let tasksData: Task[] = []
        
        // Extract tasks from responseData.data.tasks
        if (responseData && typeof responseData === 'object') {
          if (responseData.data && Array.isArray(responseData.data.tasks)) {
            tasksData = responseData.data.tasks
            console.log('Found responseData.data.tasks:', tasksData.length, 'tasks')
          } else if (Array.isArray(responseData.tasks)) {
            tasksData = responseData.tasks
            console.log('Found responseData.tasks:', tasksData.length, 'tasks')
          } else if (Array.isArray(responseData.data)) {
            tasksData = responseData.data
            console.log('Found responseData.data (array):', tasksData.length, 'tasks')
          } else if (Array.isArray(responseData)) {
            tasksData = responseData
            console.log('Found direct array:', tasksData.length, 'tasks')
          }
        }
        
        // Ensure tasksData is always an array
        if (!Array.isArray(tasksData)) {
          console.error('tasksData is not an array:', tasksData)
          tasksData = []
        }
        
        // Normalize task data - convert string IDs to numbers where needed
        tasksData = tasksData.map((task: any) => ({
          ...task,
          id: typeof task.id === 'string' ? parseInt(task.id) : task.id,
          role_id: typeof task.role_id === 'string' ? parseInt(task.role_id) : task.role_id,
          duration: typeof task.duration === 'string' ? parseInt(task.duration) : task.duration,
          task_group_id: task.task_group_id ? (typeof task.task_group_id === 'string' ? parseInt(task.task_group_id) : task.task_group_id) : undefined,
          parent_task_id: task.parent_task_id ? (typeof task.parent_task_id === 'string' ? parseInt(task.parent_task_id) : task.parent_task_id) : undefined,
        }))

        tasksData = mergeNonRoutineTasksForDisplay(tasksData)
        
        console.log('Final parsed tasks:', tasksData.length)
        if (tasksData.length > 0) {
          console.log('Sample task:', tasksData[0])
        }
        
        setTasks(tasksData)
        setFilteredTasks(tasksData)
      } else {
        console.error('API error or no data:', response)
        toast.error(response.error || 'Failed to load tasks')
        setTasks([])
        setFilteredTasks([])
      }
    } catch (error) {
      console.error('Load tasks error:', error)
      toast.error('An error occurred while loading tasks')
      setTasks([])
      setFilteredTasks([])
    } finally {
      setLoading(false)
    }
  }

  const loadAssets = async () => {
    try {
      const response = await assetsApi.getAssets()
      if (response.success && response.data) {
        const responseData = response.data as any
        const assetsData = Array.isArray(responseData.data) ? responseData.data : []
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
        setRoles(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error('Load roles error:', error)
    }
  }

  const loadTaskGroups = async () => {
    try {
      const response = await taskGroupsApi.getTaskGroups()
      if (response.success && response.data) {
        const responseData = response.data as any
        // Handle new format: { taskGroups: [...], total: ..., ... }
        let taskGroupsData: any[] = []
        if (responseData.taskGroups && Array.isArray(responseData.taskGroups)) {
          taskGroupsData = responseData.taskGroups
        } else if (Array.isArray(responseData.data)) {
          taskGroupsData = responseData.data
        } else if (Array.isArray(responseData)) {
          taskGroupsData = responseData
        }
        setTaskGroups(taskGroupsData)
      }
    } catch (error) {
      console.error('Load task groups error:', error)
    }
  }

  useEffect(() => {
    loadTasks()
    loadAssets()
    loadRoles()
    loadTaskGroups()
  }, [])

  // Reload data when filters change
  useEffect(() => {
    loadTasks()
  }, [searchTerm, assetFilter, roleFilter, taskGroupFilter, mainTaskFilter, sortBy, sortOrder])

  const handleEdit = (task: Task) => {
    router.push(`/tasks/edit/${task.id}`)
  }

  const handleView = (task: Task) => {
    setSelectedTask(task)
    setDetailDialogOpen(true)
  }

  const handleRefresh = () => {
    loadTasks()
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
            <BreadcrumbPage className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Tasks
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage tasks and their configurations
          </p>
        </div>
        <Button onClick={() => router.push('/tasks/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tasks List</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>
            
            <Select value={assetFilter} onValueChange={setAssetFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Asset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={taskGroupFilter} onValueChange={setTaskGroupFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Task Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {taskGroups.map((tg) => (
                  <SelectItem key={tg.id} value={tg.id.toString()}>
                    {tg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={mainTaskFilter} onValueChange={setMainTaskFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Main Task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="yes">Main Tasks</SelectItem>
                <SelectItem value="no">Sub Tasks</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="created_at">Created Date</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[120px] bg-white">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">A - Z</SelectItem>
                <SelectItem value="desc">Z - A</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm('')
                setAssetFilter('all')
                setRoleFilter('all')
                setTaskGroupFilter('all')
                setMainTaskFilter('all')
                setSortBy('name')
                setSortOrder('asc')
              }}
            >
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading tasks...</span>
              </div>
            </div>
          ) : (
            <TasksTable
              tasks={filteredTasks}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        task={selectedTask}
      />
    </div>
  )
}

