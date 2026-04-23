'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Asset, CreateComplaintReportData, UpdateComplaintReportData, authApi, assetsApi, User, complaintReportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, Image, X, Camera } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

const complaintReportSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().min(1, 'Description is required').trim(),
  asset_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  status: z.number().min(0).max(3).optional(),
  priority: z.number().min(0).max(3).optional(),
})

type ComplaintReportFormData = z.infer<typeof complaintReportSchema>

interface ComplaintReportFormProps {
  onSubmit: (data: CreateComplaintReportData | UpdateComplaintReportData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function ComplaintReportForm({ onSubmit, onCancel, loading = false }: ComplaintReportFormProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const form = useForm<ComplaintReportFormData>({
    resolver: zodResolver(complaintReportSchema),
    defaultValues: {
      title: '',
      description: '',
      asset_id: null,
      tenant_id: null,
      status: 0, // pending
      priority: 1, // medium
    },
  })

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await authApi.getCurrentUser()
        setCurrentUser(user)
      } catch (error) {
        console.error('Load current user error:', error)
      }
    }
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const loadAssets = async () => {
      setAssetsLoading(true)
      try {
        const response = await assetsApi.getAssets({ status: 1, limit: 1000 })
        if (response.success && response.data) {
          const responseData = response.data as any
          const assetsData = Array.isArray(responseData?.data)
            ? responseData.data
            : Array.isArray(responseData)
              ? responseData
              : []
          setAssets(assetsData)
        } else {
          setAssets([])
        }
      } catch (error) {
        console.error('Load assets error:', error)
        setAssets([])
      } finally {
        setAssetsLoading(false)
      }
    }
    loadAssets()
  }, [])

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
        setEvidenceFiles(prev => [...prev, file])
        toast.success('Photo captured successfully')
        closeCamera()
      }
    }, 'image/jpeg', 0.9)
  }


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      
      // Validate file types (images only)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      const invalidFiles = files.filter(file => !allowedTypes.includes(file.type))
      
      if (invalidFiles.length > 0) {
        toast.error('Only image files (JPG, JPEG, PNG, GIF, WEBP) are allowed')
        return
      }

      // Validate file size (max 10MB per file)
      const maxSize = 10 * 1024 * 1024 // 10MB
      const oversizedFiles = files.filter(file => file.size > maxSize)
      
      if (oversizedFiles.length > 0) {
        toast.error('File size must be less than 10MB')
        return
      }

      setEvidenceFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Component for file preview with proper cleanup
  const FilePreviewItem = ({ file, index }: { file: File; index: number }) => {
    const isImage = file.type.startsWith('image/')
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
      if (isImage) {
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        return () => {
          URL.revokeObjectURL(url)
        }
      }
    }, [file, isImage])

    return (
      <div className="relative border rounded-lg overflow-hidden bg-gray-50 group">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview ${index + 1}`}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 flex items-center justify-center bg-gray-100">
            <Image className="h-8 w-8 text-gray-400" />
          </div>
        )}
        <div className="p-2">
          <p className="text-xs font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white h-6 w-6 p-0"
          onClick={() => removeFile(index)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const uploadEvidenceFiles = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      try {
        const response = await complaintReportsApi.uploadComplaintReportFile(file)
        
        if (response.success && response.data) {
          // Handle both array and string response formats
          const url = Array.isArray(response.data.url) ? response.data.url[0] : response.data.url
          return url || ''
        } else {
          throw new Error(response.error || 'Upload failed')
        }
      } catch (error) {
        console.error('Upload file error:', error)
        throw error
      }
    })
    
    return Promise.all(uploadPromises)
  }

  const handleSubmit = async (data: ComplaintReportFormData) => {
    if (!currentUser || !currentUser.id) {
      return
    }

    try {
      // Upload evidence files first to get URLs
      let evidenceUrls: string[] = []
      if (evidenceFiles.length > 0) {
        evidenceUrls = await uploadEvidenceFiles(evidenceFiles)
      }

      // Create the complaint report data with evidence URLs
      const submitData: CreateComplaintReportData = {
        type: 'report', // Always 'report' for role_id 4 and 5
        title: data.title,
        description: data.description,
        reporter_id: currentUser.id,
        asset_id: data.asset_id || null,
        tenant_id: data.tenant_id || null,
        status: data.status ?? 0,
        priority: data.priority ?? 1,
        evidences: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      }

      await onSubmit(submitData)
    } catch (error) {
      console.error('Error uploading files or creating report:', error)
      toast.error('Failed to upload photos or create report')
      throw error
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input placeholder="Enter title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter description"
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="asset_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                value={field.value || 'none'}
                disabled={assetsLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={assetsLoading ? 'Loading assets...' : 'Select asset'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No asset</SelectItem>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="0">Low</SelectItem>
                  <SelectItem value="1">Medium</SelectItem>
                  <SelectItem value="2">High</SelectItem>
                  <SelectItem value="3">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Photos/Evidences Upload */}
        <div className="space-y-2">
          <FormLabel>Photos</FormLabel>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="evidence-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => document.getElementById('evidence-upload')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={openCamera}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>

            {evidenceFiles.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {evidenceFiles.map((file, index) => (
                  <FilePreviewItem key={index} file={file} index={index} />
                ))}
              </div>
            )}

            {evidenceFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No photos uploaded. You can upload multiple image files.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !currentUser}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Report'
            )}
          </Button>
        </div>
      </form>

      {/* Camera Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
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
    </Form>
  )
}

