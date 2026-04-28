'use client'

import React, { useState, useEffect } from 'react'
import { TaskGroup, CreateTaskGroupData, UpdateTaskGroupData, settingsApi } from '@/lib/api'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const taskGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().optional().nullable(),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format (e.g., 06:00)'),
  end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format (e.g., 14:00)'),
  is_active: z.boolean().optional().default(true),
})

type TaskGroupFormData = z.infer<typeof taskGroupSchema>

interface TaskGroupFormProps {
  taskGroup?: TaskGroup | null
  onSubmit: (data: CreateTaskGroupData | UpdateTaskGroupData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function TaskGroupForm({ taskGroup, onSubmit, onCancel, loading = false }: TaskGroupFormProps) {
  const [beforeHours, setBeforeHours] = useState<string>('...')
  const [afterHours, setAfterHours] = useState<string>('...')

  const form = useForm<TaskGroupFormData>({
    resolver: zodResolver(taskGroupSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      start_time: '06:00',
      end_time: '14:00',
      is_active: true,
    },
  })

  // Update form values when taskGroup changes (for edit mode)
  useEffect(() => {
    if (taskGroup) {
      form.reset({
        name: taskGroup.name || '',
        description: taskGroup.description || '',
        start_time: taskGroup.start_time || '06:00',
        end_time: taskGroup.end_time || '14:00',
        is_active: taskGroup.is_active !== undefined ? taskGroup.is_active : true,
      })
    }
  }, [taskGroup, form])

  useEffect(() => {
    const getSettingValue = async (key: string) => {
      try {
        const res = await settingsApi.getSettingByKey(key)
        if (!res.success || !res.data) return null
        const payload = res.data as any
        const raw = payload?.data?.value ?? payload?.value
        return raw != null ? String(raw) : null
      } catch {
        return null
      }
    }

    const loadGenerationWindow = async () => {
      const [before, after] = await Promise.all([
        getSettingValue('task_generation_before_hours'),
        getSettingValue('task_generation_after_hours'),
      ])
      if (before) setBeforeHours(before)
      if (after) setAfterHours(after)
    }

    loadGenerationWindow()
  }, [])

  const handleSubmit = async (data: TaskGroupFormData) => {
    try {
      const submitData: CreateTaskGroupData | UpdateTaskGroupData = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        start_time: data.start_time,
        end_time: data.end_time,
        is_active: data.is_active,
      }
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Enter task group name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter description (optional)"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Start Time and End Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time <span className="text-red-500">*</span></FormLabel>
                <p className="text-xs text-muted-foreground">
                  Generate task bisa didapatkan dari {beforeHours} jam sebelum start_time dan {afterHours} jam setelah start_time.
                </p>
                <FormControl>
                  <Input 
                    type="time"
                    placeholder="HH:mm (e.g., 06:00)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input 
                    type="time"
                    placeholder="HH:mm (e.g., 14:00)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Is Active */}
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this task group
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
            {taskGroup ? 'Update Task Group' : 'Create Task Group'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

