'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ComplaintReport, complaintReportsApi, authApi, User } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, AlertTriangle, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import ComplaintReportsTable from '@/components/table/complaint-reports-table'
import ComplaintReportDetailDialog from '@/components/dialogs/complaint-report-detail-dialog'
import ComplaintReportEditDialog from '@/components/dialogs/complaint-report-edit-dialog'
import toast from 'react-hot-toast'

export default function ComplaintReportsPage() {
  const router = useRouter()
  const [complaintReports, setComplaintReports] = useState<ComplaintReport[]>([])
  const [filteredComplaintReports, setFilteredComplaintReports] = useState<ComplaintReport[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedComplaintReport, setSelectedComplaintReport] = useState<ComplaintReport | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [complaintReportToEdit, setComplaintReportToEdit] = useState<ComplaintReport | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<string>('desc')

  const loadComplaintReports = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const filterParams: any = {}
      const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === 2
      
      if (searchTerm.trim()) {
        filterParams.title = searchTerm.trim()
      }
      if (!isAdmin && currentUser?.assetIds && currentUser.assetIds.length > 0) {
        filterParams.asset_id = currentUser.assetIds[0]
      }
      // Only apply type filter if user is super admin (role_id 1 or 2)
      if (showTypeColumn() && typeFilter !== 'all') {
        filterParams.type = typeFilter as 'complaint' | 'report'
      }
      if (statusFilter !== 'all') {
        // Map filter value to string status
        const statusMap: Record<string, string> = {
          '0': 'pending',
          '1': 'in_progress',
          '2': 'resolved',
          '3': 'closed'
        }
        filterParams.status = statusMap[statusFilter] || statusFilter
      }
      if (priorityFilter !== 'all') {
        // Map filter value to string priority
        const priorityMap: Record<string, string> = {
          '0': 'low',
          '1': 'medium',
          '2': 'high',
          '3': 'urgent'
        }
        filterParams.priority = priorityMap[priorityFilter] || priorityFilter
      }
      if (sortBy && sortOrder) {
        filterParams.order = `${sortBy}_${sortOrder}`
      }
      
      const response = await complaintReportsApi.getComplaintReports(filterParams)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        let reportsData: ComplaintReport[] = []
        
        if (Array.isArray(responseData)) {
          reportsData = responseData
        } else if (responseData.data && Array.isArray(responseData.data)) {
          reportsData = responseData.data
        } else if (responseData.complaintReports && Array.isArray(responseData.complaintReports)) {
          reportsData = responseData.complaintReports
        }
        
        // Keep status and priority as strings (as returned from backend)
        setComplaintReports(reportsData)
        setFilteredComplaintReports(reportsData)
      } else {
        toast.error(response.error || 'Failed to load complaint reports')
        setComplaintReports([])
        setFilteredComplaintReports([])
      }
    } catch (error) {
      console.error('Load complaint reports error:', error)
      toast.error('An error occurred while loading complaint reports')
      setComplaintReports([])
      setFilteredComplaintReports([])
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Load current user error:', error)
    }
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  // Reload data when filters change
  useEffect(() => {
    loadComplaintReports()
  }, [searchTerm, typeFilter, statusFilter, priorityFilter, sortBy, sortOrder, currentUser])

  // Check if user can create complaint reports (only role_id 4 and 5)
  const canCreateComplaintReport = () => {
    if (!currentUser || !currentUser.role_id) return false
    return currentUser.role_id === 4 || currentUser.role_id === 5
  }

  // Check if user is super admin (role_id 1 or 2) to show type column
  const showTypeColumn = () => {
    if (!currentUser || !currentUser.role_id) return false
    return currentUser.role_id === 1 || currentUser.role_id === 2
  }

  const handleEdit = (complaintReport: ComplaintReport) => {
    setComplaintReportToEdit(complaintReport)
    setEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    loadComplaintReports()
  }

  const handleView = (complaintReport: ComplaintReport) => {
    setSelectedComplaintReport(complaintReport)
    setDetailDialogOpen(true)
  }

  const handleRefresh = () => {
    loadComplaintReports()
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
              <AlertTriangle className="h-4 w-4" />
              Findings and Issues
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings and Issues</h1>
          <p className="text-muted-foreground">
            Manage complaint reports and issues
          </p>
        </div>
        {canCreateComplaintReport() && (
          <Button onClick={() => router.push('/complaint-reports/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Report
          </Button>
        )}
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Complaint Reports List</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search complaint reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>
            
            {showTypeColumn() && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="0">Pending</SelectItem>
                <SelectItem value="1">In Progress</SelectItem>
                <SelectItem value="2">Resolved</SelectItem>
                <SelectItem value="3">Closed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="0">Low</SelectItem>
                <SelectItem value="1">Medium</SelectItem>
                <SelectItem value="2">High</SelectItem>
                <SelectItem value="3">Urgent</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[120px] bg-white">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">A - Z</SelectItem>
                <SelectItem value="desc">Z - A</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm('')
                setTypeFilter('all')
                setStatusFilter('all')
                setPriorityFilter('all')
                setSortBy('created_at')
                setSortOrder('desc')
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
                <span>Loading complaint reports...</span>
              </div>
            </div>
          ) : (
            <ComplaintReportsTable
              complaintReports={filteredComplaintReports}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
              showType={showTypeColumn()}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <ComplaintReportDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open)
          if (!open) {
            setSelectedComplaintReport(null)
          }
        }}
        complaintReport={selectedComplaintReport}
      />

      {/* Edit Dialog */}
      <ComplaintReportEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setComplaintReportToEdit(null)
          }
        }}
        complaintReport={complaintReportToEdit}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}

