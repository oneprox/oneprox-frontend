'use client'

import React, { useState, useEffect } from 'react'
import { Task, CreateTaskData, UpdateTaskData, assetsApi, rolesApi, taskGroupsApi, tasksApi, scanInfoApi, usersApi, Asset, Role, TaskGroup, ScanInfo, User } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, X } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

/** Empty string is not valid for z.string().uuid(); routine tasks still keep non_routine_items with blank ids. */
const optionalUuid = z
  .string()
  .optional()
  .refine((val) => val === undefined || val === '' || z.string().uuid().safeParse(val).success, {
    message: 'User ID must be a valid UUID',
  })

const taskSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  is_routine: z.boolean().optional(),
  is_main_task: z.boolean().optional(),
  is_need_validation: z.boolean().optional(),
  is_scan: z.boolean().optional(),
  scan_code: z.string().optional().nullable(),
  duration: z.number().int().min(1, 'Duration must be at least 1 minute'),
  asset_id: z.string().min(1, 'Asset is required').uuid('Asset ID must be a valid UUID'),
  role_id: z.number().int().min(1, 'Role is required'),
  parent_task_ids: z.array(z.number().int()).optional(),
  task_group_id: z.number().int().optional().nullable(),
  days: z.array(z.number().int()).optional(),
  times: z.array(z.string()).optional(),
  monthly_frequency: z.number().int().min(1, 'Frekuensi minimal 1').max(5, 'Frekuensi maksimal 5').optional(),
  due_date: z.string().optional(),
  area: z.string().optional(),
  assigned_user_id: optionalUuid,
  non_routine_items: z.array(z.object({
    due_date: z.string().optional(),
    area: z.string().optional(),
    assigned_user_id: optionalUuid,
  })).optional(),
}).superRefine((data, ctx) => {
  if (data.is_routine === false) {
    if (!data.monthly_frequency || data.monthly_frequency < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monthly_frequency'],
        message: 'Frekuensi per bulan wajib diisi untuk task non-rutin',
      })
    }
    const expectedItems = data.monthly_frequency || 1
    const items = data.non_routine_items || []
    if (items.length !== expectedItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['non_routine_items'],
        message: `Detail non-rutin harus berjumlah ${expectedItems} item`,
      })
      return
    }

    items.forEach((item, index) => {
      const dueDateRaw = item.due_date?.trim() || ''
      const dueDateNum = Number(dueDateRaw)
      const isValidDueDate =
        dueDateRaw !== '' &&
        Number.isInteger(dueDateNum) &&
        dueDateNum >= 1 &&
        dueDateNum <= 28

      if (!isValidDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['non_routine_items', index, 'due_date'],
          message: 'Jatuh tempo harus angka 1 sampai 28',
        })
      }
      if (!item.area || item.area.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['non_routine_items', index, 'area'],
          message: 'Area wajib diisi',
        })
      }
      if (!item.assigned_user_id || item.assigned_user_id.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['non_routine_items', index, 'assigned_user_id'],
          message: 'User assignment wajib dipilih',
        })
      }
    })
  }
})

type TaskFormData = z.infer<typeof taskSchema>

