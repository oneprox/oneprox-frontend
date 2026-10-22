'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Building2, Loader2 } from "lucide-react"
import { assetsApi, Asset } from "@/lib/api"
import LoadingSkeleton from "@/components/loading-skeleton"
import Link from "next/link"

export default function AssetTableCard() {
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const handleAssetClick = (assetId: string | number) => {
    router.push(`/asset/view/${assetId}`)
  }

  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const response = await assetsApi.getAssets({ limit: 10 })
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        const data = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setAssets(data)
      }
    } catch (err) {
      console.error('Error loading assets:', err)
      setAssets([])
    } finally {
      setLoading(false)
    }
  }

  // Get unit count from asset (if available)
  const getUnitCount = (asset: Asset) => {
    return (asset as any).total_units || 0
  }

  if (loading) {
    return (
      <Card className="p-6 h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-700">
            Asset
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-700">
          Asset
        </CardTitle>
        <Link href="/asset">
          <span className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
            Lihat Semua &gt;
          </span>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {assets.length > 0 ? (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold text-gray-700 w-[40%]">Nama Asset</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 w-[30%]">Luas Area</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 w-[30%]">Jumlah Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const area = typeof asset.area === 'string' ? parseFloat(asset.area) : (typeof asset.area === 'number' ? asset.area : 0)
                    const unitCount = getUnitCount(asset)
                    
                    return (
                      <TableRow 
                        key={asset.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleAssetClick(asset.id)}
                      >
                        <TableCell className="font-medium text-sm text-gray-900 max-w-[150px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-help">
                                {asset.name || '-'}
                              </div>
                            </TooltipTrigger>
                            {asset.name && asset.name.length > 20 && (
                              <TooltipContent>
                                <p>{asset.name}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {area ? `${area.toLocaleString('id-ID')} m²` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {unitCount || 0}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
            <div>
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data asset</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

