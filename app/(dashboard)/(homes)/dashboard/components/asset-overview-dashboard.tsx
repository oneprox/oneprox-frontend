'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  // Donut chart options for Asset Utilization
  const utilizationChartOptions: ApexOptions = {
    chart: {
      type: 'donut',
      height: 300
    },
    labels: utilizationData.map(d => d.category),
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    legend: {
      position: 'right'
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val.toLocaleString('id-ID') + ' tenant'
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: function () {
                const total = utilizationData.reduce((sum, d) => sum + d.value, 0)
                return total.toLocaleString('id-ID') + ' tenant'
              }
            }
          }
        }
      }
    }
  }

  const utilizationChartSeries = utilizationData.map(d => d.value)

  // Bar chart options for Financial Performance
  const financialChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: 300
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: financialData.map(d => d.quarter)
    },
    yaxis: {
      labels: {
        formatter: function (val: number) {
          if (val >= 1000000000) return 'Rp ' + (val / 1000000000).toFixed(1) + ' M'
          if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1) + ' Jt'
          if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + ' K'
          return 'Rp ' + val.toLocaleString('id-ID')
        }
      }
    },
    colors: ['#8B5CF6', '#3B82F6'],
    legend: {
      position: 'top'
    },
    fill: {
      opacity: 1
    }
  }

  const financialChartSeries = [
    {
      name: 'Realisasi',
      data: financialData.map(d => d.realisasi)
    },
    {
      name: 'Target',
      data: financialData.map(d => d.target)
    }
  ]

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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Luas Lahan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overviewData.totalLandArea.toLocaleString('id-ID')} m²
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Leaf className="h-6 w-6 text-green-600" />
              </div>
            </div>
            </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Luas Bangunan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overviewData.totalBuildingArea.toLocaleString('id-ID')} m²
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Home className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Okupansi</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overviewData.occupancy.toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rp {overviewData.averageRate.toLocaleString('id-ID')} / m²
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
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
            <CardTitle>PEMANFAATAN ASET</CardTitle>
          </CardHeader>
          <CardContent>
            {utilizationData.length > 0 ? (
              <Chart
                options={utilizationChartOptions}
                series={utilizationChartSeries}
                type="donut"
                height={300}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada data pemanfaatan aset
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>KINERJA KEUANGAN {new Date().getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span className="text-sm">Realisasi</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm">Target</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>TARGET TOTAL: Rp {financialData.reduce((sum, d) => sum + d.target, 0).toLocaleString('id-ID')}</p>
                <p className="mt-2">REALISASI TOTAL: Rp {financialData.reduce((sum, d) => sum + d.realisasi, 0).toLocaleString('id-ID')}</p>
              </div>
            </div>
            {financialData.length > 0 ? (
              <Chart
                options={financialChartOptions}
                series={financialChartSeries}
                type="bar"
                height={300}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
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
