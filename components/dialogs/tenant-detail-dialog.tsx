'use client'

import React, { useState, useEffect } from 'react'
import { Tenant, Asset, DURATION_UNIT_LABELS, TenantPaymentLog, tenantsApi, UpdateTenantPaymentData, CreateTenantPaymentData, normalizeTenantStatus, TENANT_STATUS_LABELS, ASSET_TYPE_LABELS } from '@/lib/api'
import { formatBillingRatePercent } from '@/lib/billing-rate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { History, Building2, X, Edit, CreditCard, DollarSign, ChevronLeft, ChevronRight, Loader2, Plus, Image as ImageIcon, FileText } from 'lucide-react'
import Link from 'next/link'
import TenantLogsTable from '@/components/table/tenant-logs-table'
import toast from 'react-hot-toast'

// Category options mapping
const CATEGORY_MAP: Record<number, string> = {
  1: 'Restoran/Cafe',
  2: 'Sport Club',
  3: 'Kantor',
  4: 'Tempat Hiburan',
  5: 'Retail/Toko',
  6: 'Klinik/Kesehatan',
  7: 'Pendidikan',
  8: 'Jasa Keuangan',
  9: 'Other',
}

function formatCurrencyIdr(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (Number.isNaN(n) || n === 0) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function getTenantTotalRentPrice(tenant: Tenant): number {
  if (tenant.total_price != null && Number(tenant.total_price) > 0) {
    return Number(tenant.total_price)
  }
  return (tenant.rent_price || 0) + (tenant.ppn || 0)
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '-'
  switch (method) {
    case 'cash': return 'Cash'
    case 'bank_transfer': return 'Bank Transfer'
    case 'qris': return 'QRIS'
    case 'other': return 'Other'
    default: return method
  }
}

const getCategoryLabel = (tenant: Tenant): string => {
  // Check if category is an object with name
  if (tenant.category && typeof tenant.category === 'object' && 'name' in tenant.category) {
    return (tenant.category as { name: string }).name
  }
  
  // Check if category is an object with id
  if (tenant.category && typeof tenant.category === 'object' && 'id' in tenant.category) {
    const categoryObj = tenant.category as { id: number | string }
    const categoryId = typeof categoryObj.id === 'number' ? categoryObj.id : parseInt(String(categoryObj.id), 10)
    if (!isNaN(categoryId)) {
      return CATEGORY_MAP[categoryId] || 'Unknown'
    }
  }
  
  // Check if category is a number directly
  if (typeof tenant.category === 'number') {
    return CATEGORY_MAP[tenant.category] || 'Unknown'
  }
  
  // Check category_id field
  const categoryIdField = (tenant as any).category_id
  if (categoryIdField !== undefined && categoryIdField !== null) {
    const categoryId = typeof categoryIdField === 'number' 
      ? categoryIdField 
      : parseInt(String(categoryIdField), 10)
    if (!isNaN(categoryId)) {
      return CATEGORY_MAP[categoryId] || 'Unknown'
    }
  }
  
  return '-'
}

const getAssetTypeLabel = (assetType: number | string) => {
  if (typeof assetType === 'string') {
    const stringToLabel: Record<string, string> = {
      ESTATE: 'Estate',
      OFFICE: 'Office',
      WAREHOUSE: 'Warehouse',
      SPORT: 'Sport',
      ENTERTAINMENTRESTAURANT: 'Entertainment/Restaurant',
      RESIDENCE: 'Residence',
      MALL: 'Mall',
      SUPPORTFACILITYMOSQUEITAL: 'Support Facility/Mosque',
      PARKINGLOT: 'Parking Lot',
    }
    return stringToLabel[assetType] || assetType
  }
  return ASSET_TYPE_LABELS[assetType] || 'Unknown'
}

const resolveBuildingType = (tenant: Tenant): 'unit' | 'asset' | null => {
  if (tenant.building_type === 'unit' || tenant.building_type === 'asset') {
    return tenant.building_type
  }
  if (tenant.units && tenant.units.length > 0) return 'unit'
  if (tenant.assets && tenant.assets.length > 0) return 'asset'
  if (tenant.asset_ids && tenant.asset_ids.length > 0) return 'asset'
  if (tenant.unit_ids && tenant.unit_ids.length > 0) return 'unit'
  return null
}

interface TenantDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: Tenant | null
}

