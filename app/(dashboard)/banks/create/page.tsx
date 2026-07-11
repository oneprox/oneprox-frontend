'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { banksApi, CreateBankData, UpdateBankData } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Landmark, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import BankForm from '@/components/forms/bank-form'

export default function CreateBankPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: CreateBankData | UpdateBankData) => {
    setLoading(true)
    try {
      const response = await banksApi.createBank(data as CreateBankData)

      if (response.success) {
        toast.success('Bank berhasil ditambahkan')
        router.push('/banks')
      } else {
        toast.error(response.error || 'Gagal menambahkan bank')
      }
    } catch (error) {
      console.error('Create bank error:', error)
      toast.error('Terjadi kesalahan saat menambahkan bank')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/banks')
  }

  return (
    <div className="space-y-6">
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
            <BreadcrumbLink href="/banks" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Bank
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tambah Bank
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tambah Bank Baru</h1>
          <p className="text-muted-foreground">
            Tambahkan rekening bank baru ke sistem
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <BankForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
