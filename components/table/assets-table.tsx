'use client'

import React, { useState, useEffect } from 'react'
import { Asset, assetsApi, ASSET_TYPE_LABELS } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Edit, Trash2, Eye, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface PaginationInfo {
  total: number
  limit: number
  offset: number
}

interface AssetsTableProps {
  assets: Asset[]
  onEdit: (asset: Asset) => void
  onView: (asset: Asset) => void
  onRefresh: () => void
  loading?: boolean
  pagination?: PaginationInfo
  onPageChange?: (offset: number) => void
  can_edit?: boolean
  can_delete?: boolean
}

export default function AssetsTable({ 
  assets, 
  onEdit, 
  onView, 
  onRefresh, 
  loading = false,
  pagination,
  onPageChange,
  can_edit = true,
  can_delete = true
}: AssetsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDeleteClick = (asset: Asset) => {
    setAssetToDelete(asset)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return

    setDeleting(true)
    try {
      const response = await assetsApi.deleteAsset(assetToDelete.id)
      
      if (response.success) {
        toast.success('Asset berhasil dihapus')
        onRefresh()
      } else {
        toast.error(response.error || 'Gagal menghapus asset')
      }
    } catch (error) {
      console.error('Delete asset error:', error)
      toast.error('Terjadi kesalahan saat menghapus asset')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setAssetToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    if (!mounted) return 'Loading...'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
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

  const handlePageChange = (newOffset: number) => {
    if (onPageChange && pagination) {
      onPageChange(newOffset)
    }
  }

  const getCurrentPage = () => {
    if (!pagination) return 1
    return Math.floor(pagination.offset / pagination.limit) + 1
  }

  const getTotalPages = () => {
    if (!pagination) return 1
    return Math.ceil(pagination.total / pagination.limit)
  }

  const getPageStart = () => {
    if (!pagination) return 0
    // Ensure offset is valid (not negative and reasonable)
    // Maximum offset should be (totalPages - 1) * limit
    const maxPages = Math.ceil(pagination.total / pagination.limit)
    const maxOffset = Math.max(0, (maxPages - 1) * pagination.limit)
    const validOffset = Math.max(0, Math.min(pagination.offset, maxOffset))
    return validOffset + 1
  }

  const getPageEnd = () => {
    if (!pagination) return assets.length
    return Math.min(pagination.offset + pagination.limit, pagination.total)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe Asset</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Luas (m²)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Diubah</TableHead>
              <TableHead className="w-[70px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Tidak ada data asset
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset, index) => {
                const isLast = index === assets.length - 1;
                const rowNumber = pagination 
                  ? getPageStart() + index
                  : index + 1;
                return (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{String(rowNumber)}</TableCell>
                  <TableCell className="font-medium">
                    {asset.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getAssetTypeLabel(asset.asset_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {asset.address || '-'}
                  </TableCell>
                  <TableCell>{asset.area ? `${asset.area} m²` : '-'}</TableCell>
                  <TableCell>
                      <span
                          className={`px-3 py-1.5 rounded text-sm font-medium border ${(asset.status === 1 || asset.status === 'active')
                              ? "bg-green-600/15 text-green-600 border-green-600"
                              : "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400"
                              }`}
                      >
                          {getStatusLabel(asset.status)}
                      </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(asset.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(asset.updated_at)}
                  </TableCell>
                  <TableCell
                      className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                          }`}
                  >
                      <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => onView(asset)} className="rounded-[50%] text-blue-500 bg-blue-500/10">
                              <Eye className="w-5 h-5" />
                          </Button>
                          {can_edit && (
                            <Button size="icon" variant="ghost" onClick={() => onEdit(asset)} className="rounded-[50%] text-green-600 bg-green-600/10">
                                <Edit className="w-5 h-5" />
                            </Button>
                          )}
                          {can_delete && (
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(asset)} className="rounded-[50%] text-red-500 bg-red-500/10">
                                <Trash2 className="w-5 h-5" />
                            </Button>
                          )}
                      </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-muted-foreground">
            Menampilkan {getPageStart()} - {getPageEnd()} dari {pagination.total} asset
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(0)}
              disabled={pagination.offset === 0 || loading}
              className="h-9 w-9 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0 || loading}
              className="h-9 w-9 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {(() => {
                const totalPages = getTotalPages()
                const currentPage = getCurrentPage()
                const pageNumbers: number[] = []
                
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) {
                    pageNumbers.push(i)
                  }
                } else if (currentPage <= 3) {
                  for (let i = 1; i <= 5; i++) {
                    pageNumbers.push(i)
                  }
                } else if (currentPage >= totalPages - 2) {
                  for (let i = totalPages - 4; i <= totalPages; i++) {
                    pageNumbers.push(i)
                  }
                } else {
                  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                    pageNumbers.push(i)
                  }
                }
                
                return pageNumbers.map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange((pageNum - 1) * pagination.limit)}
                    disabled={loading}
                    className="h-9 w-9 p-0"
                  >
                    {pageNum}
                  </Button>
                ))
              })()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(
                (getTotalPages() - 1) * pagination.limit,
                pagination.offset + pagination.limit
              ))}
              disabled={pagination.offset + pagination.limit >= pagination.total || loading}
              className="h-9 w-9 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange((getTotalPages() - 1) * pagination.limit)}
              disabled={pagination.offset + pagination.limit >= pagination.total || loading}
              className="h-9 w-9 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus asset <strong>{assetToDelete?.name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