export default function TenantDetailDialog({
  open,
  onOpenChange,
  tenant
}: TenantDetailDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [paymentLogs, setPaymentLogs] = useState<TenantPaymentLog[]>([])
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentPage, setPaymentPage] = useState(1)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [paymentLimit] = useState(10)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<number | undefined>(undefined)
  const [updatePaymentDialogOpen, setUpdatePaymentDialogOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<TenantPaymentLog | null>(null)
  const [updatePaymentData, setUpdatePaymentData] = useState<UpdateTenantPaymentData>({
    payment_date: '',
    payment_method: '',
    notes: '',
    paid_amount: undefined
  })
  const [paidAmountDisplay, setPaidAmountDisplay] = useState<string>('')
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [allPaidPayments, setAllPaidPayments] = useState<TenantPaymentLog[]>([])
  const [createPaymentDialogOpen, setCreatePaymentDialogOpen] = useState(false)

  const now = new Date()
  const defaultBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const defaultPaymentDeadline = now.toISOString().slice(0, 10)

  const [createPaymentData, setCreatePaymentData] = useState<CreateTenantPaymentData & { payment_date?: string }>({
    billing_period: defaultBillingPeriod,
    amount: 0,
    ppn: 0,
    ppn_percent: 0,
    billing_amount: 0,
    payment_deadline: defaultPaymentDeadline,
    paid_amount: 0,
    payment_method: '',
    notes: '',
    payment_date: ''
  })
  const [creatingPayment, setCreatingPayment] = useState(false)
  const [displayTenant, setDisplayTenant] = useState<Tenant | null>(tenant)
  const [tenantDetailLoading, setTenantDetailLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadTenantDetail = async () => {
      if (!open || !tenant?.id) {
        setDisplayTenant(tenant)
        return
      }

      setDisplayTenant(tenant)
      setTenantDetailLoading(true)
      try {
        const response = await tenantsApi.getTenant(tenant.id)
        if (response.success && response.data) {
          const tenantData = (response.data as any).data ?? response.data
          setDisplayTenant(tenantData as Tenant)
        }
      } catch (error) {
        console.error('Load tenant detail error:', error)
      } finally {
        setTenantDetailLoading(false)
      }
    }

    loadTenantDetail()
  }, [open, tenant?.id])

  // Fetch all paid payments to calculate total amount due
  useEffect(() => {
    const loadAllPaidPayments = async () => {
      if (open && tenant?.id) {
        try {
          const response = await tenantsApi.getTenantPaymentLogs(tenant.id, {
            status: 1, // Only paid payments
            limit: 1000 // Fetch all paid payments
          })
          if (response.success && response.data) {
            const logsData = response.data as any
            const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
            setAllPaidPayments(logs)
          }
        } catch (error) {
          console.error('Load paid payments error:', error)
        }
      }
    }

    loadAllPaidPayments()
  }, [open, tenant?.id])

  // Reset pagination when dialog opens or tenant changes
  useEffect(() => {
    if (open && tenant?.id) {
      setPaymentPage(1)
      setPaymentTotal(0)
      setPaymentStatusFilter(undefined)
    }
  }, [open, tenant?.id])

  // Reset page when status filter changes
  useEffect(() => {
    if (open && tenant?.id) {
      setPaymentPage(1)
    }
  }, [paymentStatusFilter, open, tenant?.id])

  // Fetch payment logs when dialog opens and tenant is available
  useEffect(() => {
    const loadPaymentLogs = async () => {
      if (open && tenant?.id) {
        setPaymentLoading(true)
        try {
          const offset = (paymentPage - 1) * paymentLimit
          const response = await tenantsApi.getTenantPaymentLogs(tenant.id, {
            limit: paymentLimit,
            offset: offset,
            status: paymentStatusFilter
          })
          if (response.success && response.data) {
            const logsData = response.data as any
            const logs = Array.isArray(logsData)
              ? logsData
              : Array.isArray(logsData.data)
                ? logsData.data
                : []
            setPaymentLogs(logs)

            const envelope = logsData as { pagination?: { total?: number }; total?: number; count?: number }
            let total: number | null =
              response.pagination?.total != null ? Number(response.pagination.total) : null
            if (total == null && envelope?.pagination?.total != null) {
              total = Number(envelope.pagination.total)
            } else if (total == null && typeof envelope?.total === 'number') {
              total = envelope.total
            } else if (total == null && typeof envelope?.count === 'number') {
              total = envelope.count
            }

            if (total !== null && !Number.isNaN(total) && total >= 0) {
              setPaymentTotal(total)
            } else if (paymentPage === 1) {
              setPaymentTotal(logs.length)
            }
          }
        } catch (error) {
          console.error('Load payment logs error:', error)
          toast.error('Gagal memuat history pembayaran')
        } finally {
          setPaymentLoading(false)
        }
      }
    }

    loadPaymentLogs()
  }, [open, tenant?.id, paymentPage, paymentLimit, paymentStatusFilter])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const formatDate = (dateString: string) => {
    if (!mounted) return 'Loading...'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTenantStatus = (status: string | number | null | undefined) => {
    const normalized = normalizeTenantStatus(status)
    switch (normalized) {
      case 'inactive':
        return { label: TENANT_STATUS_LABELS.inactive, variant: 'secondary' as const }
      case 'active':
        return { label: TENANT_STATUS_LABELS.active, variant: 'default' as const }
      case 'pending':
        return { label: TENANT_STATUS_LABELS.pending, variant: 'outline' as const }
      case 'expired':
        return { label: TENANT_STATUS_LABELS.expired, variant: 'destructive' as const }
      case 'terminated':
        return { label: TENANT_STATUS_LABELS.terminated, variant: 'destructive' as const }
      case 'blacklisted':
        return { label: TENANT_STATUS_LABELS.blacklisted, variant: 'destructive' as const }
      default:
        return { label: 'Tidak Diketahui', variant: 'secondary' as const }
    }
  }

  const getPaymentStatusBadge = (status?: number) => {
    if (status === undefined || status === null) {
      return <Badge variant="secondary">Unknown</Badge>
    }
    switch (status) {
      case 0:
        return <Badge variant="destructive">Unpaid</Badge>
      case 1:
        return <Badge variant="default" className="bg-green-600">Paid</Badge>
      case 2:
        return <Badge variant="secondary">Expired</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  // Format price: convert number to string with thousand separators (dots)
  const formatPrice = (value: number | string | undefined): string => {
    if (value === null || value === undefined || value === '') return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
    if (isNaN(numValue)) return ''
    if (numValue === 0) return '0'
    // Convert to integer string and add thousand separators
    const integerPart = Math.floor(numValue).toString()
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Parse price input: remove separators and leading zeros
  const parsePrice = (value: string): number => {
    if (!value || value.trim() === '') return 0
    // Remove thousand separators (dots) and any non-digit characters
    const cleaned = value.replace(/\./g, '').replace(/[^\d]/g, '')
    if (!cleaned || cleaned === '') return 0
    // Remove leading zeros but keep at least one digit if all zeros
    const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
    return parseFloat(parsed) || 0
  }

  const handleUpdatePayment = (payment: TenantPaymentLog) => {
    setSelectedPayment(payment)
    const paidAmount = payment.paid_amount
    setUpdatePaymentData({
      payment_date: payment.payment_date ? new Date(payment.payment_date).toISOString().split('T')[0] : '',
      payment_method: payment.payment_method || '',
      notes: payment.notes || '',
      paid_amount: paidAmount
    })
    // Set formatted display value using formatPrice
    setPaidAmountDisplay(formatPrice(paidAmount))
    setUpdatePaymentDialogOpen(true)
  }

  const handlePaidAmountChange = (value: string) => {
    const parsedValue = parsePrice(value)
    setPaidAmountDisplay(formatPrice(parsedValue))
    const isEmptyInput = value.trim() === ''
    setUpdatePaymentData(prev => ({ 
      ...prev, 
      paid_amount: isEmptyInput ? undefined : parsedValue
    }))
  }

  const handleUpdatePaymentSubmit = async () => {
    if (!selectedPayment || !tenant) return

    setUpdatingPayment(true)
    try {
      const sanitizedUpdatePaymentData: UpdateTenantPaymentData = {
        ...updatePaymentData,
        // Pastikan 0 terkirim agar backend set status unpaid (undefined bisa ter-strip saat serialize)
        paid_amount: updatePaymentData.paid_amount ?? 0,
        payment_method: updatePaymentData.payment_method || undefined,
      }
      const response = await tenantsApi.updateTenantPayment(tenant.id, selectedPayment.id, sanitizedUpdatePaymentData)
      
      if (response.success) {
        toast.success('Status pembayaran berhasil diperbarui')
        setUpdatePaymentDialogOpen(false)
        setPaidAmountDisplay('')
        // Reload payment logs and total
        const offset = (paymentPage - 1) * paymentLimit
        const reloadResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, {
          limit: paymentLimit,
          offset: offset,
          status: paymentStatusFilter
        })
        if (reloadResponse.success && reloadResponse.data) {
          const logsData = reloadResponse.data as any
          const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
          setPaymentLogs(logs)
          
          // Update total from reload response
          if (reloadResponse.data && typeof reloadResponse.data === 'object') {
            const responseData = reloadResponse.data as any
            if (typeof responseData.total === 'number' && responseData.total > 0) {
              setPaymentTotal(responseData.total)
            } else if (typeof responseData.count === 'number' && responseData.count > 0) {
              setPaymentTotal(responseData.count)
            } else if (logsData && typeof logsData.total === 'number' && logsData.total > 0) {
              setPaymentTotal(logsData.total)
            }
          }
        }
        
        // Reload paid payments to update summary
        const paidResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, {
          status: 1,
          limit: 1000
        })
        if (paidResponse.success && paidResponse.data) {
          const paidLogsData = paidResponse.data as any
          const paidLogs = Array.isArray(paidLogsData.data) ? paidLogsData.data : (Array.isArray(paidLogsData) ? paidLogsData : [])
          setAllPaidPayments(paidLogs)
        }
      } else {
        toast.error(response.error || 'Gagal memperbarui status pembayaran')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat memperbarui status pembayaran')
    } finally {
      setUpdatingPayment(false)
    }
  }

  const handleCreatePayment = () => {
    setCreatePaymentData({
      billing_period: defaultBillingPeriod,
      amount: 0,
      ppn: 0,
      ppn_percent: 0,
      billing_amount: 0,
      payment_deadline: defaultPaymentDeadline,
      paid_amount: 0,
      payment_method: '',
      notes: '',
      payment_date: ''
    })
    setCreatePaymentDialogOpen(true)
  }

  const handleCreatePaymentSubmit = async () => {
    if (!tenant) return

    if (!createPaymentData.paid_amount || createPaymentData.paid_amount <= 0) {
      toast.error('Jumlah dibayar harus diisi dan lebih dari 0')
      return
    }

    if (!createPaymentData.payment_method) {
      toast.error('Metode pembayaran harus dipilih')
      return
    }

    if (!createPaymentData.notes || !createPaymentData.notes.trim()) {
      toast.error('Catatan harus diisi')
      return
    }

    setCreatingPayment(true)
    try {
      const billAmt = createPaymentData.billing_amount || createPaymentData.paid_amount || 0
      const response = await tenantsApi.createTenantPayment(tenant.id, {
        billing_period: createPaymentData.billing_period || defaultBillingPeriod,
        amount: billAmt,
        ppn_percent: 0,
        ppn: 0,
        billing_amount: billAmt,
        payment_deadline: createPaymentData.payment_deadline || defaultPaymentDeadline,
        paid_amount: createPaymentData.paid_amount,
        payment_method: createPaymentData.payment_method,
        notes: createPaymentData.notes.trim(),
        ...(createPaymentData.payment_date ? { payment_date: createPaymentData.payment_date } : {})
      })
      
      if (response.success) {
        toast.success('Pembayaran berhasil ditambahkan')
        setCreatePaymentDialogOpen(false)
        setCreatePaymentData({
          billing_period: defaultBillingPeriod,
          amount: 0,
          ppn: 0,
          ppn_percent: 0,
          billing_amount: 0,
          payment_deadline: defaultPaymentDeadline,
          paid_amount: 0,
          payment_method: '',
          notes: '',
          payment_date: ''
        })
        
        // Reload payment logs and total
        const offset = (paymentPage - 1) * paymentLimit
        const reloadResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, {
          limit: paymentLimit,
          offset: offset,
          status: paymentStatusFilter
        })
        if (reloadResponse.success && reloadResponse.data) {
          const logsData = reloadResponse.data as any
          const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
          setPaymentLogs(logs)
          
          // Update total from reload response
          if (reloadResponse.data && typeof reloadResponse.data === 'object') {
            const responseData = reloadResponse.data as any
            if (typeof responseData.total === 'number' && responseData.total > 0) {
              setPaymentTotal(responseData.total)
            } else if (typeof responseData.count === 'number' && responseData.count > 0) {
              setPaymentTotal(responseData.count)
            } else if (logsData && typeof logsData.total === 'number' && logsData.total > 0) {
              setPaymentTotal(logsData.total)
            }
          }
        }
        
        // Reload paid payments to update summary
        const paidResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, {
          status: 1,
          limit: 1000
        })
        if (paidResponse.success && paidResponse.data) {
          const paidLogsData = paidResponse.data as any
          const paidLogs = Array.isArray(paidLogsData.data) ? paidLogsData.data : (Array.isArray(paidLogsData) ? paidLogsData : [])
          setAllPaidPayments(paidLogs)
        }
      } else {
        toast.error(response.error || 'Gagal menambahkan pembayaran')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat menambahkan pembayaran')
    } finally {
      setCreatingPayment(false)
    }
  }

  const totalPaymentPages = Math.ceil(paymentTotal / paymentLimit)

  // Calculate total amount due
  const calculateTotalAmountDue = () => {
    if (!tenant) return { totalMustPay: 0, totalPaid: 0, remaining: 0 }
    
    const rentPrice = tenant.rent_price || 0
    const downPayment = tenant.down_payment || 0
    const totalMustPay = rentPrice - downPayment
    
    const totalPaid = allPaidPayments.reduce((sum, payment) => {
      return sum + (payment.paid_amount || 0)
    }, 0)
    
    const remaining = totalMustPay - totalPaid
    
    return { totalMustPay, totalPaid, remaining }
  }

  const { totalMustPay, totalPaid, remaining } = calculateTotalAmountDue()

  const activeTenant = displayTenant ?? tenant
  const totalRentPrice = activeTenant ? getTenantTotalRentPrice(activeTenant) : 0
  const buildingType = activeTenant ? resolveBuildingType(activeTenant) : null

  if (!tenant || !open || !activeTenant) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Detail Tenant: {activeTenant.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Informasi lengkap dan riwayat aktivitas tenant
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href={`/tenants/edit/${activeTenant.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Tenant
                  </Link>
                </Button>
              </div>
            </div>

            {/* Custom Tabs */}
            <div className="w-full">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Informasi Tenant
                </button>
                <button
                  onClick={() => setActiveTab('payment')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'payment'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  History Pembayaran
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  History Aktivitas
                </button>
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    {/* Informasi Dasar */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Informasi Dasar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Kode Tenant
                            </label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">
                              {activeTenant.code}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Nama Tenant
                            </label>
                            <p className="text-sm font-medium">{activeTenant.name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              User
                            </label>
                            <p className="text-sm font-medium">
                              {(() => {
                                try {
                                  if (activeTenant.user && typeof activeTenant.user === 'object') {
                                    return activeTenant.user.name || activeTenant.user.email || '-';
                                  }
                                  return activeTenant.user || '-';
                                } catch (error) {
                                  console.error('Error rendering user field:', error, activeTenant.user);
                                  return '-';
                                }
                              })()}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Status Tenant
                            </label>
                            <div className="mt-1">
                              {(() => {
                                // Use status from database if available, otherwise calculate based on contract_end_at
                                let tenantStatus: string;
                                const normalizedStatus = normalizeTenantStatus(activeTenant.status);
                                if (normalizedStatus) {
                                  tenantStatus = normalizedStatus;
                                } else {
                                  // Fallback: Calculate tenant status based on contract_end_at
                                  const today = new Date()
                                  const endDate = new Date(activeTenant.contract_end_at)
                                  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                  tenantStatus = diffDays < 0 ? 'expired' : 'active'
                                }
                                const statusInfo = getTenantStatus(tenantStatus)
                                return (
                                  <Badge variant={statusInfo.variant}>
                                    {statusInfo.label}
                                  </Badge>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Informasi Kontrak */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Informasi Kontrak
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Mulai Kontrak
                            </label>
                            <p className="text-sm font-medium">{formatDate(activeTenant.contract_begin_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Berakhir Kontrak
                            </label>
                            <p className="text-sm font-medium">{formatDate(activeTenant.contract_end_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Durasi Sewa
                            </label>
                            <p className="text-sm font-medium">
                              {activeTenant.rent_duration} {DURATION_UNIT_LABELS[activeTenant.rent_duration_unit] || activeTenant.rent_duration_unit}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Harga Sewa
                            </label>
                            <p className="text-sm font-medium">
                              {formatCurrencyIdr(totalRentPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Total harga sewa + PPN
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Tipe Bangunan
                            </label>
                            <div className="mt-1">
                              {tenantDetailLoading ? (
                                <span className="text-sm text-muted-foreground">Memuat...</span>
                              ) : buildingType ? (
                                <Badge variant="secondary" className="text-sm">
                                  {buildingType === 'unit' ? 'Unit' : 'Asset'}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              {buildingType === 'asset' ? 'Asset yang Digunakan' : 'Unit yang Digunakan'}
                            </label>
                            <div className="flex flex-col gap-2 mt-1">
                              {tenantDetailLoading ? (
                                <span className="text-sm text-muted-foreground">Memuat...</span>
                              ) : (() => {
                                try {
                                  if (buildingType === 'unit') {
                                    if (activeTenant.units && Array.isArray(activeTenant.units) && activeTenant.units.length > 0) {
                                      return activeTenant.units.map((unit, index) => {
                                        if (!unit) return null
                                        const unitName = unit.name || unit.code || unit.id || `Unit ${index + 1}`
                                        const assetName = unit.asset?.name || unit.asset?.code || null

                                        return (
                                          <div key={unit.id || index} className="flex flex-col gap-1">
                                            <Badge variant="outline" className="text-sm w-fit">
                                              {unitName}
                                            </Badge>
                                            {assetName && (
                                              <div className="text-xs text-muted-foreground ml-1">
                                                Asset: {assetName}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      }).filter(Boolean)
                                    }

                                    if (activeTenant.unit_ids && Array.isArray(activeTenant.unit_ids) && activeTenant.unit_ids.length > 0) {
                                      return activeTenant.unit_ids.map((unitId, index) => (
                                        <Badge key={index} variant="outline" className="text-sm w-fit">
                                          {unitId}
                                        </Badge>
                                      ))
                                    }
                                  }

                                  if (buildingType === 'asset') {
                                    if (activeTenant.assets && Array.isArray(activeTenant.assets) && activeTenant.assets.length > 0) {
                                      return activeTenant.assets.map((asset: Asset, index: number) => {
                                        const assetName = asset.name || asset.code || asset.id || `Asset ${index + 1}`
                                        const assetTypeLabel = asset.asset_type != null ? getAssetTypeLabel(asset.asset_type) : null

                                        return (
                                          <div key={asset.id || index} className="flex flex-col gap-1">
                                            <Badge variant="outline" className="text-sm w-fit">
                                              {assetName}
                                            </Badge>
                                            {assetTypeLabel && (
                                              <div className="text-xs text-muted-foreground ml-1">
                                                Tipe: {assetTypeLabel}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    }

                                    if (activeTenant.asset_ids && Array.isArray(activeTenant.asset_ids) && activeTenant.asset_ids.length > 0) {
                                      return activeTenant.asset_ids.map((assetId, index) => (
                                        <Badge key={index} variant="outline" className="text-sm w-fit">
                                          {assetId}
                                        </Badge>
                                      ))
                                    }
                                  }

                                  return <span className="text-sm text-muted-foreground">-</span>
                                } catch (error) {
                                  console.error('Error rendering building resources:', error, activeTenant.units, activeTenant.assets)
                                  return <span className="text-sm text-muted-foreground">-</span>
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Dokumen dan Kategori */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Dokumen dan Kategori
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Dokumen Identitas
                            </label>
                            <div className="mt-2">
                              {activeTenant.tenant_identifications && activeTenant.tenant_identifications.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {activeTenant.tenant_identifications.map((doc, index) => {
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc) || doc.startsWith('data:image')
                                    const isPdf = /\.pdf$/i.test(doc)
                                    const fileName = doc.split('/').pop() || `Dokumen ${index + 1}`
                                    
                                    return (
                                      <div key={index} className="relative group">
                                        <div className="aspect-square rounded-lg overflow-hidden border bg-gray-100">
                                          {isImage ? (
                                            <img
                                              src={doc}
                                              alt={`Dokumen Identitas ${index + 1}`}
                                              className="w-full h-full object-cover cursor-pointer"
                                              onClick={() => window.open(doc, '_blank')}
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-image.png'
                                              }}
                                            />
                                          ) : isPdf ? (
                                            <a
                                              href={doc}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="w-full h-full flex flex-col items-center justify-center p-4 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                                            >
                                              <FileText className="h-12 w-12 text-red-600 mb-2" />
                                              <span className="text-xs font-medium text-red-700 text-center line-clamp-2">
                                                {fileName}
                                              </span>
                                              <span className="text-xs text-red-500 mt-1">PDF</span>
                                            </a>
                                          ) : (
                                            <a
                                              href={doc}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                            >
                                              <FileText className="h-12 w-12 text-gray-400 mb-2" />
                                              <span className="text-xs text-gray-600 text-center line-clamp-2 px-2">
                                                {fileName}
                                              </span>
                                            </a>
                                          )}
                                        </div>
                                        {isImage && (
                                          <a
                                            href={doc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                                          >
                                            <ImageIcon className="h-6 w-6 text-white" />
                                          </a>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Dokumen Kontrak
                            </label>
                            <div className="mt-2">
                              {activeTenant.contract_documents && activeTenant.contract_documents.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {activeTenant.contract_documents.map((doc, index) => {
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc) || doc.startsWith('data:image')
                                    const isPdf = /\.pdf$/i.test(doc)
                                    const fileName = doc.split('/').pop() || `Dokumen ${index + 1}`
                                    
                                    return (
                                      <div key={index} className="relative group">
                                        <div className="aspect-square rounded-lg overflow-hidden border bg-gray-100">
                                          {isImage ? (
                                            <img
                                              src={doc}
                                              alt={`Dokumen Kontrak ${index + 1}`}
                                              className="w-full h-full object-cover cursor-pointer"
                                              onClick={() => window.open(doc, '_blank')}
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-image.png'
                                              }}
                                            />
                                          ) : isPdf ? (
                                            <a
                                              href={doc}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="w-full h-full flex flex-col items-center justify-center p-4 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                                            >
                                              <FileText className="h-12 w-12 text-red-600 mb-2" />
                                              <span className="text-xs font-medium text-red-700 text-center line-clamp-2">
                                                {fileName}
                                              </span>
                                              <span className="text-xs text-red-500 mt-1">PDF</span>
                                            </a>
                                          ) : (
                                            <a
                                              href={doc}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                            >
                                              <FileText className="h-12 w-12 text-gray-400 mb-2" />
                                              <span className="text-xs text-gray-600 text-center line-clamp-2 px-2">
                                                {fileName}
                                              </span>
                                            </a>
                                          )}
                                        </div>
                                        {isImage && (
                                          <a
                                            href={doc}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                                          >
                                            <ImageIcon className="h-6 w-6 text-white" />
                                          </a>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Kategori
                            </label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="outline" className="text-sm">
                                {getCategoryLabel(activeTenant)}
                              </Badge>
                            </div>
                          </div>
                          {activeTenant.bank && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Bank
                              </label>
                              <div className="mt-1 text-sm">
                                <p className="font-medium">{activeTenant.bank.bank_name}</p>
                                <p className="text-muted-foreground">
                                  {activeTenant.bank.bank_account} — {activeTenant.bank.holder_name}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Informasi Sistem */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Informasi Sistem
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Dibuat Pada
                            </label>
                            <p className="text-sm font-medium">{formatDate(activeTenant.created_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Diperbarui Pada
                            </label>
                            <p className="text-sm font-medium">{formatDate(activeTenant.updated_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              ID Tenant
                            </label>
                            <p className="text-xs font-mono bg-muted p-2 rounded">
                              {activeTenant.id}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              ID User
                            </label>
                            <p className="text-xs font-mono bg-muted p-2 rounded">
                              {activeTenant.user_id}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          History Aktivitas Tenant
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TenantLogsTable tenantId={activeTenant.id} loading={false} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === 'payment' && (
                  <div className="min-w-0 space-y-6">
                    {/* Payment Summary Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Ringkasan Pembayaran
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="text-sm text-muted-foreground mb-1">Total Harus Dibayar</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(totalMustPay)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              (Harga Sewa - Uang Muka)
                            </div>
                          </div>
                          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="text-sm text-muted-foreground mb-1">Total Sudah Dibayar</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(totalPaid)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              ({allPaidPayments.length} pembayaran)
                            </div>
                          </div>
                          <div className={`p-4 rounded-lg border ${
                            remaining > 0 
                              ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' 
                              : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                          }`}>
                            <div className="text-sm text-muted-foreground mb-1">Sisa Pembayaran</div>
                            <div className={`text-2xl font-bold ${
                              remaining > 0 
                                ? 'text-orange-600 dark:text-orange-400' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(remaining)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {remaining > 0 ? 'Belum Lunas' : 'Lunas'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            History Pembayaran
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={handleCreatePayment}
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Sisa Pembayaran
                            </Button>
                            <Label htmlFor="status-filter" className="text-sm">Filter Status:</Label>
                            <Select
                              value={paymentStatusFilter !== undefined ? String(paymentStatusFilter) : 'all'}
                              onValueChange={(value) => {
                                setPaymentStatusFilter(value === 'all' ? undefined : parseInt(value))
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Semua Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="0">Unpaid</SelectItem>
                                <SelectItem value="1">Paid</SelectItem>
                                <SelectItem value="2">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="min-w-0">
                        {paymentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Memuat data...</span>
                          </div>
                        ) : paymentLogs.length > 0 ? (
                          <>
                            <div className="max-w-full min-w-0 rounded-md border bg-card shadow-sm">
                              <p className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground md:hidden">
                                Geser ke samping untuk melihat semua kolom.
                              </p>
                              <Table className="min-w-[1200px] w-max">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="z-30 w-12 min-w-12 max-w-12 shrink-0 bg-muted text-center md:sticky md:left-0 md:border-r">
                                      No
                                    </TableHead>
                                    <TableHead className="z-30 w-[140px] min-w-[140px] max-w-[140px] shrink-0 bg-muted text-center md:sticky md:left-12 md:border-r">
                                      Aksi
                                    </TableHead>
                                    <TableHead className="z-30 w-32 min-w-[8rem] max-w-[8rem] shrink-0 bg-muted whitespace-nowrap md:sticky md:left-[188px] md:border-r">
                                      No. Invoice
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="whitespace-nowrap">Periode Tagihan</TableHead>
                                    <TableHead className="whitespace-nowrap">Jatuh Tempo</TableHead>
                                    <TableHead>Jenis Tagihan</TableHead>
                                    <TableHead>SPK</TableHead>
                                    <TableHead>Tgl. Invoice</TableHead>
                                    <TableHead>PPh</TableHead>
                                    <TableHead>Jumlah Tagihan</TableHead>
                                    <TableHead>Tanggal Bayar</TableHead>
                                    <TableHead>Jumlah Bayar</TableHead>
                                    <TableHead>Metode</TableHead>
                                    <TableHead className="min-w-[140px]">Catatan</TableHead>
                                    <TableHead>Outstanding</TableHead>
                                    <TableHead className="whitespace-nowrap">Overdue (hari)</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead className="whitespace-nowrap">Last Charge</TableHead>
                                    <TableHead>Diubah Oleh</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {paymentLogs.map((log, logIndex) => {
                                    const paidAmount = log.paid_amount || 0
                                    const formattedPaidAmount =
                                      paidAmount > 0 ? formatCurrencyIdr(paidAmount) : '-'

                                    return (
                                      <TableRow key={log.id} className="group hover:bg-muted">
                                        <TableCell className="z-20 w-12 min-w-12 max-w-12 shrink-0 bg-background text-center text-sm font-medium group-hover:bg-muted md:sticky md:left-0 md:border-r">
                                          {((paymentPage - 1) * paymentLimit) + logIndex + 1}
                                        </TableCell>
                                        <TableCell className="z-20 w-[140px] min-w-[140px] max-w-[140px] shrink-0 bg-background group-hover:bg-muted md:sticky md:left-12 md:border-r">
                                          {log.status === 1 ? (
                                            <span className="text-muted-foreground text-sm flex justify-center">-</span>
                                          ) : (
                                            <div className="flex justify-center">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleUpdatePayment(log)}
                                              >
                                                <Edit className="h-4 w-4 mr-1" />
                                                Pelunasan
                                              </Button>
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell
                                          className="z-20 w-32 min-w-[8rem] max-w-[8rem] shrink-0 truncate bg-background font-mono text-sm group-hover:bg-muted md:sticky md:left-[188px] md:border-r"
                                          title={log.invoice_number || undefined}
                                        >
                                          {log.invoice_number || '-'}
                                        </TableCell>
                                        <TableCell>
                                          {getPaymentStatusBadge(log.status)}
                                        </TableCell>
                                        <TableCell>{log.billing_period || '-'}</TableCell>
                                        <TableCell>
                                          {log.payment_deadline ? formatDate(log.payment_deadline) : '-'}
                                        </TableCell>
                                        <TableCell>{log.billing_type || '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap">{log.spk || '-'}</TableCell>
                                        <TableCell>
                                          {log.invoice_date
                                            ? formatDate(String(log.invoice_date).slice(0, 10))
                                            : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrencyIdr(log.pph)}
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrencyIdr(log.billing_amount)}
                                        </TableCell>
                                        <TableCell>
                                          {log.payment_date ? formatDate(log.payment_date) : '-'}
                                        </TableCell>
                                        <TableCell>{formattedPaidAmount}</TableCell>
                                        <TableCell>{paymentMethodLabel(log.payment_method)}</TableCell>
                                        <TableCell className="max-w-[220px] align-top">
                                          <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm">
                                            {log.notes?.trim() ? log.notes : '-'}
                                          </span>
                                        </TableCell>
                                        <TableCell>{formatCurrencyIdr(log.outstanding)}</TableCell>
                                        <TableCell>
                                          {log.overdue != null
                                            ? `${Math.round(Number(log.overdue))} hari`
                                            : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {formatBillingRatePercent(log.rate)}
                                        </TableCell>
                                        <TableCell>
                                          {log.last_charge_date ? formatDate(log.last_charge_date) : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {log.updatedBy ? (
                                            <div>
                                              <p className="font-medium text-sm">{log.updatedBy.name}</p>
                                              <p className="text-xs text-muted-foreground">{log.updatedBy.email}</p>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                            {/* Pagination */}
                            {(paymentPage > 1 || paymentLogs.length === paymentLimit || totalPaymentPages > 1) && (
                              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                  {paymentTotal > 0 ? (
                                    <>Menampilkan {((paymentPage - 1) * paymentLimit) + 1} - {Math.min(paymentPage * paymentLimit, paymentTotal)} dari {paymentTotal} pembayaran</>
                                  ) : (
                                    <>Menampilkan {((paymentPage - 1) * paymentLimit) + 1} - {((paymentPage - 1) * paymentLimit) + paymentLogs.length} pembayaran</>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPaymentPage(prev => Math.max(1, prev - 1))}
                                    disabled={paymentPage === 1 || paymentLoading}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm">
                                    Halaman {paymentPage} {totalPaymentPages > 1 ? `dari ${totalPaymentPages}` : (paymentPage > 1 ? '(terakhir)' : '')}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPaymentPage(prev => prev + 1)}
                                    disabled={paymentLoading || (paymentLogs.length < paymentLimit && paymentPage > 1)}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Tidak ada history pembayaran</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Update Payment Dialog */}
      <Dialog open={updatePaymentDialogOpen} onOpenChange={(open) => {
        setUpdatePaymentDialogOpen(open)
        if (!open) {
          setPaidAmountDisplay('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pelunasan Pembayaran</DialogTitle>
            <DialogDescription>
              Perbarui status pembayaran untuk {selectedPayment?.paid_amount ? new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(selectedPayment.paid_amount) : 'pembayaran ini'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Tanggal Pembayaran</Label>
              <Input
                id="payment_date"
                type="date"
                value={updatePaymentData.payment_date}
                onChange={(e) => setUpdatePaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Metode Pembayaran</Label>
              <Select
                value={updatePaymentData.payment_method || ''}
                onValueChange={(value) => setUpdatePaymentData(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_amount">Jumlah Dibayar</Label>
              <Input
                id="paid_amount"
                type="text"
                value={paidAmountDisplay}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
                placeholder="Masukkan jumlah yang dibayar"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Input
                id="notes"
                value={updatePaymentData.notes}
                onChange={(e) => setUpdatePaymentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Masukkan catatan (opsional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUpdatePaymentDialogOpen(false)
                setPaidAmountDisplay('')
              }}
              disabled={updatingPayment}
            >
              Batal
            </Button>
            <Button
              onClick={handleUpdatePaymentSubmit}
              disabled={updatingPayment}
            >
              {updatingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Payment Dialog */}
      <Dialog open={createPaymentDialogOpen} onOpenChange={setCreatePaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sisa Pembayaran</DialogTitle>
            <DialogDescription>
              Tambahkan catatan pembayaran baru untuk tenant ini
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create_paid_amount">
                Jumlah Dibayar <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
                <Input
                  id="create_paid_amount"
                  type="text"
                  value={formatPrice(createPaymentData.paid_amount || 0)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value)
                    setCreatePaymentData(prev => ({
                      ...prev,
                      paid_amount: parsedValue
                    }))
                  }}
                  placeholder="0"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_payment_date">Tanggal Pembayaran</Label>
              <Input
                id="create_payment_date"
                type="date"
                value={createPaymentData.payment_date || ''}
                onChange={(e) => setCreatePaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_payment_method">
                Metode Pembayaran <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createPaymentData.payment_method}
                onValueChange={(value) => setCreatePaymentData(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_notes">
                Catatan <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create_notes"
                value={createPaymentData.notes}
                onChange={(e) => setCreatePaymentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Masukkan catatan pembayaran"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatePaymentDialogOpen(false)}
              disabled={creatingPayment}
            >
              Batal
            </Button>
            <Button
              onClick={handleCreatePaymentSubmit}
              disabled={creatingPayment}
            >
              {creatingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Pembayaran
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

