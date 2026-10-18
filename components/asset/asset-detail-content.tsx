'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Building2, MapPin, Loader2, Search, Info } from 'lucide-react'
import { assetsApi, unitsApi, Asset, Unit, AssetLog } from '@/lib/api'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface AssetDetailContentProps {
  assetId: string
  onAssetLoaded?: (asset: Asset) => void
  /** Dipanggil saat asset gagal dimuat (mis. halaman detail mengarahkan kembali ke daftar asset). */
  onLoadError?: () => void
}

/** Isi detail asset (ringkasan, daftar unit, informasi, history) — dipakai halaman asset & dashboard. */
export default function AssetDetailContent({ assetId, onAssetLoaded, onLoadError }: AssetDetailContentProps) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [assetLogs, setAssetLogs] = useState<AssetLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('units')

  useEffect(() => {
    if (assetId) {
      loadAsset()
    }
  }, [assetId])

  useEffect(() => {
    if (assetId && activeTab === 'units') {
      loadUnits()
    } else if (assetId && activeTab === 'logs') {
      loadAssetLogs()
    }
  }, [assetId, activeTab])

  const loadAsset = async () => {
    try {
      setLoading(true)
      const response = await assetsApi.getAsset(assetId)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const assetData = responseData.data || responseData
        setAsset(assetData)
        onAssetLoaded?.(assetData)
      } else {
        toast.error('Gagal memuat data asset')
        onLoadError?.()
      }
    } catch (error) {
      console.error('Error loading asset:', error)
      toast.error('Terjadi kesalahan saat memuat data asset')
      onLoadError?.()
    } finally {
      setLoading(false)
    }
  }

  const loadUnits = async () => {
    try {
      setLoadingUnits(true)
      const response = await unitsApi.getUnits({ asset_id: assetId, limit: 1000 })
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const unitsData = Array.isArray(responseData.data) 
          ? responseData.data 
          : (Array.isArray(responseData) ? responseData : [])
        setUnits(unitsData.filter((unit: Unit) => !unit.is_deleted))
      }
    } catch (error) {
      console.error('Error loading units:', error)
      toast.error('Terjadi kesalahan saat memuat data unit')
    } finally {
      setLoadingUnits(false)
    }
  }

  const loadAssetLogs = async () => {
    try {
      setLoadingLogs(true)
      const response = await assetsApi.getAssetLogs(assetId)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const logsData = Array.isArray(responseData.data) 
          ? responseData.data 
          : (Array.isArray(responseData) ? responseData : [])
        setAssetLogs(logsData)
      }
    } catch (error) {
      console.error('Error loading asset logs:', error)
      toast.error('Terjadi kesalahan saat memuat history aktivitas')
    } finally {
      setLoadingLogs(false)
    }
  }

  // Calculate unit statistics
  const getUnitStats = () => {
    const totalUnits = units.length
    const occupiedUnits = units.filter(unit => 
      unit.status === 'occupied' || unit.status === '1'
    ).length
    const availableUnits = totalUnits - occupiedUnits
    
    return { totalUnits, occupiedUnits, availableUnits }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return { label: 'Unknown', className: 'text-gray-600' }
    
    const statusLower = status.toLowerCase()
    if (statusLower === 'available' || statusLower === '0') {
      return { label: 'Available', className: 'text-green-600' }
    } else if (statusLower === 'occupied' || statusLower === '1') {
      return { label: 'Occupied', className: 'text-blue-600' }
    } else if (statusLower === 'maintenance' || statusLower === '2') {
      return { label: 'Maintenance', className: 'text-yellow-600' }
    } else if (statusLower === 'reserved' || statusLower === '3') {
      return { label: 'Reserved', className: 'text-purple-600' }
    }
    return { label: status, className: 'text-gray-600' }
  }

  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      'create': 'Dibuat',
      'update': 'Diperbarui',
      'delete': 'Dihapus',
      'restore': 'Dipulihkan'
    }
    return actionMap[action] || action
  }

  const filteredUnits = units.filter(unit => 
    unit.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = getUnitStats()
  const area = typeof asset?.area === 'string' ? parseFloat(asset.area) : (typeof asset?.area === 'number' ? asset.area : 0)


  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Memuat data asset...</p>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Asset tidak ditemukan</p>
      </div>
    )
  }


  const mainPhoto = asset.photos && asset.photos.length > 0 ? asset.photos[0] : null

  // Backend mengirim sketch sebagai array URL; string lama tetap didukung
  const sketches = Array.isArray(asset.sketch)
    ? asset.sketch.filter(Boolean)
    : asset.sketch
      ? [asset.sketch]
      : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detail Asset</h1>
          <p className="text-muted-foreground">
            Informasi lengkap asset: <span className="font-medium">{asset.name}</span>
          </p>
        </div>
      </div>

      {/* Asset Detail Section */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asset Information */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {asset.name}
                </h2>
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                  <p className="text-sm">{asset.address || '-'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Luas Bangunan: </span>
                  <span className="text-sm text-gray-900">
                    {area ? `${area.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : '-'}
                  </span>
                </div>

                {/* Unit Summary */}
                <div className="flex items-center gap-6 pt-2 border-t">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Total Unit: </span>
                    <span className="text-sm font-semibold text-gray-900">{stats.totalUnits}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-600">Terisi: </span>
                    <span className="text-sm font-semibold text-green-600">{stats.occupiedUnits}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-red-600">Kosong: </span>
                    <span className="text-sm font-semibold text-red-600">{stats.availableUnits}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Image */}
            <div className="lg:col-span-1">
              {mainPhoto ? (
                <div className="relative w-full h-64 lg:h-full min-h-[256px] rounded-lg overflow-hidden border">
                  <Image
                    src={mainPhoto}
                    alt={asset.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-64 lg:h-full min-h-[256px] rounded-lg bg-gray-200 flex items-center justify-center border">
                  <Building2 className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-6">
              <TabsList className="bg-transparent h-auto p-0">
                <TabsTrigger 
                  value="units" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none"
                >
                  Daftar Unit
                </TabsTrigger>
                <TabsTrigger 
                  value="info" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none"
                >
                  Informasi Asset
                </TabsTrigger>
                <TabsTrigger 
                  value="logs" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none"
                >
                  History Aktivitas
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: List Unit */}
            <TabsContent value="units" className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cari Unit"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loadingUnits ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Nama Unit</TableHead>
                        <TableHead>Ukuran (m²)</TableHead>
                        <TableHead>Daya Listrik</TableHead>
                        <TableHead>Toilet</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'Tidak ada unit yang sesuai dengan pencarian' : 'Tidak ada unit pada asset ini'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUnits.map((unit, index) => {
                          const statusInfo = getStatusBadge(unit.status)
                          return (
                            <TableRow key={unit.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="font-medium">{unit.name}</TableCell>
                              <TableCell>{unit.size ? `${unit.size} m²` : '-'}</TableCell>
                              <TableCell>
                                {unit.electrical_power 
                                  ? `${unit.electrical_power} ${unit.electrical_unit || 'kW'}` 
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={unit.is_toilet_exist ? 'default' : 'secondary'}>
                                  {unit.is_toilet_exist ? 'Ada' : 'Tidak Ada'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className={statusInfo.className}>
                                  {statusInfo.label}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    // TODO: Open unit detail dialog
                                    toast('Fitur detail unit akan segera tersedia', {
                                      icon: 'ℹ️',
                                    })
                                  }}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Informasi Asset */}
            <TabsContent value="info" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nama Asset</label>
                    <p className="text-sm text-gray-900 mt-1">{asset.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Alamat</label>
                    <p className="text-sm text-gray-900 mt-1">{asset.address || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Luas Bangunan</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {area ? `${area.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tipe Asset</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {typeof asset.asset_type === 'string' 
                        ? asset.asset_type 
                        : (asset.asset_type ? String(asset.asset_type) : '-')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {asset.status === 1 || asset.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Dibuat Pada</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {asset.created_at ? formatDate(asset.created_at) : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Diperbarui Pada</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {asset.updated_at ? formatDate(asset.updated_at) : '-'}
                    </p>
                  </div>
                  {asset.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Deskripsi</label>
                      <p className="text-sm text-gray-900 mt-1">{asset.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sketsa Denah */}
              {sketches.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <label className="text-sm font-medium text-gray-700">Sketsa Denah</label>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sketches.map((sketchUrl, index) => (
                      <button
                        key={`sketch-${index}`}
                        type="button"
                        onClick={() => window.open(sketchUrl, '_blank')}
                        className="group relative block w-full overflow-hidden rounded-lg border bg-gray-50 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <img
                          src={sketchUrl}
                          alt={`Sketsa denah ${index + 1}`}
                          className="h-64 w-full object-contain"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition-colors group-hover:bg-black/10 group-hover:opacity-100">
                          Klik untuk memperbesar
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: History Aktivitas */}
            <TabsContent value="logs" className="p-6">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Aksi</TableHead>
                        <TableHead>Data Lama</TableHead>
                        <TableHead>Data Baru</TableHead>
                        <TableHead>Dibuat Oleh</TableHead>
                        <TableHead>Tanggal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Tidak ada history aktivitas
                          </TableCell>
                        </TableRow>
                      ) : (
                        assetLogs.map((log, index) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getActionLabel(log.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {log.old_data ? (
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                                  {JSON.stringify(log.old_data, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {log.new_data ? (
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                                  {JSON.stringify(log.new_data, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.created_by?.name || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(log.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
