'use client'

import React, { useEffect } from 'react'
import { Bank, CreateBankData, UpdateBankData } from '@/lib/api'
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
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const bankSchema = z.object({
  bank_name: z.string().min(1, 'Nama bank wajib diisi').trim(),
  bank_account: z.string().min(1, 'Nomor rekening wajib diisi').trim(),
  holder_name: z.string().min(1, 'Nama pemilik rekening wajib diisi').trim(),
  is_active: z.boolean().optional().default(true),
})

type BankFormData = z.infer<typeof bankSchema>

interface BankFormProps {
  bank?: Bank | null
  onSubmit: (data: CreateBankData | UpdateBankData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function BankForm({ bank, onSubmit, onCancel, loading = false }: BankFormProps) {
  const form = useForm<BankFormData>({
    resolver: zodResolver(bankSchema) as any,
    defaultValues: {
      bank_name: '',
      bank_account: '',
      holder_name: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (bank) {
      form.reset({
        bank_name: bank.bank_name || '',
        bank_account: bank.bank_account || '',
        holder_name: bank.holder_name || '',
        is_active: bank.is_active !== undefined ? bank.is_active : true,
      })
    }
  }, [bank, form])

  const handleSubmit = async (data: BankFormData) => {
    try {
      const submitData: CreateBankData | UpdateBankData = {
        bank_name: data.bank_name.trim(),
        bank_account: data.bank_account.trim(),
        holder_name: data.holder_name.trim(),
        is_active: data.is_active,
      }
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="bank_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Bank <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: BCA" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bank_account"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nomor Rekening <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: 1234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="holder_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pemilik Rekening <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: PT Oripro Properti" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Aktif</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Aktifkan atau nonaktifkan rekening bank ini
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

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
            {bank ? 'Perbarui Bank' : 'Tambah Bank'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
