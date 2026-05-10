'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  RefreshCw,
  Loader2,
  Home,
  AlertCircle,
  FileText,
  Calendar
} from 'lucide-react'
import { Tenant, tenantsApi, Unit, unitsApi, Asset, assetsApi, TenantPaymentLog, TenantDepositLog, authApi, User, DURATION_UNIT_LABELS } from '@/lib/api'
import toast from 'react-hot-toast'

interface TenantWithPayment extends Tenant {
  units?: Unit[]
  allPayments?: TenantPaymentLog[]
  currentPayment?: TenantPaymentLog | null
  depositLogs?: TenantDepositLog[]
}

interface PropertyCard {
  tenant: TenantWithPayment
  unit: Unit
  asset: Asset
  payment: TenantPaymentLog | null
  status: 'terlambat' | 'jatuh-tempo-hari-ini' | 'lunas' | 'akan-datang'
}

export default function DashboardTenantPage() {
  const [tenants, setTenants] = useState<TenantWithPayment[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Menggunakan payment_status dari tabel tenant (bukan dihitung manual)
  // Status ini diupdate oleh backend melalui internal.js berdasarkan payment logs
  const getPaymentStatus = (tenant: TenantWithPayment): 'terlambat' | 'jatuh-tempo-hari-ini' | 'lunas' | 'akan-datang' => {
    // Ambil payment_status langsung dari tenant table
    const paymentStatus = tenant.payment_status || 'scheduled'
    
    // Mapping dari nilai ENUM di database ke nilai yang digunakan di UI
    switch (paymentStatus) {
      case 'paid':
        return 'lunas'
      case 'overdue':
        return 'terlambat'
      case 'reminder_needed':
        return 'jatuh-tempo-hari-ini'
      case 'scheduled':
      default:
        return 'akan-datang'
    }
  }

  const getStatusBadge = (status: 'terlambat' | 'jatuh-tempo-hari-ini' | 'lunas' | 'akan-datang') => {
    switch (status) {
      case 'terlambat':
        return <Badge className="bg-red-500 hover:bg-red-600">Terlambat</Badge>
      case 'jatuh-tempo-hari-ini':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Jatuh Tempo Hari Ini</Badge>
      case 'lunas':
        return <Badge className="bg-green-500 hover:bg-green-600">Lunas</Badge>
      case 'akan-datang':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Akan Datang</Badge>
    }
  }

  const getCurrentPayment = (payments: TenantPaymentLog[]): TenantPaymentLog | null => {
    if (payments.length === 0) return null
    
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // Cari payment yang belum lunas dan deadline terdekat
    const unpaidPayments = payments.filter(p => p.status === 0 && p.payment_deadline)
    if (unpaidPayments.length > 0) {
      unpaidPayments.sort((a, b) => {
        const dateA = new Date(a.payment_deadline!).getTime()
        const dateB = new Date(b.payment_deadline!).getTime()
        return dateA - dateB
      })
      return unpaidPayments[0]
    }

    // Jika semua sudah lunas, ambil yang terbaru
    const sortedPayments = [...payments].sort((a, b) => {
      const dateA = new Date(a.payment_deadline || a.created_at).getTime()
      const dateB = new Date(b.payment_deadline || b.created_at).getTime()
      return dateB - dateA
    })
    return sortedPayments[0]
  }

  const calculateContractDuration = (tenant: Tenant): string => {
    const duration = tenant.rent_duration || 0
    const unit = tenant.rent_duration_unit
    
    if (typeof unit === 'number') {
      const unitLabel = unit === 0 ? 'Tahun' : 'Bulan'
      return `${duration} ${unitLabel}`
    } else if (typeof unit === 'string') {
      const unitLabel = DURATION_UNIT_LABELS[unit] || unit
      return `${duration} ${unitLabel}`
    }
    
    return `${duration} Bulan`
  }

  const loadData = async () => {
    try {
      setRefreshing(true)
      
      // Get current user
      const user = await authApi.getCurrentUser()
      if (!user || !user.id) {
        toast.error('User tidak ditemukan. Silakan login kembali.')
        return
      }
      setCurrentUser(user)

      // Load tenants, units, and assets in parallel
      const [tenantsResponse, unitsResponse, assetsResponse] = await Promise.all([
        tenantsApi.getTenants({ user_id: user.id }),
        unitsApi.getUnits(),
        assetsApi.getAssets()
      ])

      let tenantsData: TenantWithPayment[] = []
      if (tenantsResponse.success && tenantsResponse.data) {
        const tenantsDataResponse = tenantsResponse.data as any;
        tenantsData = Array.isArray(tenantsDataResponse.data) 
          ? tenantsDataResponse.data 
          : []
      }

      let unitsData: Unit[] = []
      if (unitsResponse.success && unitsResponse.data) {
        unitsData = Array.isArray(unitsResponse.data) 
          ? unitsResponse.data 
          : []
        setUnits(unitsData)
      }

      if (assetsResponse.success && assetsResponse.data) {
        const assetsData = Array.isArray(assetsResponse.data) 
          ? assetsResponse.data 
          : []
        setAssets(assetsData)
      }

      // Load all payments for each tenant (not just unpaid)
      const tenantsWithPayments = await Promise.all(
        tenantsData.map(async (tenant) => {
          try {
            // Get all payments (not just unpaid)
            const paymentResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, {
              limit: 100
            })

            let allPayments: TenantPaymentLog[] = []
            
            if (paymentResponse.success && paymentResponse.data) {
              const paymentData = paymentResponse.data as any;
              allPayments = Array.isArray(paymentData.data) 
                ? paymentData.data 
                : []
            }

            // Get units for this tenant
            let tenantUnits: Unit[] = []
            if (tenant.units && tenant.units.length > 0) {
              tenantUnits = tenant.units
            } else if (tenant.unit_ids && tenant.unit_ids.length > 0) {
              tenantUnits = unitsData.filter(u => tenant.unit_ids?.includes(u.id))
            }

            const currentPayment = getCurrentPayment(allPayments)

            return {
              ...tenant,
              units: tenantUnits,
              allPayments,
              currentPayment
            }
          } catch (error) {
            console.error(`Error loading data for tenant ${tenant.id}:`, error)
            return {
              ...tenant,
              units: tenant.units || (tenant.unit_ids ? unitsData.filter(u => tenant.unit_ids?.includes(u.id)) : []),
              allPayments: [],
              currentPayment: null
            }
          }
        })
      )

      setTenants(tenantsWithPayments)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Memuat data dashboard tenant...</span>
        </div>
      </div>
    )
  }

  // Calculate statistics
  const totalProperties = tenants.reduce((sum, tenant) => sum + (tenant.units?.length || 0), 0)
  
  const allPayments = tenants.flatMap(tenant => 
    (tenant.allPayments || []).map(payment => ({
      ...payment,
      tenant,
      status: getPaymentStatus(tenant) // Menggunakan status dari tenant, bukan dari payment
    }))
  )

  const upcomingBills = allPayments.filter(p => {
    if (p.status === 'lunas') return false
    const deadline = p.payment_deadline ? new Date(p.payment_deadline) : null
    if (!deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 3 // Within 3 days (including today)
  })

  const totalBills = allPayments
    .filter(p => p.status !== 'lunas')
    .reduce(
      (sum, p) => sum + (p.billing_amount ?? p.paid_amount ?? p.amount ?? 0),
      0
    )

  // Create property cards
  const propertyCards: PropertyCard[] = tenants.flatMap(tenant => {
    const tenantUnits = tenant.units || []
    return tenantUnits.map(unit => {
      const asset = assets.find(a => a.id === unit.asset_id)
      const payment = tenant.currentPayment || null
      const status = getPaymentStatus(tenant) // Menggunakan status dari tenant table, bukan dari payment
      
      return {
        tenant,
        unit,
        asset: asset || {} as Asset,
        payment,
        status
      }
    })
  })

  return (
    <div className="space-y-6">
      {/* Header dengan Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Halo, {currentUser?.name || 'User'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Berikut adalah ringkasan properti dan tagihan Anda
          </p>
        </div>
        <Button onClick={loadData} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Properti</p>
                <p className="text-2xl font-bold mt-1">{totalProperties}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Home className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tagihan Terdekat</p>
                <p className="text-2xl font-bold mt-1">{upcomingBills.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tagihan</p>
                <p className="text-2xl font-bold mt-1">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(totalBills)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daftar Properti Sewaan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Daftar Properti Sewaan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {propertyCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada properti yang disewa</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {propertyCards.map((property, index) => {
                const { tenant, unit, asset, payment, status } = property
                const totalContract = tenant.rent_price || 0
                const contractDuration = calculateContractDuration(tenant)
                const monthlyBill =
                  payment?.billing_amount ??
                  payment?.paid_amount ??
                  unit.rent_price ??
                  0

                return (
                  <Card key={`${tenant.id}-${unit.id}-${index}`} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <CardTitle className="text-lg mb-1">{unit.name}</CardTitle>
                          {asset?.address && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {asset.address}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Kontrak</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(totalContract)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Durasi Kontrak</p>
                          <p className="font-semibold">{contractDuration}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">Tagihan Bulan Ini</p>
                          <p className="text-sm font-semibold">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(monthlyBill)}
                          </p>
                        </div>
                        {payment?.payment_deadline && status !== 'lunas' && (
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <Calendar className="h-4 w-4 text-red-500" />
                            <span className="text-muted-foreground">
                              Jatuh tempo: {formatDateShort(payment.payment_deadline)}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
