'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, Loader2 } from "lucide-react"
import { dashboardApi, TopAssetRevenue, assetsApi } from "@/lib/api"
import LoadingSkeleton from "@/components/loading-skeleton"

interface TopAssetRevenueCardProps {
  selectedAssetId?: string
}

export default function TopAssetRevenueCard({ selectedAssetId = 'all' }: TopAssetRevenueCardProps) {
  const [topAssets, setTopAssets] = useState<TopAssetRevenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTopAssets()
  }, [selectedAssetId])

  const loadTopAssets = async () => {
    try {
      setLoading(true)
      const response = await dashboardApi.getTopAssetRevenue()
      
      if (response.success && response.data) {
        // Backend returns array directly in response.data
        let data = Array.isArray(response.data) ? response.data : []
        
        // Filter by selected asset if needed
        if (selectedAssetId !== 'all') {
          // Get asset name to filter by name (since TopAssetRevenue doesn't have id)
          try {
            const assetResponse = await assetsApi.getAsset(selectedAssetId)
            if (assetResponse.success && assetResponse.data) {
              const assetData = assetResponse.data as any
              const asset = assetData.data || assetData
              const assetName = asset.name
              // Filter to show only the selected asset by name
              data = data.filter((item: TopAssetRevenue) => item.name === assetName)
            } else {
              // If asset not found, show empty
              data = []
            }
          } catch (err) {
            console.error('Error loading asset for filtering:', err)
            data = []
          }
        }
        
        setTopAssets(data)
      } else {
        console.error('Top Asset Revenue API Error:', response.error || response.message)
        setTopAssets([])
      }
    } catch (err) {
      console.error('Error loading top asset revenue:', err)
      setTopAssets([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-700">
            Top Asset Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <LoadingSkeleton height="h-64" text="Memuat data..." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-6 h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-700">
          Top Asset Revenue
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {topAssets.length > 0 ? (
          <>
            <div className="space-y-4 flex-1">
              {topAssets.map((asset, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Home className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {asset.name}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {asset.formatted}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
            <div>
              <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data asset revenue</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
