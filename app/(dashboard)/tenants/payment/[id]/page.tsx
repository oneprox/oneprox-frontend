'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Tenant, CreateTenantPaymentData, tenantsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, Users, DollarSign, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from 'react-hot-toast'

export default function UpdateTenantPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = params.id as string
  
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadTenant = async () => {
      if (!tenantId) return
      
      try {
        const tenantResponse = await tenantsApi.getTenant(tenantId)
        
        if (tenantResponse.success && tenantResponse.data) {
          const responseData = tenantResponse.data as any
          setTenant(responseData.data)
        } else {
          toast.error(tenantResponse.error || 'Tenant tidak ditemukan')
          router.push('/tenants')
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

  const formatPrice = (value: number | string): string => {
    if (value === null || value === undefined || value === '') return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
    if (isNaN(numValue) || numValue === 0) return ''
    const integerPart = Math.floor(numValue).toString()
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const parsePrice = (value: string): number => {
    if (!value || value.trim() === '') return 0
    const cleaned = value.replace(/\./g, '').replace(/[^\d]/g, '')
    if (!cleaned || cleaned === '') return 0
    const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
    return parseFloat(parsed) || 0
  }

  const handleInputChange = (field: string, value: string) => {
    if (field === 'amount') {
      const parsedValue = parsePrice(value)
      setFormData(prev => ({ ...prev, [field]: formatPrice(parsedValue) }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.amount || parsePrice(formData.amount) <= 0) {
      newErrors.amount = 'Jumlah pembayaran harus diisi dan lebih dari 0'
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'Metode pembayaran harus dipilih'
    }

    if (!formData.notes || formData.notes.trim() === '') {
      newErrors.notes = 'Pesan/Alasan harus diisi'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!tenant) {
      toast.error('Tenant tidak ditemukan')
      return
    }

    setLoading(true)
    try {
      const amount = parsePrice(formData.amount)
      const now = new Date()
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const paymentDeadline = now.toISOString().slice(0, 10)

      const paymentData: CreateTenantPaymentData = {
        billing_period: billingPeriod,
        billing_amount: amount,
        payment_deadline: paymentDeadline,
        amount,
        payment_method: formData.payment_method,
        notes: formData.notes.trim(),
      }

      const response = await tenantsApi.createTenantPayment(tenant.id, paymentData)
      
      if (response.success && response.data) {
        toast.success('Pembayaran berhasil dicatat')
        router.push('/tenants')
      } else {
        toast.error(response.error || 'Gagal mencatat pembayaran')
      }
    } catch (error) {
      console.error('Create payment error:', error)
      toast.error('Terjadi kesalahan saat mencatat pembayaran')
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
            <BreadcrumbLink href="/dashboard" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/tenants" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Tenants
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Update Payment
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Update Payment - {tenant.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          Catat pembayaran untuk tenant ini
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Jumlah Pembayaran <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="text"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="Masukkan jumlah pembayaran"
                className={errors.amount ? 'border-red-500' : ''}
              />
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">
                Metode Pembayaran <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => handleInputChange('payment_method', value)}
              >
                <SelectTrigger className={errors.payment_method ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.payment_method && (
                <p className="text-sm text-red-500">{errors.payment_method}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Pesan/Alasan <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Masukkan pesan atau alasan pembayaran"
                rows={4}
                className={errors.notes ? 'border-red-500' : ''}
              />
              {errors.notes && (
                <p className="text-sm text-red-500">{errors.notes}</p>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Simpan Pembayaran
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

