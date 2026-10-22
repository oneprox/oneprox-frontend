'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Home, Boxes, Eye } from 'lucide-react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import AssetDetailContent from '@/components/asset/asset-detail-content'

export default function AssetViewPage() {
  const params = useParams()
  const router = useRouter()
  const assetId = params.id as string
  const [assetName, setAssetName] = useState('')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/asset" className="flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Asset
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Detail{assetName ? `: ${assetName}` : ''}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AssetDetailContent
        assetId={assetId}
        onAssetLoaded={(asset) => setAssetName(asset.name)}
        onLoadError={() => router.push('/asset')}
      />
    </div>
  )
}
