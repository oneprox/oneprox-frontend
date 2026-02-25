'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { assetsApi, userTasksApi, Asset, UserTask } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface AssetWorkStatus {
  assetId: string
  assetName: string
  completionPercentage: number
}

interface DailyWorkStatusProps {
  selectedAssetId?: string
}

export default function DailyWorkStatus({ selectedAssetId = 'all' }: DailyWorkStatusProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [workStatus, setWorkStatus] = useState<AssetWorkStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [selectedAssetId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load assets
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      if (!assetsResponse.success || !assetsResponse.data) {
        return
      }

      const assetsList: Asset[] = Array.isArray(assetsResponse.data) ? assetsResponse.data : []
      setAssets(assetsList)

      // Load user tasks for today
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      
      const tasksResponse = await userTasksApi.getUserTasks({
        date_from: dateStr,
        date_to: dateStr,
        limit: 10000
      })

      if (!tasksResponse.success || !tasksResponse.data) {
        return
      }

      const tasksList: UserTask[] = Array.isArray(tasksResponse.data) ? tasksResponse.data : []

      // Filter assets by selected asset
      let filteredAssets = assetsList
      if (selectedAssetId !== 'all') {
        filteredAssets = assetsList.filter(a => a.id === selectedAssetId)
      }

      // Calculate completion per asset
      const assetStatusMap = new Map<string, { total: number; completed: number }>()

      // Initialize filtered assets only
      filteredAssets.forEach(asset => {
        assetStatusMap.set(asset.id, { total: 0, completed: 0 })
      })

      // Process tasks
      tasksList.forEach(task => {
        if (task.task && task.task.asset_id) {
          const assetId = task.task.asset_id
          const status = assetStatusMap.get(assetId)
          
          if (status) {
            status.total++
            if (task.status === 'completed' || task.completed_at) {
              status.completed++
            }
          }
        }
      })

      // Calculate percentages
      const statusList: AssetWorkStatus[] = []
      assetStatusMap.forEach((status, assetId) => {
        const asset = assetsList.find(a => a.id === assetId)
        if (asset) {
          const percentage = status.total > 0 
            ? Math.round((status.completed / status.total) * 100) 
            : 0
          statusList.push({
            assetId,
            assetName: asset.name,
            completionPercentage: percentage
          })
        }
      })

      // Sort by name and take top 4
      statusList.sort((a, b) => a.assetName.localeCompare(b.assetName))
      setWorkStatus(statusList.slice(0, 4))
    } catch (err) {
      console.error('Error loading daily work status:', err)
    } finally {
      setLoading(false)
    }
  }

  const getChartOptions = (percentage: number): ApexOptions => ({
    chart: {
      type: 'donut',
      height: 200
    },
    labels: ['Completed', 'Pending'],
    colors: ['#8B5CF6', '#E5E7EB'],
    dataLabels: {
      enabled: false
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
                return percentage + '%'
              },
              fontSize: '20px',
              fontWeight: 600
            }
          }
        }
      }
    },
    legend: {
      show: false
    }
  })

  const getChartSeries = (percentage: number) => [percentage, 100 - percentage]

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat status pekerjaan harian..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>STATUS PEKERJAAN HARIAN</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workStatus.length === 0 ? (
            <div className="col-span-4 text-center py-8 text-muted-foreground">
              Tidak ada data pekerjaan harian
            </div>
          ) : (
            workStatus.map((status) => (
              <div key={status.assetId} className="flex flex-col items-center">
                <Chart
                  options={getChartOptions(status.completionPercentage)}
                  series={getChartSeries(status.completionPercentage)}
                  type="donut"
                  height={200}
                />
                <p className="mt-2 text-sm font-medium text-center">{status.assetName}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
