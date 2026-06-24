'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { dashboardApi, tenantsApi, type FinancialTableData, type Tenant } from '@/lib/api'
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

type FinancialPaymentStatus = 'overdue' | 'reminder_needed' | 'scheduled' | 'paid'

const PAYMENT_STATUS_ORDER: Record<FinancialPaymentStatus, number> = {
  overdue: 0,
  reminder_needed: 1,
  scheduled: 2,
  paid: 3,
}

function isPastDueByDate(row: FinancialTableData): boolean {
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const todayMs = startToday.getTime()

  if (row.dueDateIso) {
    const t = new Date(row.dueDateIso).getTime()
    if (!Number.isNaN(t)) {
      const d = new Date(t)
      const dueDayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return dueDayMs < todayMs
    }
  }

  const jtMs = parseLooseDateToMs(row.jatuhTempo)
  if (jtMs != null) {
    const d = new Date(jtMs)
    const dueDayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    return dueDayMs < todayMs
  }

  return false
}

function normalizePaymentStatus(row: FinancialTableData): FinancialPaymentStatus {
  const raw = String(row.status || '').toLowerCase().trim()
  if (raw === 'overdue' || raw === 'reminder_needed' || raw === 'scheduled' || raw === 'paid') {
    return raw
  }
  if (raw === 'on process') return 'scheduled'
  if (isPastDueByDate(row)) return 'overdue'
  return 'scheduled'
}

function compareFinancialRows(a: FinancialTableData, b: FinancialTableData): number {
  const sa = PAYMENT_STATUS_ORDER[normalizePaymentStatus(a)]
  const sb = PAYMENT_STATUS_ORDER[normalizePaymentStatus(b)]
  if (sa !== sb) return sa - sb

  if (normalizePaymentStatus(a) === 'overdue' && normalizePaymentStatus(b) === 'overdue') {
    return (b.aging || 0) - (a.aging || 0)
  }

  const ta = a.dueDateIso ? new Date(a.dueDateIso).getTime() : Infinity
  const tb = b.dueDateIso ? new Date(b.dueDateIso).getTime() : Infinity
  return ta - tb
}

function worstGroupStatus(logs: FinancialTableData[]): FinancialPaymentStatus {
  let worst: FinancialPaymentStatus = 'paid'
  let worstOrder = PAYMENT_STATUS_ORDER.paid
  for (const row of logs) {
    const st = normalizePaymentStatus(row)
    const order = PAYMENT_STATUS_ORDER[st]
    if (order < worstOrder) {
      worstOrder = order
      worst = st
    }
  }
  return worst
}

function PaymentStatusBadge({ status }: { status: FinancialPaymentStatus }) {
  if (status === 'overdue') {
    return (
      <span className="inline-flex max-w-full rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 sm:px-2.5 sm:text-sm">
        Overdue
      </span>
    )
  }
  if (status === 'reminder_needed') {
    return (
      <span className="inline-flex max-w-full rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 sm:px-2.5 sm:text-sm">
        Reminder Needed
      </span>
    )
  }
  if (status === 'paid') {
    return (
      <span className="inline-flex max-w-full rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 sm:px-2.5 sm:text-sm">
        Paid
      </span>
    )
  }
  return (
    <span className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 sm:px-2.5 sm:text-sm">
      Scheduled
    </span>
  )
}

function formatInvoiceRupiah(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0
  return `Rp ${n.toLocaleString('id-ID')}`
}

