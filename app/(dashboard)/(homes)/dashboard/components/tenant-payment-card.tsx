'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Clock, Loader2 } from "lucide-react"
import { tenantsApi, Tenant, TenantPaymentLog } from "@/lib/api"
import LoadingSkeleton from "@/components/loading-skeleton"
import TenantDetailDialog from "@/components/dialogs/tenant-detail-dialog"

interface TenantWithPaymentStatus extends Tenant {
  paymentStatus?: 'overdue' | 'expiring'
  daysRemaining?: number
  daysOverdue?: number
  lastPayment?: TenantPaymentLog | null
}

export default function TenantPaymentCard() {
  const [overdueTenants, setOverdueTenants] = useState<TenantWithPaymentStatus[]>([])
  const [expiringTenants, setExpiringTenants] = useState<TenantWithPaymentStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      
      // Get all tenants
      const tenantsResponse = await tenantsApi.getTenants({ limit: 1000 })
      
      if (!tenantsResponse.success || !tenantsResponse.data) {
        setOverdueTenants([])
        setExpiringTenants([])
        return
      }

      const responseData = tenantsResponse.data as any
      const tenants = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])

      const now = new Date()
      
      // Fetch payment logs for tenants that need deadline info
      const paymentPromises = tenants.map((tenant: Tenant) => 
        tenantsApi.getTenantPaymentLogs(tenant.id, { limit: 10 })
          .then(response => ({ tenant, response }))
          .catch(error => {
            console.error(`Error loading payment for tenant ${tenant.id}:`, error)
            return { tenant, response: null }
          })
      )

      const allPaymentData = await Promise.all(paymentPromises)
      
      const overdueList: TenantWithPaymentStatus[] = []
      const expiringList: TenantWithPaymentStatus[] = []

      // Process each tenant - payment_status diambil langsung dari tabel tenant (tidak dihitung manual)
      for (const { tenant, response } of allPaymentData) {
        // Payment status diambil langsung dari kolom payment_status di tabel tenant
        // Status ini diupdate oleh backend melalui internal.js berdasarkan payment logs
        const paymentStatus = tenant.payment_status || 'scheduled'
        let lastPayment: TenantPaymentLog | null = null

        // Get last payment untuk menampilkan informasi deadline (hanya untuk display, bukan untuk menentukan status)
        if (response?.success && response.data) {
          const paymentsData = response.data as any
          const payments = Array.isArray(paymentsData.data) 
            ? paymentsData.data 
            : (Array.isArray(paymentsData) ? paymentsData : [])
          
          if (payments.length > 0) {
            // Sort by deadline descending to get most recent
            const sortedPayments = payments.sort((a: TenantPaymentLog, b: TenantPaymentLog) => {
              const dateA = a.payment_deadline ? new Date(a.payment_deadline).getTime() : 0
              const dateB = b.payment_deadline ? new Date(b.payment_deadline).getTime() : 0
              return dateB - dateA
            })
            lastPayment = sortedPayments[0]
          }
        }

        // Filter tenant berdasarkan payment_status dari database (bukan dihitung manual)
        // Perhitungan diffDays di bawah hanya untuk menampilkan informasi tambahan (daysOverdue/daysRemaining)
        if (paymentStatus === 'overdue') {
          const deadline = lastPayment?.payment_deadline || tenant.contract_end_at
          if (deadline) {
            const deadlineDate = new Date(deadline)
            deadlineDate.setHours(0, 0, 0, 0)
            const nowDateOnly = new Date(now)
            nowDateOnly.setHours(0, 0, 0, 0)
            // Perhitungan ini hanya untuk display (menampilkan berapa hari terlambat), bukan untuk menentukan status
            const diffDays = Math.ceil((deadlineDate.getTime() - nowDateOnly.getTime()) / (1000 * 60 * 60 * 24))
            
            overdueList.push({
              ...tenant,
              paymentStatus: 'overdue',
              daysOverdue: Math.abs(diffDays),
              lastPayment
            })
          }
        } else if (paymentStatus === 'reminder_needed') {
          const deadline = lastPayment?.payment_deadline || tenant.contract_end_at
          if (deadline) {
            const deadlineDate = new Date(deadline)
            deadlineDate.setHours(0, 0, 0, 0)
            const nowDateOnly = new Date(now)
            nowDateOnly.setHours(0, 0, 0, 0)
            // Perhitungan ini hanya untuk display (menampilkan berapa hari lagi), bukan untuk menentukan status
            const diffDays = Math.ceil((deadlineDate.getTime() - nowDateOnly.getTime()) / (1000 * 60 * 60 * 24))
            
            expiringList.push({
              ...tenant,
              paymentStatus: 'expiring',
              daysRemaining: diffDays,
              lastPayment
            })
          }
        }
      }

      // Sort overdue by days overdue (most overdue first)
      overdueList.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))
      
      // Sort expiring by days remaining (soonest first)
      expiringList.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))

      setOverdueTenants(overdueList.slice(0, 5)) // Limit to 5
      setExpiringTenants(expiringList.slice(0, 5)) // Limit to 5
    } catch (err) {
      console.error('Error loading tenant payment data:', err)
      setOverdueTenants([])
      setExpiringTenants([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-700">
            Tenant Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <LoadingSkeleton height="h-64" text="Memuat data..." />
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Card className="p-6 h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-700">
          Tenant Payment Status
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-y-auto">
        {/* Overdue Tenants Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Jatuh Tempo (Belum Bayar)
            </h3>
          </div>
          {overdueTenants.length > 0 ? (
            <div className="space-y-3">
              {overdueTenants.map((tenant) => (
                <div 
                  key={tenant.id} 
                  className="p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => {
                    setSelectedTenant(tenant)
                    setDialogOpen(true)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Jatuh tempo: {tenant.lastPayment?.payment_deadline ? formatDate(tenant.lastPayment.payment_deadline) : (tenant.contract_end_at ? formatDate(tenant.contract_end_at) : '-')}
                      </p>
                      {tenant.daysOverdue !== undefined && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          Terlambat {tenant.daysOverdue} hari
                        </p>
                      )}
                      {tenant.lastPayment && tenant.lastPayment.amount && (
                        <p className="text-xs text-gray-600 mt-1">
                          Tagihan: {formatCurrency(tenant.lastPayment.amount)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Tidak ada tenant yang jatuh tempo
            </p>
          )}
        </div>

        {/* Expiring Tenants Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Akan Jatuh Tempo
            </h3>
          </div>
          {expiringTenants.length > 0 ? (
            <div className="space-y-3">
              {expiringTenants.map((tenant) => (
                <div 
                  key={tenant.id} 
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => {
                    setSelectedTenant(tenant)
                    setDialogOpen(true)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Jatuh tempo: {tenant.lastPayment?.payment_deadline ? formatDate(tenant.lastPayment.payment_deadline) : (tenant.contract_end_at ? formatDate(tenant.contract_end_at) : '-')}
                      </p>
                      {tenant.daysRemaining !== undefined && (
                        <p className="text-xs text-yellow-600 mt-1 font-medium">
                          {tenant.daysRemaining === 0 ? 'Hari ini' : `${tenant.daysRemaining} hari lagi`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Tidak ada tenant yang akan jatuh tempo
            </p>
          )}
        </div>
      </CardContent>

      {/* Tenant Detail Dialog */}
      <TenantDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={selectedTenant}
      />
    </Card>
  )
}

