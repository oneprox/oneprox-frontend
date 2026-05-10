'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { userTasksApi } from '@/lib/api'
import toast from 'react-hot-toast'

function getGenerateBodyFromSession(): { asset_id?: string; asset_ids?: string[] } | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = localStorage.getItem('user_data')
  if (!raw) return undefined
  try {
    const user = JSON.parse(raw) as { assetIds?: string[] }
    if (Array.isArray(user.assetIds) && user.assetIds.length > 0) {
      return { asset_ids: user.assetIds }
    }
  } catch {
    return undefined
  }
  return undefined
}

interface GenerateTaskButtonProps {
  onGenerateSuccess: () => void
  /** Satu aset; dipakai jika worker hanya generate untuk aset ini */
  assetId?: string
  /** Beberapa aset; menimpa isi `user_data` bila diisi */
  assetIds?: string[]
}

export function GenerateTaskButton({ onGenerateSuccess, assetId, assetIds: assetIdsProp }: GenerateTaskButtonProps) {
  const [isGenerating, setIsGenerating] = React.useState(false)

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)

      let body: { asset_id?: string; asset_ids?: string[] } | undefined
      if (assetIdsProp && assetIdsProp.length > 0) {
        body = { asset_ids: assetIdsProp }
      } else if (assetId) {
        body = { asset_id: assetId }
      } else {
        body = getGenerateBodyFromSession()
      }

      const response = await userTasksApi.generateUpcomingUserTasks(body ?? {})

      if (response.success) {
        toast.success('User tasks berhasil di-generate')
        await new Promise(resolve => setTimeout(resolve, 1000))
        onGenerateSuccess()
      } else {
        toast.error(response.error || 'Gagal generate user tasks')
      }
    } catch (error: unknown) {
      console.error('Error generating tasks:', error)
      const msg =
        error instanceof Error ? error.message : ''
      if (msg.includes('already been generated') || msg.includes('409')) {
        toast.error('User tasks sudah pernah di-generate untuk periode ini')
        onGenerateSuccess()
      } else {
        toast.error('Terjadi kesalahan saat generate user tasks')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating}
      className="flex items-center gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        'Generate User Tasks'
      )}
    </Button>
  )
}