interface TaskFormProps {
  task?: Task | null
  onSubmit: (data: CreateTaskData | UpdateTaskData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function TaskForm({ task, onSubmit, onCancel, loading = false }: TaskFormProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])
  const [parentTasks, setParentTasks] = useState<Task[]>([])
  const [scanCodes, setScanCodes] = useState<{ code: string; taskName: string }[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [taskGroupsLoading, setTaskGroupsLoading] = useState(true)
  const [parentTasksLoading, setParentTasksLoading] = useState(true)
  const [scanCodesLoading, setScanCodesLoading] = useState(false)

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      is_routine: true,
      is_main_task: false,
      is_need_validation: false,
      is_scan: false,
      scan_code: null,
      duration: 1,
      asset_id: '',
      role_id: 0,
      parent_task_ids: [],
      task_group_id: null,
      days: [],
      times: [],
      monthly_frequency: 1,
      due_date: '',
      area: '',
      assigned_user_id: '',
      non_routine_items: [{ due_date: '', area: '', assigned_user_id: '' }],
    },
  })
  const { fields: nonRoutineItems, replace, remove } = useFieldArray({
    control: form.control,
    name: 'non_routine_items',
  })

  const isRoutine = form.watch('is_routine')
  const isMainTask = form.watch('is_main_task')
  const selectedAssetId = form.watch('asset_id')

  useEffect(() => {
    if (!isRoutine) {
      // Non-routine tasks use fixed flags and do not need routine-specific relations/schedules.
      form.setValue('is_main_task', true)
      form.setValue('is_need_validation', true)
      form.setValue('is_scan', false)
      form.setValue('task_group_id', null)
      form.setValue('parent_task_ids', [])
      form.setValue('days', [])
      form.setValue('times', [])
      form.setValue('scan_code', null)
      return
    }

    // Keep routine defaults predictable when user toggles back.
    form.setValue('is_main_task', false)
    form.setValue('is_scan', false)
  }, [isRoutine, form])

  const handleNonRoutineFrequencyChange = (next: number) => {
    const clamped = Math.min(5, Math.max(1, next))
    const current = form.getValues('non_routine_items') || []
    let nextItems = [...current]
    if (clamped > nextItems.length) {
      while (nextItems.length < clamped) {
        nextItems.push({ due_date: '', area: '', assigned_user_id: '' })
      }
    } else if (clamped < nextItems.length) {
      nextItems = nextItems.slice(0, clamped)
    }
    replace(nextItems)
    form.setValue('monthly_frequency', clamped)
  }

  const handleRemoveNonRoutineRow = (index: number) => {
    const items = form.getValues('non_routine_items') || []
    if (items.length <= 1) return
    remove(index)
    queueMicrotask(() => {
      const after = form.getValues('non_routine_items') || []
      form.setValue('monthly_frequency', Math.max(1, after.length))
    })
  }

  // Load assets
  useEffect(() => {
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
      } finally {
        setAssetsLoading(false)
      }
    }
    loadAssets()
  }, [])

  // Load roles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await rolesApi.getRoles()
        if (response.success && response.data) {
          setRoles(Array.isArray(response.data) ? response.data : [])
        }
      } catch (error) {
        console.error('Load roles error:', error)
      } finally {
        setRolesLoading(false)
      }
    }
    loadRoles()
  }, [])

  // Load users for non-routine assignment based on selected asset
  useEffect(() => {
    const loadUsers = async () => {
      if (isRoutine || !selectedAssetId) {
        setUsers([])
        setUsersLoading(false)
        form.setValue('assigned_user_id', '')
        return
      }

      setUsersLoading(true)
      try {
        const response = await usersApi.getUsers({
          limit: 1000,
          status: 'active',
          asset_id: selectedAssetId,
        })
        const responseData = response.data as any
        const usersData = Array.isArray(responseData?.data?.users)
          ? responseData.data.users
          : Array.isArray(responseData?.users)
            ? responseData.users
            : Array.isArray(responseData?.data)
              ? responseData.data
              : Array.isArray(responseData)
                ? responseData
                : []

        setUsers(usersData)
        const selectedAssignedUserId = form.getValues('assigned_user_id')
        if (
          selectedAssignedUserId &&
          !usersData.some((user: User) => user.id === selectedAssignedUserId)
        ) {
          form.setValue('assigned_user_id', '')
        }
      } catch (error) {
        console.error('Load users error:', error)
        setUsers([])
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [isRoutine, selectedAssetId, form])

  // Load task groups
  useEffect(() => {
    const loadTaskGroups = async () => {
      try {
        const response = await taskGroupsApi.getTaskGroups()
        if (response.success && response.data) {
          const responseData = response.data as any
          const resData = responseData.data as any
          const taskGroupsData = Array.isArray(resData.taskGroups) ? resData.taskGroups : (Array.isArray(responseData) ? responseData : [])
          setTaskGroups(taskGroupsData)
        }
      } catch (error) {
        console.error('Load task groups error:', error)
      } finally {
        setTaskGroupsLoading(false)
      }
    }
    loadTaskGroups()
  }, [])

  // Load parent tasks (only main tasks with same asset_id)
  useEffect(() => {
    const loadParentTasks = async () => {
      // Only load if asset_id is selected
      if (!selectedAssetId) {
        setParentTasks([])
        setParentTasksLoading(false)
        return
      }

      setParentTasksLoading(true)
      try {
        const response = await tasksApi.getTasks({ 
          is_main_task: true,
          asset_id: selectedAssetId 
        })
        if (response.success && response.data) {
          const responseData = response.data as any
          const tasksData = responseData.data.tasks
          // Filter out current task if editing
          const filtered = task ? tasksData.filter((t: Task) => t.id !== task.id) : tasksData
          setParentTasks(filtered)
        }
      } catch (error) {
        console.error('Load parent tasks error:', error)
      } finally {
        setParentTasksLoading(false)
      }
    }
    loadParentTasks()
  }, [task, selectedAssetId])

  // Load scan codes from tasks in task groups related to the selected asset
  useEffect(() => {
    const loadScanCodes = async () => {
      // Only load if asset_id is selected
      if (!selectedAssetId) {
        setScanCodes([])
        setScanCodesLoading(false)
        return
      }

      setScanCodesLoading(true)
      try {
        // Get all tasks with the selected asset that belong to task groups and have scan_code
        const response = await tasksApi.getTasks({ 
          asset_id: selectedAssetId 
        })
        if (response.success && response.data) {
          const responseData = response.data as any
          const tasksData = responseData.data?.tasks || responseData.tasks || responseData.data || []
          
          // Filter tasks that:
          // 1. Have a task_group_id (belong to a task group)
          // 2. Have a scan_code
          const tasksWithScanCode = tasksData.filter((t: Task) => 
            t.task_group_id && t.scan_code && t.scan_code.trim() !== ''
          )
          
          // Extract unique scan codes with task names from tasks
          const scanCodeMap = new Map<string, string>()
          tasksWithScanCode.forEach((t: Task) => {
            if (t.scan_code && !scanCodeMap.has(t.scan_code)) {
              scanCodeMap.set(t.scan_code, t.name || '')
            }
          })
          
          // Also get scan codes from scan_infos table
          try {
            const scanInfoResponse = await scanInfoApi.getScanInfos({ 
              asset_id: selectedAssetId 
            })
            if (scanInfoResponse.success && scanInfoResponse.data) {
              const responseData = scanInfoResponse.data as any
              const scanInfosData = responseData.data?.scanInfos || responseData.scanInfos || responseData.data || []
              
              // Add scan codes from scan_infos (use scan_code as name if not already in map)
              scanInfosData.forEach((si: ScanInfo) => {
                if (si.scan_code && si.scan_code.trim() !== '') {
                  if (!scanCodeMap.has(si.scan_code)) {
                    // Use scan_code as name if no task name available
                    scanCodeMap.set(si.scan_code, si.scan_code)
                  }
                }
              })
            }
          } catch (error) {
            console.error('Load scan codes from scan_infos error:', error)
            // Continue with codes from tasks only
          }
          
          // Convert to array
          const codes = Array.from(scanCodeMap.entries()).map(([code, taskName]) => ({
            code,
            taskName
          }))
          
          setScanCodes(codes)
        }
      } catch (error) {
        console.error('Load scan codes error:', error)
        setScanCodes([])
      } finally {
        setScanCodesLoading(false)
      }
    }
    loadScanCodes()
  }, [selectedAssetId])

  // Update form values when task changes (for edit mode)
  useEffect(() => {
    if (task && !assetsLoading && !rolesLoading && !taskGroupsLoading) {
      // Normalize IDs to numbers
      const normalizeId = (id: number | string | undefined): number | undefined => {
        if (id === undefined || id === null) return undefined
        return typeof id === 'string' ? parseInt(id) : id
      }
      
      const normalizeIds = (ids: (number | string)[] | undefined): number[] => {
        if (!ids || ids.length === 0) return []
        return ids.map(id => typeof id === 'string' ? parseInt(id) : id)
      }
      
      const normalizeDays = (days: (number | string)[] | undefined): number[] => {
        if (!days || days.length === 0) return []
        return days.map(day => {
          if (typeof day === 'string') {
            const parsed = parseInt(day)
            return isNaN(parsed) ? 0 : parsed
          }
          return day
        }).filter(day => !isNaN(day))
      }

      const mapNonRoutineRow = (it: { due_date?: string | number; area?: string; assigned_user_id?: string }) => ({
        due_date: it.due_date !== undefined && it.due_date !== null ? String(it.due_date) : '',
        area: it.area || '',
        assigned_user_id: it.assigned_user_id || '',
      })

      const nonRoutineItemsSource = (task as Task & { non_routine_items?: unknown }).non_routine_items
      let parsedRawItems: unknown = nonRoutineItemsSource
      if (typeof parsedRawItems === 'string') {
        try {
          parsedRawItems = JSON.parse(parsedRawItems)
        } catch {
          parsedRawItems = []
        }
      }
      const parsedItems = Array.isArray(parsedRawItems) ? parsedRawItems : []

      const isNonRoutine = task.is_routine === false
      const freq = Math.min(5, Math.max(1, Number(task.monthly_frequency) || 1))

      let nonRoutineItemsForForm: { due_date: string; area: string; assigned_user_id: string }[]
      if (!isNonRoutine) {
        nonRoutineItemsForForm =
          parsedItems.length > 0
            ? parsedItems.map((it) => mapNonRoutineRow(it as Parameters<typeof mapNonRoutineRow>[0]))
            : [
                {
                  due_date: task.due_date !== undefined && task.due_date !== null ? String(task.due_date) : '',
                  area: task.area || '',
                  assigned_user_id: task.assigned_user_id || '',
                },
              ]
      } else {
        nonRoutineItemsForForm =
          parsedItems.length > 0
            ? parsedItems.map((it) => mapNonRoutineRow(it as Parameters<typeof mapNonRoutineRow>[0]))
            : [
                {
                  due_date: task.due_date !== undefined && task.due_date !== null ? String(task.due_date) : '',
                  area: task.area || '',
                  assigned_user_id: task.assigned_user_id || '',
                },
              ]
        while (nonRoutineItemsForForm.length < freq) {
          nonRoutineItemsForForm.push({ due_date: '', area: '', assigned_user_id: '' })
        }
        if (nonRoutineItemsForForm.length > freq) {
          nonRoutineItemsForForm = nonRoutineItemsForForm.slice(0, freq)
        }
      }
      
      form.reset({
        name: task.name || '',
        is_routine: task.is_routine ?? true,
        is_main_task: task.is_main_task || false,
        is_need_validation: task.is_need_validation || false,
        is_scan: task.is_scan || false,
        scan_code: task.scan_code || null,
        duration: task.duration || 0,
        asset_id: String(task.asset_id || ''),
        role_id: normalizeId(task.role_id) || 0,
        parent_task_ids: task.parent_task_ids 
          ? normalizeIds(task.parent_task_ids)
          : (task.parent_task_id ? [normalizeId(task.parent_task_id)!].filter(Boolean) as number[] : []),
        task_group_id: task.task_group_id ? normalizeId(task.task_group_id) : null,
        days: normalizeDays(task.days),
        times: task.times || [],
        monthly_frequency: isNonRoutine ? freq : task.monthly_frequency || 1,
        due_date: task.due_date !== undefined && task.due_date !== null ? String(task.due_date) : '',
        area: task.area || '',
        assigned_user_id: task.assigned_user_id || '',
        non_routine_items: nonRoutineItemsForForm,
      })
      if (isNonRoutine) {
        replace(nonRoutineItemsForForm)
      }
    } else if (!task) {
      // Reset to default values when creating new task
      form.reset({
        name: '',
        is_routine: true,
        is_main_task: false,
        is_need_validation: false,
        is_scan: false,
        scan_code: null,
        duration: 1,
        asset_id: '',
        role_id: 0,
        parent_task_ids: [],
        task_group_id: null,
        days: [],
        times: [],
        monthly_frequency: 1,
        due_date: '',
        area: '',
        assigned_user_id: '',
        non_routine_items: [{ due_date: '', area: '', assigned_user_id: '' }],
      })
    }
  }, [task, form, assetsLoading, rolesLoading, taskGroupsLoading])

  const handleSubmit = async (data: TaskFormData) => {
    console.log('TaskForm handleSubmit called with data:', data)
    console.log('Form errors:', form.formState.errors)
    
    try {
      const submitData: CreateTaskData | UpdateTaskData = {
        name: data.name.trim(),
        is_routine: data.is_routine,
        is_main_task: data.is_main_task,
        is_need_validation: data.is_need_validation,
        is_scan: data.is_scan,
        scan_code: data.scan_code?.trim() || undefined,
        duration: data.duration,
        asset_id: data.asset_id,
        role_id: data.role_id,
        // Only include parent_task_ids if it has items
        ...(data.parent_task_ids && data.parent_task_ids.length > 0 ? { parent_task_ids: data.parent_task_ids } : {}),
        // Only include task_group_id if it has a value
        ...(data.task_group_id ? { task_group_id: data.task_group_id } : {}),
        // Only include days if it has items
        ...(data.days && data.days.length > 0 ? { days: data.days } : {}),
        // Only include times if it has items
        ...(data.times && data.times.length > 0 ? { times: data.times } : {}),
        ...(data.is_routine === false ? {
          monthly_frequency: data.monthly_frequency,
          // Backward compatibility + backend expects integer day 1–28
          due_date: (() => {
            const raw = data.non_routine_items?.[0]?.due_date ?? data.due_date
            if (raw === undefined || raw === '') return undefined
            const n = parseInt(String(raw), 10)
            return Number.isNaN(n) ? undefined : n
          })(),
          area: data.non_routine_items?.[0]?.area?.trim() || data.area?.trim(),
          assigned_user_id: data.non_routine_items?.[0]?.assigned_user_id || data.assigned_user_id,
          non_routine_items: data.non_routine_items?.map((item) => {
            const d = item.due_date
            if (d === undefined || d === '') {
              return {
                area: item.area?.trim(),
                assigned_user_id: item.assigned_user_id,
              }
            }
            const n = parseInt(String(d), 10)
            return {
              due_date: Number.isNaN(n) ? undefined : n,
              area: item.area?.trim(),
              assigned_user_id: item.assigned_user_id,
            }
          }),
          ...(task?.non_routine_group_id
            ? { non_routine_group_id: task.non_routine_group_id }
            : {}),
        } : {}),
      }
      console.log('Submitting data:', submitData)
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission error:', error)
      throw error // Re-throw to let form handle it
    }
  }

  const handleDayToggle = (day: number, checked: boolean) => {
    const currentDays = form.getValues('days') || []
    // Normalize days to numbers
    const normalizedDays = currentDays.map(d => typeof d === 'string' ? parseInt(d) : d).filter(d => !isNaN(d))
    if (checked) {
      if (!normalizedDays.includes(day)) {
        form.setValue('days', [...normalizedDays, day])
      }
    } else {
      form.setValue('days', normalizedDays.filter(d => d !== day))
    }
  }

  const handleTimeAdd = () => {
    const currentTimes = form.getValues('times') || []
    form.setValue('times', [...currentTimes, '00:00'])
  }

  const handleTimeRemove = (index: number) => {
    const currentTimes = form.getValues('times') || []
    form.setValue('times', currentTimes.filter((_, i) => i !== index))
  }

  const handleTimeChange = (index: number, value: string) => {
    const currentTimes = form.getValues('times') || []
    const updated = [...currentTimes]
    updated[index] = value
    form.setValue('times', updated)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
        console.error('Form validation errors:', errors)
        console.error('Form values:', form.getValues())
      })} className="space-y-6">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Enter task name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Asset and Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="asset_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset <span className="text-red-500">*</span></FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || ''}
                  disabled={assetsLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={assetsLoading ? "Loading assets..." : "Select asset"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={String(asset.id)}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role <span className="text-red-500">*</span></FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(parseInt(value))} 
                  value={field.value?.toString()}
                  disabled={rolesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Duration */}
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => {
            // Convert minutes to hours for display (if needed) or keep as minutes
            // Assuming duration is stored in minutes
            const minutes = field.value || 0
            const hours = Math.floor(minutes / 60)
            const mins = minutes % 60
            
            return (
              <FormItem>
                <FormLabel>Duration <span className="text-red-500">*</span></FormLabel>
                <div className="grid grid-cols-2 gap-4">
                  <FormControl>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Hours</label>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        value={hours}
                        onChange={(e) => {
                          const hrs = parseInt(e.target.value) || 0
                          const totalMinutes = hrs * 60 + mins
                          field.onChange(totalMinutes)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormControl>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Minutes</label>
                      <Input 
                        type="number" 
                        min="0"
                        max="59"
                        placeholder="0"
                        value={mins}
                        onChange={(e) => {
                          const mns = parseInt(e.target.value) || 0
                          const totalMinutes = hours * 60 + mns
                          field.onChange(totalMinutes)
                        }}
                      />
                    </div>
                  </FormControl>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total: {minutes} minute{minutes !== 1 ? 's' : ''}
                </div>
                <FormMessage />
              </FormItem>
            )
          }}
        />

        {/* Boolean Switches */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="is_routine"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Tipe Task</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    {field.value ? 'Rutin' : 'Non Rutin'}
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {isRoutine && (
            <FormField
              control={form.control}
              name="is_main_task"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Main Task</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Mark this task as a main task
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {isRoutine && (
            <FormField
              control={form.control}
              name="is_need_validation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Requires Validation</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This task requires validation
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {isRoutine && (
            <FormField
              control={form.control}
              name="is_scan"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Requires Scan</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This task requires scanning
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Scan Code - Routine with scan only */}
        {isRoutine && form.watch('is_scan') && (
          <FormField
            control={form.control}
            name="scan_code"
            render={({ field }) => {
              const selectedValue = field.value || null
              const stringValue = selectedValue ? String(selectedValue) : ''
              const isInDropdown = stringValue && scanCodes.some(item => item.code === stringValue)
              const [useManualEntry, setUseManualEntry] = useState(!isInDropdown && stringValue !== '')
              
              // Update manual entry state when value changes
              useEffect(() => {
                if (stringValue && !isInDropdown) {
                  setUseManualEntry(true)
                } else if (isInDropdown) {
                  setUseManualEntry(false)
                }
              }, [stringValue, isInDropdown])
              
              return (
                <FormItem>
                  <FormLabel>Scan Code</FormLabel>
                  <div className="space-y-2">
                    {!useManualEntry && scanCodes.length > 0 && (
                      <Select 
                        onValueChange={(value) => {
                          if (value === '__manual__') {
                            setUseManualEntry(true)
                            field.onChange(null)
                          } else {
                            field.onChange(value)
                            setUseManualEntry(false)
                          }
                        }} 
                        value={isInDropdown ? stringValue : undefined}
                        disabled={scanCodesLoading || !selectedAssetId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !selectedAssetId 
                                ? "Select asset first" 
                                : scanCodesLoading 
                                  ? "Loading scan codes..." 
                                  : "Select scan code"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scanCodes.map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.code} {item.taskName ? `(${item.taskName})` : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value="__manual__">Enter manually</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {(useManualEntry || scanCodes.length === 0) && (
                      <div className="space-y-2">
                        {!useManualEntry && scanCodes.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setUseManualEntry(true)}
                            className="w-full"
                          >
                            Enter manually
                          </Button>
                        )}
                        <FormControl>
                          <Input 
                            placeholder="Enter scan code manually" 
                            value={stringValue}
                            onChange={(e) => {
                              const value = e.target.value.trim()
                              field.onChange(value || null)
                            }}
                          />
                        </FormControl>
                      </div>
                    )}
                  </div>
                  {selectedAssetId && scanCodes.length === 0 && !scanCodesLoading && (
                    <p className="text-sm text-muted-foreground">
                      No scan codes found in task groups for this asset. You can enter manually.
                    </p>
                  )}
                  {!selectedAssetId && (
                    <p className="text-sm text-muted-foreground">
                      Please select an asset first to load scan codes from related task groups.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}

        {/* Task Group - Routine only */}
        {isRoutine && (
          <FormField
            control={form.control}
            name="task_group_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Group</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === 'none' ? null : parseInt(value))} 
                  value={field.value ? field.value.toString() : 'none'}
                  disabled={taskGroupsLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={taskGroupsLoading ? "Loading task groups..." : "Select task group (optional)"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {taskGroups.map((tg) => (
                      <SelectItem key={tg.id} value={tg.id.toString()}>
                        {tg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Non Routine Fields */}
        {!isRoutine && (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="monthly_frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frekuensi per Bulan <span className="text-red-500">*</span></FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const next = parseInt(value, 10)
                      handleNonRoutineFrequencyChange(next)
                    }}
                    value={String(field.value ?? 1)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih frekuensi" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1x per bulan</SelectItem>
                      <SelectItem value="2">2x per bulan</SelectItem>
                      <SelectItem value="3">3x per bulan</SelectItem>
                      <SelectItem value="4">4x per bulan</SelectItem>
                      <SelectItem value="5">5x per bulan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {nonRoutineItems.map((item, index) => (
              <div key={item.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Jadwal ke-{index + 1}
                  </span>
                  {nonRoutineItems.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveNonRoutineRow(index)}
                      aria-label={`Hapus jadwal ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name={`non_routine_items.${index}.due_date`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jatuh Tempo #{index + 1} <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          placeholder="1 - 28"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`non_routine_items.${index}.area`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area #{index + 1} <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Area Lantai 2" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`non_routine_items.${index}.assigned_user_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign User #{index + 1} <span className="text-red-500">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={usersLoading || !selectedAssetId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !selectedAssetId
                                  ? 'Pilih asset terlebih dahulu'
                                  : usersLoading
                                    ? 'Loading users...'
                                    : 'Pilih user'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parent Tasks - Routine child task only */}
        {isRoutine && !isMainTask && (
          <FormField
            control={form.control}
            name="parent_task_ids"
            render={({ field }) => {
              // Use field.value which is initialized from task.parent_task_ids when editing
              // This ensures we use task.parent_task_ids as the source of truth for selected parents
              const selectedTaskIdsRaw = field.value || []
              
              // Normalize selected task IDs to numbers for comparison
              const selectedTaskIds = selectedTaskIdsRaw
                .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                .filter(id => !isNaN(id) && id !== null && id !== undefined)
              
              const tasksArray = Array.isArray(parentTasks) ? parentTasks : []
              const selectedTasks = tasksArray.filter((taskItem) => {
                const taskId = typeof taskItem.id === 'string' ? parseInt(taskItem.id, 10) : taskItem.id
                return !isNaN(taskId) && selectedTaskIds.includes(taskId) && taskItem.is_main_task === true
              })
              const availableTasks = tasksArray.filter((taskItem) => {
                const taskId = typeof taskItem.id === 'string' ? parseInt(taskItem.id, 10) : taskItem.id
                return !isNaN(taskId) && !selectedTaskIds.includes(taskId) && taskItem.is_main_task === true
              })

              return (
                <FormItem>
                  <FormLabel>Parent Tasks</FormLabel>
                  
                  {/* Selected Tasks as Badges */}
                  {selectedTasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 p-3 border rounded-lg bg-muted/50">
                      {selectedTasks.map((task) => {
                        const taskId = typeof task.id === 'string' ? parseInt(task.id, 10) : task.id
                        return (
                          <Badge key={task.id} variant="secondary" className="flex items-center gap-1 pr-1">
                            <span>{task.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = field.value || []
                                const normalizedCurrent = current.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                                field.onChange(normalizedCurrent.filter(id => id !== taskId))
                              }}
                              className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  )}

                  {/* Available Tasks List */}
                  <div className="space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                    {parentTasksLoading ? (
                      <div className="text-sm text-muted-foreground">Loading tasks...</div>
                    ) : parentTasks.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No parent tasks available</div>
                    ) : availableTasks.length === 0 ? (
                      <div className="text-sm text-muted-foreground">All tasks have been selected</div>
                    ) : (
                      availableTasks.map((parentTask) => {
                        const taskId = typeof parentTask.id === 'string' ? parseInt(parentTask.id) : parentTask.id
                        return (
                          <div key={parentTask.id} className="flex items-center space-x-2 hover:bg-muted/50 p-2 rounded cursor-pointer"
                            onClick={() => {
                              const current = field.value || []
                              const normalizedCurrent = current.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                              if (!normalizedCurrent.includes(taskId)) {
                                field.onChange([...normalizedCurrent, taskId])
                              }
                            }}
                          >
                            <Checkbox
                              id={`parent-${parentTask.id}`}
                              checked={false}
                              onCheckedChange={(checked) => {
                                const current = field.value || []
                                const normalizedCurrent = current.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                                if (checked) {
                                  if (!normalizedCurrent.includes(taskId)) {
                                    field.onChange([...normalizedCurrent, taskId])
                                  }
                                } else {
                                  field.onChange(normalizedCurrent.filter(id => id !== taskId))
                                }
                              }}
                            />
                            <label
                              htmlFor={`parent-${parentTask.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {parentTask.name}
                            </label>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}

        {/* Days - Routine only */}
        {isRoutine && (
          <FormField
            control={form.control}
            name="days"
            render={({ field }) => {
              // Normalize days to numbers for comparison
              const normalizedDays = (field.value || []).map(d => typeof d === 'string' ? parseInt(d) : d).filter(d => !isNaN(d))
              
              const handleSelectAll = () => {
                const allDays = DAYS_OF_WEEK.map(day => day.value)
                const allSelected = allDays.every(day => normalizedDays.includes(day))
                
                if (allSelected) {
                  // If all are selected, deselect all
                  form.setValue('days', [])
                } else {
                  // If not all are selected, select all
                  form.setValue('days', allDays)
                }
              }
              
              const handleSelectWeekdays = () => {
                // Weekdays: Monday (1) to Friday (5)
                const weekdays = [1, 2, 3, 4, 5]
                form.setValue('days', weekdays)
              }
              
              return (
                <FormItem>
                  <div className="flex items-center justify-between mb-2">
                    <FormLabel>Days of Week</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectWeekdays}
                        className="text-xs"
                      >
                        Weekdays Only
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="text-xs"
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded-lg p-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={normalizedDays.includes(day.value)}
                          onCheckedChange={(checked) => handleDayToggle(day.value, checked as boolean)}
                        />
                        <label
                          htmlFor={`day-${day.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}

        {/* Times - Routine only */}
        {isRoutine && (
          <FormField
            control={form.control}
            name="times"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Times</FormLabel>
                <div className="space-y-2">
                  {(field.value || []).map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTimeRemove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTimeAdd}
                  >
                    Add Time
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {task ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

