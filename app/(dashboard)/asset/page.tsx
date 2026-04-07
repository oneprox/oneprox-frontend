'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Asset, assetsApi, ASSET_TYPE_LABELS, ASSET_TYPES } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Boxes, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import AssetsTable from '@/components/table/assets-table'
import AssetDetailDialog from '@/components/dialogs/asset-detail-dialog'
import toast from 'react-hot-toast'
import { useMenuPermissions } from '@/hooks/useMenuPermissions'

export default function AssetsPage() {
  const router = useRouter()
  const { can_add, can_edit, can_delete } = useMenuPermissions()
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  
  // Filter dan sorting states
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [order, setOrder] = useState<string>('newest')
  
  // Pagination states
  const [limit] = useState<number>(10)
  const [offset, setOffset] = useState<number>(0)
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number } | null>(null)

  const loadAssets = async () => {
    setLoading(true)
    try {
      // Prepare filter parameters
      const filterParams: any = {
        limit,
        offset
      }
      if (searchTerm.trim()) {
        filterParams.name = searchTerm.trim()
      }
      if (assetTypeFilter !== 'all') {
        filterParams.asset_type = parseInt(assetTypeFilter)
      }
      if (statusFilter !== 'all') {
        filterParams.status = parseInt(statusFilter)
      }
      if (order) {
        filterParams.order = order
      }
      
      const response = await assetsApi.getAssets(filterParams)
      
      if (response.success && response.data) {
        // Handle new nested structure: response.data.data contains the array
        const responseData = response.data as any
        const assetsData = Array.isArray(responseData.data) ? responseData.data : []
        
        // Extract pagination from response
        let paginationData: { total: number; limit: number; offset: number } | null = null
        if (response.pagination) {
          paginationData = {
            total: response.pagination.total || 0,
            limit: response.pagination.limit || limit,
            offset: response.pagination.offset || offset
          }
        } else if (responseData.pagination) {
          paginationData = {
            total: responseData.pagination.total || 0,
            limit: responseData.pagination.limit || limit,
            offset: responseData.pagination.offset || offset
          }
        } else {
          paginationData = {
            total: assetsData.length,
            limit: limit,
            offset: offset
          }
        }
        
        setAssets(assetsData)
        setFilteredAssets(assetsData)
        setPagination(paginationData)
      } else {
        toast.error(response.error || 'Gagal memuat data assets')
        // Set empty array on error to prevent filter errors
        setAssets([])
        setFilteredAssets([])
        setPagination(null)
      }
    } catch (error) {
      console.error('Load assets error:', error)
      toast.error('Terjadi kesalahan saat memuat data assets')
      // Set empty array on error to prevent filter errors
      setAssets([])
      setFilteredAssets([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssets()
  }, [])

  // Reload data when filters or pagination change
  useEffect(() => {
    loadAssets()
  }, [searchTerm, assetTypeFilter, statusFilter, order, offset])

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Remove the old client-side filtering since we're using server-side filtering
  // useEffect(() => {
  //   if (Array.isArray(assets)) {
  //     if (searchTerm.trim()) {
  //       const filtered = assets.filter(asset =>
  //         asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //         asset.code.toLowerCase().includes(searchTerm.toLowerCase())
  //       )
  //       setFilteredAssets(filtered)
  //     } else {
  //       setFilteredAssets(assets)
  //     }
  //   }
  // }, [searchTerm, assets])

  const handleEdit = (asset: Asset) => {
    router.push(`/asset/edit/${asset.id}`)
  }

  const handleView = (asset: Asset) => {
    router.push(`/asset/view/${asset.id}`)
  }

  const handleRefresh = () => {
    loadAssets()
  }

  const getStats = () => {
    if (!Array.isArray(assets)) {
      return {
        total: 0,
        estate: 0,
        office: 0,
        warehouse: 0,
        residence: 0,
        mall: 0,
        other: 0
      }
    }
    
    const total = assets.length
    const estate = assets.filter(asset => asset.asset_type === 1).length
    const office = assets.filter(asset => asset.asset_type === 2).length
    const warehouse = assets.filter(asset => asset.asset_type === 3).length
    const residence = assets.filter(asset => asset.asset_type === 6).length
    const mall = assets.filter(asset => asset.asset_type === 7).length
    const other = assets.filter(asset => ![1, 2, 3, 6, 7].includes(parseInt(asset.asset_type as string))).length

    return { total, estate, office, warehouse, residence, mall, other }
  }

  const stats = getStats()

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
              <Boxes className="h-4 w-4" />
              Assets
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 hidden">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Semua aset terdaftar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estate</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.estate}</div>
            <p className="text-xs text-muted-foreground">
              Properti Estate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Office</CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.office}</div>
            <p className="text-xs text-muted-foreground">
              Gedung Kantor
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
            <div className="h-4 w-4 rounded-full bg-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.warehouse}</div>
            <p className="text-xs text-muted-foreground">
              Gudang
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residence</CardTitle>
            <div className="h-4 w-4 rounded-full bg-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.residence}</div>
            <p className="text-xs text-muted-foreground">
              Perumahan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mall</CardTitle>
            <div className="h-4 w-4 rounded-full bg-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mall}</div>
            <p className="text-xs text-muted-foreground">
              Pusat Perbelanjaan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lainnya</CardTitle>
            <div className="h-4 w-4 rounded-full bg-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.other}</div>
            <p className="text-xs text-muted-foreground">
              Jenis Lain
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
              <p className="text-muted-foreground">
                Kelola data aset dan properti
              </p>
            </div>
            <div className="flex items-center gap-2">
              {can_add && (
                <Button onClick={() => router.push('/asset/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Asset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filter Bar - Horizontal Layout */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari asset..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="1">Aktif</SelectItem>
                <SelectItem value="0">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={order} onValueChange={setOrder}>
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
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm('')
                setAssetTypeFilter('all')
                setStatusFilter('all')
                setOrder('newest')
                setOffset(0)
              }}
            >
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Memuat data assets...</span>
              </div>
            </div>
          ) : (
            <AssetsTable
              assets={filteredAssets}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
              pagination={pagination || undefined}
              onPageChange={handlePageChange}
              can_edit={can_edit}
              can_delete={can_delete}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <AssetDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        asset={selectedAsset}
      />
    </div>
  )
}
