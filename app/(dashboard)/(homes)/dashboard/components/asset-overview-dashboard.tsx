'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { assetsApi, dashboardApi, Asset } from '@/lib/api'
import { Leaf, Home, FileText, DollarSign } from "lucide-react"
import LoadingSkeleton from "@/components/loading-skeleton"

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
  nama: string
  aset: string
  unit: string
  jatuhTempo: string
  kewajibanMitra: string
  progress: number
  dokumen: string
  status: string
  tipe: 'legal' | 'payment' // Menandai apakah ini legal document atau penagihan
}

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

  useEffect(() => {
    loadAssets()
  }, [])

  useEffect(() => {
    if (assets.length > 0) {
      loadDashboardData()
    }
  }, [selectedAssetId, assets, propSelectedAssetId])

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
      
      // Call backend API untuk mendapatkan semua data yang sudah dikalkulasi
      const response = await dashboardApi.getAssetOverview(selectedAssetId !== 'all' ? selectedAssetId : undefined)
      
      if (response.success && response.data) {
       
        const responseData = response.data as any
        const data = responseData.data;
        console.log('Dashboard Data:', data)
        // Set overview data
        if (data.overview) {
          setOverviewData(data.overview)
        }
        
        // Set utilization data
        if (data.utilization) {
          setUtilizationData(data.utilization)
        }
        
        // Set financial data
        if (data.financial) {
          setFinancialData(data.financial)
        }
        
        // Set legal data
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
              offsetY: 18,
              fontSize: '12px',
              fontWeight: 700,
              color: '#94A3B8',
            },
            value: {
              show: true,
              offsetY: -8,
              fontSize: '40px',
              fontWeight: 800,
              color: '#0F172A',
              formatter: (val: string) => `${Number(val).toFixed(0)}%`,
            },
            total: {
              show: true,
              label: 'OCCUPIED',
              fontSize: '12px',
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

  const FINANCIAL_REALISASI = '#335C6E'
  const FINANCIAL_TARGET = '#EF8354'
  const financialRawMax = financialData.length
    ? Math.max(0, ...financialData.flatMap((d) => [d.realisasi, d.target]))
    : 0
  const financialYMax = financialNiceYMax(financialRawMax)
  const financialAxisInBillions = financialYMax >= 1_000_000_000
  const financialYAxisDecimals =
    financialAxisInBillions && financialYMax < 5_000_000_000 && financialRawMax < 1_000_000_000 ? 2 : financialAxisInBillions && financialYMax < 20_000_000_000 ? 1 : 0

  // Bar chart — grup per triwulan, mirip mockup Kinerja Keuangan
  const financialChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: 320,
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
      categories: financialData.map((d) => quarterToTwLabel(d.quarter)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: '#64748B', fontSize: '12px', fontWeight: 500 },
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
        style: { colors: '#64748B', fontSize: '11px' },
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
    { name: 'Realisasi', data: financialData.map((d) => d.realisasi) },
    { name: 'Target', data: financialData.map((d) => d.target) },
  ]

  const financialYear = new Date().getFullYear()
  const totalFinancialRealisasi = financialData.reduce((s, d) => s + d.realisasi, 0)
  const totalFinancialTarget = financialData.reduce((s, d) => s + d.target, 0)

  if (loading && assets.length === 0) {
    return <LoadingSkeleton height="h-96" text="Memuat data dashboard..." />
  }

  return (
    <div className="space-y-6">
      {/* Asset Selector */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">SELURUH ASET KELOLAAN</h1>
        <Select value={selectedAssetId} onValueChange={handleAssetChange}>
          <SelectTrigger className="w-[250px]">
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

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 text-white overflow-hidden" style={{ background: '#F97316' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">Total Lahan</p>
                <p className="text-3xl font-bold leading-none">
                  {formatCompactNumber(overviewData.totalLandArea)} <span className="text-base font-semibold text-white/80">m²</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-4">
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                  ↗ 2.4%
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Leaf className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 text-white overflow-hidden" style={{ background: '#8B5CF6' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">Luas Bangunan</p>
                <p className="text-3xl font-bold leading-none">
                  {formatCompactNumber(overviewData.totalBuildingArea)} <span className="text-base font-semibold text-white/80">m²</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-4">
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                  ↗ 1.7%
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Home className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 text-white overflow-hidden" style={{ background: '#0EA5A5' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">Okupansi</p>
                <p className="text-3xl font-bold leading-none">
                  {overviewData.occupancy.toFixed(1)}<span className="text-base font-semibold text-white/80">%</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-4">
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                  ↗ 0.9%
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 text-white overflow-hidden" style={{ background: '#111827' }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">Avg. Rate</p>
                <p className="text-3xl font-bold leading-none">
                  {formatCompactRupiah(overviewData.averageRate)} <span className="text-base font-semibold text-white/70">/m²</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-4">
                <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  ↗ 3.2%
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
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
            <CardTitle className="flex items-center justify-between">
              <span>Pemanfaatan Aset</span>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Menu</span>
                <span aria-hidden>⋮</span>
              </button>
            </CardTitle>
            <p className="text-sm text-muted-foreground -mt-1">Asset occupancy by sector category</p>
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
                        <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                          {item.category}
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {Math.round(item.pct)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
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
                <CardTitle className="text-lg font-bold tracking-tight text-slate-900">
                  Kinerja Keuangan {financialYear}
                </CardTitle>
                <CardDescription className="text-sm font-normal text-slate-500">
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
                      <span className="text-[10px] font-semibold tracking-wider text-slate-500">
                        REALISASI
                      </span>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
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
                      <span className="text-[10px] font-semibold tracking-wider text-slate-500">
                        TARGET
                      </span>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
                      {formatFinancialKpi(totalFinancialTarget)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {financialData.length > 0 ? (
              <Chart
                options={financialChartOptions}
                series={financialChartSeries}
                type="bar"
                height={320}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-muted-foreground">
                Tidak ada data kinerja keuangan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legal Table */}
      <Card>
        <CardHeader>
          <CardTitle>LEGAL</CardTitle>
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
                  <TableHead>KEWAJIBAN MITRA</TableHead>
                  <TableHead>PROGRESS</TableHead>
                  <TableHead>DOKUMEN/PERIODE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>TIPE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legalData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Tidak ada data legal atau penagihan
                    </TableCell>
                  </TableRow>
                ) : (
                  legalData.map((legal, index) => (
                    <TableRow key={`${legal.tipe}-${legal.id}`}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>{legal.nama}</TableCell>
                      <TableCell>{legal.aset}</TableCell>
                      <TableCell>{legal.unit}</TableCell>
                      <TableCell>{legal.jatuhTempo}</TableCell>
                      <TableCell className="max-w-xs truncate">{legal.kewajibanMitra}</TableCell>
                      <TableCell>{legal.progress}%</TableCell>
                      <TableCell className="max-w-xs truncate">{legal.dokumen}</TableCell>
                      <TableCell>
                        <Badge variant={legal.status === 'Done' ? 'default' : (legal.status === 'Belum Dibayar' ? 'destructive' : 'secondary')}>
                          {legal.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={legal.tipe === 'legal' ? 'outline' : 'secondary'}>
                          {legal.tipe === 'legal' ? 'Legal Document' : 'Penagihan'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
