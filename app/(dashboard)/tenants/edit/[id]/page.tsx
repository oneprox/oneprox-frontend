'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Tenant, CreateTenantData, UpdateTenantData, TenantDepositLog, tenantsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Users, Edit, Loader2, Menu, FileText } from 'lucide-react'
import TenantForm from '@/components/forms/tenant-form'
import toast from 'react-hot-toast'
import TenantLogsTable from '@/components/table/tenant-logs-table'

export default function EditTenantPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = params.id as string
  
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [depositLogs, setDepositLogs] = useState<TenantDepositLog[]>([])

  useEffect(() => {
    const loadTenant = async () => {
      if (!tenantId) return
      
      try {
        const [tenantResponse, depositLogsResponse] = await Promise.all([
          tenantsApi.getTenant(tenantId),
          tenantsApi.getTenantDepositLogs(tenantId)
        ])
        
        if (tenantResponse.success && tenantResponse.data) {
          const responseData = tenantResponse.data as any
          setTenant(responseData.data)
        } else {
          toast.error(tenantResponse.error || 'Tenant tidak ditemukan')
          router.push('/tenants')
        }

        if (depositLogsResponse.success && depositLogsResponse.data) {
          const logsData = depositLogsResponse.data as any
          const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
          setDepositLogs(logs)
        }
      } catch (error) {
        console.error('Load tenant error:', error)
        toast.error('Terjadi kesalahan saat memuat data tenant')
        router.push('/tenants')
      } finally {
        setInitialLoading(false)
      }
    }

    loadTenant()
  }, [tenantId, router])

  const handleSubmit = async (data: CreateTenantData | UpdateTenantData) => {
    setLoading(true)
    try {
      const response = await tenantsApi.updateTenant(tenantId, data as UpdateTenantData)
      
      if (response.success && response.data) {
        toast.success('Tenant berhasil diperbarui')
        router.push('/tenants')
      } else {
        toast.error(response.error || response.message || 'Gagal memperbarui tenant', {
          duration: 8000,
        })
      }
    } catch (error) {
      console.error('Update tenant error:', error)
      const errMsg = error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui tenant'
      toast.error(errMsg, { duration: 8000 })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Memuat data tenant...</span>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Tenant tidak ditemukan</h2>
          <p className="text-muted-foreground mt-2">
            Tenant yang Anda cari tidak ditemukan atau telah dihapus.
          </p>
        </div>
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
            <BreadcrumbLink href="/tenants" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tenants
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit: {tenant.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Tenant</h1>
          <p className="text-muted-foreground">
            Perbarui informasi tenant: <span className="font-medium">{tenant.name}</span>
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Form Edit Tenant</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <TenantForm 
            tenant={tenant} 
            onSubmit={handleSubmit} 
            loading={loading} 
          />
        </CardContent>
      </Card>
    </div>
  )
}
