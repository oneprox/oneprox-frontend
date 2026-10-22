'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ASSET_TYPE_LABELS, User, usersApi, Role, rolesApi, UserAsset } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Loader2, Eye, RefreshCw, UsersRound, Home, UserRoundPen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WorkerPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<User[]>([])
  const [displayWorkers, setDisplayWorkers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [securityRoleId, setSecurityRoleId] = useState<string | null>(null)
  const [cleaningRoleId, setCleaningRoleId] = useState<string | null>(null)
  const [userAssetsByUserId, setUserAssetsByUserId] = useState<Record<string, UserAsset[]>>({})

  // Asset filter UI (mirip halaman asset)
  const [assetSearchTerm, setAssetSearchTerm] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all')
  const [assetStatusFilter, setAssetStatusFilter] = useState<string>('all')
  const [assetOrder, setAssetOrder] = useState<string>('newest')

  // Load roles to find security and cleaning role IDs
  const loadRoles = async () => {
    try {
      const response = await rolesApi.getRoles()
      if (response.success && response.data) {
        const rolesData = response.data as any
        const rolesList = Array.isArray(rolesData.data) ? rolesData.data : (Array.isArray(rolesData) ? rolesData : [])
        setRoles(rolesList)
        
        // Find role IDs for security and cleaning
        const securityRole = rolesList.find((r: Role) => 
          r.name?.toLowerCase().includes('keamanan') || 
          r.name?.toLowerCase().includes('security') ||
          r.name?.toLowerCase().includes('satpam')
        )
        const cleaningRole = rolesList.find((r: Role) => 
          r.name?.toLowerCase().includes('kebersihan') || 
          r.name?.toLowerCase().includes('cleaning') ||
          r.name?.toLowerCase().includes('cleaning')
        )
        
        if (securityRole) {
          setSecurityRoleId(String(securityRole.id))
        }
        if (cleaningRole) {
          setCleaningRoleId(String(cleaningRole.id))
        }
      }
    } catch (error) {
      console.error('Load roles error:', error)
    }
  }

  // Load workers (users with security or cleaning role)
  const loadWorkers = async () => {
    setLoading(true)
    try {
      const allWorkers: User[] = []
      
      // Load security workers
      if (securityRoleId) {
        const securityResponse = await usersApi.getUsers({
          role_id: securityRoleId,
          limit: 100,
          offset: 0
        })
        if (securityResponse.success && securityResponse.data) {
          const responseData = securityResponse.data as any
          const securityWorkers = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : [])
          allWorkers.push(...securityWorkers)
        }
      }
      
      // Load cleaning workers
      if (cleaningRoleId) {
        const cleaningResponse = await usersApi.getUsers({
          role_id: cleaningRoleId,
          limit: 100,
          offset: 0
        })
        if (cleaningResponse.success && cleaningResponse.data) {
          const responseData = cleaningResponse.data as any
          const cleaningWorkers = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : [])
          allWorkers.push(...cleaningWorkers)
        }
      }
      
      // Remove duplicates based on user ID
      const uniqueWorkers = allWorkers.filter((worker, index, self) =>
        index === self.findIndex((w) => w.id === worker.id)
      )

      // Load assets per user (parallel), for display
      const assetsEntries = await Promise.all(
        uniqueWorkers.map(async (worker) => {
          try {
            const res = await usersApi.getUserAssets(worker.id)
            const data = (res.data as any)?.data ?? res.data
            const list: UserAsset[] = Array.isArray(data) ? data : []
            return [worker.id, list] as const
          } catch {
            return [worker.id, []] as const
          }
        })
      )
      setUserAssetsByUserId(Object.fromEntries(assetsEntries))
      
      // Filter by search term if provided
      if (searchTerm.trim()) {
        const filtered = uniqueWorkers.filter(worker =>
          worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setWorkers(filtered)
      } else {
        setWorkers(uniqueWorkers)
      }
    } catch (error) {
      console.error('Load workers error:', error)
      toast.error('Terjadi kesalahan saat memuat data pekerja')
      setWorkers([])
      setUserAssetsByUserId({})
      setDisplayWorkers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  useEffect(() => {
    if (securityRoleId || cleaningRoleId) {
      loadWorkers()
    }
  }, [securityRoleId, cleaningRoleId, searchTerm])

  const resetAssetFilter = () => {
    setAssetSearchTerm('')
    setAssetTypeFilter('all')
    setAssetStatusFilter('all')
    setAssetOrder('newest')
  }

  const matchesAssetFilter = (userId: string) => {
    const assets = userAssetsByUserId[userId] || []

    const hasAnyAsset = assets.length > 0
    const needsAnyFilter =
      assetSearchTerm.trim() || assetTypeFilter !== 'all' || assetStatusFilter !== 'all'
    if (!needsAnyFilter) return true
    if (!hasAnyAsset) return false

    const q = assetSearchTerm.trim().toLowerCase()

    return assets.some((ua) => {
      const name = (ua.asset?.name || ua.asset_name || '').toLowerCase()
      const typeRaw = ua.asset?.asset_type ?? ua.asset_type
      const statusRaw = ua.asset?.status ?? ua.asset_status
      const type = typeRaw === undefined || typeRaw === null ? null : String(typeRaw)
      const status = statusRaw === undefined || statusRaw === null ? null : String(statusRaw)

      if (q && !name.includes(q)) return false
      if (assetTypeFilter !== 'all' && type !== assetTypeFilter) return false
      if (assetStatusFilter !== 'all' && status !== assetStatusFilter) return false
      return true
    })
  }

  useEffect(() => {
    const filtered = workers.filter((w) => matchesAssetFilter(w.id))
    setDisplayWorkers(filtered)
  }, [workers, userAssetsByUserId, assetSearchTerm, assetTypeFilter, assetStatusFilter])

  const handleViewDetail = (userId: string) => {
    router.push(`/worker/${userId}`)
  }

  const getRoleBadge = (user: User) => {
    const roleName = user.role?.name || ''
    if (roleName.toLowerCase().includes('keamanan') || roleName.toLowerCase().includes('security')) {
      return <Badge variant="default" className="bg-blue-600">Keamanan</Badge>
    } else if (roleName.toLowerCase().includes('kebersihan') || roleName.toLowerCase().includes('cleaning')) {
      return <Badge variant="default" className="bg-green-600">Kebersihan</Badge>
    }
    return <Badge variant="outline">{roleName}</Badge>
  }

  const getStatusBadge = (status?: string) => {
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-600">Aktif</Badge>
    } else if (status === 'inactive') {
      return <Badge variant="secondary">Tidak Aktif</Badge>
    }
    return <Badge variant="outline">{status || '-'}</Badge>
  }

  const getAssetLabel = (workerId: string) => {
    const assets = userAssetsByUserId[workerId] || []
    if (assets.length === 0) return '-'
    if (assets.length === 1) return assets[0].asset?.name || assets[0].asset_name || 'Asset'
    return assets
      .map((a) => a.asset?.name || a.asset_name || 'Asset')
      .filter(Boolean)
      .join('\n')
  }

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
            <BreadcrumbPage className="flex items-center gap-2">
              <UserRoundPen className="h-4 w-4" />
              Data Pekerja
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Search and Filter */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Pekerja</h1>
              <p className="text-muted-foreground">
                Daftar pekerja dengan role keamanan dan kebersihan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadWorkers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Filter Bar - samakan dengan halaman asset */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <UsersRound className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari pekerja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari asset..."
                value={assetSearchTerm}
                onChange={(e) => setAssetSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>

            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Tipe Asset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={String(key)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assetStatusFilter} onValueChange={setAssetStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="1">Aktif</SelectItem>
                <SelectItem value="0">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assetOrder} onValueChange={setAssetOrder}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
                <SelectItem value="a-z">Nama A - Z</SelectItem>
                <SelectItem value="z-a">Nama Z - A</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={resetAssetFilter} disabled={loading}>
              Reset
            </Button>
          </div>

          {/* Workers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Memuat data pekerja...</span>
            </div>
          ) : displayWorkers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Tidak ada data pekerja ditemukan</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
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
                  {displayWorkers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">
                        {worker.name || '-'}
                      </TableCell>
                      <TableCell>
                        {worker.email || '-'}
                      </TableCell>
                      <TableCell>
                        {worker.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assets = userAssetsByUserId[worker.id] || []
                          if (assets.length === 0) return '-'
                          if (assets.length === 1) return assets[0].asset?.name || assets[0].asset_name || 'Asset'

                          const sorted = [...assets]
                          if (assetOrder === 'a-z' || assetOrder === 'z-a') {
                            sorted.sort((a, b) => {
                              const an = (a.asset?.name || a.asset_name || '').toLowerCase()
                              const bn = (b.asset?.name || b.asset_name || '').toLowerCase()
                              if (an < bn) return assetOrder === 'a-z' ? -1 : 1
                              if (an > bn) return assetOrder === 'a-z' ? 1 : -1
                              return 0
                            })
                          }

                          return (
                            <div className="space-y-1">
                              {sorted.map((a) => {
                                const name = a.asset?.name || a.asset_name || 'Asset'
                                return (
                                  <div key={a.id} className="text-sm leading-tight">
                                    - {name}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(worker)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(worker.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(worker.id)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
