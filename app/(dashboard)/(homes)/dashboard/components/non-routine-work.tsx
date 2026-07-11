'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { dashboardApi, DashboardNonRoutineWorkItem, DashboardNonRoutineWorkResponse, userTasksApi, UserTask } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface NonRoutineWorkProps {
  selectedAssetId?: string
}

const PAGE_SIZE = 15

export default function NonRoutineWork({ selectedAssetId = 'all' }: NonRoutineWorkProps) {
  const [workData, setWorkData] = useState<DashboardNonRoutineWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<DashboardNonRoutineWorkItem | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<UserTask | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadNonRoutineWork()
  }, [selectedAssetId])

  useEffect(() => {
    setCurrentPage(1)
  }, [workData.length])

  const totalPages = Math.max(1, Math.ceil(workData.length / PAGE_SIZE))
  const paginatedWorkData = workData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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

  const parseDetailPayload = (payload: unknown): UserTask | null => {
    if (!payload || typeof payload !== 'object') return null
    const p = payload as Record<string, unknown>
    if (p.data && typeof p.data === 'object') return p.data as UserTask
    return payload as UserTask
  }

  const openDetail = async (item: DashboardNonRoutineWorkItem) => {
    setSelectedItem(item)
    setSelectedDetail(null)
    setDetailLoading(true)
    try {
      const res = await userTasksApi.getUserTaskById(item.id)
      if (!res.success || !res.data) return
      const detail = parseDetailPayload(res.data)
      setSelectedDetail(detail)
    } catch (error) {
      console.error('Error loading user task detail:', error)
      setSelectedDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedItem(null)
    setSelectedDetail(null)
    setDetailLoading(false)
  }

  const extractEvidenceUrls = (detail: UserTask | null): string[] => {
    if (!detail?.evidences || !Array.isArray(detail.evidences)) return []
    return detail.evidences
      .map((e: any) => (typeof e === 'string' ? e : e?.url))
      .filter((u: string | undefined) => typeof u === 'string' && u.trim() !== '')
  }

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat data pekerjaan non rutin..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight text-slate-900">PEKERJAAN NON RUTIN</CardTitle>
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
                <TableHead className="text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Tidak ada data pekerjaan non rutin
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWorkData.map((item, index) => (
                  <TableRow key={item.id} className={rowAccentClass(item)}>
                    <TableCell className="text-center">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.aset}</TableCell>
                    <TableCell>{item.area}</TableCell>
                    <TableCell>{item.jatuhTempo}</TableCell>
                    <TableCell>{item.jenisPekerjaan}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsiPekerjaan}</TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(item)}
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

        {workData.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-muted-foreground">
              Menampilkan {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, workData.length)} dari {workData.length} data
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-9 w-9 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                Halaman {currentPage} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-9 w-9 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

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

      <Dialog open={selectedItem !== null} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail User Task Non Rutin</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div><span className="font-medium">ID User Task:</span> {selectedItem.id}</div>
              <div><span className="font-medium">Nama:</span> {selectedDetail?.user?.name || selectedItem.nama}</div>
              <div><span className="font-medium">Aset:</span> {selectedDetail?.task?.asset?.name || selectedItem.aset}</div>
              <div><span className="font-medium">Area:</span> {selectedItem.area}</div>
              <div><span className="font-medium">Jatuh Tempo:</span> {selectedItem.jatuhTempo}</div>
              <div><span className="font-medium">Jenis Pekerjaan:</span> {selectedItem.jenisPekerjaan}</div>
              <div><span className="font-medium">Deskripsi Pekerjaan:</span> {selectedDetail?.task?.name || selectedItem.deskripsiPekerjaan}</div>
              <div className="flex items-center gap-2"><span className="font-medium">Status:</span>{getStatusBadge(selectedItem)}</div>
              <div>
                <span className="font-medium">Waktu Dimulai:</span>{' '}
                {formatDateTime(selectedDetail?.started_at || selectedDetail?.start_at || null)}
              </div>
              <div>
                <span className="font-medium">Waktu Selesai:</span>{' '}
                {formatDateTime(selectedDetail?.completed_at || null)}
              </div>

              {detailLoading ? (
                <div className="text-muted-foreground">Memuat detail...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <span className="font-medium">Attachment:</span>
                    {extractEvidenceUrls(selectedDetail).length === 0 ? (
                      <div className="text-muted-foreground">Tidak ada attachment</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {extractEvidenceUrls(selectedDetail).map((url, idx) => (
                          <a
                            key={`${url}-${idx}`}
                            href={url.startsWith('text:') ? undefined : url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {url.startsWith('text:') ? url.replace(/^text:/, '') : `Attachment ${idx + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
