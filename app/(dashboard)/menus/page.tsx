'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, menusApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Menu as MenuIcon, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import MenusTable from '@/components/table/menus-table'
import MenuDetailDialog from '@/components/dialogs/menu-detail-dialog'
import MenuFormDialog from '@/components/dialogs/menu-form-dialog'
import { showToast } from '@/lib/toast'

export default function MenusPage() {
  const router = useRouter()
  const [menus, setMenus] = useState<Menu[]>([])
  const [filteredMenus, setFilteredMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  
  // Filter dan sorting states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [parentFilter, setParentFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('title')
  const [sortOrder, setSortOrder] = useState<string>('asc')

  const loadMenus = async () => {
    setLoading(true)
    try {
      // Prepare filter parameters
      const filterParams: any = {}
      if (searchTerm.trim()) {
        filterParams.title = searchTerm.trim()
      }
      if (statusFilter !== 'all') {
        filterParams.is_active = statusFilter === 'active'
      }
      if (parentFilter !== 'all') {
        if (parentFilter === 'parent') {
          filterParams.parent_id = null
        } else if (parentFilter === 'child') {
          filterParams.has_parent = true
        }
      }
      if (sortBy && sortOrder) {
        filterParams.order = `${sortBy}_${sortOrder}`
      }
      
      const response = await menusApi.getMenus(filterParams)
      
      if (response.success && response.data) {
        setMenus(response.data)
        setFilteredMenus(response.data)
      } else {
        showToast.error(response.error || 'Gagal memuat data menus')
      }
    } catch (error) {
      console.error('Load menus error:', error)
      showToast.error('Terjadi kesalahan saat memuat data menus')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMenus()
  }, [])

  // Reload data when filters change
  useEffect(() => {
    loadMenus()
  }, [searchTerm, statusFilter, parentFilter, sortBy, sortOrder])

  // Remove the old client-side filtering since we're using server-side filtering
  // useEffect(() => {
  //   if (searchTerm.trim()) {
  //     const filtered = menus.filter(menu =>
  //       menu.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       menu.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       menu.icon?.toLowerCase().includes(searchTerm.toLowerCase())
  //     )
  //     setFilteredMenus(filtered)
  //   } else {
  //     setFilteredMenus(menus)
  //   }
  // }, [searchTerm, menus])

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu)
    setFormDialogOpen(true)
  }

  const handleView = (menu: Menu) => {
    setSelectedMenu(menu)
    setDetailDialogOpen(true)
  }

  const handleRefresh = () => {
    loadMenus()
  }

  const handleAddNew = () => {
    setEditingMenu(null)
    setFormDialogOpen(true)
  }

  const handleFormSuccess = () => {
    loadMenus()
  }

  // Calculate stats
  const totalMenus = menus.length
  const activeMenus = menus.filter(menu => menu.is_active).length
  const inactiveMenus = menus.filter(menu => !menu.is_active).length
  const parentMenus = menus.filter(menu => !menu.parent_id).length
  const childMenus = menus.filter(menu => menu.parent_id).length

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>Menu Management</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 hidden">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Menus</CardTitle>
            <MenuIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMenus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Menus</CardTitle>
            <MenuIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMenus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Menus</CardTitle>
            <MenuIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inactiveMenus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parent Menus</CardTitle>
            <MenuIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{parentMenus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Child Menus</CardTitle>
            <MenuIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{childMenus}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
              <p className="text-muted-foreground">
                Kelola menu dan navigasi sistem
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Menu
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filter Bar - Horizontal Layout */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={parentFilter} onValueChange={setParentFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Tipe Menu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="parent">Parent Menu</SelectItem>
                <SelectItem value="child">Child Menu</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Judul</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="order">Urutan</SelectItem>
                <SelectItem value="created_at">Tanggal Dibuat</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[120px] bg-white">
                <SelectValue placeholder="Urutan" />
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
                setStatusFilter('all')
                setParentFilter('all')
                setSortBy('title')
                setSortOrder('asc')
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
                <span>Memuat data menus...</span>
              </div>
            </div>
          ) : (
            <MenusTable
              menus={filteredMenus}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedMenu && (
        <MenuDetailDialog
          menu={selectedMenu}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
        />
      )}

      {/* Form Dialog */}
      <MenuFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        menu={editingMenu}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
