'use client'

import { useState } from 'react'
import AssetOverviewDashboard from "./components/asset-overview-dashboard"
import FinancialTable from "./components/financial-table"
import DailyWorkStatus from "./components/daily-work-status"
import NonRoutineWork from "./components/non-routine-work"
import ReportsObstaclesNotes from "./components/reports-obstacles-notes"
import DashboardStatCards from "./components/dashboard-stat-cards"
import AssetCarousel from "./components/asset-carousel"
import RevenueGrowthChart from "./components/revenue-growth-chart"
import TopAssetRevenueCard from "./components/top-asset-revenue-card"
import TenantKontrakTable from "./components/tenant-kontrak-table"

export default function DashboardPage() {
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all')

  return (
    <>
      {/* Asset Overview Dashboard */}
      <AssetOverviewDashboard 
        selectedAssetId={selectedAssetId}
        onAssetChange={setSelectedAssetId}
      />

      {/* Financial, Daily Work Status, Non-Routine Work, and Reports Sections */}
      <div className="space-y-6 mt-6">
        {/* Financial Table */}
        <FinancialTable selectedAssetId={selectedAssetId} />

        {/* Daily Work Status */}
        <DailyWorkStatus selectedAssetId={selectedAssetId} />

        {/* Non-Routine Work */}
        <NonRoutineWork selectedAssetId={selectedAssetId} />

        {/* Reports, Obstacles, and Notes */}
        <ReportsObstaclesNotes selectedAssetId={selectedAssetId} />
      </div>
    </>
  );
}
