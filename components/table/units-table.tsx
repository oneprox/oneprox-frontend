'use client'

import React, { useState, useEffect } from 'react'
import { Unit, unitsApi } from '@/lib/api'
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

interface UnitsTableProps {
  units: Unit[]
  onEdit: (unit: Unit) => void
  onView: (unit: Unit) => void
  onRefresh: () => void
  loading?: boolean
  pagination?: PaginationInfo
  onPageChange?: (offset: number) => void
  can_edit?: boolean
  can_delete?: boolean
}

export default function UnitsTable({ 
  units, 
  onEdit, 
  onView, 
  onRefresh, 
  loading = false,
  pagination,
  onPageChange,
  can_edit = true,
  can_delete = true
}: UnitsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDeleteClick = (unit: Unit) => {
    setUnitToDelete(unit)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!unitToDelete) return

    setDeleting(true)
    try {
      const response = await unitsApi.deleteUnit(unitToDelete.id)
      
      if (response.success) {
        toast.success('Unit berhasil dihapus')
        onRefresh()
      } else {
        toast.error(response.error || 'Gagal menghapus unit')
      }
    } catch (error) {
      console.error('Delete unit error:', error)
      toast.error('Terjadi kesalahan saat menghapus unit')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setUnitToDelete(null)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
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
    return pagination.offset + 1
  }

  const getPageEnd = () => {
    if (!pagination) return units.length
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
              <TableHead>Nama Unit</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Luas Lahan (m²)</TableHead>
              <TableHead>Luas Bangunan (m²)</TableHead>
              <TableHead>Daya Listrik</TableHead>
              <TableHead>Toilet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Diperbarui</TableHead>
              <TableHead className="w-[70px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Tidak ada data unit
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit, index) => {
                const isLast = index === units.length - 1;
                return (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{String(index + 1)}</TableCell>
                  <TableCell className="font-medium">
                    {unit.name || '-'}
                  </TableCell>
                  <TableCell>
                    {unit.asset?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {unit.size ? `${unit.size} m²` : '-'}
                  </TableCell>
                  <TableCell>
                    {unit.building_area ? `${unit.building_area} m²` : '-'}
                  </TableCell>
                  <TableCell>
                    {unit.electrical_power ? `${unit.electrical_power} ${unit.electrical_unit || 'Watt'}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={unit.is_toilet_exist ? 'default' : 'secondary'}>
                      {unit.is_toilet_exist ? 'Ada' : 'Tidak Ada'}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(unit.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(unit.updated_at)}
                  </TableCell>
                  <TableCell
                      className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                          }`}
                  >
                      <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => onView(unit)} className="rounded-[50%] text-blue-500 bg-blue-500/10">
                              <Eye className="w-5 h-5" />
                          </Button>
                          {can_edit && (
                            <Button size="icon" variant="ghost" onClick={() => onEdit(unit)} className="rounded-[50%] text-green-600 bg-green-600/10">
                                <Edit className="w-5 h-5" />
                            </Button>
                          )}
                          {can_delete && (
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(unit)} className="rounded-[50%] text-red-500 bg-red-500/10">
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
            Menampilkan {getPageStart()} - {getPageEnd()} dari {pagination.total} unit
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
              Apakah Anda yakin ingin menghapus unit <strong>{unitToDelete?.name}</strong>?
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