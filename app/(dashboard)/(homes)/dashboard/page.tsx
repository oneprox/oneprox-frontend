'use client'

import { Suspense, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import AssetOverviewDashboard from "./components/asset-overview-dashboard"
import DailyWorkStatus from "./components/daily-work-status"
import OperationSection from "./components/operation-section"
import ReportsObstaclesNotes from "./components/reports-obstacles-notes"
import AssetDetailContent from "@/components/asset/asset-detail-content"
import {
  normalizeDashboardSection,
  parseDashboardSection,
  type DashboardSection,
} from "./components/dashboard-section-nav"

function DashboardContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Aset & section disimpan di URL (?asset=..&section=..) agar bertahan saat refresh / dibagikan.
  const selectedAssetId = searchParams.get('asset') || 'all'
  const isAllAssets = selectedAssetId === 'all'
  const section = normalizeDashboardSection(parseDashboardSection(searchParams.get('section')), isAllAssets)

  const updateUrl = useCallback(
    (assetId: string, nextSection: DashboardSection) => {
      const params = new URLSearchParams(searchParams.toString())
      if (assetId === 'all') params.delete('asset')
      else params.set('asset', assetId)
      const normalized = normalizeDashboardSection(nextSection, assetId === 'all')
      if (normalized === 'overview') params.delete('section')
      else params.set('section', normalized)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleSectionChange = (nextSection: DashboardSection) => {
    updateUrl(selectedAssetId, nextSection)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {/* Header aset, tombol section, dan konten Ringkasan / Finance / Legal */}
      <AssetOverviewDashboard
        selectedAssetId={selectedAssetId}
        onAssetChange={(assetId) => updateUrl(assetId, section)}
        section={section}
        onSectionChange={handleSectionChange}
      />

      <div className="space-y-6 mt-6">
        {section === 'overview' ? (
          <DailyWorkStatus selectedAssetId={selectedAssetId} variant="summary" />
        ) : null}

        {section === 'operation' ? <OperationSection selectedAssetId={selectedAssetId} /> : null}

        {section === 'asset' && !isAllAssets ? (
          <AssetDetailContent key={selectedAssetId} assetId={selectedAssetId} />
        ) : null}

        {section === 'reports' ? <ReportsObstaclesNotes selectedAssetId={selectedAssetId} /> : null}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
