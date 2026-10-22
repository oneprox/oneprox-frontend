'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { DashboardWorker } from "@/lib/api"

interface PekerjaProps {
  workers: DashboardWorker[]
}

export default function Pekerja({ workers }: PekerjaProps) {
  const router = useRouter()

  const handleWorkerClick = (workerId: string | number) => {
    router.push(`/worker/${workerId}`)
  }

  const getRoleColor = (role: string) => {
    const roleLower = role.toLowerCase()
    if (roleLower === 'cleaning' || roleLower === 'kebersihan') {
      return 'bg-blue-500'
    } else if (roleLower === 'security' || roleLower === 'keamanan') {
      return 'bg-yellow-500'
    }
    return 'bg-gray-500'
  }

  const getRoleBadge = (role: string) => {
    const roleLower = role.toLowerCase()
    if (roleLower === 'cleaning' || roleLower === 'kebersihan') {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0">Cleaning</Badge>
    } else if (roleLower === 'security' || roleLower === 'keamanan') {
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-0">Security</Badge>
    }
    return <Badge>{role}</Badge>
  }

  return (
    <Card className="h-[600px] w-full flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6 pt-6 flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-gray-700">
          Pekerja
        </CardTitle>
        <Link href="/worker">
          <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700">
            Lihat Semua
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-3">
          {workers.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Tidak ada data pekerja
            </div>
          ) : (
            workers.map((worker) => (
              <div
                key={worker.id}
                className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
                onClick={() => handleWorkerClick(worker.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${getRoleColor(worker.role)}`} />
                    <span className="font-medium text-sm text-gray-900">
                      {worker.name}
                    </span>
                  </div>
                  <div>
                    {getRoleBadge(worker.role)}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Attendance</span>
                      <span className="text-blue-600 font-medium">{worker.attendance}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${worker.attendance}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Task Completion</span>
                      <span className="text-blue-600 font-medium">{worker.taskCompletion}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${worker.taskCompletion}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

