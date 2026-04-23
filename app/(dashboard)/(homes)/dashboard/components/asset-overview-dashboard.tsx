'use client'

import { Fragment, type RefObject, type WheelEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import FinancialTable from './financial-table'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { assetsApi, dashboardApi, Asset } from '@/lib/api'
import { ChevronRight, Mountain, DraftingCompass, MapPinned, Banknote } from "lucide-react"
import LoadingSkeleton from "@/components/loading-skeleton"
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface AssetOverviewData {
  totalLandArea: number // m²
  totalBuildingArea: number // m²
  occupancy: number // percentage
  averageRate: number // Rp per m²
}

interface AssetUtilizationData {
  category: string
  value: number
}

interface FinancialPerformanceData {
  quarter: string // Q1, Q2, Q3, Q4
  realisasi: number
  target: number
}

interface LegalTableData {
  id: number
  tenantId?: string
  dueDateIso?: string
  dokumenUrl?: string | null
  description?: string
  deskripsi?: string
  keterangan?: string
  nama: string
  aset: string
  unit: string
  jatuhTempo: string
  kewajibanMitra: string
  progress: number
  dokumen: string
  status: string
  tipe: 'legal' | 'payment'
}

function isOpenObligationStatus(status: string): boolean {
  const s = (status || '').trim().toLowerCase()
  if (!s) return false
  return /^(selesai|done|lunas|completed)$/.test(s) || s.includes('sudah dibayar')
}

/** Merah: lewat tempo · Kuning: ≤30 hari · Biru: &gt;30 hari */
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

function legalRowDisplayStatus(row: LegalTableData): 'Overdue' | 'On Process' {
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

function tenantGroupKeyLegal(row: LegalTableData): string {
  return row.tenantId || `${row.nama}::${row.aset}::${row.unit}`
}

function earliestDueMsLegal(logs: LegalTableData[]): number {
  let min = Infinity
  for (const r of logs) {
    if (!r.dueDateIso) continue
    const t = new Date(r.dueDateIso).getTime()
    if (!Number.isNaN(t)) min = Math.min(min, t)
  }
  return min === Infinity ? 0 : min
}

interface TenantLegalGroup {
  key: string
  tenantId: string | undefined
  nama: string
  aset: string
  unit: string
  logs: LegalTableData[]
}

const DASHBOARD_LIST_PAGE_SIZE = 10

interface AssetOverviewDashboardProps {
  selectedAssetId?: string
  onAssetChange?: (assetId: string) => void
}

export default function AssetOverviewDashboard({ 
  selectedAssetId: propSelectedAssetId, 
  onAssetChange 
}: AssetOverviewDashboardProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [internalSelectedAssetId, setInternalSelectedAssetId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  
  // Use prop if provided, otherwise use internal state
  const selectedAssetId = propSelectedAssetId !== undefined ? propSelectedAssetId : internalSelectedAssetId
  const selectedAssetName =
    selectedAssetId === 'all'
      ? 'SELURUH ASET KELOLAAN'
      : assets.find((asset) => asset.id === selectedAssetId)?.name ?? 'ASET KELOLAAN'
  
  const handleAssetChange = (assetId: string) => {
    if (onAssetChange) {
      onAssetChange(assetId)
    } else {
      setInternalSelectedAssetId(assetId)
    }
  }
  const [overviewData, setOverviewData] = useState<AssetOverviewData>({
    totalLandArea: 0,
    totalBuildingArea: 0,
    occupancy: 0,
    averageRate: 0
  })
  const [utilizationData, setUtilizationData] = useState<AssetUtilizationData[]>([])
  const [financialData, setFinancialData] = useState<FinancialPerformanceData[]>([])
  const [legalData, setLegalData] = useState<LegalTableData[]>([])
  const [expandedLegalKeys, setExpandedLegalKeys] = useState<Set<string>>(new Set())
  const [financialVisibleCount, setFinancialVisibleCount] = useState(DASHBOARD_LIST_PAGE_SIZE)
  const [legalVisibleCount, setLegalVisibleCount] = useState(DASHBOARD_LIST_PAGE_SIZE)
  const financialScrollRef = useRef<HTMLDivElement>(null)
  const legalScrollRef = useRef<HTMLDivElement>(null)
  const financialScrollTsRef = useRef(0)
  const legalScrollTsRef = useRef(0)
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar()
  /** Hanya dashboard: offset vertikal bar aset = tinggi header aktual (hilangkan gap), tanpa mengubah header global */
  const [appHeaderHeightPx, setAppHeaderHeightPx] = useState(64)

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector('header')
      if (!el) return
      setAppHeaderHeightPx(Math.round(el.getBoundingClientRect().height))
    }
    measure()
    const el = document.querySelector('header')
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sidebarState, sidebarIsMobile])

  useEffect(() => {
    loadAssets()
  }, [])

  useEffect(() => {
    if (assets.length > 0) {
      loadDashboardData()
    }
  }, [selectedAssetId, assets, propSelectedAssetId])

  useEffect(() => {
    setFinancialVisibleCount(DASHBOARD_LIST_PAGE_SIZE)
  }, [financialData])

  useEffect(() => {
    setLegalVisibleCount(DASHBOARD_LIST_PAGE_SIZE)
  }, [legalData])

  const loadAssets = async () => {
    try {
      const response = await assetsApi.getAssets({ limit: 1000 })
      if (response.success && response.data) {
        const responseData = response.data as any
        const assetsList: Asset[] = Array.isArray(responseData.data) ? responseData.data : []
        console.log('Assets List:', assetsList)
        setAssets(assetsList)
        if (assetsList.length > 0 && selectedAssetId === 'all') {
          // Keep 'all' as default
        }
      }
    } catch (err) {
      console.error('Error loading assets:', err)
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const assetParam = selectedAssetId !== 'all' ? selectedAssetId : undefined
      const response = await dashboardApi.getAssetOverview(assetParam)

      if (response.success && response.data) {
        const responseData = response.data as any
        const data = responseData.data
        console.log('Dashboard Data:', data)
        if (data.overview) {
          setOverviewData(data.overview)
        }
        if (data.utilization) {
          setUtilizationData(data.utilization)
        }
        if (data.financial) {
          setFinancialData(data.financial)
        }
        if (data.legal) {
          setLegalData(data.legal)
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCompactRupiah = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000_000) return `Rp ${(value / 1_000_000_000_000).toFixed(1)} T`
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)} M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)} Jt`
    return `Rp ${value.toLocaleString('id-ID')}`
  }

  const formatCompactNumber = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toLocaleString('id-ID')
  }

  /** Total KPI header: Jt jika &lt; 1 M, supaya angka kecil tetap terbaca. */
  const formatFinancialKpi = (value: number) => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) {
      const b = value / 1_000_000_000
      return `Rp${(Math.round(b * 100) / 100).toFixed(2)}B`
    }
    if (abs >= 1_000_000) {
      const jt = value / 1_000_000
      return `Rp${(Math.round(jt * 10) / 10).toFixed(1)}Jt`
    }
    return `Rp${value.toLocaleString('id-ID')}`
  }

  /** Batas atas sumbu Y yang “rapi” + ruang kepala agar batang tidak menempel atas. */
  const financialNiceYMax = (dataMax: number): number => {
    if (!Number.isFinite(dataMax) || dataMax <= 0) {
      return 100_000_000
    }
    const padded = dataMax * 1.22
    const exp = Math.floor(Math.log10(padded))
    const magnitude = 10 ** exp
    const n = padded / magnitude
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
    return nice * magnitude
  }

  const quarterToTwLabel = (quarter: string) => {
    const map: Record<string, string> = { Q1: 'TW 1', Q2: 'TW 2', Q3: 'TW 3', Q4: 'TW 4' }
    return map[quarter] ?? quarter.replace(/^Q(\d)$/i, 'TW $1')
  }

  const utilizationTotal = utilizationData.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0)
  const utilizationPercentages = utilizationData.map((d) => ({
    category: d.category,
    raw: d.value,
    pct: utilizationTotal > 0 ? (d.value / utilizationTotal) * 100 : 0,
  }))

  // Donut chart options for Asset Utilization
  const utilizationChartOptions: ApexOptions = {
    chart: {
      type: 'donut',
      height: 300,
      toolbar: { show: false },
      animations: { enabled: true, speed: 600 },
    },
    labels: utilizationPercentages.map(d => d.category),
    // Palet mendekati contoh (lebih “dashboard” dan kontras)
    colors: ['#F47C4B', '#2E5B6C', '#8D49A6', '#9BA31A', '#2C63D6', '#FF5A7A'],
    legend: { show: false },
    dataLabels: {
      // Hapus label persen per-slice (yang muncul seperti "50%")
      enabled: false,
    },
    stroke: {
      show: true,
      width: 6,
      colors: ['#FFFFFF'],
    },
    states: {
      hover: {
        filter: { type: 'lighten' },
      },
      active: {
        filter: { type: 'darken' },
      },
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: (val: number) => `${val.toFixed(1)}%`,
        title: {
          formatter: (seriesName: string) => `${seriesName}: `,
        },
      },
    },
    plotOptions: {
      pie: {
        dataLabels: {
          minAngleToShowLabel: 12,
          offset: -10
        },
        startAngle: -110,
        endAngle: 250,
        expandOnClick: false,
        donut: {
          // Lebih kecil = ring lebih tebal
          size: '62%',
          labels: {
            show: true,
            name: {
              show: true,
              // Jarak vertikal label "OCCUPIED" dari angka % (Apex: label total pakai name.offsetY)
              offsetY: 30,
              fontSize: '13px',
              fontWeight: 700,
              color: '#94A3B8',
            },
            value: {
              show: true,
              offsetY: -10,
              fontSize: '44px',
              fontWeight: 800,
              color: '#0F172A',
              formatter: (val: string) => `${Number(val).toFixed(0)}%`,
            },
            total: {
              show: true,
              label: 'OCCUPIED',
              fontSize: '13px',
              fontWeight: 800,
              color: '#94A3B8',
              formatter: function () {
                return `${overviewData.occupancy.toFixed(0)}%`
              }
            }
          }
        }
      }
    }
  }

  const utilizationChartSeries = utilizationPercentages.map(d => Number.isFinite(d.pct) ? Number(d.pct.toFixed(2)) : 0)

  const financialDataForChart = useMemo(
    () => financialData.slice(0, financialVisibleCount),
    [financialData, financialVisibleCount]
  )

  const FINANCIAL_REALISASI = '#335C6E'
  const FINANCIAL_TARGET = '#EF8354'
  const financialRawMax = financialDataForChart.length
    ? Math.max(0, ...financialDataForChart.flatMap((d) => [d.realisasi, d.target]))
    : 0
  const financialYMax = financialNiceYMax(financialRawMax)
  const financialAxisInBillions = financialYMax >= 1_000_000_000
  const financialYAxisDecimals =
    financialAxisInBillions && financialYMax < 5_000_000_000 && financialRawMax < 1_000_000_000 ? 2 : financialAxisInBillions && financialYMax < 20_000_000_000 ? 1 : 0

  const financialChartPixelHeight = Math.max(320, financialDataForChart.length * 68)

  // Bar chart — grup per triwulan, mirip mockup Kinerja Keuangan
  const financialChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: financialChartPixelHeight,
      toolbar: { show: false },
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 450 },
    },
    colors: [FINANCIAL_REALISASI, FINANCIAL_TARGET],
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 12, right: 12, bottom: 4, left: 4 },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '58%',
        borderRadius: 8,
        borderRadiusApplication: 'end',
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: false },
    xaxis: {
      categories: financialDataForChart.map((d) => quarterToTwLabel(d.quarter)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: '#64748B', fontSize: '13px', fontWeight: 500 },
      },
    },
    yaxis: {
      min: 0,
      max: financialYMax,
      tickAmount: 5,
      labels: {
        formatter: (val: number) => {
          if (financialAxisInBillions) {
            return `${(val / 1_000_000_000).toFixed(financialYAxisDecimals)}B`
          }
          return `${Math.round(val / 1_000_000)}Jt`
        },
        style: { colors: '#64748B', fontSize: '12px' },
      },
    },
    legend: { show: false },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number) =>
          val >= 1_000_000_000
            ? `Rp ${(val / 1_000_000_000).toFixed(2)} M`
            : `Rp ${val.toLocaleString('id-ID')}`,
      },
    },
    fill: { opacity: 1 },
  }

  const financialChartSeries = [
    { name: 'Realisasi', data: financialDataForChart.map((d) => d.realisasi) },
    { name: 'Target', data: financialDataForChart.map((d) => d.target) },
  ]

  const financialYear = new Date().getFullYear()
  const totalFinancialRealisasi = financialData.reduce((s, d) => s + d.realisasi, 0)
  const totalFinancialTarget = financialData.reduce((s, d) => s + d.target, 0)

  const legalitasSourceRows = useMemo(() => {
    return legalData.filter((row) => row.tipe === 'legal')
  }, [legalData])

  const legalProgressByTenant = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>()
    for (const row of legalitasSourceRows) {
      const key = tenantGroupKeyLegal(row)
      const current = map.get(key) ?? { completed: 0, total: 0 }
      current.total += 1
      if (isOpenObligationStatus(row.status)) current.completed += 1
      map.set(key, current)
    }
    return map
  }, [legalitasSourceRows])

  const legalitasRows = useMemo(() => {
    return [...legalitasSourceRows].sort((a, b) => {
      const ta = a.dueDateIso ? new Date(a.dueDateIso).getTime() : 0
      const tb = b.dueDateIso ? new Date(b.dueDateIso).getTime() : 0
      return ta - tb
    })
  }, [legalitasSourceRows])

  const legalTenantGroups = useMemo((): TenantLegalGroup[] => {
    const map = new Map<string, LegalTableData[]>()
    for (const row of legalitasRows) {
      const key = tenantGroupKeyLegal(row)
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }

    const groups: TenantLegalGroup[] = []
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
      const da = earliestDueMsLegal(a.logs)
      const db = earliestDueMsLegal(b.logs)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da - db
    })

    return groups
  }, [legalitasRows])

  const visibleLegalGroups = useMemo(
    () => legalTenantGroups.slice(0, legalVisibleCount),
    [legalTenantGroups, legalVisibleCount]
  )

  const handleFinancialScroll = useCallback(() => {
    const now = Date.now()
    if (now - financialScrollTsRef.current < 200) return
    const el = financialScrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 80) return
    financialScrollTsRef.current = now
    setFinancialVisibleCount((c) =>
      c >= financialData.length ? c : Math.min(c + DASHBOARD_LIST_PAGE_SIZE, financialData.length)
    )
  }, [financialData.length])

  const handleLegalScroll = useCallback(() => {
    const now = Date.now()
    if (now - legalScrollTsRef.current < 200) return
    const el = legalScrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 80) return
    legalScrollTsRef.current = now
    setLegalVisibleCount((c) =>
      c >= legalTenantGroups.length ? c : Math.min(c + DASHBOARD_LIST_PAGE_SIZE, legalTenantGroups.length)
    )
  }, [legalTenantGroups.length])

  const handleContainerWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>, ref: RefObject<HTMLDivElement | null>) => {
      const el = ref.current
      if (!el) return
      if (el.scrollHeight <= el.clientHeight) return

      const scrollingDown = event.deltaY > 0
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if ((scrollingDown && atBottom) || (!scrollingDown && atTop)) return

      event.preventDefault()
      el.scrollTop += event.deltaY
    },
    []
  )

  const toggleExpandedLegal = (key: string) => {
    setExpandedLegalKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading && assets.length === 0) {
    return <LoadingSkeleton height="h-96" text="Memuat data dashboard..." />
  }

  return (
    <div className="space-y-6">
      {/* Asset Selector — fixed di bawah header app, tidak ikut scroll */}
      <div
        className={cn(
          'fixed inset-x-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 transition-[padding,top] duration-200 ease-linear',
          'pr-4 md:pr-6',
          sidebarIsMobile
            ? 'pl-4'
            : sidebarState === 'collapsed'
              ? 'pl-4 md:pl-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
              : 'pl-4 md:pl-[calc(var(--sidebar-width)+(--spacing(0)))]'
        )}
        style={{ top: appHeaderHeightPx }}
      >
        <h1 className="pl-2 text-xl font-semibold text-gray-900 sm:pl-4 sm:text-3xl md:pl-6 md:text-4xl">{selectedAssetName}</h1>
        <Select value={selectedAssetId} onValueChange={handleAssetChange}>
          <SelectTrigger className="w-[250px] text-base">
            <SelectValue placeholder="Pilih Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Asset</SelectItem>
            {assets.map(asset => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Ruang untuk bar fixed (tinggi ≈ judul + py-3 + border) */}
      <div className="h-20 shrink-0 md:h-24" aria-hidden />

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        <Card
          className="gap-0 border-0 py-0 text-white shadow-md overflow-hidden rounded-2xl"
          style={{ background: '#F97316' }}
        >
          <CardContent className="px-8 py-4">
            <div className="flex flex-col gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
                <Mountain className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-bold tracking-wide text-white uppercase">Total Lahan</p>
                <p className="text-5xl font-bold leading-none tracking-tight sm:text-2xl">
                  {formatCompactNumber(overviewData.totalLandArea)}{' '}
                  <span className="text-2xl font-semibold text-white/55 sm:text-2xl">m²</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="gap-0 border-0 py-0 text-white shadow-md overflow-hidden rounded-2xl"
          style={{ background: '#8B5CF6' }}
        >
          <CardContent className="px-8 py-4">
            <div className="flex flex-col gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
                <DraftingCompass className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-bold tracking-wide text-white uppercase">Luas Bangunan</p>
                <p className="text-5xl font-bold leading-none tracking-tight sm:text-2xl">
                  {formatCompactNumber(overviewData.totalBuildingArea)}{' '}
                  <span className="text-2xl font-semibold text-white/55 sm:text-2xl">m²</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="gap-0 border-0 py-0 text-white shadow-md overflow-hidden rounded-2xl"
          style={{ background: '#0F766E' }}
        >
          <CardContent className="px-8 py-4">
            <div className="flex flex-col gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
                <MapPinned className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-bold tracking-wide text-white uppercase">Okupansi</p>
                <p className="text-5xl font-bold leading-none tracking-tight sm:text-2xl">
                  {overviewData.occupancy.toFixed(1)}
                  <span className="text-2xl font-semibold text-white/55 sm:text-2xl">%</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="gap-0 border-0 py-0 text-white shadow-md overflow-hidden rounded-2xl"
          style={{ background: '#1F2937' }}
        >
          <CardContent className="px-8 py-4">
            <div className="flex flex-col gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Banknote className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-bold tracking-wide text-white/55 uppercase">Avg. Rate</p>
                <p className="text-5xl font-bold leading-none tracking-tight sm:text-2xl">
                  {formatCompactRupiah(overviewData.averageRate)}{' '}
                  <span className="text-2xl font-semibold text-white/45 sm:text-2xl">/ m²</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-2xl font-bold tracking-tight">
              <span>Pemanfaatan Aset</span>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Menu</span>
                <span aria-hidden>⋮</span>
              </button>
            </CardTitle>
            <p className="text-lg text-muted-foreground -mt-1">Asset occupancy by sector category</p>
          </CardHeader>
          <CardContent>
            {utilizationData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 items-center">
                <div className="flex justify-center">
                  <Chart
                    options={utilizationChartOptions}
                    series={utilizationChartSeries}
                    type="donut"
                    height={300}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {utilizationPercentages.map((item, idx) => (
                    <div key={`${item.category}-${idx}`} className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-3 w-3 rounded-full"
                        style={{ background: (utilizationChartOptions.colors as string[] | undefined)?.[idx % 6] || '#94A3B8' }}
                        aria-hidden
                      />
                      <div className="leading-tight">
                        <div className="text-lg font-semibold tracking-wide text-muted-foreground uppercase">
                          {item.category}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {Math.round(item.pct)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-base text-muted-foreground">
                Tidak ada data pemanfaatan aset
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Performance — Kinerja Keuangan */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="space-y-0 pb-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                  Kinerja Keuangan {financialYear}
                </CardTitle>
                <CardDescription className="text-lg font-normal text-slate-500">
                  Financial tracking against annual projections (Rp)
                </CardDescription>
              </div>
              {financialData.length > 0 ? (
                <div className="flex shrink-0 items-stretch gap-0 sm:pt-0.5">
                  <div className="flex min-w-[7.5rem] flex-col gap-1 pr-5 sm:pr-6">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: FINANCIAL_REALISASI }}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold tracking-wider text-slate-500">
                        REALISASI
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                      {formatFinancialKpi(totalFinancialRealisasi)}
                    </p>
                  </div>
                  <div className="w-px self-stretch bg-slate-200" aria-hidden />
                  <div className="flex min-w-[7.5rem] flex-col gap-1 pl-5 sm:pl-6">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: FINANCIAL_TARGET }}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold tracking-wider text-slate-500">
                        TARGET
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                      {formatFinancialKpi(totalFinancialTarget)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {financialData.length > 0 ? (
              <div
                ref={financialScrollRef}
                className={cn(
                  'overflow-y-auto overscroll-contain rounded-md',
                  financialVisibleCount < financialData.length ? 'max-h-[300px]' : 'max-h-[380px]'
                )}
                onScroll={handleFinancialScroll}
                onWheel={(event) => handleContainerWheel(event, financialScrollRef)}
              >
                <Chart
                  options={financialChartOptions}
                  series={financialChartSeries}
                  type="bar"
                  height={financialChartPixelHeight}
                />
                {financialVisibleCount < financialData.length ? (
                  <p className="py-2 text-center text-base text-slate-500">
                    Gulir ke bawah untuk memuat periode berikutnya
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-base text-muted-foreground">
                Tidak ada data kinerja keuangan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Legalitas Aset */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Status Legalitas Aset
          </CardTitle>
          <CardDescription className="text-lg text-slate-500">
            Detail legalitas per tenant, termasuk yang sudah selesai maupun masih berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            ref={legalScrollRef}
            className="h-[420px] overflow-auto overscroll-contain rounded-lg border border-slate-100"
            onScroll={handleLegalScroll}
            onWheel={(event) => handleContainerWheel(event, legalScrollRef)}
          >
            <Table className="w-full min-w-[980px] table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="w-10 px-2" />
                  <TableHead className="w-11 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                    No
                  </TableHead>
                  <TableHead className="min-w-0 w-[20%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nama
                  </TableHead>
                  <TableHead className="w-28 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="min-w-0 w-[16%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Aset
                  </TableHead>
                  <TableHead className="min-w-0 w-[14%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Unit
                  </TableHead>
                  <TableHead className="w-[9rem] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Jatuh tempo
                  </TableHead>
                  <TableHead className="min-w-0 w-[18%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Kewajiban mitra
                  </TableHead>
                  <TableHead className="w-24 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Progress
                  </TableHead>
                  <TableHead className="w-[132px] whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legalTenantGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-base text-muted-foreground">
                      Tidak ada data legalitas untuk ditampilkan.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleLegalGroups.map((group, groupIndex) => {
                    const isOpen = expandedLegalKeys.has(group.key)
                    const groupOverdue = group.logs.some((r) => legalRowDisplayStatus(r) === 'Overdue')
                    const groupStatusLabel = groupOverdue ? 'Overdue' : 'On Process'
                    const earliest = group.logs.reduce<LegalTableData | null>((acc, r) => {
                      if (!r.dueDateIso) return acc
                      if (!acc?.dueDateIso) return r
                      const ta = new Date(acc.dueDateIso).getTime()
                      const tb = new Date(r.dueDateIso).getTime()
                      if (Number.isNaN(tb)) return acc
                      if (Number.isNaN(ta)) return r
                      return tb < ta ? r : acc
                    }, null)
                    const dotClass = dueDateDotClass(earliest?.dueDateIso)
                    const earliestLabel = earliest?.jatuhTempo || '—'
                    const progressSummary = legalProgressByTenant.get(group.key) ?? { completed: 0, total: group.logs.length }
                    const progressPercent = progressSummary.total > 0
                      ? Math.round((progressSummary.completed / progressSummary.total) * 100)
                      : 0

                    return (
                      <Fragment key={`legal-g-${group.key}`}>
                        <TableRow className="border-b border-slate-100 bg-slate-50/80 last:border-0">
                          <TableCell className="w-10 px-2 align-middle">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-slate-600"
                              aria-expanded={isOpen}
                              aria-label={isOpen ? 'Tutup detail legalitas' : 'Buka detail legalitas'}
                              onClick={() => toggleExpandedLegal(group.key)}
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
                          <TableCell className="min-w-0 align-middle">
                            <div className="flex min-w-0 flex-wrap items-center gap-2 text-base text-slate-800">
                              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                              <span className="min-w-0 break-words">{earliestLabel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-0 break-words align-middle text-base whitespace-normal text-slate-700">
                            {group.logs.length} item
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-base font-bold tabular-nums text-slate-900">
                            {progressPercent}%
                          </TableCell>
                          <TableCell className="min-w-0 align-middle">
                            {group.tenantId ? (
                              <Button
                                asChild
                                size="sm"
                                className="h-8 max-w-full truncate rounded-md bg-blue-600 px-2 text-sm font-semibold text-white hover:bg-blue-700"
                              >
                                <Link href={`/tenants/edit/${group.tenantId}?tab=legals`}>Update Data</Link>
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
                            <TableCell colSpan={11} className="p-0 align-middle">
                              <div className="border-t border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Detail legalitas
                                </p>
                                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                                  <Table className="min-w-[720px] table-fixed">
                                    <TableHeader>
                                      <TableRow className="border-b border-slate-100 hover:bg-transparent">
                                        <TableHead className="w-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          No
                                        </TableHead>
                                        <TableHead className="min-w-0 w-[11rem] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          Jatuh tempo
                                        </TableHead>
                                        <TableHead className="min-w-0 w-[26%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          Kewajiban mitra
                                        </TableHead>
                                        <TableHead className="min-w-0 w-[26%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          Keterangan
                                        </TableHead>
                                        <TableHead className="w-36 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          Status penyelesaian
                                        </TableHead>
                                        <TableHead className="min-w-0 w-[14%] whitespace-normal text-xs font-semibold uppercase tracking-wider text-slate-500">
                                          Dokumen
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {group.logs.map((row, idx) => {
                                        const rowDotClass = dueDateDotClass(row.dueDateIso)
                                        const jenisDokumenLabel =
                                          (row.description && row.description.trim() !== '' ? row.description : '') ||
                                          (row.deskripsi && row.deskripsi.trim() !== '' ? row.deskripsi : '') ||
                                          row.kewajibanMitra ||
                                          '—'
                                        const keteranganLabel = row.keterangan && row.keterangan.trim() !== '' ? row.keterangan : '—'
                                        const isCompleted = isOpenObligationStatus(row.status)
                                        return (
                                          <TableRow
                                            key={`legal-${group.key}-${row.id}`}
                                            className="border-b border-slate-100 last:border-0"
                                          >
                                            <TableCell className="text-center text-base text-slate-600">{idx + 1}</TableCell>
                                            <TableCell className="min-w-0 align-middle">
                                              <div className="flex min-w-0 flex-wrap items-center gap-2 text-base text-slate-800">
                                                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${rowDotClass}`} aria-hidden />
                                                <span className="min-w-0 break-words">{row.jatuhTempo}</span>
                                              </div>
                                            </TableCell>
                                            <TableCell className="min-w-0 whitespace-normal break-words align-middle text-base leading-6 text-slate-700">
                                              {jenisDokumenLabel}
                                            </TableCell>
                                            <TableCell className="min-w-0 whitespace-normal break-words align-middle text-base leading-6 text-slate-700">
                                              {keteranganLabel}
                                            </TableCell>
                                            <TableCell className="align-middle">
                                              {isCompleted ? (
                                                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
                                                  Selesai
                                                </span>
                                              ) : (
                                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-700">
                                                  Belum selesai
                                                </span>
                                              )}
                                            </TableCell>
                                            <TableCell className="min-w-0 max-w-[160px] align-middle">
                                              {row.dokumenUrl && row.dokumen ? (
                                                <a
                                                  href={row.dokumenUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block break-words text-base font-medium text-blue-600 hover:underline"
                                                >
                                                  {row.dokumen}
                                                </a>
                                              ) : null}
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
            {legalTenantGroups.length > 0 && legalVisibleCount < legalTenantGroups.length ? (
              <p className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-center text-sm text-slate-500">
                Gulir ke bawah untuk memuat baris berikutnya
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
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

      {/* Financial Table */}
      <FinancialTable selectedAssetId={selectedAssetId} />
    </div>
  )
}
