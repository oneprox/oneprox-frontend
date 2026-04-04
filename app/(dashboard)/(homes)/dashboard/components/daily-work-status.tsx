'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Check, Circle, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { assetsApi, userTasksApi, type Asset, type UserTask } from '@/lib/api'
import LoadingSkeleton from '@/components/loading-skeleton'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const PROGRESS = '#345e6f'
const TRACK = '#f0f2f5'
const DONUT_TRACK = '#e8ecf0'

const PATROL_TIME_SLOTS = ['08:00', '13:00', '17:00', '20:00', '22:00', '04:00'] as const

interface DailyWorkStatusProps {
  selectedAssetId?: string
}

function normalizeUserTasksPayload(payload: unknown): UserTask[] {
  if (Array.isArray(payload)) return payload as UserTask[]
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const inner = (payload as { data: unknown }).data
    if (Array.isArray(inner)) return inner as UserTask[]
  }
  return []
}

function flattenUserTasks(tasks: UserTask[]): UserTask[] {
  return tasks.flatMap((t) => [t, ...(t.sub_user_task || [])])
}

function getRoleName(ut: UserTask): string {
  return (ut.task?.role?.name || '').toLowerCase().trim()
}

function isKebersihan(ut: UserTask): boolean {
  return getRoleName(ut) === 'kebersihan'
}

function isKeamanan(ut: UserTask): boolean {
  return getRoleName(ut) === 'keamanan'
}

function isCompleted(ut: UserTask): boolean {
  const s = (ut.status || '').toLowerCase()
  return s === 'completed' || !!ut.completed_at
}

function isInProgress(ut: UserTask): boolean {
  const s = (ut.status || '').toLowerCase()
  return s === 'inprogress' || s === 'in_progress' || (!!ut.started_at && !ut.completed_at)
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Map jam dari scheduled_at ke indeks slot patroli */
function slotIndexFromUserTask(ut: UserTask): number {
  const raw = ut.scheduled_at || ut.start_at || ut.created_at
  if (!raw) return -1
  const h = new Date(raw).getHours()
  const map: Record<number, number> = { 8: 0, 13: 1, 17: 2, 20: 3, 22: 4, 4: 5, 0: 5 }
  return map[h] ?? -1
}

type CellStatus = 'selesai' | 'terlewat' | 'proses' | 'belum'

function cellStatusForPatrol(ut: UserTask | undefined): CellStatus {
  if (!ut) return 'belum'
  if (isCompleted(ut)) return 'selesai'
  if (isInProgress(ut)) return 'proses'
  const deadline = ut.scheduled_at ? new Date(ut.scheduled_at) : null
  if (deadline && deadline < new Date() && !isCompleted(ut)) return 'terlewat'
  return 'belum'
}

function cleaningStatusLabel(ut: UserTask): { label: string; className: string } {
  if (isCompleted(ut)) {
    return {
      label: 'Selesai',
      className: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
    }
  }
  if (isInProgress(ut)) {
    return {
      label: 'Proses',
      className: 'border border-amber-200 bg-amber-50 text-amber-800',
    }
  }
  return {
    label: 'Tidak Selesai',
    className: 'border border-red-200 bg-red-50 text-red-800',
  }
}

function radialOptions(percentage: number): ApexOptions {
  const pct = Math.min(100, Math.max(0, Math.round(percentage)))
  return {
    chart: { type: 'radialBar', sparkline: { enabled: true }, toolbar: { show: false } },
    plotOptions: {
      radialBar: {
        hollow: { size: '65%' },
        track: { background: TRACK, strokeWidth: '100%' },
        dataLabels: {
          show: true,
          name: { show: false },
          value: {
            fontSize: '18px',
            fontWeight: 700,
            color: '#0f172a',
            offsetY: 6,
            formatter: () => `${pct}%`,
          },
        },
      },
    },
    colors: [PROGRESS],
    stroke: { lineCap: 'round' },
  }
}

function donutOptions(label: string, percentage: number): ApexOptions {
  const pct = Math.min(100, Math.max(0, Math.round(percentage)))
  return {
    chart: { type: 'donut', toolbar: { show: false } },
    labels: [label, 'Sisa'],
    colors: [PROGRESS, DONUT_TRACK],
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: { show: true, offsetY: 20, color: '#64748b', fontSize: '11px', fontWeight: 600 },
            value: {
              show: true,
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a',
              formatter: () => `${pct}%`,
            },
            total: {
              show: false,
            },
          },
        },
      },
    },
    legend: { show: false },
  }
}

