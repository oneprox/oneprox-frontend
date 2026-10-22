'use client'

import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Section dashboard. `overview` = ringkasan (KPI, grafik, status pekerjaan).
 * Semua aset: finance · operation · legal · reports.
 * Satu aset: finance-legal · operation · asset · reports.
 */
export type DashboardSection =
  | 'overview'
  | 'finance'
  | 'legal'
  | 'finance-legal'
  | 'operation'
  | 'asset'
  | 'reports'

interface SectionButton {
  key: Exclude<DashboardSection, 'overview'>
  label: string
  color: string
}

const ALL_ASSETS_SECTIONS: SectionButton[] = [
  { key: 'finance', label: 'Finance', color: '#F97316' },
  { key: 'operation', label: 'Operation', color: '#8B5CF6' },
  { key: 'legal', label: 'Legal', color: '#0F766E' },
  { key: 'reports', label: 'Laporan Kendala & Catatan', color: '#1F2937' },
]

const SINGLE_ASSET_SECTIONS: SectionButton[] = [
  { key: 'finance-legal', label: 'Finance & Legal', color: '#F97316' },
  { key: 'operation', label: 'Operation', color: '#8B5CF6' },
  { key: 'asset', label: 'Detail Asset', color: '#0F766E' },
  { key: 'reports', label: 'Laporan Kendala & Catatan', color: '#1F2937' },
]

const ALL_SECTION_KEYS: DashboardSection[] = [
  'overview',
  'finance',
  'legal',
  'finance-legal',
  'operation',
  'asset',
  'reports',
]

export function parseDashboardSection(value: string | null): DashboardSection {
  return ALL_SECTION_KEYS.includes(value as DashboardSection) ? (value as DashboardSection) : 'overview'
}

/** Sesuaikan section dengan cakupan aset (mis. Finance/Legal ↔ Finance & Legal, Detail Asset hanya untuk satu aset). */
export function normalizeDashboardSection(section: DashboardSection, isAllAssets: boolean): DashboardSection {
  if (isAllAssets) {
    if (section === 'finance-legal') return 'finance'
    if (section === 'asset') return 'overview'
    return section
  }
  if (section === 'finance' || section === 'legal') return 'finance-legal'
  return section
}

interface DashboardSectionNavProps {
  isAllAssets: boolean
  activeSection: DashboardSection
  onSectionChange: (section: DashboardSection) => void
}

export default function DashboardSectionNav({ isAllAssets, activeSection, onSectionChange }: DashboardSectionNavProps) {
  const sections = isAllAssets ? ALL_ASSETS_SECTIONS : SINGLE_ASSET_SECTIONS
  const isOverview = activeSection === 'overview'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
        {sections.map((section) => {
          const isActive = activeSection === section.key
          return (
            <button
              key={section.key}
              type="button"
              aria-pressed={isActive}
              // Klik section yang sedang aktif = kembali ke ringkasan
              onClick={() => onSectionChange(isActive ? 'overview' : section.key)}
              className={cn(
                'flex min-h-16 items-center justify-center rounded-2xl px-4 py-4 text-center text-lg font-medium text-white shadow-md transition-all md:min-h-20 md:text-2xl',
                'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400',
                !isOverview && !isActive && 'opacity-55 hover:opacity-90',
                isActive && 'ring-4 ring-offset-2 ring-slate-300'
              )}
              style={{ background: section.color }}
            >
              {section.label}
            </button>
          )
        })}
      </div>
      {!isOverview ? (
        <button
          type="button"
          onClick={() => onSectionChange('overview')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke ringkasan
        </button>
      ) : null}
    </div>
  )
}
