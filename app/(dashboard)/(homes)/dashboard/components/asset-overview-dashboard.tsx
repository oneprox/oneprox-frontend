'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { assetsApi, tenantsApi, unitsApi, Tenant, Asset, Unit, TenantLegal, TenantPaymentLog } from '@/lib/api'
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
  year: string
  income: number
  savings: number
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
      
      // Load all tenants
      const tenantsResponse = await tenantsApi.getTenants({ limit: 10000 })
      if (!tenantsResponse.success || !tenantsResponse.data) {
        return
      }

      // Backend returns: { data: [...], message: "...", status: 200 }
      // ApiClient returns: { success: true, data: [...] }
      const tenantsList: Tenant[] = Array.isArray(tenantsResponse.data) 
        ? tenantsResponse.data 
        : []

      // Load all units
      const unitsResponse = await unitsApi.getUnits({ limit: 10000 })
      const unitsList: Unit[] = Array.isArray(unitsResponse.data) 
        ? unitsResponse.data 
        : []

      // Filter by selected asset
      let filteredAssets = assets
      if (selectedAssetId !== 'all') {
        filteredAssets = assets.filter(a => a.id === selectedAssetId)
      }

      // Calculate overview data
      let totalLandArea = 0
      let totalBuildingArea = 0
      let occupiedUnits = 0
      let totalUnits = 0
      let totalRevenue = 0

      filteredAssets.forEach(asset => {
        const assetArea = typeof asset.area === 'string' ? parseFloat(asset.area) : (typeof asset.area === 'number' ? asset.area : 0)
        totalLandArea += assetArea
        
        // Get units for this asset
        // Check both asset_id and unit.asset.id (unit may have asset object from backend)
        const assetUnits = unitsList.filter(u => {
          return u.asset_id === asset.id || u.asset?.id === asset.id
        })
        totalUnits += assetUnits.length
        
        // Get tenants for this asset (through units)
        // Units are already included in tenant response from backend
        const assetUnitIds = assetUnits.map(u => u.id)
        const assetTenants = tenantsList.filter(t => {
          if (!t.units || !Array.isArray(t.units)) return false
          // Check if tenant has any unit in this asset
          return t.units.some((tu: any) => {
            const unitId = tu.id
            // Also check if unit's asset matches
            const unitAssetId = tu.asset?.id || tu.asset_id
            return assetUnitIds.includes(unitId) || unitAssetId === asset.id
          })
        })
        
        occupiedUnits += assetTenants.length
        
        // Calculate building area (using building_area or size)
        assetUnits.forEach(unit => {
          const unitArea = unit.building_area || unit.size || 0
          totalBuildingArea += typeof unitArea === 'string' ? parseFloat(unitArea) : (typeof unitArea === 'number' ? unitArea : 0)
        })

        // Calculate revenue
        assetTenants.forEach(tenant => {
          const rentPrice = typeof tenant.rent_price === 'string' ? parseFloat(tenant.rent_price) : (typeof tenant.rent_price === 'number' ? tenant.rent_price : 0)
          totalRevenue += rentPrice
        })
      })

      const occupancy = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0
      const averageRate = totalBuildingArea > 0 ? totalRevenue / totalBuildingArea : 0

      setOverviewData({
        totalLandArea,
        totalBuildingArea,
        occupancy,
        averageRate
      })

      // Calculate utilization data from tenant categories
      const utilizationMap = new Map<string, number>()
      
      // Get all tenants for filtered assets
      const allFilteredTenants = filteredAssets.flatMap(asset => {
        const assetUnits = unitsList.filter(u => {
          return u.asset_id === asset.id || u.asset?.id === asset.id
        })
        const assetUnitIds = assetUnits.map(u => u.id)
        return tenantsList.filter(t => {
          if (!t.units || !Array.isArray(t.units)) return false
          return t.units.some((tu: any) => {
            const unitId = tu.id
            const unitAssetId = tu.asset?.id || tu.asset_id
            return assetUnitIds.includes(unitId) || unitAssetId === asset.id
          })
        })
      })

      // Group by category and calculate total rent price
      allFilteredTenants.forEach(tenant => {
        const categoryName = tenant.category?.name || 'Other Expenses'
        const rentPrice = typeof tenant.rent_price === 'string' 
          ? parseFloat(tenant.rent_price) 
          : (typeof tenant.rent_price === 'number' ? tenant.rent_price : 0)
        
        const currentValue = utilizationMap.get(categoryName) || 0
        utilizationMap.set(categoryName, currentValue + rentPrice)
      })

      // Convert to array format
      const utilizationArray: AssetUtilizationData[] = Array.from(utilizationMap.entries())
        .map(([category, value]) => ({ category, value }))
        .sort((a, b) => b.value - a.value) // Sort by value descending

      // If no data, set empty array
      setUtilizationData(utilizationArray.length > 0 ? utilizationArray : [])

      // Calculate financial performance data from payment logs
      const financialMap = new Map<string, { income: number; savings: number }>()
      
      // Get payment logs for all filtered tenants in parallel
      const paymentPromises = allFilteredTenants.map(async (tenant) => {
        try {
          const paymentResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, { 
            limit: 1000,
            status: 1 // Only paid payments
          })
          
          if (paymentResponse.success && paymentResponse.data) {
            const paymentData = paymentResponse.data as any
            const payments: TenantPaymentLog[] = Array.isArray(paymentData.data) 
              ? paymentData.data 
              : (Array.isArray(paymentData) ? paymentData : [])
            
            return payments
          }
          return []
        } catch (err) {
          console.error(`Error loading payments for tenant ${tenant.id}:`, err)
          return []
        }
      })
      
      const allPaymentsArrays = await Promise.all(paymentPromises)
      const allPayments = allPaymentsArrays.flat()
      
      // Process all payments
      allPayments.forEach((payment: TenantPaymentLog) => {
        if (payment.payment_date && payment.paid_amount) {
          const paymentDate = new Date(payment.payment_date)
          const year = paymentDate.getFullYear().toString()
          
          const paidAmount = typeof payment.paid_amount === 'string' 
            ? parseFloat(payment.paid_amount) 
            : (typeof payment.paid_amount === 'number' ? payment.paid_amount : 0)
          
          const current = financialMap.get(year) || { income: 0, savings: 0 }
          current.income += paidAmount
          // Calculate savings as 20% of income (adjustable)
          current.savings = current.income * 0.2
          financialMap.set(year, current)
        }
      })

      // Convert to array format and sort by year
      const financialArray: FinancialPerformanceData[] = Array.from(financialMap.entries())
        .map(([year, data]) => ({ year, income: data.income, savings: data.savings }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year))

      // If no data, set empty array
      setFinancialData(financialArray.length > 0 ? financialArray : [])

      // Load legal data
      await loadLegalData(tenantsList, filteredAssets, unitsList, selectedAssetId)

    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadLegalData = async (tenants: Tenant[], assets: Asset[], units: Unit[], assetIdFilter: string) => {
    try {
      const legalTableData: LegalTableData[] = []
      
      // Get legal documents for each tenant
      for (const tenant of tenants) {
        try {
          const legalResponse = await tenantsApi.getTenantLegals(tenant.id)
          if (legalResponse.success && legalResponse.data) {
            const legals = Array.isArray(legalResponse.data) ? legalResponse.data : []
            
            // Get tenant units - units are already included in tenant response from backend
            const tenantUnits = tenant.units && Array.isArray(tenant.units) ? tenant.units : []

            legals.forEach((legal: TenantLegal) => {
              // Get asset from unit (unit already has asset from backend, or use asset_id as fallback)
              const tenantUnit = tenantUnits[0]
              const asset = tenantUnit?.asset || (tenantUnit?.asset_id ? assets.find(a => a.id === tenantUnit.asset_id) : null)
              
              // Skip if no asset found
              if (!asset) return
              
              if (assetIdFilter === 'all' || (asset && asset.id === assetIdFilter)) {
                legalTableData.push({
                  id: legal.id,
                  nama: tenant.name || '-',
                  aset: asset?.name || '-',
                  unit: tenantUnit?.name || '-',
                  jatuhTempo: legal.due_date ? new Date(legal.due_date).toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  }) : '-',
                  kewajibanMitra: legal.description || legal.doc_type || '-',
                  progress: legal.status === 'selesai' ? 100 : 10,
                  dokumen: legal.keterangan || legal.doc_type || '-',
                  status: legal.status === 'selesai' ? 'Done' : 'On Process'
                })
              }
            })
          }
        } catch (err) {
          console.error(`Error loading legal for tenant ${tenant.id}:`, err)
        }
      }

      setLegalData(legalTableData)
    } catch (err) {
      console.error('Error loading legal data:', err)
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
        return 'Rp ' + val.toLocaleString('id-ID')
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
                return 'Rp ' + total.toLocaleString('id-ID')
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
      categories: financialData.map(d => d.year)
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
      name: 'Income',
      data: financialData.map(d => d.income)
    },
    {
      name: 'Savings',
      data: financialData.map(d => d.savings)
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
            <CardTitle>PEMANFAATAN ASET (m²)</CardTitle>
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
            <CardTitle>KINERJA KEUANGAN 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span className="text-sm">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm">Savings</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>TARGET: 8.930.000.000</p>
                <p className="mt-2">REALISASI:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Triwulan 1</li>
                  <li>Triwulan 2</li>
                  <li>Triwulan 3</li>
                  <li>Triwulan 4</li>
                </ul>
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
                  <TableHead>DOKUMEN</TableHead>
                  <TableHead>STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legalData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Tidak ada data legal
                    </TableCell>
                  </TableRow>
                ) : (
                  legalData.map((legal, index) => (
                    <TableRow key={legal.id}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>{legal.nama}</TableCell>
                      <TableCell>{legal.aset}</TableCell>
                      <TableCell>{legal.unit}</TableCell>
                      <TableCell>{legal.jatuhTempo}</TableCell>
                      <TableCell className="max-w-xs truncate">{legal.kewajibanMitra}</TableCell>
                      <TableCell>{legal.progress}%</TableCell>
                      <TableCell className="max-w-xs truncate">{legal.dokumen}</TableCell>
                      <TableCell>
                        <Badge variant={legal.status === 'Done' ? 'default' : 'secondary'}>
                          {legal.status}
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
