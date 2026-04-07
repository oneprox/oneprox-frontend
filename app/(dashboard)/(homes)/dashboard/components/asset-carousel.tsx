'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { assetsApi, unitsApi, tenantsApi, Asset, Unit, Tenant } from '@/lib/api'
import { Button } from "@/components/ui/button"

interface AssetWithUnits extends Asset {
  totalUnits: number
  occupiedUnits: number
  availableUnits: number
  photoUrl?: string
}

interface AssetCarouselProps {
  selectedAssetId?: string
}

export default function AssetCarousel({ selectedAssetId = 'all' }: AssetCarouselProps) {
  const router = useRouter()
  const [assets, setAssets] = useState<AssetWithUnits[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAssetsData()
  }, [selectedAssetId])

  // Auto-play carousel every 5 seconds
  useEffect(() => {
    if (assets.length <= 1) return // Don't auto-play if only 1 or no assets
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % assets.length)
    }, 5000) // 5 seconds

    return () => clearInterval(interval)
  }, [assets.length])

  const loadAssetsData = async () => {
    try {
      setLoading(true)
      
      // Load all assets
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      if (!assetsResponse.success || !assetsResponse.data) {
        return
      }

      const responseData = assetsResponse.data as any
      const assetsList: Asset[] = Array.isArray(responseData.data) 
        ? responseData.data 
        : (Array.isArray(responseData) ? responseData : [])
      console.log('Assets List:', assetsList)

      // Load all units
      const unitsResponse = await unitsApi.getUnits({ limit: 10000 })
      const unitsList: Unit[] = unitsResponse.success && unitsResponse.data
        ? (Array.isArray((unitsResponse.data as any).data) 
            ? (unitsResponse.data as any).data 
            : (Array.isArray(unitsResponse.data) ? unitsResponse.data : []))
        : []

      // Load all tenants to get occupied units
      const tenantsResponse = await tenantsApi.getTenants({ limit: 10000 })
      const tenantsList: Tenant[] = tenantsResponse.success && tenantsResponse.data
        ? (Array.isArray((tenantsResponse.data as any).data) 
            ? (tenantsResponse.data as any).data 
            : (Array.isArray(tenantsResponse.data) ? tenantsResponse.data : []))
        : []

      // Helper function to normalize UUID for comparison
      const normalizeId = (id: any): string => {
        if (!id) return ''
        return String(id).trim().toLowerCase()
      }

      // Get all occupied unit IDs from active tenants
      const occupiedUnitIds = new Set<string>()
      const now = new Date()
      tenantsList.forEach(tenant => {
        // Check if tenant is active (contract not expired)
        const endDate = tenant.contract_end_at ? new Date(tenant.contract_end_at) : null
        if (endDate && endDate > now) {
          // First try to use populated units array
          if (tenant.units && tenant.units.length > 0) {
            tenant.units.forEach(unit => {
              if (unit && unit.id) {
                occupiedUnitIds.add(normalizeId(unit.id))
              }
            })
          } 
          // Fallback to unit_ids array
          else if (tenant.unit_ids && tenant.unit_ids.length > 0) {
            tenant.unit_ids.forEach(id => {
              if (id) {
                occupiedUnitIds.add(normalizeId(id))
              }
            })
          }
        }
      })

      // Load photos for each asset (getAsset returns photos)
      const assetsWithPhotos = await Promise.all(
        assetsList.map(async (asset) => {
          if (!asset || !asset.id) return asset
          
          try {
            const detailResponse = await assetsApi.getAsset(asset.id)
            if (detailResponse.success && detailResponse.data) {
              const detailData = detailResponse.data as any
              const assetDetail = detailData.data || detailData
              if (assetDetail.photos && assetDetail.photos.length > 0) {
                return {
                  ...asset,
                  photos: assetDetail.photos
                }
              }
            }
          } catch (err) {
            console.error(`Error loading photo for asset ${asset.id}:`, err)
          }
          
          return asset
        })
      )

      // Filter assets by selectedAssetId if needed
      let filteredAssetsWithPhotos = assetsWithPhotos
      if (selectedAssetId !== 'all') {
        filteredAssetsWithPhotos = assetsWithPhotos.filter(asset => asset.id === selectedAssetId)
      }
      
      // Process assets with unit counts
      const assetsWithUnits: AssetWithUnits[] = filteredAssetsWithPhotos.map(asset => {
        if (!asset || !asset.id) {
          return {
            ...asset,
            totalUnits: 0,
            occupiedUnits: 0,
            availableUnits: 0,
            photoUrl: undefined
          }
        }

        const assetIdNormalized = normalizeId(asset.id)
        
        // Filter units for this asset (not deleted)
        const assetUnits = unitsList.filter(unit => {
          if (!unit || unit.is_deleted) return false
          if (!unit.asset?.id) return false
          // Compare asset_id as normalized string to handle UUID comparison
          const unitAssetIdNormalized = normalizeId(unit.asset?.id)
          return unitAssetIdNormalized === assetIdNormalized
        })
        
        const totalUnits = assetUnits.length
       
        // Count occupied units by checking if unit.id is in occupiedUnitIds
        const occupiedUnits = assetUnits.filter(unit => {
          if (!unit || !unit.id) return false
          const unitIdStr = normalizeId(unit.id)
          return occupiedUnitIds.has(unitIdStr)
        }).length
        
        const availableUnits = Math.max(0, totalUnits - occupiedUnits)

        // Get first photo as background (only 1 photo)
        let photoUrl: string | undefined = undefined
        if (asset.photos && asset.photos.length > 0) {
          const firstPhoto = asset.photos[0]
          // Ensure URL is properly formatted
          if (firstPhoto) {
            photoUrl = firstPhoto.startsWith('http') || firstPhoto.startsWith('/') 
              ? firstPhoto 
              : `/${firstPhoto}`
          }
        }

        return {
          ...asset,
          totalUnits,
          occupiedUnits,
          availableUnits,
          photoUrl
        }
      })
      
      // Debug log - verify data for current asset
      console.log('Asset Carousel Data:', {
        totalAssets: assetsWithUnits.length,
        totalOccupiedUnitIds: occupiedUnitIds.size,
        assets: assetsWithUnits.map(asset => ({
          id: asset.id,
          name: asset.name,
          totalUnits: asset.totalUnits,
          occupiedUnits: asset.occupiedUnits,
          availableUnits: asset.availableUnits,
          photoUrl: asset.photoUrl,
          photos: asset.photos
        }))
      })

      setAssets(assetsWithUnits)
    } catch (err) {
      console.error('Error loading assets data:', err)
    } finally {
      setLoading(false)
    }
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % assets.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + assets.length) % assets.length)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const handleAssetClick = (assetId: string | number) => {
    router.push(`/asset/view/${assetId}`)
  }

  if (loading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-gray-500">Memuat data asset...</div>
      </Card>
    )
  }

  if (assets.length === 0) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-gray-500">Tidak ada data asset</div>
      </Card>
    )
  }

  const currentAsset = assets[currentIndex]

  return (
    <Card 
      className="relative h-[400px] overflow-hidden rounded-lg cursor-pointer"
      onClick={() => handleAssetClick(currentAsset.id)}
    >
      {/* Background Image */}
      <div className="absolute inset-0 bg-gray-300 overflow-hidden">
        {currentAsset.photoUrl ? (
          <>
            <img
              src={currentAsset.photoUrl}
              alt={currentAsset.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Hide image on error, show gray background
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            {/* Overlay untuk readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-6 text-white">
        {/* Top Section - Asset Name and Location */}
        <div>
          <h3 className="text-2xl text-white font-bold mb-2">{currentAsset.name}</h3>
          <p className="text-sm text-white/90">{currentAsset.address}</p>
        </div>

        {/* Bottom Section - Unit Info */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-sm">
              <span className="font-semibold">Total Unit: </span>
              <span>{currentAsset.totalUnits}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-green-300">Terisi: </span>
              <span className="text-green-300">{currentAsset.occupiedUnits}</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-red-300">Kosong: </span>
              <span className="text-red-300">{currentAsset.availableUnits}</span>
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mb-4">
            {assets.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  goToSlide(index)
                }}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white w-8' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {assets.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={(e) => {
              e.stopPropagation()
              prevSlide()
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={(e) => {
              e.stopPropagation()
              nextSlide()
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}
    </Card>
  )
}
