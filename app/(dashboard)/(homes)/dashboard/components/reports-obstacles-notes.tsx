'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { complaintReportsApi, ComplaintReport, assetsApi, Asset } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"
import ComplaintReportDetailDialog from '@/components/dialogs/complaint-report-detail-dialog'

interface ReportData {
  id: number
  createdAtRaw?: string
  tanggal: string
  nama: string
  role: string
  lokasi: string
  asset: string
  status: string
  deskripsi: string
  evidenceUrl?: string
  tindakLanjut: string
  rawReport: ComplaintReport
}

interface ReportsObstaclesNotesProps {
  selectedAssetId?: string
}

export default function ReportsObstaclesNotes({ selectedAssetId = 'all' }: ReportsObstaclesNotesProps) {
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ComplaintReport | null>(null)

  useEffect(() => {
    loadReportsData()
  }, [selectedAssetId])

  const loadReportsData = async () => {
    try {
      setLoading(true)
      
      // Load complaint reports
      const reportsResponse = await complaintReportsApi.getComplaintReports({ 
        limit: 100,
        order: 'created_at_desc'
      })
      
      if (!reportsResponse.success || !reportsResponse.data) {
        setReportData([])
        return
      }

      const reportsResponseData = reportsResponse.data as any
      const reportsList: ComplaintReport[] = Array.isArray(reportsResponseData)
        ? reportsResponseData
        : Array.isArray(reportsResponseData?.data)
          ? reportsResponseData.data
          : Array.isArray(reportsResponseData?.complaintReports)
            ? reportsResponseData.complaintReports
            : []

      // Load assets to match with selected asset
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      const assetsResponseData = assetsResponse.data as any
      const assetsList: Asset[] = Array.isArray(assetsResponseData)
        ? assetsResponseData
        : Array.isArray(assetsResponseData?.data)
          ? assetsResponseData.data
          : []

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
        let lokasi = report.asset?.name || '-'
        let reportAsset: Asset | null = null
        if (report.asset?.id) {
          reportAsset = assetsList.find((a) => a.id === report.asset?.id) || (report.asset as Asset)
        } else if (report.asset_id) {
          reportAsset = assetsList.find((a) => a.id === report.asset_id) || null
        }
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
        
        // Extract location from description only when location is still unavailable
        const locationKeywords = ['Gudang', 'gudang', 'The Kalijaga', 'Padel at Alley', 'Lebak Bulus']
        if (lokasi === '-' || lokasi === 'All Area') {
          for (const keyword of locationKeywords) {
            if (report.description?.includes(keyword)) {
              lokasi = keyword
              // Try to find asset by name
              reportAsset = assetsList.find(a => a.name?.includes(keyword)) || null
              break
            }
          }
        }

        // Filter by selected asset
        if (selectedAssetId !== 'all' && (!reportAsset || reportAsset.id !== selectedAssetId)) {
          return
        }

        // Check if has evidence
        const evidenceArray = Array.isArray(report.evidences) ? report.evidences : []
        const firstEvidence = evidenceArray.length > 0 ? evidenceArray[0] : null
        const evidenceUrl =
          typeof firstEvidence === 'string'
            ? firstEvidence
            : firstEvidence && typeof firstEvidence === 'object' && 'url' in firstEvidence
              ? String((firstEvidence as any).url || '')
              : ''

        const status =
          typeof report.status === 'string'
            ? report.status
            : report.status === 0
              ? 'pending'
              : report.status === 1
                ? 'in_progress'
                : report.status === 2
                  ? 'resolved'
                  : report.status === 3
                    ? 'closed'
                    : 'pending'

        reportTableData.push({
          id: report.id,
          createdAtRaw: report.created_at || '',
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
          asset: reportAsset?.name || report.asset?.name || '-',
          status,
          deskripsi: report.description || report.title || '-',
          evidenceUrl: evidenceUrl || undefined,
          tindakLanjut: '-',
          rawReport: report,
        })
      })

      // Sort by date (newest first)
      reportTableData.sort((a, b) => {
        return new Date(b.createdAtRaw || 0).getTime() - new Date(a.createdAtRaw || 0).getTime()
      })

      setReportData(reportTableData)
    } catch (err) {
      console.error('Error loading reports data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = (status || '').toLowerCase()
    if (statusLower === 'resolved') {
      return <Badge variant="default" className="bg-green-500">Resolved</Badge>
    }
    if (statusLower === 'closed') {
      return <Badge variant="secondary" className="bg-gray-500 text-white">Closed</Badge>
    }
    if (statusLower === 'in_progress' || statusLower === 'inprogress') {
      return <Badge variant="secondary" className="bg-blue-500 text-white">In Progress</Badge>
    }
    return <Badge variant="secondary" className="bg-yellow-500 text-black">Pending</Badge>
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
                <TableHead>STATUS</TableHead>
                <TableHead>TANGGAL</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>ROLE</TableHead>
                <TableHead>LOKASI</TableHead>
                <TableHead>ASSET</TableHead>
                <TableHead>DESKRIPSI</TableHead>
                <TableHead>EVIDENCE</TableHead>
                <TableHead>TINDAK LANJUT</TableHead>
                <TableHead className="text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Tidak ada data laporan, kendala, dan catatan
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{item.tanggal}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell>{item.lokasi}</TableCell>
                    <TableCell>{item.asset}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsi}</TableCell>
                    <TableCell>
                      {item.evidenceUrl ? (
                        <img
                          src={item.evidenceUrl}
                          alt={`Evidence ${item.id}`}
                          className="h-8 w-8 rounded object-cover border"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReport(item.rawReport)
                          setDetailDialogOpen(true)
                        }}
                      >
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <ComplaintReportDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open)
          if (!open) {
            setSelectedReport(null)
          }
        }}
        complaintReport={selectedReport}
      />
    </Card>
  )
}
