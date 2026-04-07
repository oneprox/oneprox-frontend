'use client'

import React, { useState, useEffect } from 'react'
import { Unit, ASSET_TYPE_LABELS } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History, Home, X, Square, Zap, Calendar, Edit, Building2, MapPin } from 'lucide-react'
import Link from 'next/link'
import UnitLogsTable from '@/components/table/unit-logs-table'

interface UnitDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unit: Unit | null
}

export default function UnitDetailDialog({
  open,
  onOpenChange,
  unit
}: UnitDetailDialogProps) {
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

  if (!unit || !open) return null

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

  const getStatusBadge = (status?: string) => {
    if (status === undefined || status === null) {
      return {
        label: 'Unknown',
        className: 'bg-gray-600/15 text-gray-600 dark:text-white border-gray-400'
      }
    }
    switch (status) {
      case 'available':
        return {
          label: 'Available',
          className: 'bg-green-600/15 text-green-600 border-green-600'
        }
      case 'occupied':
        return {
          label: 'Occupied',
          className: 'bg-blue-600/15 text-blue-600 border-blue-600'
        }
      default:
        return {
          label: 'Unknown',
          className: 'bg-gray-600/15 text-gray-600 dark:text-white border-gray-400'
        }
    }
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
              <Home className="h-5 w-5" />
              Detail Unit: {unit.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Informasi lengkap dan riwayat aktivitas unit
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
                <Link href={`/unit/edit/${unit.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Unit
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
                  <Home className="h-4 w-4" />
                  Informasi Unit
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
                          <Home className="h-5 w-5" />
                          Informasi Dasar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Nama Unit
                            </label>
                            <p className="text-sm font-medium">{unit.name}</p>
                          </div>
                          {unit.asset && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Asset
                              </label>
                              <p className="text-sm font-medium flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {unit.asset.name || '-'}
                              </p>
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Luas Lahan
                            </label>
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Square className="h-4 w-4" />
                              {unit.size ?? '-'}{unit.size !== undefined && unit.size !== null ? ' m²' : ''}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Luas Bangunan
                            </label>
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Square className="h-4 w-4" />
                              {unit.building_area ?? '-'}{unit.building_area !== undefined && unit.building_area !== null ? ' m²' : ''}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Status
                            </label>
                            <div className="mt-1">
                              {(() => {
                                const statusInfo = getStatusBadge(unit.status)
                                return (
                                  <span
                                    className={`px-3 py-1.5 rounded text-sm font-medium border ${statusInfo.className}`}
                                  >
                                    {statusInfo.label}
                                  </span>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                        {unit.description && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Deskripsi
                            </label>
                            <p className="text-sm font-medium mt-1">{unit.description}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Informasi Fasilitas */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Informasi Fasilitas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Daya Listrik
                            </label>
                            <p className="text-sm font-medium">
                              {unit.electrical_power} {unit.electrical_unit}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Toilet
                            </label>
                            <div className="mt-1">
                              <Badge variant={unit.is_toilet_exist ? 'default' : 'secondary'}>
                                {unit.is_toilet_exist ? 'Ada' : 'Tidak Ada'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

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
                            <p className="text-sm font-medium">{formatDate(unit.created_at)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Diperbarui
                            </label>
                            <p className="text-sm font-medium">{formatDate(unit.updated_at)}</p>
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
                          History Aktivitas Unit
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <UnitLogsTable unitId={unit.id} loading={false} />
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