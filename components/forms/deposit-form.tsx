'use client'

import React, { useEffect, useState } from 'react'
import {
  TenantDepositLog,
  CreateTenantDepositLogData,
  UpdateTenantDepositLogData,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DepositFormProps {
  deposit?: TenantDepositLog
  onSubmit: (data: CreateTenantDepositLogData | UpdateTenantDepositLogData) => Promise<void>
  loading?: boolean
  onCancel: () => void
}

type TransactionType = 'in' | 'out'

function formatPrice(value: number | string): string {
  if (value === null || value === undefined || value === '') return ''
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value
  if (isNaN(numValue)) return ''
  if (numValue === 0) return '0'
  const integerPart = Math.floor(Math.abs(numValue)).toString()
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function parsePrice(value: string): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value.replace(/\./g, '').replace(/[^\d]/g, '')
  if (!cleaned || cleaned === '') return 0
  const parsed = cleaned.replace(/^0+(?=\d)/, '') || '0'
  return parseFloat(parsed) || 0
}

export default function DepositForm({
  deposit,
  onSubmit,
  loading = false,
  onCancel,
}: DepositFormProps) {
  const [formData, setFormData] = useState({
    deposit_date: '',
    amount: 0,
    notes: '',
  })
  const [transactionType, setTransactionType] = useState<TransactionType>('in')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (deposit) {
      const amountNum = Number(deposit.amount)
      setTransactionType(amountNum < 0 ? 'out' : 'in')
      setFormData({
        deposit_date: deposit.deposit_date
          ? String(deposit.deposit_date).slice(0, 10)
          : '',
        amount:
          deposit.amount != null && !Number.isNaN(amountNum)
            ? Math.abs(amountNum)
            : 0,
        notes: deposit.notes || '',
      })
    } else {
      setTransactionType('in')
      setFormData({
        deposit_date: new Date().toISOString().slice(0, 10),
        amount: 0,
        notes: '',
      })
    }
    setErrors({})
  }, [deposit])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleAmountChange = (value: string) => {
    const parsedValue = parsePrice(value)
    setFormData((prev) => ({ ...prev, amount: parsedValue }))
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.deposit_date.trim()) {
      newErrors.deposit_date = 'Tanggal deposit harus diisi'
    }

    if (!formData.amount || formData.amount === 0) {
      newErrors.amount = 'Jumlah deposit harus diisi'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const absAmount = formData.amount
    const signedAmount = transactionType === 'out' ? -absAmount : absAmount

    const submitData: CreateTenantDepositLogData | UpdateTenantDepositLogData = {
      deposit_date: formData.deposit_date,
      amount: signedAmount,
      notes: formData.notes.trim() || undefined,
    }

    await onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deposit_date">Tanggal Deposit *</Label>
        <Input
          id="deposit_date"
          type="date"
          value={formData.deposit_date}
          onChange={(e) => handleInputChange('deposit_date', e.target.value)}
          className={errors.deposit_date ? 'border-red-500' : ''}
        />
        {errors.deposit_date && (
          <p className="text-sm text-red-500">{errors.deposit_date}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipe Transaksi *</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={transactionType === 'in' ? 'default' : 'outline'}
            className={cn(
              transactionType === 'in' && 'bg-green-600 hover:bg-green-700'
            )}
            onClick={() => setTransactionType('in')}
          >
            Masuk (Credit)
          </Button>
          <Button
            type="button"
            variant={transactionType === 'out' ? 'default' : 'outline'}
            className={cn(
              transactionType === 'out' && 'bg-red-600 hover:bg-red-700'
            )}
            onClick={() => setTransactionType('out')}
          >
            Keluar (Debit)
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Jumlah Deposit *</Label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-muted-foreground">Rp</span>
          <Input
            id="amount"
            type="text"
            value={formatPrice(formData.amount)}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className={cn('pl-10', errors.amount ? 'border-red-500' : '')}
          />
        </div>
        {errors.amount && (
          <p className="text-sm text-red-500">{errors.amount}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Keterangan</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Keterangan transaksi (opsional)"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            deposit ? 'Perbarui' : 'Simpan'
          )}
        </Button>
      </div>
    </form>
  )
}
