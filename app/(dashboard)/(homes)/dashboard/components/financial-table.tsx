'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { tenantsApi, Tenant, TenantPaymentLog, assetsApi, unitsApi, Asset, Unit } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

interface FinancialTableData {
  id: number
  nama: string
  aset: string
  unit: string
  jatuhTempo: string
  deskripsi: string
  nomorInvoice: string
  nilaiInvoice: number
  tanggalInvoice: string
  status: string
  aging: number
}

interface FinancialTableProps {
  selectedAssetId?: string
}

export default function FinancialTable({ selectedAssetId = 'all' }: FinancialTableProps) {
  const [financialData, setFinancialData] = useState<FinancialTableData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFinancialData()
  }, [selectedAssetId])

  const loadFinancialData = async () => {
    try {
      setLoading(true)
      
      // Load all tenants
      const tenantsResponse = await tenantsApi.getTenants({ limit: 10000 })
      if (!tenantsResponse.success || !tenantsResponse.data) {
        return
      }

      const tenantsList: Tenant[] = Array.isArray(tenantsResponse.data) 
        ? tenantsResponse.data 
        : []

      // Load assets for fallback (units already have asset from backend)
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      const assetsList: Asset[] = Array.isArray(assetsResponse.data) ? assetsResponse.data : []

      const financialTableData: FinancialTableData[] = []
      const now = new Date()

      // Get payment logs for each tenant
      for (const tenant of tenantsList) {
        try {
          const paymentResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, { limit: 100 })
          if (paymentResponse.success && paymentResponse.data) {
            const payments = Array.isArray(paymentResponse.data) ? paymentResponse.data : []

            // Get tenant units - units are already included in tenant response from backend
            const tenantUnits = tenant.units && Array.isArray(tenant.units) ? tenant.units : []

            payments.forEach((payment: TenantPaymentLog) => {
              // Get asset from unit (unit already has asset from backend, or use asset_id as fallback)
              const tenantUnit = tenantUnits[0]
              const asset = tenantUnit?.asset || (tenantUnit?.asset_id ? assetsList.find(a => a.id === tenantUnit.asset_id) : null)
              
              // Skip if no asset found
              if (!asset) return

              // Filter by selected asset
              if (selectedAssetId !== 'all' && (!asset || asset.id !== selectedAssetId)) {
                return
              }

              // Only show unpaid or overdue payments
              if (payment.status === 0 || payment.status === 2) {
                const deadline = payment.payment_deadline ? new Date(payment.payment_deadline) : null
                const aging = deadline ? Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)) : 0
                
                // Determine status based on deadline
                let status = 'On Process'
                let statusColor = 'default'
                
                if (deadline) {
                  const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  
                  if (daysUntilDeadline < 0) {
                    status = 'Overdue'
                    statusColor = 'destructive'
                  } else if (daysUntilDeadline <= 30) {
                    status = 'On Process'
                    statusColor = 'default'
                  }
                }

                financialTableData.push({
                  id: payment.id,
                  nama: tenant.name || '-',
                  aset: asset?.name || '-',
                  unit: tenantUnit?.name || '-',
                  jatuhTempo: deadline ? deadline.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : '-',
                  deskripsi: payment.billing_type || payment.billing_period || 'Tagihan Sewa',
                  nomorInvoice: `INV-${payment.id}`,
                  nilaiInvoice: payment.amount || 0,
                  tanggalInvoice: payment.created_at ? new Date(payment.created_at).toLocaleDateString('id-ID') : '-',
                  status,
                  aging: aging > 0 ? aging : 0
                })
              }
            })
          }
        } catch (err) {
          console.error(`Error loading payments for tenant ${tenant.id}:`, err)
        }
      }

      // Sort by aging (overdue first)
      financialTableData.sort((a, b) => {
        if (a.status === 'Overdue' && b.status !== 'Overdue') return -1
        if (a.status !== 'Overdue' && b.status === 'Overdue') return 1
        return b.aging - a.aging
      })

      setFinancialData(financialTableData)
    } catch (err) {
      console.error('Error loading financial data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'Overdue') {
      return <Badge variant="destructive">{status}</Badge>
    }
    return <Badge variant="default">{status}</Badge>
  }

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat data financial..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>FINANCIAL</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">NO</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>ASET</TableHead>
                <TableHead>UNIT</TableHead>
                <TableHead>JATUH TEMPO</TableHead>
                <TableHead>DESKRIPSI</TableHead>
                <TableHead>NOMOR INVOICE</TableHead>
                <TableHead>NILAI INVOICE</TableHead>
                <TableHead>TANGGAL INVOICE</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>AGING</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Tidak ada data financial
                  </TableCell>
                </TableRow>
              ) : (
                financialData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.aset}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.jatuhTempo}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsi}</TableCell>
                    <TableCell>{item.nomorInvoice}</TableCell>
                    <TableCell>Rp {item.nilaiInvoice.toLocaleString('id-ID')}</TableCell>
                    <TableCell>{item.tanggalInvoice}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{item.aging > 0 ? item.aging : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>3 Bulan Sebelum Jatuh Tempo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>1 Bulan Sebelum Jatuh Tempo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Telah Jatuh Tempo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
