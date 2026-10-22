'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DailyWorkStatus, { dateKey } from './daily-work-status'
import DataPekerja from './data-pekerja'
import NonRoutineWork from './non-routine-work'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const YEAR_RANGE = 5

interface OperationSectionProps {
  selectedAssetId?: string
}

function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return { year: y, month: m, day: d }
}

function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Section Operation: filter tanggal, progress harian, status pekerjaan, data pekerja, pekerjaan non rutin. */
export default function OperationSection({ selectedAssetId = 'all' }: OperationSectionProps) {
  const todayKey = dateKey(new Date())
  const [dayKey, setDayKey] = useState(todayKey)
  const { year, month, day } = parseDayKey(dayKey)
  const { year: currentYear } = parseDayKey(todayKey)

  /** Ganti salah satu bagian tanggal; hari di-clamp ke jumlah hari bulan tersebut. */
  const updateDate = (next: Partial<{ year: number; month: number; day: number }>) => {
    const y = next.year ?? year
    const m = next.month ?? month
    const d = Math.min(next.day ?? day, daysInMonth(y, m))
    setDayKey(toDayKey(y, m, d))
  }

  const dayLabel = new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const years = Array.from({ length: YEAR_RANGE }, (_, i) => currentYear - (YEAR_RANGE - 1) + i)

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200 py-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-semibold text-slate-900">Info Tanggal / Hari</p>
            <p className="text-sm text-slate-500">{dayLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(day)} onValueChange={(v) => updateDate({ day: Number(v) })}>
              <SelectTrigger className="w-[110px]" aria-label="Tanggal">
                <SelectValue placeholder="Tanggal" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(month)} onValueChange={(v) => updateDate({ month: Number(v) })}>
              <SelectTrigger className="w-[150px]" aria-label="Bulan">
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => updateDate({ year: Number(v) })}>
              <SelectTrigger className="w-[110px]" aria-label="Tahun">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDayKey(todayKey)}
              disabled={dayKey === todayKey}
            >
              Hari ini
            </Button>
          </div>
        </CardContent>
      </Card>

      <DailyWorkStatus selectedAssetId={selectedAssetId} dayDate={dayKey} variant="full" />

      <DataPekerja selectedAssetId={selectedAssetId} />

      <NonRoutineWork selectedAssetId={selectedAssetId} />
    </div>
  )
}
