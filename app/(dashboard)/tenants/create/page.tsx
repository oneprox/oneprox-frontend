'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreateTenantData, UpdateTenantData, tenantsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Users, Plus, FileText } from 'lucide-react'
import TenantForm from '@/components/forms/tenant-form'
import toast from 'react-hot-toast'

export default function CreateTenantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: CreateTenantData | UpdateTenantData) => {
    setLoading(true)
    try {
      const response = await tenantsApi.createTenant(data as CreateTenantData)
      
      if (response.success && response.data) {
        toast.success('Tenant berhasil dibuat')
        router.push('/tenants')
      } else {
        toast.error(response.error || response.message || 'Gagal membuat tenant', { duration: 8000 })
      }
    } catch (error) {
      console.error('Create tenant error:', error)
      toast.error('Terjadi kesalahan saat membuat tenant')
    } finally {
      setLoading(false)
    }
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
            <BreadcrumbLink href="/tenants" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tenants
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Buat Tenant Baru
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buat Tenant Baru</h1>
          <p className="text-muted-foreground">
            Tambahkan tenant baru ke sistem dengan informasi lengkap
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Form Tenant</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <TenantForm onSubmit={handleSubmit} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
