'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tenant, CreateTenantData, UpdateTenantData, usersApi, unitsApi, tenantsApi, rolesApi, assetsApi, User, Unit, Asset, DURATION_UNITS, DURATION_UNIT_LABELS, TenantPaymentLog, CreateTenantPaymentData, UpdateTenantPaymentData, TenantLegal, CreateTenantLegalData, UpdateTenantLegalData, settingsApi, Setting } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, X, File, Search, UserPlus, Users, Eye, EyeOff, Calendar, Edit, Trash2, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface TenantFormProps {
  tenant?: Tenant
  onSubmit: (data: CreateTenantData | UpdateTenantData) => Promise<void>
  loading?: boolean
}

// Kategori options
const CATEGORY_OPTIONS = [
  { value: 1, label: 'Restoran/Cafe' },
  { value: 2, label: 'Sport Club' },
  { value: 3, label: 'Kantor' },
  { value: 4, label: 'Tempat Hiburan' },
  { value: 5, label: 'Retail/Toko' },
  { value: 6, label: 'Klinik/Kesehatan' },
  { value: 7, label: 'Pendidikan' },
  { value: 8, label: 'Jasa Keuangan' },
  { value: 9, label: 'Other' },
]

// Status options
const STATUS_OPTIONS = [
  { value: 'inactive', label: 'Tidak Aktif' },
  { value: 'active', label: 'Aktif' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'blacklisted', label: 'Blacklisted' },
]

