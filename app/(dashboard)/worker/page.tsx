'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, usersApi, Role, rolesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Search, Loader2, Eye, RefreshCw, UsersRound, Home, UserRoundPen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WorkerPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [securityRoleId, setSecurityRoleId] = useState<string | null>(null)
  const [cleaningRoleId, setCleaningRoleId] = useState<string | null>(null)

  // Load roles to find security and cleaning role IDs
  const loadRoles = async () => {
    try {
      const response = await rolesApi.getRoles()
      if (response.success && response.data) {
        const rolesData = response.data as any
        const rolesList = Array.isArray(rolesData.data) ? rolesData.data : (Array.isArray(rolesData) ? rolesData : [])
        setRoles(rolesList)
        
        // Find role IDs for security and cleaning
        const securityRole = rolesList.find((r: Role) => 
          r.name?.toLowerCase().includes('keamanan') || 
          r.name?.toLowerCase().includes('security') ||
          r.name?.toLowerCase().includes('satpam')
        )
        const cleaningRole = rolesList.find((r: Role) => 
          r.name?.toLowerCase().includes('kebersihan') || 
          r.name?.toLowerCase().includes('cleaning') ||
          r.name?.toLowerCase().includes('cleaning')
        )
        
        if (securityRole) {
          setSecurityRoleId(String(securityRole.id))
        }
        if (cleaningRole) {
          setCleaningRoleId(String(cleaningRole.id))
        }
      }
    } catch (error) {
      console.error('Load roles error:', error)
    }
  }

  // Load workers (users with security or cleaning role)
  const loadWorkers = async () => {
    setLoading(true)
    try {
      const allWorkers: User[] = []
      
      // Load security workers
      if (securityRoleId) {
        const securityResponse = await usersApi.getUsers({
          role_id: securityRoleId,
          limit: 100,
          offset: 0
        })
        if (securityResponse.success && securityResponse.data) {
          const responseData = securityResponse.data as any
          const securityWorkers = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : [])
          allWorkers.push(...securityWorkers)
        }
      }
      
      // Load cleaning workers
      if (cleaningRoleId) {
        const cleaningResponse = await usersApi.getUsers({
          role_id: cleaningRoleId,
          limit: 100,
          offset: 0
        })
        if (cleaningResponse.success && cleaningResponse.data) {
          const responseData = cleaningResponse.data as any
          const cleaningWorkers = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : [])
          allWorkers.push(...cleaningWorkers)
        }
      }
      
      // Remove duplicates based on user ID
      const uniqueWorkers = allWorkers.filter((worker, index, self) =>
        index === self.findIndex((w) => w.id === worker.id)
      )
      
      // Filter by search term if provided
      if (searchTerm.trim()) {
        const filtered = uniqueWorkers.filter(worker =>
          worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setWorkers(filtered)
      } else {
        setWorkers(uniqueWorkers)
      }
    } catch (error) {
      console.error('Load workers error:', error)
      toast.error('Terjadi kesalahan saat memuat data pekerja')
      setWorkers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  useEffect(() => {
    if (securityRoleId || cleaningRoleId) {
      loadWorkers()
    }
  }, [securityRoleId, cleaningRoleId, searchTerm])

  const handleViewDetail = (userId: string) => {
    router.push(`/worker/${userId}`)
  }

  const getRoleBadge = (user: User) => {
    const roleName = user.role?.name || ''
    if (roleName.toLowerCase().includes('keamanan') || roleName.toLowerCase().includes('security')) {
      return <Badge variant="default" className="bg-blue-600">Keamanan</Badge>
    } else if (roleName.toLowerCase().includes('kebersihan') || roleName.toLowerCase().includes('cleaning')) {
      return <Badge variant="default" className="bg-green-600">Kebersihan</Badge>
    }
    return <Badge variant="outline">{roleName}</Badge>
  }

  const getStatusBadge = (status?: string) => {
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-600">Aktif</Badge>
    } else if (status === 'inactive') {
      return <Badge variant="secondary">Tidak Aktif</Badge>
    }
    return <Badge variant="outline">{status || '-'}</Badge>
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
              <UserRoundPen className="h-4 w-4" />
              Data Pekerja
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Search and Filter */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Pekerja</h1>
              <p className="text-muted-foreground">
                Daftar pekerja dengan role keamanan dan kebersihan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadWorkers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari nama atau email pekerja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Workers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Memuat data pekerja...</span>
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Tidak ada data pekerja ditemukan</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>No. Telepon</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">
                        {worker.name || '-'}
                      </TableCell>
                      <TableCell>
                        {worker.email || '-'}
                      </TableCell>
                      <TableCell>
                        {worker.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(worker)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(worker.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(worker.id)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
