'use client'

import React, { useState, useEffect } from 'react'
import { Asset, CreateAssetData, UpdateAssetData, ASSET_TYPES, ASSET_TYPE_LABELS, Unit, unitsApi, CreateUnitData, UpdateUnitData } from '@/lib/api'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Upload, Image, FileText, X, MapPin, Search, Plus, Edit, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import LeafletMapComponent from './leaflet-map-component'
import UnitForm from './unit-form'
import toast from 'react-hot-toast'

const assetSchema = z.object({
  name: z.string().min(1, 'Nama asset harus diisi'),
  description: z.string().optional(),
  asset_type: z.number().min(1, 'Tipe asset harus dipilih'),
  address: z.string().min(1, 'Alamat harus diisi'),
  area: z.coerce.number().min(0, 'Luas area harus lebih dari atau sama dengan 0'),
  longitude: z.number().min(-180).max(180, 'Longitude harus antara -180 dan 180'),
  latitude: z.number().min(-90).max(90, 'Latitude harus antara -90 dan 90'),
  status: z.number().default(1),
  photo: z.any().optional(),
  sketch: z.any().optional(),
})

type AssetFormData = z.infer<typeof assetSchema>

interface AssetFormProps {
  asset?: Asset | null
  onSubmit: (data: CreateAssetData | UpdateAssetData | FormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function AssetForm({ asset, onSubmit, onCancel, loading = false }: AssetFormProps) {
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [sketchFiles, setSketchFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [sketchPreviews, setSketchPreviews] = useState<string[]>([])
  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [existingSketches, setExistingSketches] = useState<string[]>([])
  const [originalAsset, setOriginalAsset] = useState<Asset | null>(null)
  
  // Unit management states
  const [units, setUnits] = useState<Unit[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [unitDialogOpen, setUnitDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [unitFormLoading, setUnitFormLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      asset_type: 1,
      address: '',
      area: 0,
      longitude: 0,
      latitude: 0,
      status: 1,
      photo: null,
      sketch: null,
    },
  })

  // Store original asset for comparison
  useEffect(() => {
    if (asset) {
      setOriginalAsset(asset)
    } else {
      setOriginalAsset(null)
    }
  }, [asset])

  // Update form values when asset changes (for edit mode)
  useEffect(() => {
    if (asset) {
      // Convert string values to integers for form
      const assetTypeMap: { [key: string]: number } = {
        'ESTATE': 1,
        'OFFICE': 2,
        'WAREHOUSE': 3,
        'SPORT': 4,
        'ENTERTAINMENTRESTAURANT': 5,
        'RESIDENCE': 6,
        'MALL': 7,
        'SUPPORTFACILITYMOSQUEITAL': 8,
        'PARKINGLOT': 9,
      }
      
      const statusMap: { [key: string]: number } = {
        'active': 1,
        'inactive': 0,
      }
      
      const convertedAssetType = typeof asset.asset_type === 'string' ? assetTypeMap[asset.asset_type] || 1 : asset.asset_type || 1
      const convertedStatus = typeof asset.status === 'string' ? statusMap[asset.status] || 1 : asset.status || 1
      
      form.reset({
        name: asset.name || '',
        description: asset.description || '',
        asset_type: convertedAssetType,
        address: asset.address || '',
        area: asset.area ? parseFloat(asset.area.toString()) : 0,
        longitude: asset.longitude || 0,
        latitude: asset.latitude || 0,
        status: convertedStatus,
        photo: null,
        sketch: null,
      })
    }
  }, [asset, form])

  // Re-set form values after a short delay to ensure proper initialization
  useEffect(() => {
    if (asset) {
      const timer = setTimeout(() => {
        const assetTypeMap: { [key: string]: number } = {
          'ESTATE': 1,
          'OFFICE': 2,
          'WAREHOUSE': 3,
          'SPORT': 4,
          'ENTERTAINMENTRESTAURANT': 5,
          'RESIDENCE': 6,
          'MALL': 7,
          'SUPPORTFACILITYMOSQUEITAL': 8,
          'PARKINGLOT': 9,
        }
        
        const statusMap: { [key: string]: number } = {
          'active': 1,
          'inactive': 0,
        }
        
        const convertedAssetType = typeof asset.asset_type === 'string' ? assetTypeMap[asset.asset_type] || 1 : asset.asset_type || 1
        const convertedStatus = typeof asset.status === 'string' ? statusMap[asset.status] || 1 : asset.status || 1
        
        form.setValue('area', asset.area ? parseFloat(asset.area.toString()) : 0)
        form.setValue('asset_type', convertedAssetType)
        form.setValue('status', convertedStatus)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [asset, form])

  // Set existing images when editing
  useEffect(() => {
    if (asset) {
      if (asset.photos && Array.isArray(asset.photos) && asset.photos.length > 0) {
        setExistingPhotos(asset.photos)
      } else {
        setExistingPhotos([])
      }
      // Handle sketches - can be string (single) or array (multiple)
      if (asset.sketch) {
        if (Array.isArray(asset.sketch)) {
          setExistingSketches(asset.sketch)
        } else {
          setExistingSketches([asset.sketch])
        }
      } else {
        setExistingSketches([])
      }
    } else {
      setExistingPhotos([])
      setExistingSketches([])
    }
  }, [asset])

  // Load units when asset is available
  useEffect(() => {
    if (asset?.id) {
      loadUnits()
    } else {
      setUnits([])
    }
  }, [asset?.id])

  const loadUnits = async () => {
    if (!asset?.id) return
    
    setUnitsLoading(true)
    try {
      const response = await unitsApi.getUnits({
        asset_id: asset.id,
        is_deleted: false,
      })
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const unitsData = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setUnits(unitsData)
      } else {
        toast.error(response.error || 'Gagal memuat data unit')
      }
    } catch (error) {
      console.error('Load units error:', error)
      toast.error('Terjadi kesalahan saat memuat data unit')
    } finally {
      setUnitsLoading(false)
    }
  }

  const handleCreateUnit = () => {
    setEditingUnit(null)
    setUnitDialogOpen(true)
  }

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit)
    setUnitDialogOpen(true)
  }

  const handleDeleteUnit = (unit: Unit) => {
    setUnitToDelete(unit)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!unitToDelete) return

    setDeleting(true)
    try {
      const response = await unitsApi.deleteUnit(unitToDelete.id)
      
      if (response.success) {
        toast.success('Unit berhasil dihapus')
        loadUnits()
      } else {
        toast.error(response.error || 'Gagal menghapus unit')
      }
    } catch (error) {
      console.error('Delete unit error:', error)
      toast.error('Terjadi kesalahan saat menghapus unit')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setUnitToDelete(null)
    }
  }

  const handleUnitSubmit = async (data: CreateUnitData | UpdateUnitData) => {
    setUnitFormLoading(true)
    try {
      if (editingUnit) {
        // Update unit
        const response = await unitsApi.updateUnit(editingUnit.id, data as UpdateUnitData)
        if (response.success) {
          toast.success('Unit berhasil diperbarui')
          setUnitDialogOpen(false)
          setEditingUnit(null)
          loadUnits()
        } else {
          toast.error(response.error || 'Gagal memperbarui unit')
        }
      } else {
        // Create unit
        if (!asset?.id) {
          toast.error('Asset ID tidak ditemukan')
          return
        }
        const createData = {
          ...data,
          asset_id: asset.id,
        } as CreateUnitData
        const response = await unitsApi.createUnit(createData)
        if (response.success) {
          toast.success('Unit berhasil dibuat')
          setUnitDialogOpen(false)
          loadUnits()
        } else {
          toast.error(response.error || 'Gagal membuat unit')
        }
      }
    } catch (error) {
      console.error('Unit submit error:', error)
      toast.error('Terjadi kesalahan saat menyimpan unit')
    } finally {
      setUnitFormLoading(false)
    }
  }

  const handlePhotoChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      const newFiles: File[] = []
      const previewPromises: Promise<string>[] = []
      
      Array.from(files).forEach((file) => {
        if (allowedTypes.includes(file.type)) {
          newFiles.push(file)
          previewPromises.push(
            new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                resolve(e.target?.result as string)
              }
              reader.readAsDataURL(file)
            })
          )
        } else {
          alert('Hanya file JPG, JPEG, dan PNG yang diperbolehkan')
        }
      })
      
