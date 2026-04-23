'use client'

import React, { useState, useEffect } from 'react'
import { ComplaintReport, complaintReportsApi, authApi, User } from '@/lib/api'
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
import { Card, CardContent } from '@/components/ui/card'
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
import { Edit, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface ComplaintReportsTableProps {
  complaintReports: ComplaintReport[]
  onEdit: (complaintReport: ComplaintReport) => void
  onView: (complaintReport: ComplaintReport) => void
  onRefresh: () => void
  loading?: boolean
  showType?: boolean // Show type column (for super admin role_id 1 or 2)
}

export default function ComplaintReportsTable({ 
  complaintReports, 
  onEdit, 
  onView,
  onRefresh, 
  loading = false,
  showType = true
}: ComplaintReportsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [complaintReportToDelete, setComplaintReportToDelete] = useState<ComplaintReport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    setMounted(true)
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Load current user error:', error)
    }
  }

  // Get status as string
  const getStatusString = (status?: number | string): string => {
    if (status === undefined || status === null) return ''
    
    if (typeof status === 'string') {
      return status.toLowerCase()
    } else if (typeof status === 'number') {
      // Map number to string
      const statusMap: Record<number, string> = {
        0: 'pending',
        1: 'in_progress',
        2: 'resolved',
        3: 'closed'
      }
      return statusMap[status] || ''
    }
    return ''
  }

  // Check if edit button should be shown (not resolved or closed)
  const canEdit = (report: ComplaintReport): boolean => {
    const statusString = getStatusString(report.status)
    return statusString !== 'resolved' && statusString !== 'closed'
  }

  // Check if delete button should be enabled
  const canDelete = (report: ComplaintReport): boolean => {
    if (!currentUser || !currentUser.id) return false

    // Check if report was created by current user
    const isCreatedByUser = 
      report.reporter_id === currentUser.id || 
      report.created_by === currentUser.id ||
      report.reporter?.id === currentUser.id

    if (!isCreatedByUser) return false

    // Check if status is pending or in_progress
    const statusString = getStatusString(report.status)
    return statusString === 'pending' || statusString === 'in_progress' || statusString === 'inprogress'
  }

  const handleDeleteClick = (complaintReport: ComplaintReport) => {
    setComplaintReportToDelete(complaintReport)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!complaintReportToDelete) return

    setDeleting(true)
    try {
      const response = await complaintReportsApi.deleteComplaintReport(complaintReportToDelete.id)
      
      if (response.success) {
        toast.success('Complaint report deleted successfully')
        onRefresh()
      } else {
        toast.error(response.error || 'Failed to delete complaint report')
      }
    } catch (error) {
      console.error('Delete complaint report error:', error)
      toast.error('An error occurred while deleting complaint report')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setComplaintReportToDelete(null)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!mounted || !dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status?: number | string) => {
    if (status === undefined || status === null) {
      return <Badge variant="secondary">Unknown</Badge>
    }
    
    // Handle string status values
    if (typeof status === 'string') {
      const statusLower = status.toLowerCase()
      switch (statusLower) {
        case 'pending':
        case '0':
          return <Badge variant="default" className="bg-yellow-600">Pending</Badge>
        case 'in_progress':
        case 'inprogress':
        case '1':
          return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
        case 'resolved':
        case '2':
          return <Badge variant="default" className="bg-green-600">Resolved</Badge>
        case 'closed':
        case '3':
          return <Badge variant="default" className="bg-gray-600">Closed</Badge>
        default:
          return <Badge variant="secondary">Unknown</Badge>
      }
    }
    
    // Handle number status values
    switch (status) {
      case 0: // pending
        return <Badge variant="default" className="bg-yellow-600">Pending</Badge>
      case 1: // in_progress
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
      case 2: // resolved
        return <Badge variant="default" className="bg-green-600">Resolved</Badge>
      case 3: // closed
        return <Badge variant="default" className="bg-gray-600">Closed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getPriorityBadge = (priority?: number | string) => {
    if (priority === undefined || priority === null) {
      return <Badge variant="secondary">-</Badge>
    }
    
    // Handle string priority values
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase()
      switch (priorityLower) {
        case 'low':
        case '0':
          return <Badge variant="outline" className="border-gray-400 text-gray-600">Low</Badge>
        case 'medium':
        case '1':
          return <Badge variant="outline" className="border-blue-400 text-blue-600">Medium</Badge>
        case 'high':
        case '2':
          return <Badge variant="outline" className="border-orange-400 text-orange-600">High</Badge>
        case 'urgent':
        case '3':
          return <Badge variant="destructive">Urgent</Badge>
        default:
          return <Badge variant="secondary">Unknown</Badge>
      }
    }
    
    // Handle number priority values
    switch (priority) {
      case 0: // low
        return <Badge variant="outline" className="border-gray-400 text-gray-600">Low</Badge>
      case 1: // medium
        return <Badge variant="outline" className="border-blue-400 text-blue-600">Medium</Badge>
      case 2: // high
        return <Badge variant="outline" className="border-orange-400 text-orange-600">High</Badge>
      case 3: // urgent
        return <Badge variant="destructive">Urgent</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
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

  if (complaintReports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No complaint reports found</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table View - hidden on mobile */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              {showType && <TableHead>Type</TableHead>}
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {complaintReports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-mono text-sm">{report.id}</TableCell>
                {showType && (
                  <TableCell>
                    <Badge variant={report.type === 'complaint' ? 'default' : 'outline'}>
                      {report.type === 'complaint' ? 'Complaint' : 'Report'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="font-medium">{report.title || '-'}</TableCell>
                <TableCell>{getStatusBadge(report.status)}</TableCell>
                <TableCell>{getPriorityBadge(report.priority)}</TableCell>
                <TableCell>{report.asset?.name || report.asset_id || '-'}</TableCell>
                <TableCell>{report.tenant?.name || '-'}</TableCell>
                <TableCell>
                  {report.reporter?.name || report.reporter_id || '-'}
                </TableCell>
                <TableCell>{formatDate(report.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onView(report)}
                      className="rounded-[50%] text-blue-500 bg-blue-500/10"
                    >
                      <Eye className="w-5 h-5" />
                    </Button>
                    {canEdit(report) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(report)}
                        className="rounded-[50%] text-green-600 bg-green-600/10"
                      >
                        <Edit className="w-5 h-5" />
                      </Button>
                    )}
                    {canDelete(report) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteClick(report)}
                        className="rounded-[50%] text-red-500 bg-red-500/10"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - visible only on mobile */}
      <div className="md:hidden space-y-4">
        {complaintReports.map((report) => (
          <Card key={report.id} className="border">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header with ID and Type */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">#{report.id}</span>
                    {showType && (
                      <Badge variant={report.type === 'complaint' ? 'default' : 'outline'}>
                        {report.type === 'complaint' ? 'Complaint' : 'Report'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-semibold text-base">{report.title || '-'}</h3>
                </div>

                {/* Status and Priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(report.status)}
                  {getPriorityBadge(report.priority)}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  {report.tenant?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tenant:</span>
                      <span className="font-medium">{report.tenant.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Asset:</span>
                    <span className="font-medium">{report.asset?.name || report.asset_id || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reported By:</span>
                    <span className="font-medium">{report.reporter?.name || report.reporter_id || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(report.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onView(report)}
                    className="flex-1 text-blue-500 bg-blue-500/10"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  {canEdit(report) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(report)}
                      className="flex-1 text-green-600 bg-green-600/10"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canDelete(report) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(report)}
                      className="flex-1 text-red-500 bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete complaint report &quot;{complaintReportToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
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

