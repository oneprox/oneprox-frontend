'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { dashboardApi, type FinancialTableData } from '@/lib/api'
import LoadingSkeleton from '@/components/loading-skeleton'

const TABLE_PAGE_SIZE = 10

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

function tenantGroupKey(row: FinancialTableData): string {
  return row.tenantId || `${row.nama}::${row.aset}::${row.unit}`
}

function earliestDueMs(logs: FinancialTableData[]): number {
  let min = Infinity
  for (const r of logs) {
    if (!r.dueDateIso) continue
    const t = new Date(r.dueDateIso).getTime()
    if (!Number.isNaN(t)) min = Math.min(min, t)
  }
  return min === Infinity ? 0 : min
}

interface TenantFinancialGroup {
  key: string
  tenantId: string | undefined
  nama: string
  aset: string
  unit: string
  logs: FinancialTableData[]
}

export default function FinancialTable({ selectedAssetId = 'all' }: FinancialTableProps) {
  const [rows, setRows] = useState<FinancialTableData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTsRef = useRef(0)

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

  useEffect(() => {
    setVisibleCount(TABLE_PAGE_SIZE)
  }, [selectedAssetId, rows])

  /** Tampilkan semua baris dari API (termasuk sudah dibayar / selesai). */
  const displayRows = useMemo(() => rows, [rows])

  const tenantGroups = useMemo((): TenantFinancialGroup[] => {
    const map = new Map<string, FinancialTableData[]>()
    for (const row of displayRows) {
      const key = tenantGroupKey(row)
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    const groups: TenantFinancialGroup[] = []
    for (const [key, logs] of map) {
      const first = logs[0]
      groups.push({
        key,
        tenantId: first.tenantId,
        nama: first.nama,
        aset: first.aset,
        unit: first.unit,
        logs,
      })
    }
    groups.sort((a, b) => {
      const da = earliestDueMs(a.logs)
      const db = earliestDueMs(b.logs)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da - db
    })
    return groups
  }, [displayRows])

  const visibleTenantGroups = useMemo(
    () => tenantGroups.slice(0, visibleCount),
    [tenantGroups, visibleCount]
  )

  const handleScroll = useCallback(() => {
    const now = Date.now()
    if (now - scrollTsRef.current < 200) return
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 80) return
    scrollTsRef.current = now
    setVisibleCount((c) =>
      c >= tenantGroups.length ? c : Math.min(c + TABLE_PAGE_SIZE, tenantGroups.length)
    )
  }, [tenantGroups.length])

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** Kolom tabel utama = ringkasan per tenant */
  const parentColCount = 10

  if (loading) {
    return <LoadingSkeleton height="h-64" text="Memuat data financial..." />
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold tracking-tight text-slate-900">Financial</CardTitle>
        <CardDescription className="text-base text-slate-500">
          Ringkasan invoice per tenant, termasuk yang sudah dibayar maupun belum dibayar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          ref={scrollRef}
          className="h-[380px] overflow-auto overscroll-contain rounded-lg border border-slate-100"
          onScroll={handleScroll}
        >
          <Table className="w-full min-w-[960px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                <TableHead className="w-10 px-2" />
                <TableHead className="w-11 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                  No
                </TableHead>
                <TableHead className="min-w-0 w-[22%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nama
                </TableHead>
                <TableHead className="w-24 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </TableHead>
                <TableHead className="min-w-0 w-[18%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Aset
                </TableHead>
                <TableHead className="min-w-0 w-[16%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Unit
                </TableHead>
                <TableHead className="w-24 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jumlah tagihan
                </TableHead>
                <TableHead className="w-44 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total nilai
                </TableHead>
                <TableHead className="w-28 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Aging (maks.)
                </TableHead>
                <TableHead className="w-[132px] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={parentColCount} className="py-10 text-center text-base text-muted-foreground">
                    Tidak ada data invoice untuk ditampilkan.
                  </TableCell>
                </TableRow>
              ) : (
                visibleTenantGroups.map((group, groupIndex) => {
                  const isOpen = expandedKeys.has(group.key)
                  const totalNilai = group.logs.reduce((s, r) => s + (Number(r.nilaiInvoice) || 0), 0)
                  const maxAging = Math.max(0, ...group.logs.map((r) => r.aging || 0))
                  const groupOverdue = group.logs.some((r) => financialInvoiceDisplayStatus(r) === 'Overdue')
                  const groupStatusLabel = groupOverdue ? 'Overdue' : 'On Process'

                  return (
                    <Fragment key={`fin-g-${group.key}`}>
                      <TableRow
                        className="border-b border-slate-100 bg-slate-50/80 last:border-0"
                      >
                        <TableCell className="w-10 px-2 align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-slate-600"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Tutup detail tagihan' : 'Buka detail tagihan'}
                            onClick={() => toggleExpanded(group.key)}
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center text-base font-medium text-slate-700">
                          {groupIndex + 1}
                        </TableCell>
                        <TableCell className="min-w-0 break-words align-middle text-base font-bold whitespace-normal text-slate-900">
                          {group.nama}
                        </TableCell>
                        <TableCell className="align-middle">
                          {groupStatusLabel === 'Overdue' ? (
                            <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-700">
                              Overdue
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-sm font-medium text-blue-700">
                              On Process
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                          {group.aset}
                        </TableCell>
                        <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                          {group.unit}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-base font-medium tabular-nums text-slate-700">
                          {group.logs.length}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-base font-bold tabular-nums text-slate-900">
                          {formatInvoiceRupiah(totalNilai)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-base font-bold tabular-nums">
                          {maxAging > 0 ? (
                            <span className="text-red-600">{maxAging} Hari</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-0 align-middle">
                          {group.tenantId ? (
                            <Button
                              asChild
                              size="sm"
                              className="h-8 max-w-full truncate rounded-md bg-blue-600 px-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              <Link href={`/tenants/edit/${group.tenantId}?tab=finance`}>Update Data</Link>
                            </Button>
                          ) : (
                            <Button size="sm" disabled className="h-8 max-w-full truncate rounded-md px-2 text-sm font-semibold">
                              Update Data
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="border-b border-slate-100 hover:bg-transparent">
                          <TableCell colSpan={parentColCount} className="p-0 align-middle">
                            <div className="border-t border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Detail tenant_payment_logs
                              </p>
                              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                                <Table className="min-w-[720px] table-fixed">
                                  <TableHeader>
                                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                                      <TableHead className="w-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        No
                                      </TableHead>
                                      <TableHead className="min-w-0 w-[18%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Nomor invoice
                                      </TableHead>
                                      <TableHead className="w-28 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Status tagihan
                                      </TableHead>
                                      <TableHead className="min-w-0 w-[30%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Deskripsi
                                      </TableHead>
                                      <TableHead className="w-32 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Nilai invoice
                                      </TableHead>
                                      <TableHead className="w-32 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Tanggal invoice
                                      </TableHead>
                                      <TableHead className="w-24 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Aging
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.logs.map((row, logIdx) => {
                                      const displayStatus = financialInvoiceDisplayStatus(row)
                                      const deskripsiTampil =
                                        row.deskripsi && row.deskripsi.trim() !== '' ? row.deskripsi : '—'
                                      return (
                                        <TableRow
                                          key={`fin-${group.key}-${row.id}`}
                                          className="border-b border-slate-100 last:border-0"
                                        >
                                          <TableCell className="text-center text-base text-slate-600">
                                            {logIdx + 1}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-800">
                                            {row.nomorInvoice}
                                          </TableCell>
                                          <TableCell className="align-middle">
                                            {displayStatus === 'Overdue' ? (
                                              <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-700">
                                                Overdue
                                              </span>
                                            ) : (
                                              <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-sm font-medium text-blue-700">
                                                On Process
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-600">
                                            {deskripsiTampil}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap text-right text-base font-bold tabular-nums text-slate-900">
                                            {formatInvoiceRupiah(row.nilaiInvoice)}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                                            {row.tanggalInvoice}
                                          </TableCell>
                                          <TableCell className="text-base font-bold tabular-nums">
                                            {row.aging > 0 ? (
                                              <span className="text-red-600">{row.aging} Hari</span>
                                            ) : (
                                              <span className="text-slate-500">—</span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
          {tenantGroups.length > 0 && visibleCount < tenantGroups.length ? (
            <p className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-center text-sm text-slate-500">
              Gulir ke bawah untuk memuat baris berikutnya
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