function parseLooseDateToMs(value: string | undefined | null): number | null {
  if (!value) return null
  const v = value.trim()
  if (!v || v === '-') return null

  // Try native Date parse first (handles ISO like 2026-05-27)
  const native = new Date(v)
  if (!Number.isNaN(native.getTime())) return native.getTime()

  // Fallback: dd/mm/yyyy or dd-mm-yyyy
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (!dd || !mm || !yyyy) return null
  const d = new Date(yyyy, mm - 1, dd)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
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
  const [tenantRentById, setTenantRentById] = useState<Map<string, number>>(new Map())
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
        const assetParam = selectedAssetId !== 'all' ? selectedAssetId : undefined
        const [financialRes, tenantRes] = await Promise.all([
          dashboardApi.getFinancialTable(assetParam),
          tenantsApi.getTenants({
            limit: 10000,
            offset: 0,
            ...(assetParam ? { asset_id: assetParam } : {}),
          }),
        ])
        if (cancelled) return

        if (financialRes.success && financialRes.data != null) {
          setRows(normalizeDashboardList<FinancialTableData>(financialRes.data))
        } else {
          setRows([])
        }

        if (tenantRes.success && tenantRes.data != null) {
          const tenants = normalizeDashboardList<Tenant>(tenantRes.data)
          const rentMap = new Map<string, number>()
          for (const tenant of tenants) {
            if (tenant.id) {
              rentMap.set(tenant.id, Number(tenant.rent_price) || 0)
            }
          }
          setTenantRentById(rentMap)
        } else {
          setTenantRentById(new Map())
        }
      } catch (err) {
        console.error('Error loading financial table:', err)
        if (!cancelled) {
          setRows([])
          setTenantRentById(new Map())
        }
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
      const sa = PAYMENT_STATUS_ORDER[worstGroupStatus(a.logs)]
      const sb = PAYMENT_STATUS_ORDER[worstGroupStatus(b.logs)]
      if (sa !== sb) return sa - sb

      const da = earliestDueMs(a.logs)
      const db = earliestDueMs(b.logs)
      if (!da && !db) return a.nama.localeCompare(b.nama, 'id')
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
  const parentColCount = 11

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
          <Table className="w-full min-w-[1280px] table-auto">
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                <TableHead className="w-10 shrink-0 px-2" />
                <TableHead className="w-11 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                  No
                </TableHead>
                <TableHead className="min-w-[140px] max-w-[220px] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nama
                </TableHead>
                <TableHead className="w-[9.5rem] min-w-[9.5rem] shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </TableHead>
                <TableHead className="min-w-[11rem] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Aset
                </TableHead>
                <TableHead className="min-w-[8rem] max-w-[200px] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Unit
                </TableHead>
                <TableHead className="w-24 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jumlah tagihan
                </TableHead>
                <TableHead className="w-44 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total nilai
                </TableHead>
                <TableHead className="w-44 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nilai tunggakan
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
                  const sortedByPriority = [...group.logs].sort(compareFinancialRows)
                  const groupStatus = worstGroupStatus(group.logs)
                  const totalNilai =
                    group.tenantId != null
                      ? (tenantRentById.get(group.tenantId) ?? 0)
                      : 0
                  const nilaiTunggakan =
                    group.logs.find((r) => r.sisaNilai !== undefined && r.sisaNilai !== null)?.sisaNilai ?? 0
                  const maxAging = Math.max(0, ...group.logs.map((r) => r.aging || 0))

                  return (
                    <Fragment key={`fin-g-${group.key}`}>
                      <TableRow
                        className="border-b border-slate-100 bg-slate-50/80 last:border-0"
                      >
                        <TableCell className="w-10 shrink-0 px-2 align-middle">
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
                        <TableCell className="w-11 shrink-0 text-center text-base font-medium text-slate-700">
                          {groupIndex + 1}
                        </TableCell>
                        <TableCell className="min-w-0 max-w-[220px] break-words align-middle text-base font-bold whitespace-normal text-slate-900">
                          {group.nama}
                        </TableCell>
                        <TableCell className="w-[9.5rem] min-w-[9.5rem] shrink-0 align-middle">
                          <PaymentStatusBadge status={groupStatus} />
                        </TableCell>
                        <TableCell className="min-w-[11rem] break-words align-middle border-l border-slate-200/80 pl-3 text-base whitespace-normal text-slate-700">
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
                        <TableCell className="whitespace-nowrap text-right text-base font-bold tabular-nums text-slate-900">
                          {formatInvoiceRupiah(nilaiTunggakan)}
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
                            <div className="border-t border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-teal-50/50 to-white py-3 pl-6 pr-3 sm:pl-8 sm:pr-4 dark:border-emerald-800/50 dark:from-emerald-950/35 dark:via-teal-950/20 dark:to-transparent">
                              <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                                <span className="h-3 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                                Detail penagihan
                              </p>
                              <div className="overflow-x-auto rounded-lg border border-emerald-200/60 bg-white/95 shadow-sm ring-1 ring-emerald-100/80 dark:border-emerald-800/40 dark:bg-slate-950/40 dark:ring-emerald-900/30">
                                <Table className="min-w-[1040px] w-max">
                                  <TableHeader>
                                    <TableRow className="border-b border-emerald-100/80 bg-emerald-50/70 hover:bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                                      <TableHead className="w-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        No
                                      </TableHead>
                                      <TableHead className="min-w-[7rem] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Nomor invoice
                                      </TableHead>
                                      <TableHead className="min-w-[8rem] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Periode tagihan
                                      </TableHead>
                                      <TableHead className="w-32 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Tanggal invoice
                                      </TableHead>
                                      <TableHead className="min-w-[6rem] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        No. SPK
                                      </TableHead>
                                      <TableHead className="min-w-[8rem] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Jatuh tempo
                                      </TableHead>
                                      <TableHead className="w-28 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Status tagihan
                                      </TableHead>
                                      <TableHead className="min-w-[10rem] max-w-[14rem] whitespace-normal text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Catatan
                                      </TableHead>
                                      <TableHead className="w-32 whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Nilai invoice
                                      </TableHead>
                                      <TableHead className="w-24 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/80">
                                        Aging
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sortedByPriority.map((row, logIdx) => {
                                      const displayStatus = normalizePaymentStatus(row)
                                      const catatanTampil =
                                        row.catatan && row.catatan.trim() !== '' && row.catatan !== '-'
                                          ? row.catatan
                                          : '—'
                                      const periode =
                                        row.periodeTagihan && row.periodeTagihan !== '-' ? row.periodeTagihan : '—'
                                      const spk = row.nomorSpk && row.nomorSpk !== '-' ? row.nomorSpk : '—'
                                      const jt = row.jatuhTempo && row.jatuhTempo !== '-' ? row.jatuhTempo : '—'
                                      return (
                                        <TableRow
                                          key={`fin-${group.key}-${row.id}`}
                                          className="border-b border-emerald-50/80 last:border-0 hover:bg-emerald-50/30 dark:border-emerald-900/20 dark:hover:bg-emerald-950/20"
                                        >
                                          <TableCell className="text-center text-base text-slate-600">
                                            {logIdx + 1}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-800">
                                            {row.nomorInvoice?.trim() ? row.nomorInvoice : '—'}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                                            {periode}
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                                            {row.tanggalInvoice && row.tanggalInvoice !== '-' ? row.tanggalInvoice : '—'}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap align-middle font-mono text-sm text-slate-800">
                                            {spk}
                                          </TableCell>
                                          <TableCell className="min-w-0 whitespace-nowrap align-middle text-sm text-slate-700">
                                            {jt}
                                          </TableCell>
                                          <TableCell className="align-middle">
                                            <PaymentStatusBadge status={displayStatus} />
                                          </TableCell>
                                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-600">
                                            {catatanTampil}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap text-right text-base font-bold tabular-nums text-slate-900">
                                            {formatInvoiceRupiah(row.nilaiInvoice)}
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
