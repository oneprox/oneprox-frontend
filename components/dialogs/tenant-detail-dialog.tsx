'use client'

import React, { useState, useEffect } from 'react'
import { Tenant, DURATION_UNIT_LABELS, DURATION_UNITS, TenantDepositLog, TenantPaymentLog, tenantsApi, UpdateTenantPaymentData, CreateTenantPaymentData } from '@/lib/api'
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
import { History, Building2, X, Edit, Wallet, CreditCard, DollarSign, ChevronLeft, ChevronRight, Loader2, Plus, Image as ImageIcon, FileText } from 'lucide-react'
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
  const [depositLogs, setDepositLogs] = useState<TenantDepositLog[]>([])
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
    billing_amount: 0,
    payment_deadline: defaultPaymentDeadline,
    amount: 0,
    payment_method: '',
    notes: '',
    payment_date: ''
  })
  const [creatingPayment, setCreatingPayment] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch deposit logs when dialog opens and tenant is available
  useEffect(() => {
    const loadDepositLogs = async () => {
      if (open && tenant?.id) {
        try {
          const response = await tenantsApi.getTenantDepositLogs(tenant.id)
          if (response.success && response.data) {
            const logsData = response.data as any
            const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
            console.log('logs', logs)
            setDepositLogs(logs)
          }
        } catch (error) {
          console.error('Load deposit logs error:', error)
        }
      }
    }

    loadDepositLogs()
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
            const logs = Array.isArray(logsData.data) ? logsData.data : (Array.isArray(logsData) ? logsData : [])
            setPaymentLogs(logs)
            
            // Debug: Log the response structure to understand the format
            console.log('Payment logs response:', { response, logsData, logs })
            
            // Try to get total from various possible response formats
            let total: number | null = logsData.pagination.total
            
            // Check response.data directly first (most common format: { data: [...], total: 11 })
            if (response.data && typeof response.data === 'object') {
              const responseData = response.data as any
              if (typeof responseData.total === 'number' && responseData.total > 0) {
                total = responseData.total
              } else if (typeof responseData.count === 'number' && responseData.count > 0) {
                total = responseData.count
              }
            }
            
            // Check logsData (nested data structure: { data: { data: [...], total: 11 } })
            if (total === null && logsData && typeof logsData === 'object') {
              if (typeof logsData.total === 'number' && logsData.total > 0) {
                total = logsData.total
              } else if (typeof logsData.count === 'number' && logsData.count > 0) {
                total = logsData.count
              }
            }
            
            // Check if total is in the message or other fields
            if (total === null && response && typeof response === 'object') {
              const responseAny = response as any
              if (typeof responseAny.total === 'number' && responseAny.total > 0) {
                total = responseAny.total
              }
            }
            
            // Update total if we found it, otherwise keep existing total or use current count
            if (total !== null && total > 0) {
              setPaymentTotal(total)
              console.log('Payment total set to:', total)
            } else {
              console.log('No total found in response, keeping existing total or using current count')
              // Only update if we're on first page and don't have a total yet
              if (paymentPage === 1 && paymentTotal === 0) {
                setPaymentTotal(logs.length)
              }
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

  const getTenantStatus = (status: string) => {
    switch (status) {
      case 'inactive':
        return { label: 'Tidak Aktif', variant: 'secondary' as const }
      case 'active':
        return { label: 'Aktif', variant: 'default' as const }
      case 'pending':
        return { label: 'Pending', variant: 'outline' as const }
      case 'expired':
        return { label: 'Expired', variant: 'destructive' as const }
      case 'terminated':
        return { label: 'Terminated', variant: 'destructive' as const }
      case 'blacklisted':
        return { label: 'Blacklisted', variant: 'destructive' as const }
      default:
        return { label: 'Unknown', variant: 'secondary' as const }
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
    setUpdatePaymentData(prev => ({ 
      ...prev, 
      paid_amount: parsedValue > 0 ? parsedValue : undefined 
    }))
  }

  const handleUpdatePaymentSubmit = async () => {
    if (!selectedPayment || !tenant) return

    setUpdatingPayment(true)
    try {
      const response = await tenantsApi.updateTenantPayment(tenant.id, selectedPayment.id, updatePaymentData)
      
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
      billing_amount: 0,
      payment_deadline: defaultPaymentDeadline,
      amount: 0,
      payment_method: '',
      notes: '',
      payment_date: ''
    })
    setCreatePaymentDialogOpen(true)
  }

  const handleCreatePaymentSubmit = async () => {
    if (!tenant) return

    if (!createPaymentData.amount || createPaymentData.amount <= 0) {
      toast.error('Jumlah pembayaran harus diisi dan lebih dari 0')
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
      const response = await tenantsApi.createTenantPayment(tenant.id, {
        billing_period: createPaymentData.billing_period || defaultBillingPeriod,
        billing_amount: createPaymentData.billing_amount ?? createPaymentData.amount,
        payment_deadline: createPaymentData.payment_deadline || defaultPaymentDeadline,
        amount: createPaymentData.amount,
        payment_method: createPaymentData.payment_method,
        notes: createPaymentData.notes.trim(),
        ...(createPaymentData.payment_date ? { payment_date: createPaymentData.payment_date } : {})
      } as CreateTenantPaymentData & { payment_date?: string })
      
      if (response.success) {
        toast.success('Pembayaran berhasil ditambahkan')
        setCreatePaymentDialogOpen(false)
        setCreatePaymentData({
          billing_period: defaultBillingPeriod,
          billing_amount: 0,
          payment_deadline: defaultPaymentDeadline,
          amount: 0,
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

  // Calculate price per term (harga bayar sewa)
  const calculatePricePerTerm = () => {
    if (!tenant) {
      console.log("calculatePricePerTerm: no tenant")
      return null
    }
    
    const rentPrice = tenant.rent_price || 0
    const downPayment = tenant.down_payment || 0
    const duration = parseInt(String(tenant.rent_duration)) || 0
    
    // Normalize rent_duration_unit to number: 0 = year, 1 = month
    let durationUnitNum: number
    if (typeof tenant.rent_duration_unit === 'number') {
      durationUnitNum = tenant.rent_duration_unit
    } else if (typeof tenant.rent_duration_unit === 'string') {
      const unitStr = tenant.rent_duration_unit.toLowerCase()
      durationUnitNum = (unitStr === 'year' || unitStr === DURATION_UNITS.YEAR) ? 0 : 1
    } else {
      durationUnitNum = 1 // default to month
    }
    
    // Normalize payment_term to number: 0 = year, 1 = month
    let paymentTermNum: number
    if (typeof tenant.payment_term === 'number') {
      paymentTermNum = tenant.payment_term
    } else if (typeof tenant.payment_term === 'string') {
      const termStr = tenant.payment_term.trim().toLowerCase()
      if (termStr === '0' || termStr === 'year' || termStr === DURATION_UNITS.YEAR) {
        paymentTermNum = 0
      } else if (termStr === '1' || termStr === 'month' || termStr === DURATION_UNITS.MONTH) {
        paymentTermNum = 1
      } else {
        paymentTermNum = 1 // default to month
      }
    } else {
      paymentTermNum = 1 // default to month
    }
    
    console.log("calculatePricePerTerm: durationUnitNum", durationUnitNum, "paymentTermNum", paymentTermNum)
    
    let numberOfPayments = 0
    
    // Check payment_term first
    if (paymentTermNum === durationUnitNum) {
      // If payment_term is same as rent_duration_unit, number of payments is duration
      numberOfPayments = duration
      console.log("calculatePricePerTerm: same units, numberOfPayments = duration =", duration)
    } else {
      // If payment_term is not the same as rent_duration_unit
      if (paymentTermNum === 1 && durationUnitNum === 0) {
        // If payment_term is month (1) and rent_duration_unit is year (0), number of payments is duration * 12
        numberOfPayments = duration * 12
        console.log("calculatePricePerTerm: month payment with year duration, numberOfPayments =", numberOfPayments)
      } else {
        console.log("calculatePricePerTerm: no matching condition, numberOfPayments stays 0")
      }
    }
    console.log("numberOfPayments", numberOfPayments)
    
    // Harga bayar is (rentPrice - downPayment) / number of payments
    if (numberOfPayments > 0) {
      return (rentPrice - downPayment) / numberOfPayments
    }
    
    return null
  }

  const pricePerTerm = calculatePricePerTerm()
  console.log("pricePerTerm", pricePerTerm)
  const formattedPricePerTerm = pricePerTerm 
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(pricePerTerm)
    : null

  if (!tenant || !open) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Detail Tenant: {tenant.name}
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href={`/tenants/edit/${tenant.id}`}>
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
                <button
                  onClick={() => setActiveTab('deposit')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'deposit'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  History Deposito
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
                              {tenant.code}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Nama Tenant
                            </label>
                            <p className="text-sm font-medium">{tenant.name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              User
                            </label>
                            <p className="text-sm font-medium">
                              {(() => {
                                try {
                                  if (tenant.user && typeof tenant.user === 'object') {
                                    return tenant.user.name || tenant.user.email || '-';
                                  }
                                  return tenant.user || '-';
                                } catch (error) {
                                  console.error('Error rendering user field:', error, tenant.user);
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
                                if (tenant.status) {
                                  // Use status from database
                                  tenantStatus = tenant.status;
                                } else {
                                  // Fallback: Calculate tenant status based on contract_end_at
                                  const today = new Date()
                                  const endDate = new Date(tenant.contract_end_at)
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
                            <p className="text-sm font-medium">{formatDate(tenant.contract_begin_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Berakhir Kontrak
                            </label>
                            <p className="text-sm font-medium">{formatDate(tenant.contract_end_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Durasi Sewa
                            </label>
                            <p className="text-sm font-medium">
                              {tenant.rent_duration} {DURATION_UNIT_LABELS[tenant.rent_duration_unit] || tenant.rent_duration_unit}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Harga Sewa
                            </label>
                            <p className="text-sm font-medium">
                              {tenant.rent_price 
                                ? new Intl.NumberFormat('id-ID', {
                                    style: 'currency',
                                    currency: 'IDR',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }).format(tenant.rent_price)
                                : '-'}
                            </p>
                          </div>
                          {(
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Harga Bayar Sewa
                              </label>
                              <p className="text-sm font-medium">
                                {(() => {
                                  const rentPrice = tenant.rent_price || 0
                                  const downPayment = tenant.down_payment || 0
                                  const duration = parseInt(String(tenant.rent_duration)) || 0
                                  
                                  // Normalize rent_duration_unit to number: 0 = year, 1 = month
                                  let durationUnitNum: number
                                  if (typeof tenant.rent_duration_unit === 'number') {
                                    durationUnitNum = tenant.rent_duration_unit
                                  } else if (typeof tenant.rent_duration_unit === 'string') {
                                    const unitStr = tenant.rent_duration_unit.toLowerCase()
                                    durationUnitNum = (unitStr === 'year' || unitStr === DURATION_UNITS.YEAR) ? 0 : 1
                                  } else {
                                    durationUnitNum = 1 // default to month
                                  }
                                  
                                  // Normalize payment_term to number: 0 = year, 1 = month
                                  let paymentTermNum: number
                                  if (typeof tenant.payment_term === 'number') {
                                    paymentTermNum = tenant.payment_term
                                  } else if (typeof tenant.payment_term === 'string') {
                                    const termStr = tenant.payment_term.trim().toLowerCase()
                                    if (termStr === '0' || termStr === 'year' || termStr === DURATION_UNITS.YEAR) {
                                      paymentTermNum = 0
                                    } else if (termStr === '1' || termStr === 'month' || termStr === DURATION_UNITS.MONTH) {
                                      paymentTermNum = 1
                                    } else {
                                      paymentTermNum = 1 // default to month
                                    }
                                  } else {
                                    paymentTermNum = 1 // default to month
                                  }
                                  
                                  if (duration > 0) {
                                    let numberOfPayments = 0
                                    
                                    // Check payment_term first
                                    if (paymentTermNum === durationUnitNum) {
                                      // If payment_term is same as rent_duration_unit, number of payments is duration
                                      numberOfPayments = duration
                                    } else {
                                      // If payment_term is not the same as rent_duration_unit
                                      if (paymentTermNum === 1 && durationUnitNum === 0) {
                                        // If payment_term is month (1) and rent_duration_unit is year (0), number of payments is duration * 12
                                        numberOfPayments = duration * 12
                                      }
                                    }
                                    
                                    // Harga bayar is (rentPrice - downPayment) / number of payments
                                    const pricePerTerm = numberOfPayments > 0 ? (rentPrice - downPayment) / numberOfPayments : 0
                                    
                                    if (numberOfPayments > 0 && pricePerTerm > 0) {
                                      return new Intl.NumberFormat('id-ID', {
                                        style: 'currency',
                                        currency: 'IDR',
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                      }).format(pricePerTerm)
                                    }
                                  }
                                  return '-'
                                })()}
                              </p>
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Unit & Asset
                            </label>
                            <div className="flex flex-col gap-2 mt-1">
                              {(() => {
                                try {
                                  // Check if units array exists and has items
                                  if (tenant.units && Array.isArray(tenant.units) && tenant.units.length > 0) {
                                    return tenant.units.map((unit, index) => {
                                      if (!unit) return null;
                                      const unitName = unit.name || unit.id || `Unit ${index + 1}`;
                                      const assetName = unit.asset?.name || unit.asset?.code || (unit.asset_id ? `Asset ${unit.asset_id}` : null);
                                      
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
                                      );
                                    }).filter(Boolean);
                                  }
                                  
                                  // Fallback: check unit_ids
                                  if (tenant.unit_ids && Array.isArray(tenant.unit_ids) && tenant.unit_ids.length > 0) {
                                    return tenant.unit_ids.map((unitId, index) => (
                                      <Badge key={index} variant="outline" className="text-sm w-fit">
                                        {unitId}
                                      </Badge>
                                    ));
                                  }
                                  
                                  // If unit_ids is a string
                                  if (tenant.unit_ids && typeof tenant.unit_ids === 'string') {
                                    return (
                                      <Badge variant="outline" className="text-sm w-fit">
                                        {tenant.unit_ids}
                                      </Badge>
                                    );
                                  }
                                  
                                  return <span className="text-sm text-muted-foreground">-</span>;
                                } catch (error) {
                                  console.error('Error rendering unit field:', error, tenant.units, tenant.unit_ids);
                                  return <span className="text-sm text-muted-foreground">-</span>;
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
                              {tenant.tenant_identifications && tenant.tenant_identifications.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {tenant.tenant_identifications.map((doc, index) => {
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
                              {tenant.contract_documents && tenant.contract_documents.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {tenant.contract_documents.map((doc, index) => {
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
                                {getCategoryLabel(tenant)}
                              </Badge>
                            </div>
                          </div>
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
                            <p className="text-sm font-medium">{formatDate(tenant.created_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Diperbarui Pada
                            </label>
                            <p className="text-sm font-medium">{formatDate(tenant.updated_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              ID Tenant
                            </label>
                            <p className="text-xs font-mono bg-muted p-2 rounded">
                              {tenant.id}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              ID User
                            </label>
                            <p className="text-xs font-mono bg-muted p-2 rounded">
                              {tenant.user_id}
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
                        <TenantLogsTable tenantId={tenant.id} loading={false} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === 'deposit' && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5" />
                          History Deposito
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {depositLogs.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tanggal</TableHead>
                                  <TableHead>Reason</TableHead>
                                  <TableHead>Current Deposit</TableHead>
                                  <TableHead>Dibuat Oleh</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {depositLogs.map((log) => {
                                  const reason = log.reason || '-'
                                  const newDeposit = log.new_deposit || 0
                                  const oldDeposit = log.old_deposit || 0
                                  const delta = newDeposit - oldDeposit
                                  const isIncrease = delta > 0
                                  const isDecrease = delta < 0
                                  
                                  return (
                                    <TableRow key={log.id}>
                                      <TableCell className="text-sm">
                                        {formatDate(log.created_at)}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm">{reason}</span>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium">
                                            {new Intl.NumberFormat('id-ID', {
                                              style: 'currency',
                                              currency: 'IDR',
                                              minimumFractionDigits: 0,
                                            }).format(Number(newDeposit))}
                                          </span>
                                          {delta !== 0 && (
                                            <span className={`text-sm font-semibold ${
                                              isIncrease ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                              ({isIncrease ? '+' : '-'}
                                              {new Intl.NumberFormat('id-ID', {
                                                style: 'currency',
                                                currency: 'IDR',
                                                minimumFractionDigits: 0,
                                              }).format(Math.abs(delta))})
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {log.created_by ? (
                                          <div>
                                            <p className="font-medium text-sm">{log.created_by.name}</p>
                                            <p className="text-xs text-muted-foreground">{log.created_by.email}</p>
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
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Tidak ada history deposito</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === 'payment' && (
                  <div className="space-y-6">
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
                      <CardContent>
                        {paymentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Memuat data...</span>
                          </div>
                        ) : paymentLogs.length > 0 ? (
                          <>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Batas Pembayaran</TableHead>
                                    <TableHead>Jumlah Dibayar</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Tanggal Pembayaran</TableHead>
                                    <TableHead>Metode Pembayaran</TableHead>
                                    <TableHead>Catatan</TableHead>
                                    <TableHead>Diubah Oleh</TableHead>
                                    <TableHead>Aksi</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {paymentLogs.map((log) => {
                                    const paidAmount = log.paid_amount || 0
                                    const formattedPaidAmount = new Intl.NumberFormat('id-ID', {
                                      style: 'currency',
                                      currency: 'IDR',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(paidAmount)

                                    return (
                                      <TableRow key={log.id}>
                                        <TableCell>
                                          {log.payment_deadline ? formatDate(log.payment_deadline) : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {paidAmount > 0 ? formattedPaidAmount : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {getPaymentStatusBadge(log.status)}
                                        </TableCell>
                                        <TableCell>
                                          {log.payment_date ? formatDate(log.payment_date) : '-'}
                                        </TableCell>
                                        <TableCell>
                                          {log.payment_method || '-'}
                                        </TableCell>
                                        <TableCell>
                                          {log.notes || '-'}
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
                                        <TableCell>
                                          {log.status === 1 ? (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleUpdatePayment(log)}
                                            >
                                              <Edit className="h-4 w-4 mr-1" />
                                              Pelunasan
                                            </Button>
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
              Perbarui status pembayaran untuk {selectedPayment?.amount ? new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(selectedPayment.amount) : 'pembayaran ini'}
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
                placeholder={pricePerTerm ? formatPrice(pricePerTerm) : "Masukkan jumlah yang dibayar"}
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
              <Label htmlFor="create_amount">
                Jumlah Pembayaran <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
                <Input
                  id="create_amount"
                  type="text"
                  value={formatPrice(createPaymentData.amount || 0)}
                  onChange={(e) => {
                    const parsedValue = parsePrice(e.target.value)
                    setCreatePaymentData(prev => ({ 
                      ...prev, 
                      amount: parsedValue
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

