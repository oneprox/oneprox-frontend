'use client'

import { useMemo, useState } from 'react'
import type { UserTask } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImageIcon } from 'lucide-react'

type EvidenceSlot = {
  url: string
  type: 'before' | 'after' | 'other'
  label: string
  isImage: boolean
  isText: boolean
  text?: string
}

function evidenceUrl(item: unknown): string {
  if (typeof item === 'string') return item.trim()
  if (item && typeof item === 'object' && 'url' in item && (item as { url: unknown }).url != null) {
    return String((item as { url: unknown }).url).trim()
  }
  return ''
}

function evidenceType(item: unknown, index: number): 'before' | 'after' | 'other' {
  if (item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string') {
    const t = String((item as { type: string }).type).toLowerCase()
    if (t === 'before' || t === 'after') return t
  }
  if (index === 0) return 'before'
  if (index === 1) return 'after'
  return 'other'
}

function isImageUrl(url: string): boolean {
  if (!url || url.startsWith('text:')) return false
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
}

export function parseTaskEvidences(evidences: unknown[] | undefined): EvidenceSlot[] {
  if (!Array.isArray(evidences) || evidences.length === 0) return []

  return evidences
    .map((item, index) => {
      const url = evidenceUrl(item)
      if (!url) return null

      const type = evidenceType(item, index)
      const label = type === 'before' ? 'Before' : type === 'after' ? 'After' : `Bukti ${index + 1}`

      if (url.startsWith('text:')) {
        const text = url.slice(5).trim() || '(catatan)'
        return { url, type, label, isImage: false, isText: true, text }
      }

      return { url, type, label, isImage: isImageUrl(url), isText: false }
    })
    .filter((item): item is EvidenceSlot => item != null)
}

export function hasImageEvidence(userTask: UserTask | null | undefined): boolean {
  return parseTaskEvidences(userTask?.evidences).some((e) => e.isImage)
}

interface TaskEvidenceBeforeAfterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userTask: UserTask | null
}

function EvidencePanel({
  slot,
  onPreview,
}: {
  slot: EvidenceSlot | undefined
  onPreview: (url: string, label: string) => void
}) {
  if (!slot) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-muted-foreground">
        <ImageIcon className="mb-2 h-8 w-8 text-slate-300" />
        Belum ada foto
      </div>
    )
  }

  if (slot.isText) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Badge variant="outline" className="text-[10px]">
          {slot.label}
        </Badge>
        <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{slot.text}</p>
      </div>
    )
  }

  if (!slot.isImage) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Badge variant="outline" className="text-[10px]">
          {slot.label}
        </Badge>
        <a
          href={slot.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-blue-600 hover:underline"
        >
          Buka lampiran
        </a>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onPreview(slot.url, slot.label)}
      className="group block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <img
        src={slot.url}
        alt={slot.label}
        className="h-52 w-full object-cover transition-transform group-hover:scale-[1.02] sm:h-64"
      />
      <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">Klik untuk perbesar</p>
    </button>
  )
}

export default function TaskEvidenceBeforeAfterDialog({
  open,
  onOpenChange,
  userTask,
}: TaskEvidenceBeforeAfterDialogProps) {
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null)

  const parsed = useMemo(() => parseTaskEvidences(userTask?.evidences), [userTask?.evidences])
  const before = parsed.find((e) => e.type === 'before')
  const after = parsed.find((e) => e.type === 'after')
  const others = parsed.filter((e) => e.type === 'other')

  const taskName = userTask?.task?.name || 'Task'
  const workerName = userTask?.user?.name || ''

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setPreview(null)
          onOpenChange(next)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bukti Before / After</DialogTitle>
            <DialogDescription>
              {taskName}
              {workerName ? ` — ${workerName}` : ''}
            </DialogDescription>
          </DialogHeader>

          {parsed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada bukti pengerjaan.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                    Before
                  </Badge>
                  <EvidencePanel slot={before} onPreview={(url, label) => setPreview({ url, label })} />
                </div>
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
                    After
                  </Badge>
                  <EvidencePanel slot={after} onPreview={(url, label) => setPreview({ url, label })} />
                </div>
              </div>

              {others.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium text-slate-700">Bukti lainnya</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {others.map((slot, idx) => (
                      <EvidencePanel
                        key={`${slot.url}-${idx}`}
                        slot={slot}
                        onPreview={(url, label) => setPreview({ url, label })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={preview != null} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="max-w-4xl p-2 sm:p-4">
          <DialogHeader className="px-2 sm:px-0">
            <DialogTitle>{preview?.label || 'Pratinjau'}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="max-h-[75vh] overflow-auto">
              <img
                src={preview.url}
                alt={preview.label}
                className="mx-auto max-h-[70vh] w-full object-contain"
              />
            </div>
          )}
          <div className="flex justify-end px-2 sm:px-0">
            <Button variant="outline" size="sm" asChild>
              <a href={preview?.url} target="_blank" rel="noopener noreferrer">
                Buka di tab baru
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
