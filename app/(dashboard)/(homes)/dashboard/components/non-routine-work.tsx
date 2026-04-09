'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { dashboardApi, DashboardNonRoutineWorkItem, DashboardNonRoutineWorkResponse } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

interface NonRoutineWorkProps {
  selectedAssetId?: string
}

export default function NonRoutineWork({ selectedAssetId = 'all' }: NonRoutineWorkProps) {
  const [workData, setWorkData] = useState<DashboardNonRoutineWorkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNonRoutineWork()
  }, [selectedAssetId])

  const loadNonRoutineWork = async () => {
    try {
      setLoading(true)
      const res = await dashboardApi.getNonRoutineWork(
        selectedAssetId !== 'all' ? { asset_id: selectedAssetId } : {}
      )
      if (!res.success || !res.data) {
        setWorkData([])
        return
      }
      let payload = res.data as DashboardNonRoutineWorkResponse & {
        data?: DashboardNonRoutineWorkResponse
      }
      if (payload.data != null && Array.isArray(payload.data.items)) {
        payload = payload.data
      }
      if (!Array.isArray(payload.items)) {
        setWorkData([])
        return
      }
      setWorkData(payload.items)
    } catch (err) {
      console.error('Error loading non-routine work:', err)
      setWorkData([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (item: DashboardNonRoutineWorkItem) => {
    const tone = item.status_tone
    const label = item.status
    if (tone === 'success') {
      return <Badge className="bg-green-600 hover:bg-green-600 text-white">{label}</Badge>
    }
    if (tone === 'destructive') {
      return <Badge variant="destructive">{label}</Badge>
    }
    if (tone === 'warning') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">{label}</Badge>
    }
    if (tone === 'info') {
      return <Badge className="bg-blue-500 hover:bg-blue-500 text-white">{label}</Badge>
    }
    if (tone === 'secondary') {
      return <Badge variant="secondary">{label}</Badge>
    }
    return <Badge variant="default">{label}</Badge>
  }

  const rowAccentClass = (item: DashboardNonRoutineWorkItem) => {
    const tone = item.status_tone
    if (tone === 'destructive') return 'border-l-4 border-red-500'
    if (tone === 'warning') return 'border-l-4 border-yellow-500'
    if (tone === 'info') return 'border-l-4 border-blue-500'
    if (tone === 'success') return 'border-l-4 border-green-600'
    return ''
  }

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat data pekerjaan non rutin..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PEKERJAAN NON RUTIN</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">NO</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>ASET</TableHead>
                <TableHead>AREA</TableHead>
                <TableHead>JATUH TEMPO</TableHead>
                <TableHead>JENIS PEKERJAAN</TableHead>
                <TableHead>DESKRIPSI PEKERJAAN</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Tidak ada data pekerjaan non rutin
                  </TableCell>
                </TableRow>
              ) : (
                workData.map((item, index) => (
                  <TableRow key={item.id} className={rowAccentClass(item)}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.aset}</TableCell>
                    <TableCell>{item.area}</TableCell>
                    <TableCell>{item.jatuhTempo}</TableCell>
                    <TableCell>{item.jenisPekerjaan}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsiPekerjaan}</TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Legend — teks & urutan sesuai permintaan client (desain awal) */}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>2 Minggu Sebelum Jatuh Tempo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>1 Minggu Sebelum Jatuh Tempo</span>
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