      // Wait for all previews to load, then update state
      Promise.all(previewPromises).then((previews) => {
        setPhotoFiles(prev => [...prev, ...newFiles])
        setPhotoPreviews(prev => [...prev, ...previews])
      })
    }
  }

  const handleSketchChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      const newFiles: File[] = []
      const previewPromises: Promise<string>[] = []
      
      Array.from(files).forEach((file) => {
        if (allowedTypes.includes(file.type)) {
          newFiles.push(file)
          previewPromises.push(
            new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                resolve(e.target?.result as string)
              }
              reader.readAsDataURL(file)
            })
          )
        } else {
          alert('Hanya file JPG, JPEG, dan PNG yang diperbolehkan')
        }
      })
      
      // Wait for all previews to load, then update state
      Promise.all(previewPromises).then((previews) => {
        setSketchFiles(prev => [...prev, ...newFiles])
        setSketchPreviews(prev => [...prev, ...previews])
      })
    }
  }

  const removePhoto = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingPhotos(prev => prev.filter((_, i) => i !== index))
    } else {
      // Remove from both files and previews arrays
      setPhotoFiles(prev => {
        const newFiles = [...prev]
        newFiles.splice(index, 1)
        return newFiles
      })
      setPhotoPreviews(prev => {
        const newPreviews = [...prev]
        newPreviews.splice(index, 1)
        return newPreviews
      })
    }
  }

  const removeSketch = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingSketches(prev => prev.filter((_, i) => i !== index))
    } else {
      // Remove from both files and previews arrays
      setSketchFiles(prev => {
        const newFiles = [...prev]
        newFiles.splice(index, 1)
        return newFiles
      })
      setSketchPreviews(prev => {
        const newPreviews = [...prev]
        newPreviews.splice(index, 1)
        return newPreviews
      })
    }
  }

  const handleSubmit = async (data: AssetFormData) => {
    try {
      // Prepare FormData for file upload
      const formData = new FormData()
      
      if (asset && originalAsset) {
        // Edit mode: only send changed fields
        const assetTypeMap: { [key: string]: number } = {
          'ESTATE': 1,
          'OFFICE': 2,
          'WAREHOUSE': 3,
          'SPORT': 4,
          'ENTERTAINMENTRESTAURANT': 5,
          'RESIDENCE': 6,
          'MALL': 7,
          'SUPPORTFACILITYMOSQUEITAL': 8,
          'PARKINGLOT': 9,
        }
        
        const statusMap: { [key: string]: number } = {
          'active': 1,
          'inactive': 0,
        }
        
        const originalAssetType = typeof originalAsset.asset_type === 'string' 
          ? assetTypeMap[originalAsset.asset_type] || 1 
          : originalAsset.asset_type || 1
        const originalStatus = typeof originalAsset.status === 'string' 
          ? statusMap[originalAsset.status] || 1 
          : originalAsset.status || 1
        
        // Compare and only add changed fields
        if (data.name.trim() !== (originalAsset.name || '')) {
          formData.append('name', data.name.trim())
        }
        
        const originalDescription = originalAsset.description || ''
        const newDescription = data.description?.trim() || ''
        if (newDescription !== originalDescription) {
          formData.append('description', newDescription)
        }
        
        if (data.asset_type !== originalAssetType) {
          formData.append('asset_type', data.asset_type.toString())
        }
        
        if (data.address.trim() !== (originalAsset.address || '')) {
          formData.append('address', data.address.trim())
        }
        
        const originalArea = originalAsset.area ? parseFloat(originalAsset.area.toString()) : 0
        if (Math.abs(data.area - originalArea) > 0.001) {
          formData.append('area', data.area.toString())
        }
        
        const originalLongitude = originalAsset.longitude || 0
        if (Math.abs(data.longitude - originalLongitude) > 0.000001) {
          formData.append('longitude', data.longitude.toString())
        }
        
        const originalLatitude = originalAsset.latitude || 0
        if (Math.abs(data.latitude - originalLatitude) > 0.000001) {
          formData.append('latitude', data.latitude.toString())
        }
        
        if (data.status !== originalStatus) {
          formData.append('status', data.status.toString())
        }
        
        // Handle photos - check if photos have changed
        const originalPhotos = originalAsset.photos && Array.isArray(originalAsset.photos) 
          ? originalAsset.photos 
          : []
        const photosChanged = 
          photoFiles.length > 0 || // New photos added
          existingPhotos.length !== originalPhotos.length || // Photos removed
          existingPhotos.some((photo, index) => photo !== originalPhotos[index]) // Photos reordered/removed
        
        if (photosChanged) {
          // Include existing photos URLs (append each URL separately)
          existingPhotos.forEach((photoUrl) => {
            formData.append('existing_photos', photoUrl)
          })
          
          // Add new photo files (append each file separately with same key)
          photoFiles.forEach((file) => {
            formData.append('photos', file)
          })
        }
        
        // Handle sketches - check if sketches have changed
        const originalSketches = originalAsset.sketch 
          ? (Array.isArray(originalAsset.sketch) ? originalAsset.sketch : [originalAsset.sketch])
          : []
        const sketchesChanged = 
          sketchFiles.length > 0 || // New sketches added
          existingSketches.length !== originalSketches.length || // Sketches removed
          existingSketches.some((sketch, index) => sketch !== originalSketches[index]) // Sketches reordered/removed
        
        if (sketchesChanged) {
          // Include existing sketch URLs (append each URL separately)
          existingSketches.forEach((sketchUrl) => {
            formData.append('existing_sketches', sketchUrl)
          })
          
          // Add new sketch files (append each file separately with same key)
          sketchFiles.forEach((file) => {
            formData.append('sketches', file)
          })
        }
      } else {
        // Create mode: send all fields
        formData.append('name', data.name.trim())
        formData.append('description', data.description?.trim() || '')
        formData.append('asset_type', data.asset_type.toString())
        formData.append('address', data.address.trim())
        formData.append('area', data.area.toString())
        formData.append('longitude', data.longitude.toString())
        formData.append('latitude', data.latitude.toString())
        formData.append('status', data.status.toString())
        
        // Add new photo files
        photoFiles.forEach((file) => {
          formData.append('photos', file)
        })
        
        // Add new sketch files
        sketchFiles.forEach((file) => {
          formData.append('sketches', file)
        })
      }
      
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }


  return (
    <Form {...form}>
      <Tabs defaultValue="info" className="gap-4">
        <TabsList className='active-gradient bg-transparent dark:bg-transparent rounded-none h-[50px]'>
          <TabsTrigger 
            value="info" 
            className='py-2.5 px-4 font-semibold text-sm inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 rounded-[0] data-[state=active]:shadow-none cursor-pointer'
          >
            Informasi Asset
          </TabsTrigger>
          <TabsTrigger 
            value="units" 
            disabled={!asset?.id}
            className='py-2.5 px-4 font-semibold text-sm inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 rounded-[0] data-[state=active]:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
          >
            Unit {asset?.id && `(${units.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="px-6 py-4">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Informasi Asset */}
            <div className="space-y-6">
          <h3 className="text-lg font-semibold">Informasi Asset</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Asset <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan nama asset" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="asset_type"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Tipe Asset <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih tipe asset" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Luas Area (m²) <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Masukkan luas area"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || '1'}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Aktif</SelectItem>
                      <SelectItem value="0">Tidak Aktif</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deskripsi Asset (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Masukkan spesifikasi detail dari asset ini"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Lokasi Asset */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Lokasi Asset
          </h3>

          <LeafletMapComponent
            latitude={form.watch('latitude') || 0}
            longitude={form.watch('longitude') || 0}
            onLocationChange={(lat, lng) => {
              form.setValue('latitude', lat)
              form.setValue('longitude', lng)
            }}
            height="400px"
            className="border rounded-lg p-4"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="longitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.000001"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.000001"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alamat <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Alamat bisa terisi otomatis setelah dipilih dari peta"
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dokumen */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Dokumen</h3>
          
          {/* Foto Asset */}
          <FormField
            control={form.control}
            name="photo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Foto Asset
                  <span className="text-xs text-gray-500">(JPG, PNG, JPEG)</span>
                </FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <Input 
                        type="file" 
                        accept="image/jpeg,image/jpg,image/png"
                        multiple
                        onChange={(e) => {
                          handlePhotoChange(e.target.files)
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <p className="text-sm text-gray-600">Upload File (Bisa pilih multiple)</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Existing photos */}
                      {existingPhotos.map((photoUrl, index) => (
                        <div key={`existing-${index}`} className="relative">
                          <img 
                            src={photoUrl} 
                            alt={`Existing photo ${index + 1}`} 
                            className="w-full h-48 object-cover rounded-lg border shadow-sm"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removePhoto(index, true)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {/* New photo previews */}
                      {photoPreviews.map((preview, index) => (
                        <div key={`new-${index}`} className="relative">
                          <img 
                            src={preview} 
                            alt={`New photo ${index + 1}`} 
                            className="w-full h-48 object-cover rounded-lg border shadow-sm"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removePhoto(index, false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sketsa Denah */}
          <FormField
            control={form.control}
            name="sketch"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sketsa Denah
                  <span className="text-xs text-gray-500">(JPG, PNG, JPEG)</span>
                </FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <Input 
                        type="file" 
                        accept="image/jpeg,image/jpg,image/png"
                        multiple
                        onChange={(e) => {
                          handleSketchChange(e.target.files)
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <p className="text-sm text-gray-600">Upload File (Bisa pilih multiple)</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Existing sketches */}
                      {existingSketches.map((sketchUrl, index) => (
                        <div key={`existing-sketch-${index}`} className="relative">
                          <img 
                            src={sketchUrl} 
                            alt={`Existing sketch ${index + 1}`} 
                            className="w-full h-48 object-contain rounded-lg border shadow-sm bg-gray-50"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removeSketch(index, true)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {/* New sketch previews */}
                      {sketchPreviews.map((preview, index) => (
                        <div key={`new-sketch-${index}`} className="relative">
                          <img 
                            src={preview} 
                            alt={`New sketch ${index + 1}`} 
                            className="w-full h-48 object-contain rounded-lg border shadow-sm bg-gray-50"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removeSketch(index, false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {asset ? 'Perbarui Asset' : 'Buat Asset'}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="units" className="px-6 py-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Daftar Unit</h3>
              <Button onClick={handleCreateUnit} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Unit
              </Button>
            </div>

            {unitsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]">No</TableHead>
                      <TableHead className="w-[25%]">Nama Unit</TableHead>
                      <TableHead className="w-[20%]">Luas Lahan (m²)</TableHead>
                      <TableHead className="w-[20%]">Luas Bangunan (m²)</TableHead>
                      <TableHead className="w-[15%]">Status</TableHead>
                      <TableHead className="w-[15%] text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Tidak ada data unit
                        </TableCell>
                      </TableRow>
                    ) : (
                      units.map((unit, index) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium text-center">{index + 1}</TableCell>
                          <TableCell className="font-medium">{unit.name || '-'}</TableCell>
                          <TableCell className="text-center">{unit.size ? `${unit.size} m²` : '-'}</TableCell>
                          <TableCell className="text-center">{unit.building_area ? `${unit.building_area} m²` : '-'}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium border ${
                                unit.status === 'available'
                                  ? 'bg-green-600/15 text-green-600 border-green-600'
                                  : unit.status === 'occupied'
                                  ? 'bg-blue-600/15 text-blue-600 border-blue-600'
                                  : 'bg-gray-600/15 text-gray-600 border-gray-400'
                              }`}
                            >
                              {unit.status === 'available' ? 'Available' : unit.status === 'occupied' ? 'Occupied' : 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditUnit(unit)}
                                className="h-8 w-8 rounded-full text-green-600 bg-green-600/10 hover:bg-green-600/20"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteUnit(unit)}
                                className="h-8 w-8 rounded-full text-red-500 bg-red-500/10 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Tambah Unit Baru'}</DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Perbarui informasi unit' : 'Masukkan informasi unit baru'}
            </DialogDescription>
          </DialogHeader>
          <UnitForm
            unit={editingUnit || undefined}
            onSubmit={handleUnitSubmit}
            loading={unitFormLoading}
            assetId={asset?.id}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus unit <strong>{unitToDelete?.name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
