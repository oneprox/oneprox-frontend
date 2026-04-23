'use client'

import React, { useState, useEffect } from 'react'
import { ComplaintReport, ComplaintReportLog, complaintReportsApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, AlertTriangle, Calendar, User, Building2, Image as ImageIcon, Loader2, FileText, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface ComplaintReportDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  complaintReport: ComplaintReport | null
}

export default function ComplaintReportDetailDialog({
  open,
  onOpenChange,
  complaintReport
}: ComplaintReportDetailDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fullReport, setFullReport] = useState<ComplaintReport | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [logs, setLogs] = useState<ComplaintReportLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load full report details when dialog opens
  useEffect(() => {
    const loadFullReport = async () => {
      if (open && complaintReport?.id) {
        setLoading(true)
        try {
          const response = await complaintReportsApi.getComplaintReport(complaintReport.id)
          if (response.success && response.data) {
            const reportData = response.data as any
            const report = reportData.data || reportData
            setFullReport(report)
          } else {
            // Fallback to the passed complaintReport if API call fails
            setFullReport(complaintReport)
          }
        } catch (error) {
          console.error('Load complaint report error:', error)
          // Fallback to the passed complaintReport
          setFullReport(complaintReport)
        } finally {
          setLoading(false)
        }
      } else if (open && complaintReport) {
        // Use the passed complaintReport if no ID
        setFullReport(complaintReport)
      }
    }

    loadFullReport()
  }, [open, complaintReport])

  // Reset logs when dialog closes or report changes
  useEffect(() => {
    if (!open) {
      setLogs([])
      setActiveTab('details')
    }
  }, [open, complaintReport?.id])

  // Load logs when logs tab is active
  useEffect(() => {
    const loadLogs = async () => {
      if (open && activeTab === 'logs' && complaintReport?.id) {
        setLogsLoading(true)
        try {
          const response = await complaintReportsApi.getComplaintReportLogs(complaintReport.id)
          if (response.success && response.data) {
            const logsData = response.data as any
            const logsArray = Array.isArray(logsData) ? logsData : (logsData.data || [])
            setLogs(logsArray)
          } else {
            toast.error(response.error || 'Failed to load logs')
            setLogs([])
          }
        } catch (error) {
          console.error('Load logs error:', error)
          toast.error('An error occurred while loading logs')
          setLogs([])
        } finally {
          setLogsLoading(false)
        }
      }
    }

    loadLogs()
  }, [open, activeTab, complaintReport?.id])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const formatDate = (dateString?: string) => {
    if (!mounted || !dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
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
      case 0:
        return <Badge variant="default" className="bg-yellow-600">Pending</Badge>
      case 1:
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
      case 2:
        return <Badge variant="default" className="bg-green-600">Resolved</Badge>
      case 3:
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
      case 0:
        return <Badge variant="outline" className="border-gray-400 text-gray-600">Low</Badge>
      case 1:
        return <Badge variant="outline" className="border-blue-400 text-blue-600">Medium</Badge>
      case 2:
        return <Badge variant="outline" className="border-orange-400 text-orange-600">High</Badge>
      case 3:
        return <Badge variant="destructive">Urgent</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  if (!complaintReport || !open) return null

  const report = fullReport || complaintReport
  // Handle evidences as array of objects with url property or array of strings
  const evidencesRaw = (report as any).evidences || []
  const evidences = evidencesRaw.map((evidence: any) => {
    if (typeof evidence === 'string') {
      return evidence
    } else if (evidence && evidence.url) {
      return evidence.url
    }
    return null
  }).filter((url: string | null) => url !== null)

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Findings and Issues: {report.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Complaint report details
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              Details
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4" />
              Logs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading details...</span>
              </div>
            ) : (
              <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        ID
                      </label>
                      <p className="text-sm font-mono">{report.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Type
                      </label>
                      <div className="mt-1">
                        <Badge variant={report.type === 'complaint' ? 'default' : 'outline'}>
                          {report.type === 'complaint' ? 'Complaint' : 'Report'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Title
                      </label>
                      <p className="text-sm font-medium">{report.title}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Status
                      </label>
                      <div className="mt-1">
                        {getStatusBadge(report.status)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Priority
                      </label>
                      <div className="mt-1">
                        {getPriorityBadge(report.priority)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Description
                    </label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{report.description || '-'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Reporter and Tenant Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Reporter & Tenant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Reporter
                      </label>
                      {report.reporter ? (
                        <div className="mt-1">
                          <p className="text-sm font-medium">{report.reporter.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{report.reporter.email || '-'}</p>
                        </div>
                      ) : (
                        <p className="text-sm mt-1">{report.reporter_id || '-'}</p>
                      )}
                    </div>
                    {report.tenant && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Tenant
                        </label>
                        <div className="mt-1">
                          <p className="text-sm font-medium">{report.tenant.name || '-'}</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Asset
                      </label>
                      <div className="mt-1">
                        <p className="text-sm font-medium">{report.asset?.name || report.asset_id || '-'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Evidence Photos */}
              {evidences && evidences.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Photos ({evidences.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {evidences.map((url: string, index: number) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border bg-gray-100">
                            <img
                              src={url}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.png'
                              }}
                            />
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ImageIcon className="h-8 w-8 text-white" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Created At
                      </label>
                      <p className="text-sm font-medium">{formatDate(report.created_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Updated At
                      </label>
                      <p className="text-sm font-medium">{formatDate(report.updated_at)}</p>
                    </div>
                    {report.createdBy && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Created By
                        </label>
                        <div className="mt-1">
                          <p className="text-sm font-medium">{report.createdBy.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{report.createdBy.email || '-'}</p>
                        </div>
                      </div>
                    )}
                    {report.updatedBy && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Updated By
                        </label>
                        <div className="mt-1">
                          <p className="text-sm font-medium">{report.updatedBy.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{report.updatedBy.email || '-'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            )
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading logs...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No logs found for this complaint report.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Status Change */}
                          {(log.old_status || log.new_status) && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Status:</span>
                              {log.old_status && (
                                <Badge variant="outline" className="bg-gray-100">
                                  {log.old_status}
                                </Badge>
                              )}
                              <span className="text-sm text-muted-foreground">→</span>
                              {log.new_status && (
                                <Badge variant="default" className="bg-blue-600">
                                  {log.new_status}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          {log.notes && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Notes
                              </label>
                              <p className="text-sm mt-1 whitespace-pre-wrap">{log.notes}</p>
                            </div>
                          )}

                          {/* Photo Evidence */}
                          {log.photo_evidence_url && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Photo Evidence
                              </label>
                              <div className="relative group">
                                <div className="aspect-video rounded-lg overflow-hidden border bg-gray-100 max-w-md">
                                  <img
                                    src={log.photo_evidence_url}
                                    alt="Log evidence"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/placeholder-image.png'
                                    }}
                                  />
                                </div>
                                <a
                                  href={log.photo_evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ImageIcon className="h-8 w-8 text-white" />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Created By and Date */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div>
                              {log.createdBy ? (
                                <div>
                                  <p className="text-sm font-medium">{log.createdBy.name || '-'}</p>
                                  <p className="text-xs text-muted-foreground">{log.createdBy.email || '-'}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">{log.created_by || '-'}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {formatDate(log.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

