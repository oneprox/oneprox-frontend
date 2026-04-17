'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ApexOptions } from 'apexcharts'
import { Check, ChevronDown, ChevronRight, Circle, CornerDownRight, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

function getTaskAssetId(ut: UserTask): string {
  return String(ut.task?.asset_id || ut.task?.asset?.id || '')
}

function getTaskGroupName(ut: UserTask): string {
  const t = ut.task as (UserTask['task'] & { taskGroup?: { name?: string } }) | undefined
  return (t?.task_group?.name || t?.taskGroup?.name || '').toLowerCase()
}

function isKebersihan(ut: UserTask): boolean {
  const role = getRoleName(ut)
  if (role.includes('kebersihan') || role.includes('cleaning')) return true
  const tg = getTaskGroupName(ut)
  if (tg.includes('kebersihan') || tg.includes('cleaning')) return true
  const tn = (ut.task?.name || '').toLowerCase()
  if (tn.includes('kebersihan') || tn.includes('cleaning')) return true
  return false
}

function isKeamanan(ut: UserTask): boolean {
  const role = getRoleName(ut)
  if (role.includes('keamanan') || role.includes('security')) return true
  const tg = getTaskGroupName(ut)
  if (tg.includes('keamanan') || tg.includes('security') || tg.includes('patrol')) return true
  const tn = (ut.task?.name || '').toLowerCase()
  if (tn.includes('keamanan') || tn.includes('security') || tn.includes('patrol')) return true
  return false
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
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

/** Status tampilan dari field `user_tasks.status` (bukan inferensi terpisah). */
function userTaskStatusDisplay(ut: UserTask): { label: string; className: string } {
  const raw = (ut.status != null ? String(ut.status) : '').toLowerCase().trim()
  if (raw === 'completed') {
    return { label: 'Selesai', className: 'border border-emerald-200 bg-emerald-50 text-emerald-800' }
  }
  if (raw === 'in_progress' || raw === 'inprogress') {
    return { label: 'Dalam proses', className: 'border border-amber-200 bg-amber-50 text-amber-800' }
  }
  if (raw === 'cancelled') {
    return { label: 'Dibatalkan', className: 'border border-slate-200 bg-slate-100 text-slate-700' }
  }
  if (raw === 'pending' || raw === '') {
    return { label: 'Menunggu', className: 'border border-slate-200 bg-white text-slate-600' }
  }
  return {
    label: ut.status != null ? String(ut.status) : '—',
    className: 'border border-slate-200 bg-slate-50 text-slate-700',
  }
}

/** Daftar bukti dari `user_tasks.evidences` untuk kolom Hasil. */
function getEvidenceEntries(ut: UserTask): { key: string; href: string | null; label: string; isText: boolean }[] {
  const ev = ut.evidences
  if (!Array.isArray(ev) || ev.length === 0) return []

  const out: { key: string; href: string | null; label: string; isText: boolean }[] = []

  ev.forEach((item, idx) => {
    const urlRaw =
      typeof item === 'string'
        ? item
        : item != null && typeof item === 'object' && 'url' in item && item.url != null
          ? String((item as { url: unknown }).url)
          : ''
    if (!urlRaw) return

    if (urlRaw.startsWith('text:')) {
      const text = urlRaw.slice(5).trim() || '(catatan)'
      out.push({
        key: `text-${idx}`,
        href: null,
        label: text.length > 60 ? `${text.slice(0, 60)}…` : text,
        isText: true,
      })
      return
    }

    let label = `Bukti ${idx + 1}`
    if (idx === 0) label = 'Before'
    else if (idx === 1) label = 'After'
    out.push({
      key: `url-${idx}-${urlRaw.slice(0, 24)}`,
      href: urlRaw,
      label,
      isText: false,
    })
  })

  return out
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

type UserTaskTreeGroup = { key: string; main: UserTask; children: UserTask[] }

function buildUserTaskTreeGroups(
  tasks: UserTask[] | undefined,
  selectedAssetId: string,
  isRole: (ut: UserTask) => boolean
): UserTaskTreeGroup[] {
  const mains = (tasks || []).filter((main) => {
    const subs = (main.sub_user_task || []) as UserTask[]
    const assetMatch =
      selectedAssetId === 'all' ||
      getTaskAssetId(main) === selectedAssetId ||
      subs.some((s) => getTaskAssetId(s) === selectedAssetId)
    if (!assetMatch) return false
    return isRole(main) || subs.some(isRole)
  })

  return mains.map((main) => {
    const subs = ((main.sub_user_task || []) as UserTask[]).filter(
      (s) => selectedAssetId === 'all' || getTaskAssetId(s) === selectedAssetId
    )
    const key = String(main.user_task_id ?? main.id ?? '')
    return { key, main, children: subs }
  })
}

function mainTaskGroupTitle(main: UserTask, fallback: string): string {
  const t = main.task as (UserTask['task'] & { taskGroup?: { name?: string } }) | undefined
  const g = (t?.task_group?.name || t?.taskGroup?.name || '').trim()
  if (g) return g
  const n = (t?.name || '').trim()
  if (n) return n
  return fallback
}

function visibleChildrenForRole(
  main: UserTask,
  children: UserTask[],
  isRole: (ut: UserTask) => boolean
): UserTask[] {
  if (isRole(main)) return children
  return children.filter(isRole)
}

export default function DailyWorkStatus({ selectedAssetId = 'all' }: DailyWorkStatusProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [tasksToday, setTasksToday] = useState<UserTask[]>([])
  const [tasksMonth, setTasksMonth] = useState<UserTask[]>([])
  const [loading, setLoading] = useState(true)
  /** Main `user_task_id` yang baris anaknya di-expand di tabel kebersihan */
  const [expandedCleaningMainIds, setExpandedCleaningMainIds] = useState<Set<string>>(new Set())

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

  /** Ring per aset — semua aset, persen dari tugas hari ini (user login) */
  const allAssetsRings = useMemo(() => {
    const map = new Map<string, { total: number; done: number; name: string }>()
    assets.forEach((a) => map.set(a.id, { total: 0, done: 0, name: a.name }))

    flatToday.forEach((ut) => {
      const aid = getTaskAssetId(ut)
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

  /** Tree: main + `sub_user_task`, sama flow dengan keamanan */
  const kebersihanCleaningGroups = useMemo(
    () => buildUserTaskTreeGroups(tasksToday, selectedAssetId, isKebersihan),
    [tasksToday, selectedAssetId]
  )

  const keamananSecurityGroups = useMemo(
    () => buildUserTaskTreeGroups(tasksToday, selectedAssetId, isKeamanan),
    [tasksToday, selectedAssetId]
  )

  const kebersihanMonthGroups = useMemo(
    () => buildUserTaskTreeGroups(tasksMonth, selectedAssetId, isKebersihan),
    [tasksMonth, selectedAssetId]
  )

  const keamananMonthGroups = useMemo(
    () => buildUserTaskTreeGroups(tasksMonth, selectedAssetId, isKeamanan),
    [tasksMonth, selectedAssetId]
  )

  /** Daftar datar untuk persen / ringkasan (main + anak yang kebersihan) */
  const kebersihanToday = useMemo(() => {
    const out: UserTask[] = []
    for (const { main, children } of kebersihanCleaningGroups) {
      if (isKebersihan(main)) out.push(main)
      for (const c of children) {
        if (isKebersihan(c)) out.push(c)
      }
    }
    return out
  }, [kebersihanCleaningGroups])

  useEffect(() => {
    setExpandedCleaningMainIds(
      new Set(kebersihanCleaningGroups.map((g) => g.key).filter(Boolean))
    )
  }, [kebersihanCleaningGroups])
  const keamananToday = useMemo(() => {
    const out: UserTask[] = []
    for (const { main, children } of keamananSecurityGroups) {
      if (isKeamanan(main)) out.push(main)
      for (const c of children) {
        if (isKeamanan(c)) out.push(c)
      }
    }
    return out
  }, [keamananSecurityGroups])

  const completionRate = (list: UserTask[]) => {
    if (list.length === 0) return 0
    const done = list.filter(isCompleted).length
    return Math.round((done / list.length) * 100)
  }

  const kebersihanMonthList = useMemo(() => {
    const out: UserTask[] = []
    for (const { main, children } of kebersihanMonthGroups) {
      if (isKebersihan(main)) out.push(main)
      for (const c of children) {
        if (isKebersihan(c)) out.push(c)
      }
    }
    return out
  }, [kebersihanMonthGroups])

  const keamananMonthList = useMemo(() => {
    const out: UserTask[] = []
    for (const { main, children } of keamananMonthGroups) {
      if (isKeamanan(main)) out.push(main)
      for (const c of children) {
        if (isKeamanan(c)) out.push(c)
      }
    }
    return out
  }, [keamananMonthGroups])

  const pctHarianKebersihan = completionRate(kebersihanToday)
  const pctHarianKeamanan = completionRate(keamananToday)
  const pctBulananKebersihan = completionRate(kebersihanMonthList)
  const pctBulananKeamanan = completionRate(keamananMonthList)

  /**
   * Baris patroli: satu baris per main task (tree API), slot waktu diisi dari
   * pool main + sub `user_task` keamanan (sama flow data dengan kebersihan).
   */
  const patrolMatrix = useMemo(() => {
    return keamananSecurityGroups
      .map((group, idx) => {
        const { main, key, children } = group
        const vis = visibleChildrenForRole(main, children, isKeamanan)
        const pool: UserTask[] = []
        if (isKeamanan(main)) pool.push(main)
        vis.forEach((c) => {
          if (isKeamanan(c)) pool.push(c)
        })
        const titik = mainTaskGroupTitle(main, 'Patroli')
        const cells = PATROL_TIME_SLOTS.map((_, col) => {
          const ut = pool.find((u) => slotIndexFromUserTask(u) === col)
          return { ut, status: cellStatusForPatrol(ut) }
        })
        return { key: key || `patrol-${idx}`, titik, cells }
      })
      .sort((a, b) => a.titik.localeCompare(b.titik, 'id'))
      .slice(0, 12)
  }, [keamananSecurityGroups])

  const toggleCleaningExpand = (mainKey: string) => {
    setExpandedCleaningMainIds((prev) => {
      const next = new Set(prev)
      if (next.has(mainKey)) next.delete(mainKey)
      else next.add(mainKey)
      return next
    })
  }

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
                {kebersihanCleaningGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada tugas kebersihan hari ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  kebersihanCleaningGroups.map((group, gIdx) => {
                    const { main, key, children } = group
                    const vis = visibleChildrenForRole(main, children, isKebersihan)
                    const hasChildren = vis.length > 0
                    const expanded = expandedCleaningMainIds.has(key)
                    const mainSt = userTaskStatusDisplay(main)
                    const mainEv = getEvidenceEntries(main)
                    const mainTitle = mainTaskGroupTitle(main, 'Kebersihan')

                    return (
                      <Fragment key={key}>
                        {(isKebersihan(main) || hasChildren) && (
                          <TableRow className="bg-slate-50/80">
                            <TableCell className="align-middle text-slate-600">{gIdx + 1}</TableCell>
                            <TableCell className="max-w-[min(100vw,280px)] text-sm text-slate-900">
                              <div className="flex items-start gap-1">
                                {hasChildren ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-0.5 h-7 w-7 shrink-0 p-0"
                                    onClick={() => toggleCleaningExpand(key)}
                                    aria-expanded={expanded}
                                    aria-label={expanded ? 'Ciutkan' : 'Bentangkan'}
                                  >
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4 text-slate-600" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-600" />
                                    )}
                                  </Button>
                                ) : (
                                  <span className="inline-block w-7 shrink-0" />
                                )}
                                <span className="min-w-0 font-medium leading-snug">
                                  {mainTitle}
                                  {hasChildren ? (
                                    <span className="ml-2 font-normal text-muted-foreground">({vis.length})</span>
                                  ) : null}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="align-middle">
                              {isKebersihan(main) ? (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${mainSt.className}`}
                                >
                                  {mainSt.label}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-middle">
                              {isKebersihan(main) ? (
                                mainEv.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">Belum ada bukti</span>
                                ) : (
                                  <div className="flex max-w-[280px] flex-wrap gap-1">
                                    {mainEv.map((e) =>
                                      e.isText ? (
                                        <span
                                          key={e.key}
                                          className="inline-flex max-w-full rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                                          title={e.label}
                                        >
                                          {e.label}
                                        </span>
                                      ) : (
                                        <Button
                                          key={e.key}
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
                                          asChild
                                        >
                                          <a href={e.href!} target="_blank" rel="noopener noreferrer">
                                            {e.label}
                                          </a>
                                        </Button>
                                      )
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                        {hasChildren &&
                          expanded &&
                          vis.map((child, cIdx) => {
                            const st = userTaskStatusDisplay(child)
                            const evidenceEntries = getEvidenceEntries(child)
                            return (
                              <TableRow key={`${key}-sub-${child.user_task_id ?? child.id ?? cIdx}`} className="bg-white">
                                <TableCell className="text-muted-foreground" />
                                <TableCell className="max-w-[min(100vw,280px)] text-sm text-slate-800">
                                  <div className="ml-2 flex items-start gap-2 border-l border-slate-200 pl-3">
                                    <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                                      <span className="leading-snug">{child.task?.name || '—'}</span>
                                      <Badge variant="secondary" className="text-[10px] font-normal">
                                        Sub task
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}
                                  >
                                    {st.label}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {evidenceEntries.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">Belum ada bukti</span>
                                  ) : (
                                    <div className="flex max-w-[280px] flex-wrap gap-1">
                                      {evidenceEntries.map((e) =>
                                        e.isText ? (
                                          <span
                                            key={e.key}
                                            className="inline-flex max-w-full rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                                            title={e.label}
                                          >
                                            {e.label}
                                          </span>
                                        ) : (
                                          <Button
                                            key={e.key}
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
                                            asChild
                                          >
                                            <a href={e.href!} target="_blank" rel="noopener noreferrer">
                                              {e.label}
                                            </a>
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </Fragment>
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