export default function TenantForm({ tenant, onSubmit, loading = false }: TenantFormProps) {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    contract_begin_at: '',
    contract_end_at: '',
    unit_ids: [] as string[],
    asset_ids: [] as string[],
    building_type: 'unit' as 'unit' | 'asset',
    category: '',
    sub_category: '',
    rent_price: 0,
    payment_term: '',
    building_area: 0,
    land_area: 0,
    electricity_power: 0,
    status: 'active',
  })
  const [userSelectionType, setUserSelectionType] = useState<'existing' | 'new'>('new')
  const [showPassword, setShowPassword] = useState(false)
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    role_id: '',
    status: 'active'
  })
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(true)
  
  // Autocomplete states
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
  const [subCategorySuggestions, setSubCategorySuggestions] = useState<string[]>([])
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [showSubCategorySuggestions, setShowSubCategorySuggestions] = useState(false)
  const categoryInputRef = useRef<HTMLInputElement>(null)
  const subCategoryInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passwordValidation, setPasswordValidation] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    minLength: false
  })
  const [identificationFiles, setIdentificationFiles] = useState<File[]>([])
  const [contractFiles, setContractFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [existingIdentificationUrls, setExistingIdentificationUrls] = useState<string[]>([])
  const [existingContractUrls, setExistingContractUrls] = useState<string[]>([])
  
  // Payment logs states
  const [paymentLogs, setPaymentLogs] = useState<TenantPaymentLog[]>([])
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<TenantPaymentLog | null>(null)
  const [paymentFormLoading, setPaymentFormLoading] = useState(false)
  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<TenantPaymentLog | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const tabFromUrl = searchParams.get('tab')?.toLowerCase() ?? ''

  useEffect(() => {
    if (!tenant?.id || !tabFromUrl) return
    if (tabFromUrl === 'finance' || tabFromUrl === 'payments') {
      setActiveTab('payments')
    } else if (tabFromUrl === 'legals') {
      setActiveTab('legals')
    } else if (tabFromUrl === 'info') {
      setActiveTab('info')
    }
  }, [tenant?.id, tabFromUrl])

  // Legal documents states
  const [legalDocuments, setLegalDocuments] = useState<TenantLegal[]>([])
  const [legalDocumentsLoading, setLegalDocumentsLoading] = useState(false)
  const [legalDialogOpen, setLegalDialogOpen] = useState(false)
  const [editingLegal, setEditingLegal] = useState<TenantLegal | null>(null)
  const [legalFormLoading, setLegalFormLoading] = useState(false)
  const [deleteLegalDialogOpen, setDeleteLegalDialogOpen] = useState(false)
  const [legalToDelete, setLegalToDelete] = useState<TenantLegal | null>(null)
  const [deletingLegal, setDeletingLegal] = useState(false)
  const [legalDocumentFile, setLegalDocumentFile] = useState<File | null>(null)
  const [legalDocSettings, setLegalDocSettings] = useState<Setting[]>([])

  // Load categories and sub categories from existing tenants
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await tenantsApi.getTenants({ limit: 1000 })
        if (response.success && response.data) {
          const responseData = response.data as any
          const tenantsData = Array.isArray(responseData.data) ? responseData.data : []
          
          // Extract unique categories
          const categories = new Set<string>()
          const subCategories = new Set<string>()
          
          tenantsData.forEach((tenant: any) => {
            // Extract category name from tenant.category object
            const category = tenant.category
            if (category) {
              if (typeof category === 'object' && category !== null && 'name' in category) {
                const categoryName = category.name
                if (categoryName && typeof categoryName === 'string' && categoryName.trim()) {
                  categories.add(categoryName)
                }
              } else if (typeof category === 'string' && category.trim()) {
                categories.add(category.trim())
              }
            }
            // Extract sub_category if exists
            const subCategory = tenant.sub_category
            if (subCategory && typeof subCategory === 'string' && subCategory.trim()) {
              subCategories.add(subCategory.trim())
            }
          })
          
          setCategorySuggestions(Array.from(categories).sort())
          setSubCategorySuggestions(Array.from(subCategories).sort())
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    
    loadCategories()
  }, [])

  // Load legal document settings
  useEffect(() => {
    const loadLegalDocSettings = async () => {
      try {
        const response = await settingsApi.getSettings()
        if (response.success && response.data) {
          const settingsData = Array.isArray(response.data) ? response.data : []
          // Filter settings with value='legal_doc'
          const legalSettings = settingsData.filter((setting: Setting) => setting.value === 'legal_doc')
          setLegalDocSettings(legalSettings)
        }
      } catch (error) {
        console.error('Error loading legal doc settings:', error)
      }
    }
    
    loadLegalDocSettings()
  }, [])

  // Load users, units, assets, and roles
  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersResponse, unitsResponse, assetsResponse, rolesResponse] = await Promise.all([
          usersApi.getUsers({ limit: 100 }),
          // When editing, load all units to show selected ones; when creating, only load available units
          tenant ? unitsApi.getUnits() : unitsApi.getUnits({ status: 0 }),
          // Load available assets
          assetsApi.getAssets({ status: 1, limit: 1000 }),
          rolesApi.getRoles()
        ])
        
        if (usersResponse.success && usersResponse.data) {
          const usersResponseData = usersResponse.data as any
          const usersData = Array.isArray(usersResponseData.data) ? usersResponseData.data : []
          setUsers(usersData)
        } else {
          toast.error('Gagal memuat data users')
          setUsers([])
        }
        
        if (unitsResponse.success && unitsResponse.data) {
          const unitsResponseData = unitsResponse.data as any
          const unitsData = Array.isArray(unitsResponseData.data) ? unitsResponseData.data : []
          setUnits(unitsData)
        } else {
          toast.error('Gagal memuat data units')
          setUnits([])
        }
        
        if (assetsResponse.success && assetsResponse.data) {
          const assetsResponseData = assetsResponse.data as any
          const assetsData = Array.isArray(assetsResponseData.data) ? assetsResponseData.data : []
          setAssets(assetsData)
        } else {
          toast.error('Gagal memuat data assets')
          setAssets([])
        }
        
        if (rolesResponse.success && rolesResponse.data) {
          const rolesData = Array.isArray(rolesResponse.data) ? rolesResponse.data : []
          setRoles(rolesData)
          
          // Set default role to "tenant" for new user
          const tenantRole = rolesData.find((role: any) => role.name?.toLowerCase() === 'tenant')
          if (tenantRole) {
            setNewUserData(prev => ({ ...prev, role_id: String(tenantRole.id) }))
          }
        } else {
          toast.error('Gagal memuat data roles')
          setRoles([])
        }
      } catch (error) {
        toast.error('Terjadi kesalahan saat memuat data')
        setUsers([])
        setUnits([])
        setRoles([])
      } finally {
        setUsersLoading(false)
        setUnitsLoading(false)
        setAssetsLoading(false)
        setRolesLoading(false)
      }
    }

    loadData()
  }, [])

  // Initialize form data when tenant prop changes
  useEffect(() => {
    if (tenant) {
      // Extract unit IDs from units array or unit_ids
      let unitIds: string[] = []
      if (tenant.units && Array.isArray(tenant.units) && tenant.units.length > 0) {
        unitIds = tenant.units.map(unit => unit.id).filter(id => id != null)
      } else if (tenant.unit_ids) {
        // If unit_ids is array, use it; if string, convert to array
        unitIds = Array.isArray(tenant.unit_ids) ? tenant.unit_ids : [tenant.unit_ids]
      }
      
      // Extract category name from tenant.category object
      let categoryName = ''
      if (tenant.category && typeof tenant.category === 'object' && 'name' in tenant.category) {
        categoryName = tenant.category.name
      } else if (typeof tenant.category === 'string') {
        categoryName = tenant.category
      }
      
      // Extract sub category
      const subCategoryName = (tenant as any).sub_category || ''
      
      // Extract building type and asset_ids
      let buildingType: 'unit' | 'asset' = 'unit'
      let assetIds: string[] = []
      // If tenant has units, it's unit type, otherwise check if it has assets
      if (tenant.units && tenant.units.length > 0) {
        buildingType = 'unit'
      } else if ((tenant as any).asset_id) {
        buildingType = 'asset'
        const assetId = (tenant as any).asset_id
        assetIds = Array.isArray(assetId) ? assetId : [assetId]
      } else if ((tenant as any).asset_ids) {
        buildingType = 'asset'
        assetIds = Array.isArray((tenant as any).asset_ids) ? (tenant as any).asset_ids : [(tenant as any).asset_ids]
      }
      
      
      // Convert status: backend returns string ('inactive', 'active', 'pending', etc.)
      let statusValue = 'active' // default
      if (tenant.status !== undefined && tenant.status !== null) {
        const statusStr = String(tenant.status).toLowerCase()
        // Check if status matches any STATUS_OPTIONS value
        const validStatus = STATUS_OPTIONS.find(opt => opt.value.toLowerCase() === statusStr)
        statusValue = validStatus ? validStatus.value : 'active'
      }

      setFormData({
        name: tenant.name || '',
        user_id: tenant.user_id || '',
        contract_begin_at: tenant.contract_begin_at ? new Date(tenant.contract_begin_at).toISOString().split('T')[0] : '',
        contract_end_at: tenant.contract_end_at ? new Date(tenant.contract_end_at).toISOString().split('T')[0] : '',
        unit_ids: unitIds,
        asset_ids: assetIds,
        building_type: buildingType,
        category: categoryName,
        sub_category: subCategoryName,
        rent_price: tenant.rent_price || 0,
        payment_term: tenant.payment_term ? (() => {
          // Convert payment_term from number (0 or 1) to string ('year' or 'month')
          // Database: 0 = year, 1 = month
          // Frontend: 'year' = DURATION_UNITS.YEAR, 'month' = DURATION_UNITS.MONTH
          if (typeof tenant.payment_term === 'number') {
            return tenant.payment_term === 0 ? DURATION_UNITS.YEAR : DURATION_UNITS.MONTH
          } else if (typeof tenant.payment_term === 'string') {
            const termStr = tenant.payment_term.trim().toLowerCase()
            if (termStr === '0' || termStr === 'year' || termStr === DURATION_UNITS.YEAR) {
              return DURATION_UNITS.YEAR
            } else if (termStr === '1' || termStr === 'month' || termStr === DURATION_UNITS.MONTH) {
              return DURATION_UNITS.MONTH
            }
          }
          return DURATION_UNITS.MONTH
        })() : '',
        building_area: tenant.building_area || 0,
        land_area: tenant.land_area || 0,
        electricity_power: tenant.electricity_power || 0,
        status: statusValue,
      })
      
      
      // Set existing file URLs for preview
      setExistingIdentificationUrls(tenant.tenant_identifications || [])
      setExistingContractUrls(tenant.contract_documents || [])
      
      // Set user selection type to existing when editing
      setUserSelectionType('existing')
    }
  }, [tenant])

  // Load payment logs when tenant is available
  useEffect(() => {
    if (tenant?.id) {
      loadPaymentLogs()
      loadLegalDocuments()
      loadLegalDocuments()
    } else {
      setPaymentLogs([])
      setLegalDocuments([])
    }
  }, [tenant?.id])

  const loadLegalDocuments = async () => {
    if (!tenant?.id) return
    
    setLegalDocumentsLoading(true)
    try {
      const response = await tenantsApi.getTenantLegals(tenant.id)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const legalsData = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setLegalDocuments(legalsData)
      } else {
        toast.error(response.error || 'Gagal memuat data legal documents')
      }
    } catch (error) {
      console.error('Load legal documents error:', error)
      toast.error('Terjadi kesalahan saat memuat data legal documents')
    } finally {
      setLegalDocumentsLoading(false)
    }
  }

  const handleCreateLegal = () => {
    setEditingLegal(null)
    setLegalDocumentFile(null)
    setLegalDialogOpen(true)
  }

  const handleEditLegal = (legal: TenantLegal) => {
    setEditingLegal(legal)
    setLegalDocumentFile(null)
    setLegalDialogOpen(true)
  }

  const handleDeleteLegal = (legal: TenantLegal) => {
    setLegalToDelete(legal)
    setDeleteLegalDialogOpen(true)
  }

  const handleDeleteLegalConfirm = async () => {
    if (!legalToDelete || !tenant?.id) return

    setDeletingLegal(true)
    try {
      const response = await tenantsApi.deleteTenantLegal(tenant.id, legalToDelete.id)
      
      if (response.success) {
        toast.success('Legal document berhasil dihapus')
        loadLegalDocuments()
      } else {
        toast.error(response.error || 'Gagal menghapus legal document')
      }
    } catch (error) {
      console.error('Delete legal error:', error)
      toast.error('Terjadi kesalahan saat menghapus legal document')
    } finally {
      setDeletingLegal(false)
      setDeleteLegalDialogOpen(false)
      setLegalToDelete(null)
    }
  }

  const normalizeDocumentUrl = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
    if (Array.isArray(value)) {
      const firstValid = value.find((item) => typeof item === 'string' && item.trim().length > 0)
      return typeof firstValid === 'string' ? firstValid.trim() : undefined
    }
    return undefined
  }

  const handleLegalSubmit = async (data: CreateTenantLegalData | UpdateTenantLegalData) => {
    if (!tenant?.id) return

    setLegalFormLoading(true)
    try {
      // Upload document if file is selected
      let documentUrl = normalizeDocumentUrl(editingLegal?.document_url)
      
      if (legalDocumentFile) {
        // Use uploadTenantFile with type 'contract' for legal documents
        const uploadResponse = await tenantsApi.uploadTenantFile(legalDocumentFile, 'contract')
        if (uploadResponse.success && uploadResponse.data) {
          documentUrl = normalizeDocumentUrl(uploadResponse.data.url)
          if (!documentUrl) {
            toast.error('Format URL dokumen dari server tidak valid')
            setLegalFormLoading(false)
            return
          }
        } else {
          toast.error('Gagal mengupload dokumen')
          setLegalFormLoading(false)
          return
        }
      }

      const submitData = { ...data, document_url: documentUrl }

      if (editingLegal) {
        // Update legal
        const response = await tenantsApi.updateTenantLegal(tenant.id, editingLegal.id, submitData as UpdateTenantLegalData)
        if (response.success) {
          toast.success('Legal document berhasil diperbarui')
          setLegalDialogOpen(false)
          setEditingLegal(null)
          setLegalDocumentFile(null)
          loadLegalDocuments()
        } else {
          toast.error(response.error || 'Gagal memperbarui legal document')
        }
      } else {
        // Create legal
        const response = await tenantsApi.createTenantLegal(tenant.id, submitData as CreateTenantLegalData)
        if (response.success) {
          toast.success('Legal document berhasil dibuat')
          setLegalDialogOpen(false)
          setLegalDocumentFile(null)
          loadLegalDocuments()
        } else {
          toast.error(response.error || 'Gagal membuat legal document')
        }
      }
    } catch (error) {
      console.error('Legal submit error:', error)
      toast.error('Terjadi kesalahan saat menyimpan legal document')
    } finally {
      setLegalFormLoading(false)
    }
  }

  const loadPaymentLogs = async () => {
    if (!tenant?.id) return
    
    setPaymentLogsLoading(true)
    try {
      const response = await tenantsApi.getTenantPaymentLogs(tenant.id)
      
      if (response.success && response.data) {
        const responseData = response.data as any
        const logsData = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : [])
        setPaymentLogs(logsData)
      } else {
        toast.error(response.error || 'Gagal memuat data payment logs')
      }
    } catch (error) {
      console.error('Load payment logs error:', error)
      toast.error('Terjadi kesalahan saat memuat data payment logs')
    } finally {
      setPaymentLogsLoading(false)
    }
  }

  const handleCreatePayment = () => {
    setEditingPayment(null)
    setPaymentDialogOpen(true)
  }

  const handleEditPayment = (payment: TenantPaymentLog) => {
    setEditingPayment(payment)
    setPaymentDialogOpen(true)
  }

  const handleDeletePayment = (payment: TenantPaymentLog) => {
    setPaymentToDelete(payment)
    setDeletePaymentDialogOpen(true)
  }

  const handleDeletePaymentConfirm = async () => {
    if (!paymentToDelete || !tenant?.id) return

    setDeletingPayment(true)
    try {
      const response = await tenantsApi.deleteTenantPayment(tenant.id, paymentToDelete.id)
      
      if (response.success) {
        toast.success('Payment log berhasil dihapus')
        loadPaymentLogs()
      loadLegalDocuments()
      } else {
        toast.error(response.error || 'Gagal menghapus payment log')
      }
    } catch (error) {
      console.error('Delete payment error:', error)
      toast.error('Terjadi kesalahan saat menghapus payment log')
    } finally {
      setDeletingPayment(false)
      setDeletePaymentDialogOpen(false)
      setPaymentToDelete(null)
    }
  }

  const handlePaymentSubmit = async (data: CreateTenantPaymentData | UpdateTenantPaymentData) => {
    if (!tenant?.id) {
      toast.error('Tenant ID tidak ditemukan')
      return
    }

    setPaymentFormLoading(true)
    try {
      if (editingPayment) {
        // Update payment
        const response = await tenantsApi.updateTenantPayment(tenant.id, editingPayment.id, data as UpdateTenantPaymentData)
        if (response.success) {
          toast.success('Payment log berhasil diperbarui')
          setPaymentDialogOpen(false)
          setEditingPayment(null)
          loadPaymentLogs()
      loadLegalDocuments()
        } else {
          toast.error(response.error || 'Gagal memperbarui payment log')
        }
      } else {
        // Create payment
        const response = await tenantsApi.createTenantPayment(tenant.id, data as CreateTenantPaymentData)
        if (response.success) {
          toast.success('Payment log berhasil dibuat')
          setPaymentDialogOpen(false)
          loadPaymentLogs()
      loadLegalDocuments()
        } else {
          toast.error(response.error || 'Gagal membuat payment log')
        }
      }
    } catch (error) {
      console.error('Payment submit error:', error)
      toast.error('Terjadi kesalahan saat menyimpan payment log')
    } finally {
      setPaymentFormLoading(false)
    }
  }

  const validatePassword = (password: string) => {
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    const minLength = password.length >= 6

    setPasswordValidation({
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      minLength
    })

    return hasUppercase && hasLowercase && hasNumber && hasSpecialChar && minLength
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nama tenant harus diisi'
    }

    if (userSelectionType === 'existing') {
      if (!formData.user_id) {
        newErrors.user_id = 'User harus dipilih'
      }
    } else {
      // Validasi field user baru
      if (!newUserData.name.trim()) newErrors.user_id = 'Nama user baru harus diisi'
      else if (!newUserData.email.trim()) newErrors.user_id = 'Email user baru harus diisi'
      else if (!newUserData.password.trim()) {
        newErrors.user_id = 'Password user baru harus diisi'
        newErrors.password = 'Password harus diisi'
      } else if (!validatePassword(newUserData.password)) {
        newErrors.user_id = 'Password tidak memenuhi syarat'
        newErrors.password = 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol'
      } else if (!newUserData.phone.trim()) newErrors.user_id = 'No. telepon user baru harus diisi'
      else if (!newUserData.gender) newErrors.user_id = 'Jenis kelamin user baru harus dipilih'
      else if (!newUserData.role_id) newErrors.user_id = 'Role user baru harus dipilih'
    }

    if (!formData.contract_begin_at) {
      newErrors.contract_begin_at = 'Tanggal mulai kontrak harus diisi'
    }

    if (!formData.contract_end_at) {
      newErrors.contract_end_at = 'Tanggal berakhir kontrak harus diisi'
    }

    if (identificationFiles.length === 0 && existingIdentificationUrls.length === 0) {
      newErrors.identificationFiles = 'Minimal satu dokumen identitas harus diupload'
    }

    if (contractFiles.length === 0 && existingContractUrls.length === 0) {
      newErrors.contractFiles = 'Minimal satu dokumen kontrak harus diupload'
    }


    if (!formData.category || formData.category.trim() === '') {
      newErrors.category = 'Kategori harus diisi'
    }

    if (!formData.rent_price || formData.rent_price <= 0) {
      newErrors.rent_price = 'Harga sewa harus diisi dan lebih dari 0'
    }


    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const uploadFiles = async (files: File[], type: 'identification' | 'contract') => {
    const uploadPromises = files.map(async (file) => {
      try {
        const response = await tenantsApi.uploadTenantFile(file, type)
        
        if (response.success && response.data) {
          // Handle both array and string response formats
          const url = Array.isArray(response.data.url) ? response.data.url[0] : response.data.url
          return url || ''
        } else {
          throw new Error(response.error || 'Upload failed')
        }
      } catch (error) {
        throw error
      }
    })
    
    return Promise.all(uploadPromises)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setUploading(true)
    try {
      let createdUserId: string | null = null
      // Jika mode user baru, buat user terlebih dahulu
      if (userSelectionType === 'new' && !formData.user_id) {
        // Ensure role_id is set (default to tenant role)
        let roleIdToUse = newUserData.role_id
        if (!roleIdToUse && roles.length > 0) {
          const tenantRole = roles.find((role: any) => role.name?.toLowerCase() === 'tenant')
          if (tenantRole) {
            roleIdToUse = String(tenantRole.id)
          }
        }
        
        const createUserResponse = await usersApi.createUser({
          name: newUserData.name,
          email: newUserData.email,
          password: newUserData.password,
          phone: newUserData.phone,
          gender: newUserData.gender,
          roleId: roleIdToUse ? String(parseInt(roleIdToUse as any, 10)) : undefined,
          status: 'active'
        })

        if (!createUserResponse.success || !createUserResponse.data) {
          throw new Error(createUserResponse.error || 'Gagal membuat user baru')
        }
        
        // Handle response structure - backend returns { data: userObject, message, status }
        // API client might wrap it differently
        let userId: string | undefined
        
        if (createUserResponse.data) {
          // Check if data is nested (data.data) - handle case where API client wraps response
          const responseData = createUserResponse.data as any
          if (responseData.data && responseData.data.id) {
            userId = responseData.data.id
          } 
          // Check if data is the user object directly
          else if (responseData.id) {
            userId = responseData.id
          }
        }
        
        if (!userId) {
          throw new Error('Gagal mendapatkan ID user yang baru dibuat')
        }
        
        createdUserId = userId
        setFormData(prev => ({ ...prev, user_id: createdUserId! }))
      }

      let identificationUrls = existingIdentificationUrls
      let contractUrls = existingContractUrls

      // Upload new files if any
      if (identificationFiles.length > 0) {
        const newIdentificationUrls = await uploadFiles(identificationFiles, 'identification')
        identificationUrls = [...existingIdentificationUrls, ...newIdentificationUrls]
      }

      if (contractFiles.length > 0) {
        const newContractUrls = await uploadFiles(contractFiles, 'contract')
        contractUrls = [...existingContractUrls, ...newContractUrls]
      }

      const effectiveUserId = userSelectionType === 'new' ? (createdUserId || formData.user_id) : formData.user_id

      // Validasi user_id sebelum submit
      if (!effectiveUserId || effectiveUserId === '') {
        throw new Error('User ID tidak tersedia. Pastikan user sudah dipilih atau dibuat.')
      }
      
      // Convert payment_term from string to number: 0 for year, 1 for month
      let paymentTermValue: number | undefined = undefined
      if (formData.payment_term) {
        if (formData.payment_term === DURATION_UNITS.YEAR) {
          paymentTermValue = 0
        } else if (formData.payment_term === DURATION_UNITS.MONTH) {
          paymentTermValue = 1
        }
      }

      const submitData: any = {
        name: formData.name.trim(),
        ...(formData.status ? { status: formData.status } : {}),
        tenant_identifications: identificationUrls,
        contract_documents: contractUrls,
      }

      // Only include these fields when creating (not editing)
      if (!tenant) {
        submitData.user_id = effectiveUserId
        submitData.contract_begin_at = formData.contract_begin_at
        submitData.contract_end_at = formData.contract_end_at
        submitData.building_type = formData.building_type
        if (formData.building_type === 'unit') {
          submitData.unit_ids = formData.unit_ids
        } else if (formData.building_type === 'asset') {
          submitData.asset_ids = formData.asset_ids
        }
        submitData.category = formData.category.trim()
        if (formData.sub_category && formData.sub_category.trim()) {
          submitData.sub_category = formData.sub_category.trim()
        }
        submitData.rent_price = formData.rent_price
        if (paymentTermValue !== undefined) {
          submitData.payment_term = paymentTermValue
        }
        submitData.building_area = formData.building_area || undefined
        submitData.land_area = formData.land_area || undefined
        submitData.electricity_power = formData.electricity_power || undefined
      } else {
        // For update, include these fields if they have values
        if (formData.building_area > 0) {
          submitData.building_area = formData.building_area
        }
        if (formData.land_area > 0) {
          submitData.land_area = formData.land_area
        }
        if (formData.electricity_power > 0) {
          submitData.electricity_power = formData.electricity_power
        }
      }

      // Validate that URLs are arrays of strings
      if (!Array.isArray(identificationUrls)) {
        throw new Error('Identification URLs must be an array')
      }
      if (!Array.isArray(contractUrls)) {
        throw new Error('Contract URLs must be an array')
      }
      
      // Validate that all URLs are strings
      const invalidIdentificationUrls = identificationUrls.filter(url => typeof url !== 'string')
      const invalidContractUrls = contractUrls.filter(url => typeof url !== 'string')
      
      if (invalidIdentificationUrls.length > 0) {
        throw new Error('All identification URLs must be strings')
      }
      if (invalidContractUrls.length > 0) {
        throw new Error('All contract URLs must be strings')
      }

      await onSubmit(submitData)
    } catch (error) {
      toast.error('Gagal membuat tenant. ' + error)
    } finally {
      setUploading(false)
    }
  }

  // Format price with thousand separators (Indonesian format: 1.000.000)
  const formatPrice = (value: number | string): string => {
    if (value === null || value === undefined || value === '') return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
    if (isNaN(numValue)) return ''
    // Allow 0 to be displayed (needed for deposit field when updating)
    if (numValue === 0) return '0'
    // Convert to integer string and add thousand separators
    const integerPart = Math.floor(numValue).toString()
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Parse price input: remove separators and leading zeros
  const parsePrice = (value: string): number => {
    if (!value || value.trim() === '') return 0
    // Remove thousand separators (dots) and any non-digit characters except decimal point
    const cleaned = value.replace(/\./g, '').replace(/[^\d]/g, '')
    if (!cleaned || cleaned === '') return 0
    // Remove leading zeros but keep at least one digit if all zeros
    const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
    return parseFloat(parsed) || 0
  }

  const handleInputChange = (field: string, value: string | string[] | number[] | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Handle price input change with formatting
  const handlePriceChange = (field: 'rent_price', value: string) => {
    const parsedValue = parsePrice(value)
    handleInputChange(field, parsedValue)
  }

  // Format number with thousand separators (for area and power)
  const formatNumber = (value: number | string): string => {
    if (value === null || value === undefined || value === '') return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
    if (isNaN(numValue)) return ''
    if (numValue === 0) return '0'
    const integerPart = Math.floor(numValue).toString()
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Parse number input: remove separators
  const parseNumber = (value: string): number => {
    if (!value || value.trim() === '') return 0
    const cleaned = value.replace(/\./g, '').replace(/[^\d.]/g, '')
    if (!cleaned || cleaned === '') return 0
    const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
    return parseFloat(parsed) || 0
  }

  // Handle number input change with formatting (for area and power)
  const handleNumberChange = (field: 'building_area' | 'land_area' | 'electricity_power', value: string) => {
    const parsedValue = parseNumber(value)
    handleInputChange(field, parsedValue)
  }

  const handleFileChange = (file: File | null, type: 'identification' | 'contract') => {
    if (file) {
      // Validasi tipe file
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Hanya file JPG, JPEG, PNG, PDF, DOC, dan DOCX yang diperbolehkan')
        return
      }

      // Validasi ukuran file (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast.error('Ukuran file maksimal 10MB')
        return
      }

      if (type === 'identification') {
        setIdentificationFiles(prev => [...prev, file])
        if (errors.identificationFiles) {
          setErrors(prev => ({ ...prev, identificationFiles: '' }))
        }
      } else {
        setContractFiles(prev => [...prev, file])
        if (errors.contractFiles) {
          setErrors(prev => ({ ...prev, contractFiles: '' }))
        }
      }
    }
  }

  const removeFile = (index: number, type: 'identification' | 'contract') => {
    if (type === 'identification') {
      setIdentificationFiles(prev => prev.filter((_, i) => i !== index))
    } else {
      setContractFiles(prev => prev.filter((_, i) => i !== index))
    }
  }

  const getFileIcon = (file: File | string) => {
    const fileName = typeof file === 'string' ? file : file.name
    const extension = fileName.split('.').pop()?.toLowerCase()
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image'
    } else if (['pdf'].includes(extension || '')) {
      return 'pdf'
    } else if (['doc', 'docx'].includes(extension || '')) {
      return 'word'
    } else {
      return 'file'
    }
  }

  const getFilePreview = (file: File | string, index: number) => {
    const fileName = typeof file === 'string' ? file.split('/').pop() || 'Unknown' : file.name
    const fileType = getFileIcon(file)
    const isImage = fileType === 'image'
    
    if (typeof file === 'string') {
      // Existing file
      return (
        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
          {isImage ? (
            <img 
              src={file} 
              alt={fileName}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="text-center p-2">
              <File className="h-8 w-8 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 truncate">{fileName}</p>
            </div>
          )}
        </div>
      )
    } else {
      // New file
      return (
        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
          {isImage ? (
            <img 
              src={URL.createObjectURL(file)} 
              alt={fileName}
              className="w-full h-full object-cover rounded-lg"
              onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
            />
          ) : (
            <div className="text-center p-2">
              <File className="h-8 w-8 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 truncate">{fileName}</p>
            </div>
          )}
        </div>
      )
    }
  }


  const toggleUnit = (unitId: string) => {
    const currentIds = formData.unit_ids || []
    const newIds = currentIds.includes(unitId)
      ? currentIds.filter(id => id !== unitId)
      : [...currentIds, unitId]
    handleInputChange('unit_ids', newIds)
  }

  const toggleAsset = (assetId: string) => {
    const currentIds = formData.asset_ids || []
    const newIds = currentIds.includes(assetId)
      ? currentIds.filter(id => id !== assetId)
      : [...currentIds, assetId]
    handleInputChange('asset_ids', newIds)
  }

  // Filter suggestions based on input
  const getFilteredCategorySuggestions = (input: string) => {
    if (!input.trim()) return categorySuggestions
    return categorySuggestions.filter((cat: string) => 
      cat.toLowerCase().includes(input.toLowerCase())
    )
  }

  const getFilteredSubCategorySuggestions = (input: string) => {
    if (!input.trim()) return subCategorySuggestions
    return subCategorySuggestions.filter((subCat: string) => 
      subCat.toLowerCase().includes(input.toLowerCase())
    )
  }

  const handleCategoryInputChange = (value: string) => {
    handleInputChange('category', value)
    setShowCategorySuggestions(true)
  }

  const handleSubCategoryInputChange = (value: string) => {
    handleInputChange('sub_category', value)
    setShowSubCategorySuggestions(true)
  }

  const selectCategorySuggestion = (category: string) => {
    handleInputChange('category', category)
    setShowCategorySuggestions(false)
    if (categoryInputRef.current) {
      categoryInputRef.current.blur()
    }
  }

  const selectSubCategorySuggestion = (subCategory: string) => {
    handleInputChange('sub_category', subCategory)
    setShowSubCategorySuggestions(false)
    if (subCategoryInputRef.current) {
      subCategoryInputRef.current.blur()
    }
  }



  const createNewUser = async () => {
    try {
      const response = await usersApi.createUser({
        name: newUserData.name,
        email: newUserData.email,
        password: newUserData.password,
        phone: newUserData.phone,
        gender: newUserData.gender,
        roleId: newUserData.role_id,
        status: 'active'
      })
      
      if (response.success && response.data) {
        toast.success('User berhasil dibuat')
        setFormData(prev => ({ ...prev, user_id: response.data!.id }))
        setUserSelectionType('existing')
        setNewUserData({ name: '', email: '', password: '', phone: '', gender: '', role_id: '', status: 'active' })
        // Reload users list
        const usersResponse = await usersApi.getUsers()
        if (usersResponse.success && usersResponse.data) {
          const usersResponseData = usersResponse.data as any
          const usersData = Array.isArray(usersResponseData.data) ? usersResponseData.data : []
          setUsers(usersData)
        }
      } else {
        toast.error(response.error || 'Gagal membuat user')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat membuat user')
    }
  }

  const handleNewUserInputChange = (field: string, value: string) => {
    setNewUserData(prev => ({ ...prev, [field]: value }))
    
    // Validate password in real-time when password field changes
    if (field === 'password') {
      validatePassword(value)
      
      // Clear password error when user starts typing
      if (errors.password) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.password
          return newErrors
        })
      }
    }
  }

  const filteredUsers = Array.isArray(users) ? users
    // filter hanya role tenant
    .filter(user => user.role?.name?.toLowerCase() === 'tenant')
    // filter pencarian
    .filter(user => {
      if (!userSearchTerm.trim()) return true
      const searchTerm = userSearchTerm.toLowerCase()
      return (
        user.name?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm)
      )
    }) : []

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
      <TabsList className='active-gradient bg-transparent dark:bg-transparent rounded-none h-[50px]'>
        <TabsTrigger 
          value="info" 
          className='py-2.5 px-4 font-semibold text-sm inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 rounded-[0] data-[state=active]:shadow-none cursor-pointer'
        >
          Informasi Tenant
        </TabsTrigger>
        <TabsTrigger 
          value="payments" 
          disabled={!tenant?.id}
          className='py-2.5 px-4 font-semibold text-sm inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 rounded-[0] data-[state=active]:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
        >
          Penagihan {tenant?.id && `(${paymentLogs.length})`}
        </TabsTrigger>
        <TabsTrigger 
          value="legals" 
          disabled={!tenant?.id}
          className='py-2.5 px-4 font-semibold text-sm inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-blue-600 dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-600 rounded-[0] data-[state=active]:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
        >
          Legal Documents {tenant?.id && `(${legalDocuments.length})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="px-6 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informasi Dasar */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Dasar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Tenant */}
            <div className="space-y-2">
              <Label htmlFor="name">Nama Tenant *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter Name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Nama Penanggung Jawab */}
            {userSelectionType === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="responsible_person">Nama Penanggung Jawab *</Label>
                <Input
                  id="responsible_person"
                  value={newUserData.name}
                  onChange={(e) => handleNewUserInputChange('name', e.target.value)}
                  placeholder="Enter Name"
                />
              </div>
            )}

            {/* Nomor Telp */}
            {userSelectionType === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telp *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newUserData.phone}
                  onChange={(e) => handleNewUserInputChange('phone', e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            {/* Jenis Kelamin */}
            {userSelectionType === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="gender">Jenis Kelamin *</Label>
                <Select
                  value={newUserData.gender}
                  onValueChange={(value) => handleNewUserInputChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Laki-laki</SelectItem>
                    <SelectItem value="female">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Buat Akses */}
      <Card>
        <CardHeader>
          <CardTitle>Buat Akses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {/* User Type Selection */}
            {!tenant && (
              <div className="space-y-2">
                <Label>Pilih Tipe User</Label>
                <RadioGroup
                  value={userSelectionType}
                  onValueChange={(value) => setUserSelectionType(value as 'existing' | 'new')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new" className="cursor-pointer">User Baru</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="existing" />
                    <Label htmlFor="existing" className="cursor-pointer">User Yang Sudah Ada</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            {tenant && (
              <div className="space-y-2">
                <Label>User</Label>
                <div className="p-3 bg-gray-50 border rounded-md">
                  <p className="font-medium">{tenant.user?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{tenant.user?.email || ''}</p>
                </div>
                <p className="text-xs text-muted-foreground">User tidak dapat diubah saat edit tenant</p>
              </div>
            )}

            {!tenant && userSelectionType === 'new' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => handleNewUserInputChange('email', e.target.value)}
                      placeholder="Masukkan Email"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={newUserData.password}
                        onChange={(e) => handleNewUserInputChange('password', e.target.value)}
                        placeholder="Masukkan Password"
                        className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-500">{errors.password}</p>
                    )}
                    {newUserData.password && (
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${passwordValidation.minLength ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}>
                            Minimal 6 karakter
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${passwordValidation.hasUppercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                            Huruf besar (A-Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${passwordValidation.hasLowercase ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                            Huruf kecil (a-z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${passwordValidation.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                            Angka (0-9)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${passwordValidation.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}>
                            Simbol (!@#$%^&*...)
                          </span>
                        </div>
                      </div>
                    )}
                    {!newUserData.password && (
                      <p className="text-xs text-muted-foreground">
                        Masukkan min. 6 karakter dengan kombinasi Huruf Kapital, Huruf Kecil, Angka, dan Simbol
                      </p>
                    )}
                  </div>

                </div>
              </div>
            )}

            {!tenant && userSelectionType === 'existing' && (
              <div className="space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari user..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                {/* User List */}
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {usersLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Memuat users...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {userSearchTerm ? `Tidak ada user yang cocok dengan "${userSearchTerm}"` : 'Tidak ada user tersedia'}
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = formData.user_id === user.id
                      
                      return (
                        <div
                          key={user.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                            isSelected ? 'bg-primary/10 border-primary' : ''
                          }`}
                          onClick={() => {
                            handleInputChange('user_id', user.id)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{user.name || 'Nama tidak tersedia'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            {isSelected && (
                              <Badge variant="default">Dipilih</Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      {/* Informasi Kontrak Sewa */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Kontrak Sewa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kategori, Sub Kategori, dan Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kategori Tenant */}
            <div className="space-y-2">
              <Label htmlFor="category">Kategori *</Label>
              <div className="relative">
                <Input
                  ref={categoryInputRef}
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleCategoryInputChange(e.target.value)}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                  placeholder="Masukkan kategori"
                  className={errors.category ? 'border-red-500' : ''}
                />
                {showCategorySuggestions && getFilteredCategorySuggestions(formData.category).length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {getFilteredCategorySuggestions(formData.category).map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectCategorySuggestion(suggestion)
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category}</p>
              )}
            </div>

            {/* Sub Kategori Tenant */}
            <div className="space-y-2">
              <Label htmlFor="sub_category">Sub Kategori</Label>
              <div className="relative">
                <Input
                  ref={subCategoryInputRef}
                  id="sub_category"
                  value={formData.sub_category}
                  onChange={(e) => handleSubCategoryInputChange(e.target.value)}
                  onFocus={() => setShowSubCategorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSubCategorySuggestions(false), 200)}
                  placeholder="Masukkan sub kategori"
                />
                {showSubCategorySuggestions && getFilteredSubCategorySuggestions(formData.sub_category).length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {getFilteredSubCategorySuggestions(formData.sub_category).map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectSubCategorySuggestion(suggestion)
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Status Tenant */}
            <div className="space-y-2">
              <Label htmlFor="status">Status Tenant *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger className={errors.status ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-500">{errors.status}</p>
              )}
            </div>
          </div>

          {tenant ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipe Bangunan</Label>
                <div className="p-3 bg-gray-50 border rounded-md">
                  <p className="font-medium">
                    {formData.building_type === 'unit' ? 'Unit' : 'Asset'}
                  </p>
                </div>
              </div>
              {formData.building_type === 'unit' && (
                <div className="space-y-2">
                  <Label>Unit Sewa</Label>
                  <div className="p-3 bg-gray-50 border rounded-md">
                    {tenant.units && tenant.units.length > 0 ? (
                      tenant.units.map((unit, index) => (
                        <div key={unit.id || index} className="mb-2 last:mb-0">
                          <p className="font-medium">{unit.name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Asset:</span> {unit.asset?.name || '-'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Tidak ada unit</p>
                    )}
                  </div>
                </div>
              )}
              {formData.building_type === 'asset' && formData.asset_ids && formData.asset_ids.length > 0 && (
                <div className="space-y-2">
                  <Label>Asset</Label>
                  <div className="p-3 bg-gray-50 border rounded-md space-y-2">
                    {formData.asset_ids.map((assetId) => {
                      const asset = assets.find(a => a.id === assetId)
                      return asset ? (
                        <p key={assetId} className="font-medium">{asset.name}</p>
                      ) : null
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Tipe bangunan dan pilihan tidak dapat diubah saat edit tenant</p>
            </div>
          ) : (
            <>
              {/* Tipe Bangunan */}
              <div className="space-y-2">
                <Label htmlFor="building_type">Tipe Bangunan *</Label>
                <Select
                  value={formData.building_type}
                  onValueChange={(value) => {
                    handleInputChange('building_type', value)
                    // Reset selection when switching type
                    handleInputChange('unit_ids', [])
                    handleInputChange('asset_ids', [])
                  }}
                >
                  <SelectTrigger className={errors.building_type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Pilih Tipe Bangunan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                  </SelectContent>
                </Select>
                {errors.building_type && (
                  <p className="text-sm text-red-500">{errors.building_type}</p>
                )}
              </div>

              {/* Pilih Unit atau Asset berdasarkan building_type - Multi Select dengan Checkbox */}
              {formData.building_type === 'unit' && (
                <div className="space-y-2">
                  <Label>Pilih Unit Sewa *</Label>
                  {errors.unit_ids && (
                    <p className="text-sm text-red-500">{errors.unit_ids}</p>
                  )}
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-3">
                    {Array.isArray(units) && units.length > 0 ? (
                      units.map((unit) => (
                        <div key={unit.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={`unit-${unit.id}`}
                            checked={formData.unit_ids.includes(unit.id)}
                            onCheckedChange={() => toggleUnit(unit.id)}
                            className="mt-1"
                          />
                          <Label
                            htmlFor={`unit-${unit.id}`}
                            className="flex-1 cursor-pointer space-y-1"
                          >
                            <p className="font-medium">{unit.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {unit.asset?.name && `Asset: ${unit.asset.name}`}
                              {unit.size && ` • ${unit.size} m²`}
                            </p>
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Tidak ada unit tersedia
                      </p>
                    )}
                  </div>
                  {formData.unit_ids.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formData.unit_ids.length} unit dipilih
                    </p>
                  )}
                </div>
              )}

              {formData.building_type === 'asset' && (
                <div className="space-y-2">
                  <Label>Pilih Asset *</Label>
                  {errors.asset_ids && (
                    <p className="text-sm text-red-500">{errors.asset_ids}</p>
                  )}
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-3">
                    {Array.isArray(assets) && assets.length > 0 ? (
                      assets.map((asset) => (
                        <div key={asset.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={`asset-${asset.id}`}
                            checked={formData.asset_ids.includes(asset.id)}
                            onCheckedChange={() => toggleAsset(asset.id)}
                            className="mt-1"
                          />
                          <Label
                            htmlFor={`asset-${asset.id}`}
                            className="flex-1 cursor-pointer space-y-1"
                          >
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.address && `Alamat: ${asset.address}`}
                              {asset.area && ` • ${asset.area} m²`}
                            </p>
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Tidak ada asset tersedia
                      </p>
                    )}
                  </div>
                  {formData.asset_ids.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formData.asset_ids.length} asset dipilih
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lama Kontrak */}
      <Card>
        <CardHeader>
          <CardTitle>Lama Kontrak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tanggal Mulai Kontrak */}
            <div className="space-y-2">
              <Label htmlFor="contract_begin_at">Tanggal Mulai Kontrak {tenant ? '' : '*'}</Label>
              {tenant ? (
                <div className="p-3 bg-gray-50 border rounded-md">
                  <p className="font-medium">
                    {formData.contract_begin_at ? new Date(formData.contract_begin_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }) : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Tanggal mulai kontrak tidak dapat diubah saat edit tenant</p>
                </div>
              ) : (
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="contract_begin_at"
                    type="date"
                    value={formData.contract_begin_at}
                    onChange={(e) => handleInputChange('contract_begin_at', e.target.value)}
                    className={`pl-8 ${errors.contract_begin_at ? 'border-red-500' : ''}`}
                  />
                </div>
              )}
              {errors.contract_begin_at && (
                <p className="text-sm text-red-500">{errors.contract_begin_at}</p>
              )}
            </div>

            {/* Tanggal Berakhir Kontrak */}
            <div className="space-y-2">
              <Label htmlFor="contract_end_at">Tanggal Berakhir Kontrak *</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="contract_end_at"
                  type="date"
                  value={formData.contract_end_at}
                  onChange={(e) => handleInputChange('contract_end_at', e.target.value)}
                  className={`pl-8 ${errors.contract_end_at ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.contract_end_at && (
                <p className="text-sm text-red-500">{errors.contract_end_at}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Harga Sewa Kontrak */}
      <Card>
        <CardHeader>
          <CardTitle>Harga Sewa Kontrak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Harga Sewa */}
            <div className="space-y-2">
              <Label htmlFor="rent_price">
                Harga Sewa {tenant ? '' : <span className="text-red-500">*</span>}
              </Label>
              {tenant ? (
                <div className="p-3 bg-gray-50 border rounded-md">
                  <p className="font-medium">
                    Rp {formatPrice(formData.rent_price)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Harga sewa tidak dapat diubah saat edit tenant</p>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
                  <Input
                    id="rent_price"
                    type="text"
                    value={formatPrice(formData.rent_price)}
                    onChange={(e) => handlePriceChange('rent_price', e.target.value)}
                    placeholder="0"
                    className={`pl-10 ${errors.rent_price ? 'border-red-500' : ''}`}
                  />
                </div>
              )}
              {errors.rent_price && (
                <p className="text-sm text-red-500">{errors.rent_price}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Harga Bayar Sewa */}
      {formData.rent_price > 0 && formData.payment_term && String(formData.payment_term).trim() !== '' && (
        <Card>
          <CardHeader>
            <CardTitle>Harga Bayar Sewa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">
                {(() => {
                  // Use tenant values when editing (more reliable), fall back to formData when creating
                  const rentPrice = tenant?.rent_price || formData.rent_price || 0
                  
                  // For payment term, use tenant values if available, otherwise formData
                  let paymentTerm: string | undefined
                  
                  if (tenant) {
                    // Normalize payment_term from tenant
                    if (tenant.payment_term !== null && tenant.payment_term !== undefined) {
                      if (typeof tenant.payment_term === 'number') {
                        paymentTerm = tenant.payment_term === 0 ? DURATION_UNITS.YEAR : DURATION_UNITS.MONTH
                      } else if (typeof tenant.payment_term === 'string') {
                        const termStr = tenant.payment_term.trim().toLowerCase()
                        if (termStr === '0' || termStr === 'year' || termStr === DURATION_UNITS.YEAR) {
                          paymentTerm = DURATION_UNITS.YEAR
                        } else if (termStr === '1' || termStr === 'month' || termStr === DURATION_UNITS.MONTH) {
                          paymentTerm = DURATION_UNITS.MONTH
                        } else {
                          paymentTerm = formData.payment_term
                        }
                      } else {
                        paymentTerm = formData.payment_term
                      }
                    } else {
                      paymentTerm = formData.payment_term
                    }
                  } else {
                    // When creating: use formData values
                    paymentTerm = formData.payment_term
                  }
                  
                  if (paymentTerm && rentPrice > 0) {
                    // Calculate price per payment term
                    const normalizedPaymentTerm = paymentTerm.toLowerCase().trim()
                    const isPaymentYear = normalizedPaymentTerm === DURATION_UNITS.YEAR || normalizedPaymentTerm === 'year'
                    const isPaymentMonth = normalizedPaymentTerm === DURATION_UNITS.MONTH || normalizedPaymentTerm === 'month'
                    
                    // For now, just return rent price divided by payment term
                    // This is a simplified calculation - adjust based on your business logic
                    if (isPaymentYear) {
                      return new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(rentPrice)
                    } else if (isPaymentMonth) {
                      return new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(rentPrice)
                    }
                  }
                  return 'Rp0'
                })()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Harga bayar sewa akan otomatis terkalkulasi berdasarkan pilihan periode pembayaran bulanan/tahunan
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informasi Bangunan */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Bangunan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Luas Bangunan */}
            <div className="space-y-2">
              <Label htmlFor="building_area">Luas Bangunan (m²)</Label>
              <div className="relative">
                <Input
                  id="building_area"
                  type="text"
                  value={formatNumber(formData.building_area)}
                  onChange={(e) => handleNumberChange('building_area', e.target.value)}
                  placeholder="0"
                  className={errors.building_area ? 'border-red-500' : ''}
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">m²</span>
              </div>
              {errors.building_area && (
                <p className="text-sm text-red-500">{errors.building_area}</p>
              )}
            </div>

            {/* Luas Tanah */}
            <div className="space-y-2">
              <Label htmlFor="land_area">Luas Tanah (m²)</Label>
              <div className="relative">
                <Input
                  id="land_area"
                  type="text"
                  value={formatNumber(formData.land_area)}
                  onChange={(e) => handleNumberChange('land_area', e.target.value)}
                  placeholder="0"
                  className={errors.land_area ? 'border-red-500' : ''}
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">m²</span>
              </div>
              {errors.land_area && (
                <p className="text-sm text-red-500">{errors.land_area}</p>
              )}
            </div>

            {/* Daya Listrik */}
            <div className="space-y-2">
              <Label htmlFor="electricity_power">Daya Listrik (VA)</Label>
              <div className="relative">
                <Input
                  id="electricity_power"
                  type="text"
                  value={formatNumber(formData.electricity_power)}
                  onChange={(e) => handleNumberChange('electricity_power', e.target.value)}
                  placeholder="0"
                  className={errors.electricity_power ? 'border-red-500' : ''}
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">VA</span>
              </div>
              {errors.electricity_power && (
                <p className="text-sm text-red-500">{errors.electricity_power}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {errors.user_id && (
        <p className="text-sm text-red-500">{errors.user_id}</p>
      )}

      {/* Dokumen Identitas */}
      <Card>
        <CardHeader>
          <CardTitle>Dokumen Identitas *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.identificationFiles && (
            <p className="text-sm text-red-500">{errors.identificationFiles}</p>
          )}
          
          {/* File Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Existing files */}
            {existingIdentificationUrls.map((url, index) => (
              <div key={`existing-${index}`} className="relative group">
                {getFilePreview(url, index)}
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">Existing</Badge>
                </div>
              </div>
            ))}
            
            {/* New files */}
            {identificationFiles.map((file, index) => (
              <div key={`new-${index}`} className="relative group">
                {getFilePreview(file, index)}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index, 'identification')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {/* Add more files button */}
            <div className="relative">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  handleFileChange(file, 'identification')
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="identification-upload"
              />
              <label 
                htmlFor="identification-upload"
                className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition-colors"
              >
                <div className="text-center">
                  <Plus className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Tambah File</p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dokumen Kontrak */}
      <Card>
        <CardHeader>
          <CardTitle>Dokumen Kontrak *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.contractFiles && (
            <p className="text-sm text-red-500">{errors.contractFiles}</p>
          )}
          
          {/* File Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Existing files */}
            {existingContractUrls.map((url, index) => (
              <div key={`existing-contract-${index}`} className="relative group">
                {getFilePreview(url, index)}
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">Existing</Badge>
                </div>
              </div>
            ))}
            
            {/* New files */}
            {contractFiles.map((file, index) => (
              <div key={`new-contract-${index}`} className="relative group">
                {getFilePreview(file, index)}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index, 'contract')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {/* Add more files button */}
            <div className="relative">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  handleFileChange(file, 'contract')
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="contract-upload"
              />
              <label 
                htmlFor="contract-upload"
                className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition-colors"
              >
                <div className="text-center">
                  <Plus className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Tambah File</p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      

      <Separator />

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={loading || uploading}
        >
          Batal
        </Button>
        <Button type="submit" disabled={loading || uploading}>
          {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {uploading ? 'Mengupload file...' : tenant ? 'Perbarui Tenant' : 'Buat Tenant'}
        </Button>
      </div>
        </form>
      </TabsContent>

      <TabsContent value="payments" className="px-6 py-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Penagihan</h3>
            <Button onClick={handleCreatePayment} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Penagihan
            </Button>
          </div>

          {paymentLogsLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[3%]">No</TableHead>
                    <TableHead className="w-[8%]">Periode Tagihan</TableHead>
                    <TableHead className="w-[8%]">Jatuh Tempo</TableHead>
                    <TableHead className="w-[7%]">Jenis Tagihan</TableHead>
                    <TableHead className="w-[8%]">Jumlah Tagihan</TableHead>
                    <TableHead className="w-[8%]">Tanggal Bayar</TableHead>
                    <TableHead className="w-[8%]">Jumlah Bayar</TableHead>
                    <TableHead className="w-[8%]">Dibayar</TableHead>
                    <TableHead className="w-[7%]">Metode</TableHead>
                    <TableHead className="w-[8%]">Outstanding</TableHead>
                    <TableHead className="w-[8%]">Overdue</TableHead>
                    <TableHead className="w-[5%]">Rate</TableHead>
                    <TableHead className="w-[8%]">Last Charge</TableHead>
                    <TableHead className="w-[6%]">Status</TableHead>
                    <TableHead className="w-[8%] text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        Tidak ada data payment
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentLogs.map((payment, index) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-center">{index + 1}</TableCell>
                        <TableCell>
                          {payment.billing_period || '-'}
                        </TableCell>
                        <TableCell>
                          {payment.payment_deadline 
                            ? new Date(payment.payment_deadline).toLocaleDateString('id-ID')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.billing_type || '-'}
                        </TableCell>
                        <TableCell>
                          {payment.billing_amount 
                            ? `Rp ${payment.billing_amount.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.payment_date 
                            ? new Date(payment.payment_date).toLocaleDateString('id-ID')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.amount 
                            ? `Rp ${payment.amount.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.paid_amount 
                            ? `Rp ${payment.paid_amount.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.payment_method === 'cash' ? 'Cash' :
                           payment.payment_method === 'bank_transfer' ? 'Bank Transfer' :
                           payment.payment_method === 'qris' ? 'QRIS' :
                           payment.payment_method === 'other' ? 'Other' : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.outstanding 
                            ? `Rp ${payment.outstanding.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.overdue 
                            ? `Rp ${payment.overdue.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {payment.rate ? (payment.rate * 100).toFixed(2) + '%' : '0.01%'}
                        </TableCell>
                        <TableCell>
                          {payment.last_charge_date 
                            ? `Rp ${payment.last_charge_date.toLocaleString('id-ID')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium border ${
                              payment.status === 1
                                ? 'bg-green-600/15 text-green-600 border-green-600'
                                : payment.status === 2
                                ? 'bg-red-600/15 text-red-600 border-red-600'
                                : 'bg-yellow-600/15 text-yellow-600 border-yellow-600'
                            }`}
                          >
                            {payment.status === 1 ? 'Paid' : payment.status === 2 ? 'Expired' : 'Unpaid'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditPayment(payment)}
                              className="h-8 w-8 rounded-full text-green-600 bg-green-600/10 hover:bg-green-600/20"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeletePayment(payment)}
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

      <TabsContent value="legals" className="px-6 py-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Legal Documents</h3>
          </div>

          {legalDocumentsLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%]">No</TableHead>
                    <TableHead className="w-[18%]">Jenis Dokumen</TableHead>
                    <TableHead className="w-[12%]">Due Date</TableHead>
                    <TableHead className="w-[25%]">Keterangan</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[15%]">Document</TableHead>
                    <TableHead className="w-[10%] text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legalDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Tidak ada data legal document
                      </TableCell>
                    </TableRow>
                  ) : (
                    legalDocuments.map((legal, index) => {
                      // Use description from backend, fallback to doc_type
                      const displayDocType = legal.description || legal.doc_type
                      
                      return (
                      <TableRow key={legal.id}>
                        <TableCell className="font-medium text-center">{index + 1}</TableCell>
                        <TableCell className="font-medium break-words whitespace-normal" style={{ wordBreak: 'break-word', maxWidth: '200px' }}>{displayDocType}</TableCell>
                        <TableCell>
                          {legal.due_date 
                            ? new Date(legal.due_date).toLocaleDateString('id-ID')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {legal.keterangan || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={legal.status === 'selesai' ? 'default' : 'secondary'}>
                            {legal.status === 'selesai' ? 'Selesai' : 'Belum Selesai'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {legal.document_url ? (
                            <a 
                              href={legal.document_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-2"
                            >
                              <File className="w-4 h-4" />
                              Lihat Dokumen
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditLegal(legal)}
                              className="h-8 w-8 rounded-full text-green-600 bg-green-600/10 hover:bg-green-600/20"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>

    {/* Payment Dialog */}
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPayment ? 'Edit Penagihan' : 'Tambah Penagihan Baru'}</DialogTitle>
          <DialogDescription>
            {editingPayment ? 'Perbarui informasi penagihan' : 'Masukkan informasi penagihan baru'}
          </DialogDescription>
        </DialogHeader>
        <PaymentForm
          payment={editingPayment || undefined}
          onSubmit={handlePaymentSubmit}
          loading={paymentFormLoading}
          onCancel={() => {
            setPaymentDialogOpen(false)
            setEditingPayment(null)
          }}
        />
      </DialogContent>
    </Dialog>

    {/* Delete Payment Dialog */}
    <AlertDialog open={deletePaymentDialogOpen} onOpenChange={setDeletePaymentDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Payment Log</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus payment log ini? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingPayment}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeletePaymentConfirm}
            disabled={deletingPayment}
            className="bg-red-600 hover:bg-red-700"
          >
            {deletingPayment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Legal Document Dialog */}
    <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingLegal ? 'Edit Legal Document' : 'Tambah Legal Document Baru'}</DialogTitle>
          <DialogDescription>
            {editingLegal ? 'Perbarui informasi legal document' : 'Masukkan informasi legal document baru'}
          </DialogDescription>
        </DialogHeader>
        <LegalForm
          legal={editingLegal || undefined}
          onSubmit={handleLegalSubmit}
          loading={legalFormLoading}
          onCancel={() => {
            setLegalDialogOpen(false)
            setEditingLegal(null)
            setLegalDocumentFile(null)
          }}
          documentFile={legalDocumentFile}
          onDocumentFileChange={setLegalDocumentFile}
        />
      </DialogContent>
    </Dialog>

    {/* Delete Legal Dialog */}
    <AlertDialog open={deleteLegalDialogOpen} onOpenChange={setDeleteLegalDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Legal Document</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus legal document ini? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingLegal}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteLegalConfirm}
            disabled={deletingLegal}
            className="bg-red-600 hover:bg-red-700"
          >
            {deletingLegal ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Hapus'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

// Payment Form Component
interface PaymentFormProps {
  payment?: TenantPaymentLog
  onSubmit: (data: CreateTenantPaymentData | UpdateTenantPaymentData) => Promise<void>
  loading?: boolean
  onCancel: () => void
}

function PaymentForm({ payment, onSubmit, loading = false, onCancel }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: '',
    payment_date: '',
    paid_amount: '',
    payment_deadline: '',
    notes: '',
    billing_type: '',
    billing_period: '',
    billing_amount: '',
    outstanding: '',
    overdue: '',
    rate: '0.01',
    last_charge_date: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount?.toString() || '',
        payment_method: payment.payment_method || '',
        payment_date: payment.payment_date ? new Date(payment.payment_date).toISOString().split('T')[0] : '',
        paid_amount: payment.paid_amount?.toString() || '',
        payment_deadline: payment.payment_deadline ? new Date(payment.payment_deadline).toISOString().split('T')[0] : '',
        notes: payment.notes || '',
        billing_type: payment.billing_type || '',
        billing_period: payment.billing_period || '',
        billing_amount: payment.billing_amount?.toString() || '',
        outstanding: payment.outstanding?.toString() || '',
        overdue: payment.overdue?.toString() || '',
        rate: payment.rate?.toString() || '0.01',
        last_charge_date: payment.last_charge_date ? new Date(payment.last_charge_date).toISOString().split('T')[0] : '',
      })
    } else {
      setFormData({
        amount: '',
        payment_method: '',
        payment_date: '',
        paid_amount: '',
        payment_deadline: '',
        notes: '',
        billing_type: '',
        billing_period: '',
        billing_amount: '',
        outstanding: '',
        overdue: '',
        rate: '0.01',
        last_charge_date: '',
      })
    }
  }, [payment])

  const formatPrice = (value: number | string): string => {
    if (value === null || value === undefined || value === '') return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
    if (isNaN(numValue) || numValue === 0) return ''
    const integerPart = Math.floor(numValue).toString()
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const parsePrice = (value: string): number => {
    if (!value || value.trim() === '') return 0
    const cleaned = value.replace(/\./g, '').replace(/[^\d]/g, '')
    if (!cleaned || cleaned === '') return 0
    const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
    return parseFloat(parsed) || 0
  }

  const handleInputChange = (field: string, value: string) => {
    if (field === 'amount' || field === 'paid_amount' || field === 'billing_amount' || field === 'outstanding' || field === 'overdue') {
      const parsedValue = parsePrice(value)
      setFormData(prev => ({ ...prev, [field]: formatPrice(parsedValue) }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Validasi hanya untuk create payment baru (tidak untuk update)
    if (!payment) {
      if (!formData.billing_period || formData.billing_period.trim() === '') {
        newErrors.billing_period = 'Periode tagihan harus diisi'
      }

      if (!formData.billing_amount || parsePrice(formData.billing_amount) <= 0) {
        newErrors.billing_amount = 'Jumlah tagihan harus diisi dan lebih dari 0'
      }

      if (!formData.payment_deadline || formData.payment_deadline.trim() === '') {
        newErrors.payment_deadline = 'Jatuh tempo harus diisi'
      }
    }

    // Field opsional untuk create, tapi tetap validasi jika diisi
    if (formData.amount && parsePrice(formData.amount) <= 0) {
      newErrors.amount = 'Jumlah pembayaran harus lebih dari 0'
    }

    if (formData.payment_method && !['cash', 'bank_transfer', 'qris', 'other'].includes(formData.payment_method)) {
      newErrors.payment_method = 'Metode pembayaran tidak valid'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (payment) {
      // Update payment
      const updateData: UpdateTenantPaymentData = {
        payment_method: formData.payment_method,
        notes: formData.notes.trim() || undefined,
      }
      if (formData.payment_date) {
        updateData.payment_date = new Date(formData.payment_date).toISOString()
      }
      if (formData.paid_amount) {
        updateData.paid_amount = parsePrice(formData.paid_amount)
      }
      if (formData.billing_type) {
        updateData.billing_type = formData.billing_type
      }
      if (formData.billing_period) {
        updateData.billing_period = formData.billing_period
      }
      if (formData.billing_amount) {
        updateData.billing_amount = parsePrice(formData.billing_amount)
      }
      if (formData.outstanding) {
        updateData.outstanding = parsePrice(formData.outstanding)
      }
      if (formData.overdue) {
        updateData.overdue = parsePrice(formData.overdue)
      }
      if (formData.rate) {
        updateData.rate = parseFloat(formData.rate) || 0.01
      }
      if (formData.last_charge_date) {
        updateData.last_charge_date = parsePrice(formData.last_charge_date)
      }
      await onSubmit(updateData)
    } else {
      // Create payment - billing_period, billing_amount, dan payment_deadline adalah mandatory
      const createData: CreateTenantPaymentData = {
        billing_period: formData.billing_period.trim(),
        billing_amount: parsePrice(formData.billing_amount),
        payment_deadline: new Date(formData.payment_deadline).toISOString(),
        amount: formData.amount ? parsePrice(formData.amount) : undefined,
        payment_method: formData.payment_method || undefined,
        notes: formData.notes.trim() || undefined,
      }
      if (formData.billing_type) {
        createData.billing_type = formData.billing_type
      }
      if (formData.outstanding) {
        createData.outstanding = parsePrice(formData.outstanding)
      }
      if (formData.overdue) {
        createData.overdue = parsePrice(formData.overdue)
      }
      if (formData.rate) {
        createData.rate = parseFloat(formData.rate) || 0.01
      }
      if (formData.last_charge_date) {
        createData.last_charge_date = parsePrice(formData.last_charge_date)
      }
      await onSubmit(createData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="billing_period">
            Periode Tagihan {!payment && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="billing_period"
            type="text"
            value={formData.billing_period}
            onChange={(e) => handleInputChange('billing_period', e.target.value)}
            placeholder="Contoh: Januari 2024"
            className={errors.billing_period ? 'border-red-500' : ''}
          />
          {errors.billing_period && (
            <p className="text-sm text-red-500">{errors.billing_period}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing_amount">
            Jumlah Tagihan {!payment && <span className="text-red-500">*</span>}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
            <Input
              id="billing_amount"
              type="text"
              value={formatPrice(parsePrice(formData.billing_amount))}
              onChange={(e) => handleInputChange('billing_amount', e.target.value)}
              placeholder="0"
              className={`pl-10 ${errors.billing_amount ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.billing_amount && (
            <p className="text-sm text-red-500">{errors.billing_amount}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment_deadline">
            Jatuh Tempo {!payment && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="payment_deadline"
            type="date"
            value={formData.payment_deadline}
            onChange={(e) => handleInputChange('payment_deadline', e.target.value)}
            className={errors.payment_deadline ? 'border-red-500' : ''}
          />
          {errors.payment_deadline && (
            <p className="text-sm text-red-500">{errors.payment_deadline}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing_type">Jenis Tagihan</Label>
          <Input
            id="billing_type"
            type="text"
            value={formData.billing_type}
            onChange={(e) => handleInputChange('billing_type', e.target.value)}
            placeholder="Masukkan jenis tagihan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Metode Pembayaran</Label>
          <Select
            value={formData.payment_method}
            onValueChange={(value) => handleInputChange('payment_method', value)}
          >
            <SelectTrigger className={errors.payment_method ? 'border-red-500' : ''}>
              <SelectValue placeholder="Pilih metode pembayaran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="qris">QRIS</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.payment_method && (
            <p className="text-sm text-red-500">{errors.payment_method}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment_date">Tanggal Pembayaran</Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => handleInputChange('payment_date', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_amount">Jumlah Dibayar</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
            <Input
              id="paid_amount"
              type="text"
              value={formatPrice(parsePrice(formData.paid_amount))}
              onChange={(e) => handleInputChange('paid_amount', e.target.value)}
              placeholder="0"
              className="pl-10"
            />
          </div>
        </div>
      </div>

      

      

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="outstanding">Outstanding</Label>
          <Input
            id="outstanding"
            type="text"
            value={formData.outstanding}
            onChange={(e) => handleInputChange('outstanding', e.target.value)}
            placeholder="Masukkan outstanding"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="overdue">Overdue</Label>
          <Input
            id="overdue"
            type="text"
            value={formData.overdue}
            onChange={(e) => handleInputChange('overdue', e.target.value)}
            placeholder="Masukkan overdue"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rate">Rate</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            value={formData.rate}
            onChange={(e) => handleInputChange('rate', e.target.value)}
            placeholder="0.01"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_charge_date">Last Charge</Label>
          <Input
            id="last_charge_date"
            type="text"
            value={formData.last_charge_date}
            onChange={(e) => handleInputChange('last_charge_date', e.target.value)}
            placeholder="Masukkan last charge"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Catatan</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Masukkan catatan (opsional)"
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {payment ? 'Perbarui Payment' : 'Buat Payment'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Legal Form Component
interface LegalFormProps {
  legal?: TenantLegal
  onSubmit: (data: CreateTenantLegalData | UpdateTenantLegalData) => Promise<void>
  loading?: boolean
  onCancel: () => void
  documentFile: File | null
  onDocumentFileChange: (file: File | null) => void
}

function LegalForm({ legal, onSubmit, loading = false, onCancel, documentFile, onDocumentFileChange }: LegalFormProps) {
  const [formData, setFormData] = useState({
    doc_type: '',
    due_date: '',
    keterangan: '',
    status: 'belum_selesai' as 'belum_selesai' | 'selesai',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (legal) {
      setFormData({
        doc_type: legal.doc_type || '',
        due_date: legal.due_date ? new Date(legal.due_date).toISOString().split('T')[0] : '',
        keterangan: legal.keterangan || '',
        status: legal.status || 'belum_selesai',
      })
    } else {
      setFormData({
        doc_type: '',
        due_date: '',
        keterangan: '',
        status: 'belum_selesai',
      })
    }
  }, [legal])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validasi tipe file
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Hanya file JPG, JPEG, PNG, PDF, DOC, dan DOCX yang diperbolehkan')
        return
      }

      // Validasi ukuran file (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast.error('Ukuran file maksimal 10MB')
        return
      }

      onDocumentFileChange(file)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.doc_type.trim()) {
      newErrors.doc_type = 'Jenis dokumen harus diisi'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const submitData: CreateTenantLegalData | UpdateTenantLegalData = {
      doc_type: formData.doc_type.trim(),
      due_date: formData.due_date || undefined,
      keterangan: formData.keterangan.trim() || undefined,
      status: formData.status,
    }

    await onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="doc_type">
          Jenis Dokumen <span className="text-red-500">*</span>
        </Label>
        <Input
          id="doc_type"
          type="text"
          value={formData.doc_type}
          onChange={(e) => handleInputChange('doc_type', e.target.value)}
          placeholder="Masukkan jenis dokumen"
          className={errors.doc_type ? 'border-red-500' : ''}
        />
        {errors.doc_type && (
          <p className="text-sm text-red-500">{errors.doc_type}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="due_date">Due Date</Label>
        <Input
          id="due_date"
          type="date"
          value={formData.due_date}
          onChange={(e) => handleInputChange('due_date', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="keterangan">Keterangan</Label>
        <Textarea
          id="keterangan"
          value={formData.keterangan}
          onChange={(e) => handleInputChange('keterangan', e.target.value)}
          placeholder="Masukkan keterangan (opsional)"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => handleInputChange('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="belum_selesai">Belum Selesai</SelectItem>
            <SelectItem value="selesai">Selesai</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="document">Upload Document</Label>
        <Input
          id="document"
          type="file"
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
        />
        {documentFile && (
          <p className="text-sm text-muted-foreground">
            File terpilih: {documentFile.name}
          </p>
        )}
        {legal?.document_url && !documentFile && (
          <p className="text-sm text-muted-foreground">
            Dokumen saat ini: <a href={legal.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Lihat</a>
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {legal ? 'Perbarui Legal Document' : 'Buat Legal Document'}
        </Button>
      </DialogFooter>
    </form>
  )
}
