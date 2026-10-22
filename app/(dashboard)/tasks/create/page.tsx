'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { tasksApi, CreateTaskData, UpdateTaskData } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, StickyNote, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import TaskForm from '@/components/forms/task-form'

export default function CreateTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: CreateTaskData | UpdateTaskData) => {
    setLoading(true)
    try {
      const response = await tasksApi.createTask(data as CreateTaskData)
      if (response.success) {
        toast.success('Task created successfully')
        router.push('/task-parents')
      } else {
        toast.error(response.error || 'Failed to create task')
      }
    } catch (error) {
      console.error('Create task error:', error)
      toast.error('An error occurred while creating task')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/task-parents')
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
            <BreadcrumbLink href="/task-parents" className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Task
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Buat Task Baru
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buat Task Baru</h1>
          <p className="text-muted-foreground">
            Tambahkan task baru ke sistem dengan informasi lengkap
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Form Task</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  )
}

