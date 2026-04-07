'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { dashboardApi, type FinancialTableData } from '@/lib/api'
import LoadingSkeleton from '@/components/loading-skeleton'

interface FinancialTableProps {
  selectedAssetId?: string
}

/** Backend createResponse: { data, message, status }; ApiClient sering mengembalikan objek ini sebagai response.data */
function normalizeDashboardList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const inner = (payload as { data: unknown }).data
    if (Array.isArray(inner)) return inner as T[]
  }
  return []
}

function isOpenObligationStatus(status: string): boolean {
  const s = (status || '').trim().toLowerCase()
  if (!s) return false
  return /^(selesai|done|lunas|completed)$/.test(s) || s.includes('sudah dibayar')
}

function dueDateDotClass(dueDateIso: string | undefined): string {
  if (!dueDateIso) return 'bg-slate-300'
  const due = new Date(dueDateIso)
  if (Number.isNaN(due.getTime())) return 'bg-slate-300'
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const daysUntil = Math.round((dueDay.getTime() - startToday.getTime()) / 86_400_000)
  if (daysUntil < 0) return 'bg-red-500'
  if (daysUntil <= 30) return 'bg-amber-400'
  return 'bg-blue-500'
}

function formatInvoiceRupiah(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0
  return `Rp ${n.toLocaleString('id-ID')}`
}

function financialInvoiceDisplayStatus(row: FinancialTableData): 'Overdue' | 'On Process' {
  if (row.status === 'Overdue') return 'Overdue'
  if (row.dueDateIso) {
    const due = new Date(row.dueDateIso)
    if (!Number.isNaN(due.getTime())) {
      const startToday = new Date()
      startToday.setHours(0, 0, 0, 0)
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      if (dueDay < startToday) return 'Overdue'
    }
  }
  return 'On Process'
}

export default function FinancialTable({ selectedAssetId = 'all' }: FinancialTableProps) {
  const [rows, setRows] = useState<FinancialTableData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const response = await dashboardApi.getFinancialTable(
          selectedAssetId !== 'all' ? selectedAssetId : undefined
        )
        if (cancelled) return
        if (response.success && response.data != null) {
          setRows(normalizeDashboardList<FinancialTableData>(response.data))
        } else {
          setRows([])
        }
      } catch (err) {
        console.error('Error loading financial table:', err)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedAssetId])

  /** API: belum bayar + deadline; filter cadangan di UI */
  const displayRows = useMemo(() => {
    return rows.filter((row) => {
      if (isOpenObligationStatus(row.status)) return false
      const hasDue =
        !!(row.dueDateIso && String(row.dueDateIso).trim()) ||
        !!(row.jatuhTempo && row.jatuhTempo !== '-')
      return hasDue
    })
  }, [rows])

  if (loading) {
    return <LoadingSkeleton height="h-64" text="Memuat data financial..." />
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight text-slate-900">Financial</CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Invoice dengan jatuh tempo yang sudah diisi dan status pembayaran belum dibayar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                <TableHead className="w-10 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  No
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Nama
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Aset
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Unit
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Jatuh tempo
                </TableHead>
                <TableHead className="min-w-[120px] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Deskripsi
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Nomor invoice
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Nilai invoice
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Tanggal invoice
                </TableHead>
                <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Aging
                </TableHead>
                <TableHead className="w-[130px] whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada tagihan belum dibayar dengan jatuh tempo yang sudah diisi.
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((row, index) => {
                  const displayStatus = financialInvoiceDisplayStatus(row)
                  const dotClass = dueDateDotClass(row.dueDateIso ?? undefined)
                  const deskripsiTampil =
                    row.deskripsi && row.deskripsi.trim() !== '' ? row.deskripsi : '—'
                  return (
                    <TableRow key={`fin-${row.id}`} className="border-b border-slate-100 last:border-0">
                      <TableCell className="text-center text-sm text-slate-600">{index + 1}</TableCell>
                      <TableCell>
                        {displayStatus === 'Overdue' ? (
                          <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            On Process
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] font-bold text-slate-900">{row.nama}</TableCell>
                      <TableCell className="text-sm text-slate-700">{row.aset}</TableCell>
                      <TableCell className="text-sm text-slate-700">{row.unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-900">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                          {row.jatuhTempo}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-sm text-slate-600">{deskripsiTampil}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-800">{row.nomorInvoice}</TableCell>
                      <TableCell className="whitespace-nowrap font-bold tabular-nums text-slate-900">
                        {formatInvoiceRupiah(row.nilaiInvoice)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-700">{row.tanggalInvoice}</TableCell>
                      <TableCell className="font-bold tabular-nums">
                        {row.aging > 0 ? (
                          <span className="text-red-600">{row.aging} Hari</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tenantId ? (
                          <Button
                            asChild
                            size="sm"
                            className="h-8 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Link href={`/tenants/payment/${row.tenantId}`}>Update Data</Link>
                          </Button>
                        ) : (
                          <Button size="sm" disabled className="h-8 rounded-md px-3 text-xs font-semibold">
                            Update Data
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
            <span className="font-medium uppercase tracking-wide text-slate-500">3 bulan sebelum jatuh tempo</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
            <span className="font-medium uppercase tracking-wide text-slate-500">1 bulan sebelum jatuh tempo</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span className="font-medium uppercase tracking-wide text-slate-500">Telah jatuh tempo</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
