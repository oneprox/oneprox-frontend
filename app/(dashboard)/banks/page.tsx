'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bank, banksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Landmark, Plus, Search, RefreshCw, Loader2 } from 'lucide-react'
import BanksTable from '@/components/table/banks-table'
import toast from 'react-hot-toast'

export default function BanksPage() {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [order, setOrder] = useState<string>('newest')
  const [limit] = useState<number>(10)
  const [offset, setOffset] = useState<number>(0)
  const [pagination, setPagination] = useState<{ total: number; limit: number; offset: number } | undefined>(undefined)

  const loadBanks = async () => {
    setLoading(true)
    try {
      const filterParams: any = { limit, offset }
      if (searchTerm.trim()) filterParams.bank_name = searchTerm.trim()
      if (statusFilter !== 'all') filterParams.is_active = statusFilter === 'active'
      if (order) filterParams.order = order

      const response = await banksApi.getBanks(filterParams)

      if (response.success && response.data) {
        const responseData = response.data as any
        let banksData: Bank[] = []

        if (responseData && typeof responseData === 'object') {
          if (responseData.data && Array.isArray(responseData.data.banks)) {
            banksData = responseData.data.banks
          } else if (Array.isArray(responseData.banks)) {
            banksData = responseData.banks
          } else if (Array.isArray(responseData.data)) {
            banksData = responseData.data
          } else if (Array.isArray(responseData)) {
            banksData = responseData
          }
        }

        if (!Array.isArray(banksData)) banksData = []

        let paginationData: { total: number; limit: number; offset: number } | undefined = undefined
        if (response.pagination) {
          paginationData = {
            total: response.pagination.total || 0,
            limit: response.pagination.limit || limit,
            offset: response.pagination.offset || offset
          }
        } else if (responseData && typeof responseData === 'object' && responseData.total !== undefined) {
          paginationData = {
            total: responseData.total || 0,
            limit: responseData.limit || limit,
            offset: responseData.offset || offset
          }
        }
        // Fallback: Check responseData.data for nested structure
        else if (responseData.data && typeof responseData.data === 'object' && responseData.data.total !== undefined) {
          paginationData = {
            total: responseData.data.total || 0,
            limit: responseData.data.limit || limit,
            offset: responseData.data.offset || offset
          }
        }
        // Fallback: Check responseData.pagination
        else if (responseData.pagination) {
          paginationData = {
            total: responseData.pagination.total || 0,
            limit: responseData.pagination.limit || limit,
            offset: responseData.pagination.offset || offset
          }
        }

        setBanks(banksData)
        setPagination(paginationData)
      } else {
        toast.error(response.error || 'Failed to load banks')
        setBanks([])
        setPagination(undefined)
      }
    } catch (error) {
      console.error('Load banks error:', error)
      toast.error('An error occurred while loading banks')
      setBanks([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setOffset(0)
  }, [searchTerm, statusFilter, order])

  useEffect(() => {
    loadBanks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, order, offset])

  const handleEdit = (bank: Bank) => {
    router.push(`/banks/edit/${bank.id}`)
  }

  const handleRefresh = () => {
    setOffset(0)
    loadBanks()
  }

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset)
  }

  return (
    <div className="space-y-6">
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
              <Landmark className="h-4 w-4" />
              Bank
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank</h1>
          <p className="text-muted-foreground">
            Kelola daftar rekening bank perusahaan
          </p>
        </div>
        <Button onClick={() => router.push('/banks/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Bank
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Bank</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama bank..."
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

            <Select value={order} onValueChange={setOrder}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
                <SelectItem value="a-z">Nama A-Z</SelectItem>
                <SelectItem value="z-a">Nama Z-A</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setOrder('newest')
                setOffset(0)
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
                <span>Memuat daftar bank...</span>
              </div>
            </div>
          ) : (
            <BanksTable
              banks={banks}
              onEdit={handleEdit}
              onRefresh={handleRefresh}
              loading={loading}
              pagination={pagination}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
