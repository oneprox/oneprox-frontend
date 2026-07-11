'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { banksApi, Bank, CreateBankData, UpdateBankData } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Landmark, Edit, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import BankForm from '@/components/forms/bank-form'

export default function EditBankPage() {
  const router = useRouter()
  const params = useParams()
  const bankId = parseInt(params.id as string)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [bank, setBank] = useState<Bank | null>(null)

  useEffect(() => {
    const loadBank = async () => {
      if (!bankId || isNaN(bankId)) return

      setInitialLoading(true)
      try {
        const response = await banksApi.getBank(bankId)
        if (response.success && response.data) {
          const responseData = response.data as any
          setBank(responseData.data || responseData)
        } else {
          toast.error(response.error || 'Failed to load bank')
          router.push('/banks')
        }
      } catch (error) {
        console.error('Load bank error:', error)
        toast.error('An error occurred while loading bank')
        router.push('/banks')
      } finally {
        setInitialLoading(false)
      }
    }

    loadBank()
  }, [bankId, router])

  const handleSubmit = async (data: CreateBankData | UpdateBankData) => {
    setLoading(true)
    try {
      const response = await banksApi.updateBank(bankId, data as UpdateBankData)

      if (response.success) {
        toast.success('Bank berhasil diperbarui')
        router.push('/banks')
      } else {
        toast.error(response.error || 'Failed to update bank')
      }
    } catch (error) {
      console.error('Update bank error:', error)
      toast.error('An error occurred while updating bank')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/banks')
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Memuat data bank...</span>
        </div>
      </div>
    )
  }

  if (!bank) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Bank tidak ditemukan</h2>
          <p className="text-muted-foreground mt-2">
            Bank yang Anda cari tidak ditemukan atau telah dihapus.
          </p>
        </div>
      </div>
    )
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
              <Edit className="h-4 w-4" />
              Edit: {bank.bank_name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Bank</h1>
          <p className="text-muted-foreground">
            Perbarui informasi bank: <span className="font-medium">{bank.bank_name}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Edit Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <BankForm
            bank={bank}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
