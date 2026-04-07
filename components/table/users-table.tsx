'use client'

import React, { useState, useEffect } from 'react'
import { User, usersApi } from '@/lib/api'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MoreHorizontal, Edit, Trash2, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface PaginationInfo {
  total: number
  limit: number
  offset: number
}

interface UsersTableProps {
  users: User[]
  onEdit: (user: User) => void
  onView: (user: User) => void
  onRefresh: () => void
  loading?: boolean
  pagination?: PaginationInfo
  onPageChange?: (offset: number) => void
  can_edit?: boolean
  can_delete?: boolean
}

export default function UsersTable({ 
  users, 
  onEdit, 
  onView, 
  onRefresh, 
  loading = false,
  pagination,
  onPageChange,
  can_edit = true,
  can_delete = true
}: UsersTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    setDeleting(true)
    try {
      const response = await usersApi.deleteUser(userToDelete.id)
      
      if (response.success) {
        toast.success('User berhasil dihapus')
        onRefresh()
      } else {
        toast.error(response.error || 'Gagal menghapus user')
      }
    } catch (error) {
      console.error('Delete user error:', error)
      toast.error('Terjadi kesalahan saat menghapus user')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
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

  const getRoleBadgeVariant = (roleName?: string) => {
    switch (roleName?.toLowerCase()) {
      case 'super_admin':
        return 'destructive'
      case 'admin':
        return 'default'
      case 'user':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusBadgeVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'pending':
        return 'outline'
      case 'suspended':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getStatusDisplayText = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Aktif'
      case 'inactive':
        return 'Tidak Aktif'
      case 'pending':
        return 'Menunggu'
      case 'suspended':
        return 'Diblokir'
      default:
        return status || 'Tidak Diketahui'
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
    if (!pagination) return users.length
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
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Diperbarui</TableHead>
              <TableHead className="w-[70px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Tidak ada data user
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => {
                const isLast = index === users.length - 1;
                const rowNumber = pagination 
                  ? getPageStart() + index
                  : index + 1;
                return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{String(rowNumber)}</TableCell>
                  <TableCell className="font-medium">
                    {user.name || '-'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role?.name)}>
                      {user.role?.name || 'No Role'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                      <span
                          className={`px-3 py-1.5 rounded text-sm font-medium border ${user.status === "active"
                              ? "bg-green-600/15 text-green-600 border-green-600"
                              : "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400"
                              }`}
                      >
                          {getStatusDisplayText(user.status)}
                      </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.updated_at)}
                  </TableCell>
                  <TableCell
                      className={`py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                          }`}
                  >
                      <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => onView(user)} className="rounded-[50%] text-blue-500 bg-blue-500/10">
                              <Eye className="w-5 h-5" />
                          </Button>
                          {can_edit && (
                            <Button size="icon" variant="ghost" onClick={() => onEdit(user)} className="rounded-[50%] text-green-600 bg-green-600/10">
                                <Edit className="w-5 h-5" />
                            </Button>
                          )}
                          {can_delete && (
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(user)} className="rounded-[50%] text-red-500 bg-red-500/10">
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
            Menampilkan {getPageStart()} - {getPageEnd()} dari {pagination.total} user
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
                const pagesToShow = Math.min(5, totalPages)
                const pageNumbers: number[] = []
                
                if (totalPages <= 5) {
                  // Show all pages if 5 or fewer
                  for (let i = 1; i <= totalPages; i++) {
                    pageNumbers.push(i)
                  }
                } else if (currentPage <= 3) {
                  // Show first 5 pages
                  for (let i = 1; i <= 5; i++) {
                    pageNumbers.push(i)
                  }
                } else if (currentPage >= totalPages - 2) {
                  // Show last 5 pages
                  for (let i = totalPages - 4; i <= totalPages; i++) {
                    pageNumbers.push(i)
                  }
                } else {
                  // Show 2 pages before and 2 pages after current
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
              Apakah Anda yakin ingin menghapus user <strong>{userToDelete?.name || userToDelete?.email}</strong>?
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
