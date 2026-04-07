'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { complaintReportsApi, ComplaintReport, User, assetsApi, Asset } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

interface ReportData {
  id: number
  tanggal: string
  nama: string
  role: string
  lokasi: string
  deskripsi: string
  evidence: string
  tindakLanjut: string
}

interface ReportsObstaclesNotesProps {
  selectedAssetId?: string
}

export default function ReportsObstaclesNotes({ selectedAssetId = 'all' }: ReportsObstaclesNotesProps) {
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportsData()
  }, [selectedAssetId])

  const loadReportsData = async () => {
    try {
      setLoading(true)
      
      // Load complaint reports
      const reportsResponse = await complaintReportsApi.getComplaintReports({ 
        limit: 100,
        order: 'created_at DESC'
      })
      
      if (!reportsResponse.success || !reportsResponse.data) {
        return
      }

      const reportsList: ComplaintReport[] = Array.isArray(reportsResponse.data) 
        ? reportsResponse.data 
        : []

      // Load assets to match with selected asset
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      const assetsList: Asset[] = Array.isArray(assetsResponse.data) ? assetsResponse.data : []

      const reportTableData: ReportData[] = []

      reportsList.forEach((report: ComplaintReport) => {
        // Get reporter info
        const reporter = report.reporter || report.createdBy
        const reporterName = reporter?.name || '-'
        
        // Get role from reporter
        let role = '-'
        if (reporter && (reporter as any).role) {
          role = (reporter as any).role.name || '-'
        } else if ((reporter as any)?.roleName) {
          role = (reporter as any).roleName
        }

        // Get location - try from tenant first, then from description
        let lokasi = 'All Area'
        let reportAsset: Asset | null = null
        if (report.tenant) {
          // Try to get asset from tenant units
          if (report.tenant.units && Array.isArray(report.tenant.units) && report.tenant.units.length > 0) {
            const unit = report.tenant.units[0]
            if (unit.asset) {
              lokasi = unit.asset?.name || lokasi
              const unitAssetId = unit.asset?.id
              reportAsset = unitAssetId ? (assetsList.find(a => a.id === unitAssetId) || null) : null
            } else if (unit.name) {
              lokasi = unit.name
            }
          }
        }
        
        // Extract location from description if it contains location keywords
        const locationKeywords = ['Gudang', 'gudang', 'The Kalijaga', 'Padel at Alley', 'Lebak Bulus']
        for (const keyword of locationKeywords) {
          if (report.description?.includes(keyword)) {
            lokasi = keyword
            // Try to find asset by name
            reportAsset = assetsList.find(a => a.name?.includes(keyword)) || null
            break
          }
        }

        // Filter by selected asset
        if (selectedAssetId !== 'all' && (!reportAsset || reportAsset.id !== selectedAssetId)) {
          return
        }

        // Check if has evidence
        const hasEvidence = report.evidences && Array.isArray(report.evidences) && report.evidences.length > 0
        const evidence = hasEvidence ? 'Foto' : '-'

        // Determine follow-up status
        let tindakLanjut = 'On Process'
        let statusColor = 'default'
        
        const status = typeof report.status === 'number' 
          ? report.status 
          : (report.status === 'resolved' || report.status === 'closed' ? 2 : 0)
        
        if (status === 2 || status === 3) {
          tindakLanjut = 'Done'
          statusColor = 'default'
        } else {
          tindakLanjut = 'On Process'
          statusColor = 'secondary'
        }

        reportTableData.push({
          id: report.id,
          tanggal: report.created_at 
            ? new Date(report.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })
            : '-',
          nama: reporterName,
          role: role,
          lokasi: lokasi,
          deskripsi: report.description || report.title || '-',
          evidence: evidence,
          tindakLanjut: tindakLanjut
        })
      })

      // Sort by date (newest first)
      reportTableData.sort((a, b) => {
        return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
      })

      setReportData(reportTableData)
    } catch (err) {
      console.error('Error loading reports data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'Done') {
      return <Badge variant="default" className="bg-green-500">{status}</Badge>
    }
    return <Badge variant="secondary" className="bg-yellow-500">{status}</Badge>
  }

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat data laporan, kendala, dan catatan..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LAPORAN, KENDALA, DAN CATATAN</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">NO</TableHead>
                <TableHead>TANGGAL</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>ROLE</TableHead>
                <TableHead>LOKASI</TableHead>
                <TableHead>DESKRIPSI</TableHead>
                <TableHead>EVIDENCE</TableHead>
                <TableHead>TINDAK LANJUT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Tidak ada data laporan, kendala, dan catatan
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{item.tanggal}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell>{item.lokasi}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsi}</TableCell>
                    <TableCell>{item.evidence}</TableCell>
                    <TableCell>{getStatusBadge(item.tindakLanjut)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
