'use client'

import React, { useState, useEffect } from 'react'
import { Asset, ASSET_TYPE_LABELS } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History, Building2, X, MapPin, Square, Calendar, Edit, Image as ImageIcon, FileText } from 'lucide-react'
import Link from 'next/link'
import AssetLogsTable from '@/components/table/asset-logs-table'

interface AssetDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: Asset | null
}

export default function AssetDetailDialog({
  open,
  onOpenChange,
  asset
}: AssetDetailDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!asset || !open) return null

  // Handle sketch as array or string (backend returns array, interface says string)
  const sketchValue = Array.isArray(asset.sketch) 
    ? (asset.sketch.length > 0 ? asset.sketch[0] : null)
    : asset.sketch

  const formatDate = (dateString: string) => {
    if (!mounted) return 'Loading...'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAssetTypeLabel = (assetType: number | string) => {
    // Handle both integer and string asset types from backend
    if (typeof assetType === 'string') {
      // Map string values to labels directly
      const stringToLabel: { [key: string]: string } = {
        'ESTATE': 'Estate',
        'OFFICE': 'Office', 
        'WAREHOUSE': 'Warehouse',
        'SPORT': 'Sport',
        'ENTERTAINMENTRESTAURANT': 'Entertainment/Restaurant',
        'RESIDENCE': 'Residence',
        'MALL': 'Mall',
        'SUPPORTFACILITYMOSQUEITAL': 'Support Facility/Mosque',
        'PARKINGLOT': 'Parking Lot',
      }
      return stringToLabel[assetType] || 'Unknown'
    }
    return ASSET_TYPE_LABELS[assetType] || 'Unknown'
  }

  const getStatusLabel = (status: number | string) => {
    // Handle both integer and string status from backend
    if (typeof status === 'string') {
      switch (status) {
        case 'active':
          return 'Aktif'
        case 'inactive':
          return 'Tidak Aktif'
        default:
          return 'Tidak Diketahui'
      }
    }
    switch (status) {
      case 1:
        return 'Aktif'
      case 0:
        return 'Tidak Aktif'
      default:
        return 'Tidak Diketahui'
    }
  }

  const getStatusBadgeVariant = (status: number | string) => {
    // Handle both integer and string status from backend
    if (typeof status === 'string') {
      switch (status) {
        case 'active':
          return 'default'
        case 'inactive':
          return 'secondary'
        default:
          return 'outline'
      }
    }
    switch (status) {
      case 1:
        return 'default'
      case 0:
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Detail Asset: {asset.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Informasi lengkap dan riwayat aktivitas asset
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-end">
              <Button asChild>
                <Link href={`/asset/edit/${asset.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Asset
                </Link>
              </Button>
            </div>

            {/* Custom Tabs */}
            <div className="w-full">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Informasi Asset
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  History Aktivitas
                </button>
              </div>

              <div className="mt-6">
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    {/* Informasi Dasar */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Informasi Dasar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Nama Asset
                            </label>
                            <p className="text-sm font-medium">{asset.name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Kode Asset
                            </label>
                            <p className="text-sm font-medium">{asset.code}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Tipe Asset
                            </label>
                            <p className="text-sm font-medium">{getAssetTypeLabel(asset.asset_type)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Status
                            </label>
                            <div className="mt-1">
                              <Badge variant={getStatusBadgeVariant(asset.status)}>
                                {getStatusLabel(asset.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {asset.description && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Deskripsi
                            </label>
                            <p className="text-sm font-medium mt-1">{asset.description}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Informasi Lokasi */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Informasi Lokasi
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Alamat
                            </label>
                            <p className="text-sm font-medium">{asset.address}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Luas Area
                            </label>
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Square className="h-4 w-4" />
                              {asset.area} m²
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Koordinat
                            </label>
                            <p className="text-sm font-medium">
                              {asset.latitude}, {asset.longitude}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Foto dan Dokumen */}
                    {(asset.photos && asset.photos.length > 0) || sketchValue ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Foto dan Dokumen
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Foto Asset */}
                          {asset.photos && asset.photos.length > 0 && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                                <ImageIcon className="h-4 w-4" />
                                Foto Asset
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {asset.photos.map((photo, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={photo}
                                      alt={`Foto asset ${index + 1}`}
                                      className="w-full h-48 object-cover rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                      onClick={() => window.open(photo, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                      <span className="text-white text-sm font-medium">Klik untuk memperbesar</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sketsa Denah */}
                          {sketchValue && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                                <FileText className="h-4 w-4" />
                                Sketsa Denah
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="relative group">
                                  <img
                                    src={sketchValue}
                                    alt="Sketsa denah"
                                    className="w-full max-h-96 object-contain rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => window.open(sketchValue, '_blank')}
                                  />
                                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="text-white text-sm font-medium">Klik untuk memperbesar</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Informasi Tanggal */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Informasi Tanggal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Dibuat
                            </label>
                            <p className="text-sm font-medium">{formatDate(asset.created_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Diperbarui
                            </label>
                            <p className="text-sm font-medium">{formatDate(asset.updated_at)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          History Aktivitas Asset
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <AssetLogsTable assetId={asset.id} loading={false} />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}