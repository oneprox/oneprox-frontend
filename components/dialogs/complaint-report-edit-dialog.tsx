'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ComplaintReport, complaintReportsApi, UpdateComplaintReportData } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Loader2, AlertTriangle, Upload, Camera, Image as ImageIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { UPLOAD_MAX_FILE_BYTES, UPLOAD_MAX_FILE_MB } from '@/lib/uploadLimits'

interface ComplaintReportEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  complaintReport: ComplaintReport | null
  onSuccess?: () => void
}

export default function ComplaintReportEditDialog({
  open,
  onOpenChange,
  complaintReport,
  onSuccess
}: ComplaintReportEditDialogProps) {
  const [status, setStatus] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (open && complaintReport) {
      // Convert status to string for the select
      let statusValue: string
      if (typeof complaintReport.status === 'string') {
        statusValue = complaintReport.status
      } else {
        // Map number to string
        const statusMap: Record<number, string> = {
          0: 'pending',
          1: 'in_progress',
          2: 'resolved',
          3: 'closed'
        }
        statusValue = statusMap[complaintReport.status] || String(complaintReport.status)
      }
      setStatus(statusValue)
      // Reset notes and photo when dialog opens
      setNotes('')
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoFile(null)
      setPhotoPreview(null)
    }
  }, [open, complaintReport])

  // Cleanup photo preview URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  // Cleanup camera stream when modal closes
  useEffect(() => {
    if (!cameraModalOpen && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
  }, [cameraModalOpen, cameraStream])

  // Initialize camera when modal opens
  useEffect(() => {
    if (cameraModalOpen && videoRef.current) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Prefer back camera on mobile
          })
          setCameraStream(stream)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        } catch (error) {
          console.error('Error accessing camera:', error)
          toast.error('Failed to access camera. Please check permissions.')
          setCameraModalOpen(false)
        }
      }
      startCamera()
    }
  }, [cameraModalOpen])

  const openCamera = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera is not supported in this browser')
      return
    }
    setCameraModalOpen(true)
  }

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCameraModalOpen(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setPhotoFile(file)
        const url = URL.createObjectURL(file)
        setPhotoPreview(url)
        toast.success('Photo captured successfully')
        closeCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      
      // Validate file type (images only)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only image files (JPG, JPEG, PNG, GIF, WEBP) are allowed')
        return
      }

      if (file.size > UPLOAD_MAX_FILE_BYTES) {
        toast.error(`Ukuran file maksimal ${UPLOAD_MAX_FILE_MB}MB`)
        return
      }

      setPhotoFile(file)
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    }
  }

  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleSubmit = async () => {
    if (!complaintReport) return

    // Validate notes
    if (!notes || notes.trim().length === 0) {
      toast.error('Notes are required')
      return
    }

    setLoading(true)
    try {
      // Convert status string to number or keep as string based on backend expectation
      // Map string status to number
      const statusMap: Record<string, number> = {
        'pending': 0,
        'in_progress': 1,
        'resolved': 2,
        'closed': 3
      }

      // If status is already a number string, use it directly, otherwise map from string
      let statusValue: number | string
      if (['0', '1', '2', '3'].includes(status)) {
        statusValue = parseInt(status, 10)
      } else if (statusMap[status] !== undefined) {
        statusValue = statusMap[status]
      } else {
        // Fallback: try to parse as number, or keep as string
        statusValue = isNaN(parseInt(status, 10)) ? status : parseInt(status, 10)
      }

      // Upload photo if provided
      let photoUrl: string | undefined
      if (photoFile) {
        try {
          const uploadResponse = await complaintReportsApi.uploadComplaintReportFile(photoFile)
          if (uploadResponse.success && uploadResponse.data) {
            const url = Array.isArray(uploadResponse.data.url) 
              ? uploadResponse.data.url[0] 
              : uploadResponse.data.url
            photoUrl = url || undefined
          } else {
            throw new Error(uploadResponse.error || 'Upload failed')
          }
        } catch (error) {
          console.error('Upload photo error:', error)
          toast.error('Failed to upload photo')
          setLoading(false)
          return
        }
      }

      const updateData: UpdateComplaintReportData = {
        status: statusValue,
        notes: notes.trim(),
        photo_evidence: photoUrl || (photoFile ?? undefined)
      }

      const response = await complaintReportsApi.updateComplaintReport(complaintReport.id, updateData)

      if (response.success) {
        toast.success('Complaint report updated successfully')
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(response.error || 'Failed to update complaint report')
      }
    } catch (error) {
      console.error('Update complaint report error:', error)
      toast.error('An error occurred while updating complaint report')
    } finally {
      setLoading(false)
    }
  }

  const getStatusValue = (status: string | number): string => {
    if (typeof status === 'string') {
      return status
    }
    // Map number to string
    const statusMap: Record<number, string> = {
      0: 'pending',
      1: 'in_progress',
      2: 'resolved',
      3: 'closed'
    }
    return statusMap[status] || String(status)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Update Issue/Findings
            </DialogTitle>
            <DialogDescription>
              Update the status of complaint report: {complaintReport?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Enter notes about this update..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
                required
              />
              <p className="text-xs text-muted-foreground">
                Notes are required when updating the status
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Photo Evidence (Optional)</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={openCamera}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </div>

                {photoPreview && (
                  <div className="relative border rounded-lg overflow-hidden bg-gray-50 group">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white h-6 w-6 p-0"
                      onClick={removePhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {photoFile && (
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{photoFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(photoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !status || !notes.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-white p-4 rounded-lg max-w-md w-full mx-4">
            <div className="mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={capturePhoto}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeCamera}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

