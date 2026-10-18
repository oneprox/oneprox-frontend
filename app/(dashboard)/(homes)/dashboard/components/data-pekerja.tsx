'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { rolesApi, usersApi, type Role, type User, type UserAsset } from '@/lib/api'
import { useCurrentUrl, withReturnTo } from '@/lib/return-to'

interface DataPekerjaProps {
  selectedAssetId?: string
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const inner = (payload as { data?: unknown } | null)?.data
  return Array.isArray(inner) ? (inner as T[]) : []
}

function userAssetId(ua: UserAsset): string {
  return String(ua.asset_id || ua.asset?.id || '')
}

function roleBadge(user: User) {
  const roleName = (user.role?.name || '').toLowerCase()
  if (roleName.includes('keamanan') || roleName.includes('security')) {
    return <Badge className="bg-blue-600">Keamanan</Badge>
  }
  if (roleName.includes('kebersihan') || roleName.includes('cleaning')) {
    return <Badge className="bg-green-600">Kebersihan</Badge>
  }
  return <Badge variant="outline">{user.role?.name || '-'}</Badge>
}

function statusBadge(status?: string) {
  if (status === 'active') return <Badge className="bg-green-600">Aktif</Badge>
  if (status === 'inactive') return <Badge variant="secondary">Tidak Aktif</Badge>
  return <Badge variant="outline">{status || '-'}</Badge>
}

/** Daftar pekerja keamanan & kebersihan (sama dengan halaman Data Pekerja), difilter per aset terpilih. */
export default function DataPekerja({ selectedAssetId = 'all' }: DataPekerjaProps) {
  const currentUrl = useCurrentUrl()
  const [workers, setWorkers] = useState<User[]>([])
  const [userAssetsByUserId, setUserAssetsByUserId] = useState<Record<string, UserAsset[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const rolesRes = await rolesApi.getRoles()
        const roles = extractList<Role>(rolesRes.success ? rolesRes.data : null)
        const workerRoleIds = roles
          .filter((r) => {
            const name = (r.name || '').toLowerCase()
            return ['keamanan', 'security', 'satpam', 'kebersihan', 'cleaning'].some((k) => name.includes(k))
          })
          .map((r) => String(r.id))

        const usersPerRole = await Promise.all(
          workerRoleIds.map(async (roleId) => {
            const res = await usersApi.getUsers({ role_id: roleId, limit: 100, offset: 0 })
            return extractList<User>(res.success ? res.data : null)
          })
        )
        const uniqueWorkers = usersPerRole
          .flat()
          .filter((w, idx, self) => idx === self.findIndex((x) => x.id === w.id))

        const assetsEntries = await Promise.all(
          uniqueWorkers.map(async (worker) => {
            try {
              const res = await usersApi.getUserAssets(worker.id)
              return [worker.id, extractList<UserAsset>(res.success ? res.data : null)] as const
            } catch {
              return [worker.id, [] as UserAsset[]] as const
            }
          })
        )

        if (cancelled) return
        setWorkers(uniqueWorkers)
        setUserAssetsByUserId(Object.fromEntries(assetsEntries))
      } catch (error) {
        console.error('Load data pekerja error:', error)
        if (cancelled) return
        setWorkers([])
        setUserAssetsByUserId({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleWorkers = useMemo(() => {
    if (selectedAssetId === 'all') return workers
    return workers.filter((w) =>
      (userAssetsByUserId[w.id] || []).some((ua) => userAssetId(ua) === selectedAssetId)
    )
  }, [workers, userAssetsByUserId, selectedAssetId])

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Data Pekerja</CardTitle>
        <CardDescription className="text-base text-slate-500">
          Daftar pekerja dengan role keamanan dan kebersihan
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span>Memuat data pekerja...</span>
          </div>
        ) : visibleWorkers.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Tidak ada data pekerja ditemukan</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>No. Telepon</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleWorkers.map((worker) => {
                  const assets = userAssetsByUserId[worker.id] || []
                  return (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">{worker.name || '-'}</TableCell>
                      <TableCell>{worker.email || '-'}</TableCell>
                      <TableCell>{worker.phone || '-'}</TableCell>
                      <TableCell>
                        {assets.length === 0 ? (
                          '-'
                        ) : (
                          <div className="space-y-1">
                            {assets.map((a) => (
                              <div key={a.id} className="text-sm leading-tight">
                                {a.asset?.name || a.asset_name || 'Asset'}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{roleBadge(worker)}</TableCell>
                      <TableCell>{statusBadge(worker.status)}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm" className="flex w-fit items-center gap-2">
                          <Link href={withReturnTo(`/worker/${worker.id}`, currentUrl)}>
                            <Eye className="h-4 w-4" />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
