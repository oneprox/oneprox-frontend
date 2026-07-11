'use client'

import React, { useState } from 'react'
import { Bank, banksApi } from '@/lib/api'
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
import { Edit, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface PaginationInfo {
  total: number
  limit: number
  offset: number
}

interface BanksTableProps {
  banks: Bank[]
  onEdit: (bank: Bank) => void
  onRefresh: () => void
  loading?: boolean
  pagination?: PaginationInfo
  onPageChange?: (offset: number) => void
}

export default function BanksTable({
  banks,
  onEdit,
  onRefresh,
  loading = false,
  pagination,
  onPageChange
}: BanksTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteClick = (bank: Bank) => {
    setBankToDelete(bank)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!bankToDelete) return

    setDeleting(true)
    try {
      const response = await banksApi.deleteBank(bankToDelete.id)

      if (response.success) {
        toast.success('Bank berhasil dihapus')
        onRefresh()
      } else {
        toast.error(response.error || 'Failed to delete bank')
      }
    } catch (error) {
      console.error('Delete bank error:', error)
      toast.error('An error occurred while deleting bank')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setBankToDelete(null)
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
    if (!pagination) return banks.length
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
              <TableHead>Bank Name</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Holder Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No banks found
                </TableCell>
              </TableRow>
            ) : (
              banks.map((bank, index) => {
                const displayNumber = pagination ? pagination.offset + index + 1 : index + 1
                return (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{String(displayNumber)}</TableCell>
                    <TableCell className="font-medium">{bank.bank_name}</TableCell>
                    <TableCell>{bank.bank_account}</TableCell>
                    <TableCell>{bank.holder_name}</TableCell>
                    <TableCell>
                      <Badge variant={bank.is_active ? 'default' : 'secondary'}>
                        {bank.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => onEdit(bank)} className="rounded-[50%] text-green-600 bg-green-600/10">
                          <Edit className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(bank)} className="rounded-[50%] text-red-500 bg-red-500/10">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-muted-foreground">
            Menampilkan {getPageStart()} - {getPageEnd()} dari {pagination.total} bank
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
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete bank <strong>{bankToDelete?.bank_name}</strong>?
              This action cannot be undone. If this bank is still referenced by a tenant, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
