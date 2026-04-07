'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { userTasksApi, assetsApi, UserTask, Asset, User } from '@/lib/api'
import { authApi } from '@/lib/api'
import LoadingSkeleton from "@/components/loading-skeleton"

interface NonRoutineWorkData {
  id: number
  nama: string
  aset: string
  area: string
  jatuhTempo: string
  jenisPekerjaan: string
  deskripsiPekerjaan: string
  status: string
}

interface NonRoutineWorkProps {
  selectedAssetId?: string
}

export default function NonRoutineWork({ selectedAssetId = 'all' }: NonRoutineWorkProps) {
  const [workData, setWorkData] = useState<NonRoutineWorkData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNonRoutineWork()
  }, [selectedAssetId])

  const loadNonRoutineWork = async () => {
    try {
      setLoading(true)
      
      // Load assets
      const assetsResponse = await assetsApi.getAssets({ limit: 1000 })
      if (!assetsResponse.success || !assetsResponse.data) {
        return
      }

      const assetsList: Asset[] = Array.isArray(assetsResponse.data) ? assetsResponse.data : []

      // Load all user tasks (we'll filter for non-routine tasks)
      // Non-routine tasks might be tasks without schedules or tasks with specific flags
      const tasksResponse = await userTasksApi.getUserTasks({ limit: 10000 })
      if (!tasksResponse.success || !tasksResponse.data) {
        return
      }

      const tasksList: UserTask[] = Array.isArray(tasksResponse.data) ? tasksResponse.data : []

      // Load users to get names
      const usersMap = new Map<string, User>()
      try {
        const currentUser = await authApi.getCurrentUser()
        if (currentUser) {
          usersMap.set(currentUser.id, currentUser)
        }
      } catch (err) {
        console.error('Error loading current user:', err)
      }

      const workTableData: NonRoutineWorkData[] = []
      const now = new Date()

      // Filter for non-routine tasks (tasks that are pending or in progress and have a deadline/start_at)
      // We'll consider tasks that are not completed and have a start_at or created_at as potential non-routine
      const nonRoutineTasks = tasksList.filter(task => {
        // Filter for tasks that are pending or in progress
        return (task.status === 'pending' || task.status === 'inprogress' || task.status === 'in_progress') && task.task
      })

      nonRoutineTasks.forEach((task: UserTask) => {
        const asset = task.task?.asset_id ? assetsList.find(a => a.id === task.task?.asset_id) : null
        
        // Filter by selected asset
        if (selectedAssetId !== 'all' && (!asset || asset.id !== selectedAssetId)) {
          return
        }
        
        const user = task.user || (task.user_id ? usersMap.get(task.user_id) : null)
        
        // Use start_at or created_at as deadline
        const deadline = task.start_at ? new Date(task.start_at) : (task.created_at ? new Date(task.created_at) : null)
        
        // Determine status based on deadline
        let status = 'On Process'
        let statusColor = 'default'
        
        if (deadline) {
          const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysUntilDeadline < 0) {
            status = 'Overdue'
            statusColor = 'destructive'
          } else if (daysUntilDeadline <= 7) {
            status = 'On Process'
            statusColor = 'default'
          } else if (daysUntilDeadline <= 14) {
            status = 'On Process'
            statusColor = 'default'
          }
        }

        workTableData.push({
          id: typeof task.id === 'number' ? task.id : (typeof task.user_task_id === 'number' ? task.user_task_id : parseInt(String(task.id || task.user_task_id || 0))),
          nama: user?.name || task.user?.name || '-',
          aset: asset?.name || '-',
          area: task.task?.name?.includes('All Area') ? 'All Area' : (task.task?.name || '-'),
          jatuhTempo: deadline ? deadline.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }) : '-',
          jenisPekerjaan: 'Non Rutin',
          deskripsiPekerjaan: task.task?.name || task.notes || '-',
          status
        })
      })

      // Sort by deadline (overdue first)
      workTableData.sort((a, b) => {
        if (a.status === 'Overdue' && b.status !== 'Overdue') return -1
        if (a.status !== 'Overdue' && b.status === 'Overdue') return 1
        return new Date(a.jatuhTempo).getTime() - new Date(b.jatuhTempo).getTime()
      })

      setWorkData(workTableData)
    } catch (err) {
      console.error('Error loading non-routine work:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'Overdue') {
      return <Badge variant="destructive">{status}</Badge>
    }
    return <Badge variant="default">{status}</Badge>
  }

  if (loading) {
    return <LoadingSkeleton height="h-96" text="Memuat data pekerjaan non rutin..." />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PEKERJAAN NON RUTIN</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">NO</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>ASET</TableHead>
                <TableHead>AREA</TableHead>
                <TableHead>JATUH TEMPO</TableHead>
                <TableHead>JENIS PEKERJAAN</TableHead>
                <TableHead>DESKRIPSI PEKERJAAN</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Tidak ada data pekerjaan non rutin
                  </TableCell>
                </TableRow>
              ) : (
                workData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.aset}</TableCell>
                    <TableCell>{item.area}</TableCell>
                    <TableCell>{item.jatuhTempo}</TableCell>
                    <TableCell>{item.jenisPekerjaan}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsiPekerjaan}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>2 Minggu Sebelum Jatuh Tempo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>1 Minggu Sebelum Jatuh Tempo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Telah Jatuh Tempo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
