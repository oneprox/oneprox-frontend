'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { dashboardApi } from '@/lib/api'
import type { FinancialTableData } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

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
      
      // Call backend API untuk mendapatkan semua data yang sudah dikalkulasi
      const response = await dashboardApi.getFinancialTable(selectedAssetId !== 'all' ? selectedAssetId : undefined)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const data = responseData.data || responseData
        setFinancialData(Array.isArray(data) ? data : [])
      }
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
