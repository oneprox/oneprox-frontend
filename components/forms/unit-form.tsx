'use client'

import React, { useState, useEffect } from 'react'
import { Unit, CreateUnitData, UpdateUnitData, assetsApi, Asset } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface UnitFormProps {
  unit?: Unit
  onSubmit: (data: CreateUnitData | UpdateUnitData) => Promise<void>
  loading?: boolean
}

export default function UnitForm({ unit, onSubmit, loading = false }: UnitFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    asset_id: '',
    size: '',
    building_area: '',
    electrical_power: '',
    electrical_unit: 'Watt',
    is_toilet_exist: false,
    description: '',
  })
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const response = await assetsApi.getAssets()
        if (response.success && response.data) {
          const responseData = response.data as any
          const assetsData = Array.isArray(responseData.data) ? responseData.data : []
          setAssets(assetsData)
        } else {
          toast.error(response.error || 'Gagal memuat data assets')
        }
      } catch (error) {
        console.error('Load assets error:', error)
        toast.error('Terjadi kesalahan saat memuat data assets')
      } finally {
        setAssetsLoading(false)
      }
    }

    loadAssets()
  }, [])

  // Initialize form data when unit prop changes
  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name || '',
        asset_id: unit.asset?.id || '',
        size: unit.size?.toString() || '',
        building_area: unit.building_area?.toString() || '',
        electrical_power: unit.electrical_power?.toString() || '',
        electrical_unit: unit.electrical_unit || 'Watt',
        is_toilet_exist: unit.is_toilet_exist || false,
        description: unit.description || '',
      })
    }
  }, [unit])

  // Re-set asset_id and electrical_unit when assets are loaded and unit is available
  useEffect(() => {
    if (unit && !assetsLoading && assets.length > 0 && unit.asset?.id) {
      setFormData(prev => ({
        ...prev,
        asset_id: unit.asset?.id || '',
        electrical_unit: unit.electrical_unit || 'Watt'
      }))
    }
  }, [unit, assetsLoading, assets, unit?.asset?.id])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nama unit harus diisi'
    }

    if (!formData.asset_id) {
      newErrors.asset_id = 'Asset harus dipilih'
    }

    if (!formData.size || parseFloat(formData.size) <= 0) {
      newErrors.size = 'Ukuran harus diisi dan lebih dari 0'
    }

    if (!formData.building_area || parseFloat(formData.building_area) <= 0) {
      newErrors.building_area = 'Luas bangunan harus diisi dan lebih dari 0'
    }

    if (!formData.electrical_power || parseFloat(formData.electrical_power) <= 0) {
      newErrors.electrical_power = 'Daya listrik harus diisi dan lebih dari 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const submitData = {
      name: formData.name.trim(),
      asset_id: formData.asset_id,
      size: parseFloat(formData.size),
      building_area: parseFloat(formData.building_area),
      electrical_power: parseFloat(formData.electrical_power),
      electrical_unit: formData.electrical_unit,
      is_toilet_exist: formData.is_toilet_exist,
      description: formData.description.trim() || undefined,
    }

    await onSubmit(submitData)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informasi Dasar */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Dasar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Unit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Masukkan nama unit"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset_id">Asset *</Label>
              <Select
                value={formData.asset_id}
                onValueChange={(value) => handleInputChange('asset_id', value)}
                disabled={assetsLoading}
              >
                <SelectTrigger className={`w-full ${errors.asset_id ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder={assetsLoading ? "Memuat assets..." : "Pilih asset"} />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.asset_id && (
                <p className="text-sm text-red-500">{errors.asset_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Luas Lahan (m²) *</Label>
              <Input
                id="size"
                type="number"
                step="0.01"
                min="0"
                value={formData.size}
                onChange={(e) => handleInputChange('size', e.target.value)}
                placeholder="Masukkan ukuran dalam m²"
                className={errors.size ? 'border-red-500' : ''}
              />
              {errors.size && (
                <p className="text-sm text-red-500">{errors.size}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="building_area">Luas Bangunan (m²) *</Label>
              <Input
                id="building_area"
                type="number"
                step="0.01"
                min="0"
                value={formData.building_area}
                onChange={(e) => handleInputChange('building_area', e.target.value)}
                placeholder="Masukkan luas bangunan dalam m²"
                className={errors.building_area ? 'border-red-500' : ''}
              />
              {errors.building_area && (
                <p className="text-sm text-red-500">{errors.building_area}</p>
              )}
            </div>

          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Masukkan deskripsi unit (opsional)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fasilitas */}
      <Card>
        <CardHeader>
          <CardTitle>Fasilitas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="electrical_power">Daya Listrik *</Label>
              <div className="flex gap-2">
                <Input
                  id="electrical_power"
                  type="number"
                  min="0"
                  value={formData.electrical_power}
                  onChange={(e) => handleInputChange('electrical_power', e.target.value)}
                  placeholder="Masukkan daya listrik"
                  className={errors.electrical_power ? 'border-red-500' : ''}
                />
                <Select
                  value={formData.electrical_unit}
                  onValueChange={(value) => handleInputChange('electrical_unit', value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Watt">Watt</SelectItem>
                    <SelectItem value="kW">kW</SelectItem>
                    <SelectItem value="kVA">kVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {errors.electrical_power && (
                <p className="text-sm text-red-500">{errors.electrical_power}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_toilet_exist">Toilet</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_toilet_exist"
                  checked={formData.is_toilet_exist}
                  onCheckedChange={(checked) => handleInputChange('is_toilet_exist', checked)}
                />
                <Label htmlFor="is_toilet_exist" className="text-sm">
                  {formData.is_toilet_exist ? 'Ada' : 'Tidak Ada'}
                </Label>
              </div>
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
          disabled={loading}
        >
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {unit ? 'Perbarui Unit' : 'Buat Unit'}
        </Button>
      </div>
    </form>
  )
}