export default function DailyWorkStatus({ selectedAssetId = 'all' }: DailyWorkStatusProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [tasksToday, setTasksToday] = useState<UserTask[]>([])
  const [tasksMonth, setTasksMonth] = useState<UserTask[]>([])
  const [loading, setLoading] = useState(true)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const monthRange = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return { start, end }
  }, [today])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const todayStr = dateKey(today)
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      const monthToStr = dateKey(lastDayOfMonth)

      const [assetsRes, dayRes, monthRes] = await Promise.all([
        assetsApi.getAssets({ limit: 1000 }),
        userTasksApi.getUserTasks({ date_from: todayStr, date_to: todayStr, limit: 10000 }),
        userTasksApi.getUserTasks({
          date_from: dateKey(monthRange.start),
          date_to: monthToStr,
          limit: 10000,
        }),
      ])

      if (assetsRes.success && assetsRes.data) {
        const rd = assetsRes.data as unknown
        const list: Asset[] = Array.isArray(rd)
          ? (rd as Asset[])
          : rd && typeof rd === 'object' && Array.isArray((rd as { data: Asset[] }).data)
            ? (rd as { data: Asset[] }).data
            : []
        setAssets(list)
      } else {
        setAssets([])
      }

      setTasksToday(dayRes.success && dayRes.data != null ? normalizeUserTasksPayload(dayRes.data) : [])
      setTasksMonth(monthRes.success && monthRes.data != null ? normalizeUserTasksPayload(monthRes.data) : [])
    } catch (e) {
      console.error('DailyWorkStatus load error:', e)
      setTasksToday([])
      setTasksMonth([])
    } finally {
      setLoading(false)
    }
  }, [today, monthRange.start, monthRange.end])

  useEffect(() => {
    loadData()
  }, [loadData, selectedAssetId])

  const flatToday = useMemo(() => flattenUserTasks(tasksToday), [tasksToday])
  const flatMonth = useMemo(() => flattenUserTasks(tasksMonth), [tasksMonth])

  const tasksForAssetToday = useMemo(() => {
    if (selectedAssetId === 'all') return flatToday
    return flatToday.filter((ut) => ut.task?.asset_id === selectedAssetId)
  }, [flatToday, selectedAssetId])

  const tasksForAssetMonth = useMemo(() => {
    if (selectedAssetId === 'all') return flatMonth
    return flatMonth.filter((ut) => ut.task?.asset_id === selectedAssetId)
  }, [flatMonth, selectedAssetId])

  /** Ring per aset — semua aset, persen dari tugas hari ini (user login) */
  const allAssetsRings = useMemo(() => {
    const map = new Map<string, { total: number; done: number; name: string }>()
    assets.forEach((a) => map.set(a.id, { total: 0, done: 0, name: a.name }))

    flatToday.forEach((ut) => {
      const aid = ut.task?.asset_id
      if (!aid) return
      if (!map.has(aid)) map.set(aid, { total: 0, done: 0, name: ut.task?.asset?.name || aid })
      const row = map.get(aid)!
      row.total++
      if (isCompleted(ut)) row.done++
    })

    return [...map.entries()]
      .map(([assetId, v]) => ({
        assetId,
        assetName: v.name,
        completionPercentage: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      }))
      .sort((a, b) => a.assetName.localeCompare(b.assetName, 'id'))
  }, [assets, flatToday])

  const kebersihanToday = useMemo(
    () => tasksForAssetToday.filter((ut) => isKebersihan(ut)),
    [tasksForAssetToday]
  )
  const keamananToday = useMemo(
    () => tasksForAssetToday.filter((ut) => isKeamanan(ut)),
    [tasksForAssetToday]
  )

  const completionRate = (list: UserTask[]) => {
    if (list.length === 0) return 0
    const done = list.filter(isCompleted).length
    return Math.round((done / list.length) * 100)
  }

  const kebersihanMonthList = useMemo(
    () => tasksForAssetMonth.filter((ut) => isKebersihan(ut)),
    [tasksForAssetMonth]
  )
  const keamananMonthList = useMemo(
    () => tasksForAssetMonth.filter((ut) => isKeamanan(ut)),
    [tasksForAssetMonth]
  )

  const pctHarianKebersihan = completionRate(kebersihanToday)
  const pctHarianKeamanan = completionRate(keamananToday)
  const pctBulananKebersihan = completionRate(kebersihanMonthList)
  const pctBulananKeamanan = completionRate(keamananMonthList)

  /** Baris patroli: grup per nama tugas induk */
  const patrolMatrix = useMemo(() => {
    const byTask = new Map<string, UserTask[]>()
    keamananToday.forEach((ut) => {
      const name = ut.task?.name || `Titik ${ut.task_id}`
      if (!byTask.has(name)) byTask.set(name, [])
      byTask.get(name)!.push(ut)
    })
    const rows = [...byTask.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id')).slice(0, 12)
    return rows.map(([titik, list], idx) => {
      const cells = PATROL_TIME_SLOTS.map((_, col) => {
        const ut = list.find((u) => slotIndexFromUserTask(u) === col)
        return { ut, status: cellStatusForPatrol(ut) }
      })
      return { key: `${titik}-${idx}`, titik: titik || `Titik ${idx + 1}`, cells }
    })
  }, [keamananToday])

  const PatrolIcon = ({ status }: { status: CellStatus }) => {
    if (status === 'selesai') {
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )
    }
    if (status === 'terlewat') {
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="h-4 w-4" strokeWidth={3} />
        </span>
      )
    }
    if (status === 'proses') {
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )
    }
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300">
        <Circle className="h-3 w-3" />
      </span>
    )
  }

  if (loading) {
    return <LoadingSkeleton height="h-64" text="Memuat status pekerjaan harian..." />
  }

  /* ---------- Tampilan semua aset: grid radial ---------- */
  if (selectedAssetId === 'all') {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold tracking-tight text-slate-900">
            Status Pekerjaan Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allAssetsRings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data aset atau tugas hari ini.</p>
          ) : (
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {allAssetsRings.map((row) => (
                <div key={row.assetId} className="flex flex-col items-center gap-2">
                  <Chart
                    options={radialOptions(row.completionPercentage)}
                    series={[row.completionPercentage]}
                    type="radialBar"
                    height={160}
                  />
                  <p className="max-w-[11rem] text-center text-xs font-medium leading-snug text-slate-800 md:max-w-none">
                    {row.assetName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  /* ---------- Satu aset: 2×2 detail ---------- */
  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Aset: <span className="font-semibold text-slate-800">{selectedAsset?.name || selectedAssetId}</span>
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Progress Harian Kebersihan</CardTitle>
            <CardDescription>Pantau pencapaian pekerjaan kebersihan</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-[10px] font-semibold uppercase text-slate-500">No</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-slate-500">Pekerjaan</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-slate-500">Status</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-slate-500">Hasil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kebersihanToday.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada tugas kebersihan hari ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  kebersihanToday.map((ut, i) => {
                    const st = cleaningStatusLabel(ut)
                    const ev = ut.evidences
                    const beforeUrl = Array.isArray(ev) && ev[0]?.url ? String(ev[0].url) : null
                    const afterUrl = Array.isArray(ev) && ev[1]?.url ? String(ev[1].url) : null
                    return (
                      <TableRow key={ut.user_task_id ?? ut.id ?? i}>
                        <TableCell className="text-slate-600">{i + 1}</TableCell>
                        <TableCell className="max-w-[220px] text-sm text-slate-800">
                          {ut.task?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={!beforeUrl}
                              className={
                                beforeUrl
                                  ? 'h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700'
                                  : 'h-7 bg-blue-50 px-2 text-xs text-blue-300'
                              }
                              asChild={!!beforeUrl}
                            >
                              {beforeUrl ? (
                                <a href={beforeUrl} target="_blank" rel="noopener noreferrer">
                                  Before
                                </a>
                              ) : (
                                <span>Before</span>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={!afterUrl}
                              className={
                                afterUrl
                                  ? 'h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700'
                                  : 'h-7 bg-blue-50 px-2 text-xs text-blue-300'
                              }
                              asChild={!!afterUrl}
                            >
                              {afterUrl ? (
                                <a href={afterUrl} target="_blank" rel="noopener noreferrer">
                                  After
                                </a>
                              ) : (
                                <span>After</span>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Progress Harian Keamanan</CardTitle>
            <CardDescription>Pantau pencapaian pekerjaan keamanan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-[10px] font-semibold uppercase text-slate-500">No</TableHead>
                    <TableHead className="min-w-[100px] text-[10px] font-semibold uppercase text-slate-500">
                      Titik patroli
                    </TableHead>
                    {PATROL_TIME_SLOTS.map((t) => (
                      <TableHead key={t} className="whitespace-nowrap text-center text-[10px] font-semibold uppercase text-slate-500">
                        {t}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patrolMatrix.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Tidak ada tugas keamanan hari ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    patrolMatrix.map((row, idx) => (
                      <TableRow key={row.key}>
                        <TableCell className="text-slate-600">{idx + 1}</TableCell>
                        <TableCell className="max-w-[140px] text-sm text-slate-800">{row.titik}</TableCell>
                        {row.cells.map((c, j) => (
                          <TableCell key={j} className="text-center">
                            <div className="flex justify-center">
                              <PatrolIcon status={c.status} />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                Selesai
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
                Terlewat
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
                Dalam proses
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-200 bg-white" />
                Belum dijalankan
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Status Pekerjaan Kebersihan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <Chart
                  options={{ ...donutOptions('Harian', pctHarianKebersihan), labels: ['Harian', 'Sisa'] }}
                  series={[pctHarianKebersihan, 100 - pctHarianKebersihan]}
                  type="donut"
                  height={200}
                />
                <p className="-mt-2 text-xs font-semibold text-slate-600">Harian</p>
              </div>
              <div className="flex flex-col items-center">
                <Chart
                  options={{ ...donutOptions('Bulanan', pctBulananKebersihan), labels: ['Bulanan', 'Sisa'] }}
                  series={[pctBulananKebersihan, 100 - pctBulananKebersihan]}
                  type="donut"
                  height={200}
                />
                <p className="-mt-2 text-xs font-semibold text-slate-600">Bulanan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Status Pekerjaan Keamanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <Chart
                  options={{ ...donutOptions('Harian', pctHarianKeamanan), labels: ['Harian', 'Sisa'] }}
                  series={[pctHarianKeamanan, 100 - pctHarianKeamanan]}
                  type="donut"
                  height={200}
                />
                <p className="-mt-2 text-xs font-semibold text-slate-600">Harian</p>
              </div>
              <div className="flex flex-col items-center">
                <Chart
                  options={{ ...donutOptions('Bulanan', pctBulananKeamanan), labels: ['Bulanan', 'Sisa'] }}
                  series={[pctBulananKeamanan, 100 - pctBulananKeamanan]}
                  type="donut"
                  height={200}
                />
                <p className="-mt-2 text-xs font-semibold text-slate-600">Bulanan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
