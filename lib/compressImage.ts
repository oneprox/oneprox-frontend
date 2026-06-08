import { UPLOAD_MAX_FILE_BYTES, UPLOAD_MAX_FILE_MB } from './uploadLimits'

/**
 * Kompresi gambar di browser sebelum upload (hindari HTTP 413 di proxy/Vercel).
 */
export type CompressImageOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  /** Target ukuran maks per file (bytes) */
  maxBytes?: number
}

const DEFAULT_MAX_WIDTH = 1280
const DEFAULT_MAX_HEIGHT = 1280
const DEFAULT_QUALITY = 0.72

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal memuat gambar'))
    }
    img.src = url
  })
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

/**
 * Kompres file gambar; file non-gambar dikembalikan apa adanya.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT
  const maxBytes = options.maxBytes ?? UPLOAD_MAX_FILE_BYTES
  let quality = options.quality ?? DEFAULT_QUALITY

  try {
    const img = await loadImage(file)
    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
    width = Math.max(1, Math.round(width * ratio))
    height = Math.max(1, Math.round(height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, width, height)

    let blob: Blob | null = null
    while (quality >= 0.35) {
      blob = await canvasToJpegBlob(canvas, quality)
      if (!blob) break
      if (blob.size <= maxBytes) break
      quality -= 0.08
    }

    if (!blob) {
      throw new Error(
        `Gagal mengompres "${file.name}". Coba ambil ulang foto atau pilih format JPG/PNG.`
      )
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Gagal mengompres')) {
      throw err
    }
    throw new Error(
      `Format gambar "${file.name}" tidak didukung. Gunakan JPG/PNG atau ambil ulang dari kamera.`
    )
  }
}

/** Batas per file saat complete task (upload terpisah per file) */
export const COMPLETE_TASK_SAFE_REQUEST_BYTES = UPLOAD_MAX_FILE_BYTES

/** Batas kompresi per file */
export function maxBytesPerFileForBatch(_fileCount: number): number {
  return UPLOAD_MAX_FILE_BYTES
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function estimateMultipartBytes(files: File[], extraTextBytes = 0): number {
  const filesTotal = files.reduce((sum, f) => sum + f.size, 0)
  return Math.ceil((filesTotal + extraTextBytes) * 1.35)
}

type StagedUploadFile = { file: File; field: 'before' | 'after' | 'scan' }

/**
 * Kompres lampiran complete task (upload per file terpisah, maks 8MB per file).
 */
export async function compressFilesForCompleteTask(
  items: StagedUploadFile[]
): Promise<StagedUploadFile[]> {
  if (items.length === 0) return []

  return Promise.all(
    items.map(async (item) => {
      const file = await compressImageFile(item.file, {
        maxBytes: UPLOAD_MAX_FILE_BYTES,
      })
      if (file.size > UPLOAD_MAX_FILE_BYTES) {
        throw new Error(
          `Foto ${item.field} (${formatFileSize(file.size)}) melebihi batas ${UPLOAD_MAX_FILE_MB}MB`
        )
      }
      return { ...item, file }
    })
  )
}
