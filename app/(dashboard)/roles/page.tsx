'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Role, rolesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Home, ShieldCheck, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import RolesTable from '@/components/table/roles-table'
import RoleDetailDialog from '@/components/dialogs/role-detail-dialog'
import toast from 'react-hot-toast'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const loadRoles = async () => {
    setLoading(true)
    try {
      const response = await rolesApi.getRoles()
      
      if (response.success && response.data) {
        setRoles(response.data)
        setFilteredRoles(response.data)
      } else {
        toast.error(response.error || 'Gagal memuat data roles')
      }
    } catch (error) {
      console.error('Load roles error:', error)
      toast.error('Terjadi kesalahan saat memuat data roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = roles.filter(role =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredRoles(filtered)
    } else {
      setFilteredRoles(roles)
    }
  }, [searchTerm, roles])

  const handleEdit = (role: Role) => {
    router.push(`/roles/edit/${role.id}`)
  }

  const handleView = (role: Role) => {
    setSelectedRole(role)
    setDetailDialogOpen(true)
  }

  const handleRefresh = () => {
    loadRoles()
  }

  const getStats = () => {
    const total = roles.length
    const superAdmin = roles.filter(role => role.level >= 100).length
    const admin = roles.filter(role => role.level >= 50 && role.level < 100).length
    const manager = roles.filter(role => role.level >= 20 && role.level < 50).length
    const staff = roles.filter(role => role.level >= 10 && role.level < 20).length
    const user = roles.filter(role => role.level < 10).length

    return { total, superAdmin, admin, manager, staff, user }
  }

  const stats = getStats()

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
              <ShieldCheck className="h-4 w-4" />
              Roles
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 hidden">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Semua role terdaftar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admin</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.superAdmin}</div>
            <p className="text-xs text-muted-foreground">
              Level 100+
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin</CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admin}</div>
            <p className="text-xs text-muted-foreground">
              Level 50-99
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manager}</div>
            <p className="text-xs text-muted-foreground">
              Level 20-49
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.staff}</div>
            <p className="text-xs text-muted-foreground">
              Level 10-19
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User</CardTitle>
            <div className="h-4 w-4 rounded-full bg-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user}</div>
            <p className="text-xs text-muted-foreground">
              Level 0-9
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
              <p className="text-muted-foreground">
                Kelola role dan level akses pengguna
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => router.push('/roles/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Role
              </Button>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64 bg-white"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Memuat data roles...</span>
              </div>
            </div>
          ) : (
            <RolesTable
              roles={filteredRoles}
              onEdit={handleEdit}
              onView={handleView}
              onRefresh={handleRefresh}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <RoleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        role={selectedRole}
      />
    </div>
  )
}
