'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Unit, UpdateUnitData, unitsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Menu, Edit, Loader2, Building2 } from 'lucide-react'
import UnitForm from '@/components/forms/unit-form'
import toast from 'react-hot-toast'
import UnitLogsTable from '@/components/table/unit-logs-table'

export default function EditUnitPage() {
  const router = useRouter()
  const params = useParams()
  const unitId = params.id as string
  
  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Load unit data
  useEffect(() => {
    const loadUnit = async () => {
      if (!unitId) return

      try {
        const response = await unitsApi.getUnit(unitId)
        
        if (response.success && response.data) {
          const responseData = response.data as any
          const unitData = responseData?.data ?? responseData
          setUnit(unitData)
        } else {
          toast.error(response.error || 'Unit tidak ditemukan')
          router.push('/unit')
        }
      } catch (error) {
        console.error('Load unit error:', error)
        toast.error('Terjadi kesalahan saat memuat data unit')
        router.push('/unit')
      } finally {
        setInitialLoading(false)
      }
    }

    loadUnit()
  }, [unitId, router])

  const handleSubmit = async (data: UpdateUnitData) => {
    setLoading(true)
    try {
      const response = await unitsApi.updateUnit(unitId, data)
      
      if (response.success) {
        toast.success('Unit berhasil diperbarui')
        router.push('/unit')
      } else {
        toast.error(response.error || 'Gagal memperbarui unit')
      }
    } catch (error) {
      console.error('Update unit error:', error)
      toast.error('Terjadi kesalahan saat memperbarui unit')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Memuat data unit...</span>
        </div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Unit tidak ditemukan</h2>
          <p className="text-muted-foreground mt-2">
            Unit yang Anda cari tidak ditemukan atau telah dihapus.
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
            <BreadcrumbLink href="/unit" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Unit
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit: {unit.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Unit</h1>
          <p className="text-muted-foreground">
            Perbarui informasi unit: <span className="font-medium">{unit.name}</span>
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Form Edit Unit</CardTitle>
        </CardHeader>
        <CardContent>
          <UnitForm 
            unit={unit} 
            onSubmit={handleSubmit} 
            loading={loading} 
          />
        </CardContent>
      </Card>
    </div>
  )
}