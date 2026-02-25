'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Building2, Home, Users } from "lucide-react"
import { dashboardApi, DashboardStats, assetsApi, unitsApi, tenantsApi, TenantPaymentLog } from "@/lib/api"
import LoadingSkeleton from "@/components/loading-skeleton"

interface DashboardStatCardsProps {
  selectedAssetId?: string
}

export default function DashboardStatCards({ selectedAssetId = 'all' }: DashboardStatCardsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [selectedAssetId])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      // If filtering by specific asset, calculate stats manually
      if (selectedAssetId !== 'all') {
        await loadFilteredStats()
        return
      }
      
      // Otherwise use API
      const response = await dashboardApi.getDashboardStats()
      console.log('Dashboard Stats API Response (full):', JSON.stringify(response, null, 2))
      
      if (response.success && response.data) {
        // Backend returns data directly in response.data
        let statsData = response.data as any
        
        // Handle nested data structure if needed
        if (statsData && typeof statsData === 'object' && 'data' in statsData) {
          statsData = statsData.data
        }
        
        // Check if statsData has the required structure
        if (statsData && 
            typeof statsData === 'object' && 
            'totalRevenue' in statsData &&
            'totalAssets' in statsData &&
            'totalUnits' in statsData &&
            'totalTenants' in statsData) {
          console.log('Dashboard Stats Data (valid):', JSON.stringify(statsData, null, 2))
          setStats(statsData as DashboardStats)
        } else {
          console.error('Dashboard Stats Data is not valid:', JSON.stringify(statsData, null, 2))
          console.error('Expected structure: { totalRevenue, totalAssets, totalUnits, totalTenants }')
          console.error('Actual keys:', statsData ? Object.keys(statsData) : 'null')
          setStats(null)
        }
      } else {
        console.error('Dashboard Stats API Error:', response.error || response.message)
        console.error('Response:', response)
        setStats(null)
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const loadFilteredStats = async () => {
    try {
      // Load all necessary data
      const [assetsResponse, unitsResponse, tenantsResponse] = await Promise.all([
        assetsApi.getAssets({ limit: 1000 }),
        unitsApi.getUnits({ limit: 10000 }),
        tenantsApi.getTenants({ limit: 10000 })
      ])

      const assetsList = assetsResponse.success && assetsResponse.data
        ? (Array.isArray((assetsResponse.data as any).data) 
            ? (assetsResponse.data as any).data 
            : (Array.isArray(assetsResponse.data) ? assetsResponse.data : []))
        : []

      const unitsList = unitsResponse.success && unitsResponse.data
        ? (Array.isArray((unitsResponse.data as any).data) 
            ? (unitsResponse.data as any).data 
            : (Array.isArray(unitsResponse.data) ? unitsResponse.data : []))
        : []

      const tenantsList = tenantsResponse.success && tenantsResponse.data
        ? (Array.isArray((tenantsResponse.data as any).data) 
            ? (tenantsResponse.data as any).data 
            : (Array.isArray(tenantsResponse.data) ? tenantsResponse.data : []))
        : []

      // Filter by selected asset
      const filteredAssets = assetsList.filter((asset: any) => asset.id === selectedAssetId)
      const filteredUnits = unitsList.filter((unit: any) => {
        if (unit.is_deleted) return false
        const unitAssetId = unit.asset?.id || unit.asset_id
        return unitAssetId === selectedAssetId
      })

      // Get tenants for filtered units
      const filteredUnitIds = new Set(filteredUnits.map((u: any) => String(u.id)))
      const filteredTenants = tenantsList.filter((tenant: any) => {
        if (tenant.status?.toLowerCase() !== 'active') return false
        if (tenant.units && tenant.units.length > 0) {
          return tenant.units.some((u: any) => filteredUnitIds.has(String(u.id)))
        }
        if (tenant.unit_ids && tenant.unit_ids.length > 0) {
          return tenant.unit_ids.some((id: any) => filteredUnitIds.has(String(id)))
        }
        return false
      })

      // Calculate total revenue from tenant payments
      let totalRevenue = 0
      for (const tenant of filteredTenants) {
        try {
          const paymentsResponse = await tenantsApi.getTenantPaymentLogs(tenant.id, { limit: 100 })
          if (paymentsResponse.success && paymentsResponse.data) {
            const paymentsData = paymentsResponse.data as any
            const payments = Array.isArray(paymentsData.data) ? paymentsData.data : (Array.isArray(paymentsData) ? paymentsData : [])
            const paidPayments = payments.filter((p: TenantPaymentLog) => p.status === 1)
            totalRevenue += paidPayments.reduce((sum: number, p: TenantPaymentLog) => sum + (p.amount || 0), 0)
          }
        } catch (err) {
          console.error(`Error loading payments for tenant ${tenant.id}:`, err)
        }
      }

      // Format revenue
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      }

      const statsData: DashboardStats = {
        totalRevenue: {
          value: totalRevenue,
          formatted: formatCurrency(totalRevenue),
          change: '+0% vs last year',
          changeType: 'positive'
        },
        totalAssets: {
          value: filteredAssets.length,
          formatted: filteredAssets.length.toString(),
          change: '+0% vs last year',
          changeType: 'positive'
        },
        totalUnits: {
          value: filteredUnits.length,
          formatted: filteredUnits.length.toString(),
          change: '+0% vs last year',
          changeType: 'positive'
        },
        totalTenants: {
          value: filteredTenants.length,
          formatted: filteredTenants.length.toString(),
          change: '+0% vs last year',
          changeType: 'positive'
        }
      }

      setStats(statsData)
    } catch (err) {
      console.error('Error loading filtered stats:', err)
      setStats(null)
    }
  }

  if (loading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <LoadingSkeleton key={i} height="h-32" text="Loading..." />
        ))}
      </>
    )
  }

  if (!stats) {
    return null
  }

  // Safe defaults untuk menghindari undefined errors
  const safeStats = {
    totalRevenue: stats.totalRevenue || {
      value: 0,
      formatted: 'Rp 0',
      change: '+0% vs last year',
      changeType: 'positive' as const,
    },
    totalAssets: stats.totalAssets || {
      value: 0,
      formatted: '0',
      change: '+0% vs last year',
      changeType: 'positive' as const,
    },
    totalUnits: stats.totalUnits || {
      value: 0,
      formatted: '0',
      change: '+0% vs last year',
      changeType: 'positive' as const,
    },
    totalTenants: stats.totalTenants || {
      value: 0,
      formatted: '0',
      change: '+0% vs last year',
      changeType: 'positive' as const,
    },
  }

  const statCards = [
    {
      title: "Total Revenue",
      value: safeStats.totalRevenue.formatted,
      change: safeStats.totalRevenue.change,
      changeType: safeStats.totalRevenue.changeType as "positive" | "negative",
      icon: DollarSign,
    },
    {
      title: "Total Asset",
      value: safeStats.totalAssets.formatted,
      change: safeStats.totalAssets.change,
      changeType: safeStats.totalAssets.changeType as "positive" | "negative",
      icon: Building2,
    },
    {
      title: "Total Units",
      value: safeStats.totalUnits.formatted,
      change: safeStats.totalUnits.change,
      changeType: safeStats.totalUnits.changeType as "positive" | "negative",
      icon: Home,
    },
    {
      title: "Total Tenant",
      value: safeStats.totalTenants.formatted,
      change: safeStats.totalTenants.change,
      changeType: safeStats.totalTenants.changeType as "positive" | "negative",
      icon: Users,
    }
  ]

  return (
    <>
      {statCards.map((stat, index) => (
        <Card key={index} className="p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className={stat.changeType === "positive" ? "text-green-600" : "text-red-600"}>
                {stat.change}
              </span>
            </p>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
