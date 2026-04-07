'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tenant, tenantsApi, User, authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Users, Plus, Search, RefreshCw, Loader2, FileText } from 'lucide-react'
import { useMenuPermissions } from '@/hooks/useMenuPermissions'

// Category options
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Semua Kategori' },
  { value: '1', label: 'Restoran/Cafe' },
  { value: '2', label: 'Sport Club' },
  { value: '3', label: 'Kantor' },
  { value: '4', label: 'Tempat Hiburan' },
  { value: '5', label: 'Retail/Toko' },
  { value: '6', label: 'Klinik/Kesehatan' },
  { value: '7', label: 'Pendidikan' },
  { value: '8', label: 'Jasa Keuangan' },
  { value: '9', label: 'Other' },
]

// Status options
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'inactive', label: 'Tidak Aktif' },
  { value: 'active', label: 'Aktif' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'blacklisted', label: 'Blacklisted' },
]

// Status string to integer mapping
const STATUS_TO_INTEGER: Record<string, number> = {
  'inactive': 0,
  'active': 1,
  'pending': 2,
  'expired': 3,
  'terminated': 4,
  'blacklisted': 5,
}
import TenantsTable from '@/components/table/tenants-table'
import TenantDetailDialog from '@/components/dialogs/tenant-detail-dialog'
import toast from 'react-hot-toast'

export default function TenantsPage() {
  const router = useRouter()
  const { can_add, can_edit, can_delete } = useMenuPermissions()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  
  // Filter dan sorting states
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [order, setOrder] = useState<string>('newest')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isTenantUser, setIsTenantUser] = useState(false)
  
  // Pagination states
  const [limit] = useState<number>(10)
  const [offset, setOffset] = useState<number>(0)
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number } | null>(null)

  const loadTenants = async () => {
    setLoading(true)
    try {
      // Prepare filter parameters
      const filterParams: any = {}
      
      // For tenant users, always filter by their user_id and don't use pagination
      if (isTenantUser && currentUser?.id) {
        filterParams.user_id = currentUser.id
        // Don't add limit/offset for tenant users - load all their tenants
      } else {
        // For admin users, use pagination and filters
        filterParams.limit = limit
        filterParams.offset = offset
      }
      
      if (searchTerm.trim()) {
        filterParams.name = searchTerm.trim()
      }
      if (!isTenantUser && categoryFilter !== 'all') {
        filterParams.category = categoryFilter
      }
      if (!isTenantUser && statusFilter !== 'all') {
        const statusInt = STATUS_TO_INTEGER[statusFilter]
        if (statusInt !== undefined) {
          filterParams.status = statusInt
        }
      }
      if (paymentStatusFilter !== 'all') {
        filterParams.payment_status = paymentStatusFilter
      }
      if (order) {
        filterParams.order = order
      }
      
      const response = await tenantsApi.getTenants(filterParams)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const tenantsData = Array.isArray(responseData.data) ? responseData.data : []
        
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
            total: tenantsData.length,
            limit: limit,
            offset: offset
          }
        }
        
        setTenants(tenantsData)
        // Since filtering is done on backend, filteredTenants should be same as tenants
        setFilteredTenants(tenantsData)
        setPagination(paginationData)
      } else {
        toast.error(response.error || 'Gagal memuat data tenants')
        setTenants([])
        setFilteredTenants([])
        setPagination(null)
      }
    } catch (error) {
      console.error('Load tenants error:', error)
      toast.error('Terjadi kesalahan saat memuat data tenants')
      setTenants([])
      setFilteredTenants([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }


  const loadCurrentUser = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setCurrentUser(user)
      
      // Check if user is a tenant by checking if they have tenants associated with them
      if (user && user.id) {
        try {
          const tenantsResponse = await tenantsApi.getTenants({ user_id: user.id, limit: 1 })
          if (tenantsResponse.success && tenantsResponse.data) {
            const tenantsData = tenantsResponse.data as any
            const tenants = Array.isArray(tenantsData.data) 
              ? tenantsData.data 
              : (Array.isArray(tenantsData) ? tenantsData : [])
            if (tenants.length > 0) {
              setIsTenantUser(true)
            }
          }
        } catch (error) {
          console.error('Error checking tenant status:', error)
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadTenants()
    }
  }, [currentUser, isTenantUser])

  // Reload data when filters or pagination change
  useEffect(() => {
    if (currentUser) {
      loadTenants()
    }
  }, [searchTerm, categoryFilter, statusFilter, paymentStatusFilter, order, offset, currentUser, isTenantUser])

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Remove the old client-side filtering since we're using server-side filtering
  // useEffect(() => {
  //   if (searchTerm.trim()) {
  //     const filtered = tenants.filter(tenant =>
  //       tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       tenant.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       (tenant.user?.name && tenant.user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
  //       (tenant.user?.email && tenant.user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  //     )
  //     setFilteredTenants(filtered)
  //   } else {
  //     setFilteredTenants(tenants)
  //   }
  // }, [searchTerm, tenants])

  const handleEdit = (tenant: Tenant) => {
    router.push(`/tenants/edit/${tenant.id}`)
  }

  const handleView = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setDetailDialogOpen(true)
  }

  const handleRefresh = () => {
    loadTenants()
  }

  const getStats = () => {
    if (!Array.isArray(tenants)) {
      return { total: 0, active: 0, expiring: 0, expired: 0 }
    }
    
    const total = tenants.length
    const active = tenants.filter(tenant => {
      const endDate = new Date(tenant.contract_end_at)
      const now = new Date()
      return endDate > now
    }).length
    const expiring = tenants.filter(tenant => {
      const endDate = new Date(tenant.contract_end_at)
      const now = new Date()
      const diffTime = endDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 30 && diffDays > 0
    }).length
    const expired = tenants.filter(tenant => {
      const endDate = new Date(tenant.contract_end_at)
      const now = new Date()
      return endDate <= now
    }).length

    return { total, active, expiring, expired }
  }

  const stats = getStats()

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full min-w-0">
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
              <FileText className="h-4 w-4" />
              Tenants
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 hidden">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Semua tenant terdaftar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kontrak Aktif</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Kontrak masih berlaku
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Akan Kadaluarsa</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiring}</div>
            <p className="text-xs text-muted-foreground">
              Kadaluarsa dalam 30 hari
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kadaluarsa</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">
              Kontrak sudah berakhir
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
              <p className="text-muted-foreground">
                Kelola data tenant dan kontrak sewa
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isTenantUser && can_add && (
                <Button onClick={() => router.push('/tenants/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Tenant
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filter Bar - Horizontal Layout */}
          {!isTenantUser ? (
            <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari tenant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-white"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Status Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status Pembayaran</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="reminder_needed">Reminder Needed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={order} onValueChange={setOrder}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-z">Nama A - Z</SelectItem>
                  <SelectItem value="z-a">Nama Z - A</SelectItem>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="oldest">Terlama</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('')
                  setCategoryFilter('all')
                  setStatusFilter('all')
                  setPaymentStatusFilter('all')
                  setOrder('a-z')
                  setOffset(0)
                }}
              >
                Reset
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari tenant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-white"
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Memuat data tenants...</span>
              </div>
            </div>
          ) : (
            <TenantsTable
              tenants={filteredTenants}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
              pagination={!isTenantUser ? (pagination || undefined) : undefined}
              onPageChange={handlePageChange}
              can_edit={can_edit}
              can_delete={can_delete}
              paymentStatusFilter={paymentStatusFilter}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <TenantDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        tenant={selectedTenant}
      />
    </div>
  )
}
