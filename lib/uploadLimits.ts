/** Batas ukuran upload per file (selaras dengan backend) */
export const UPLOAD_MAX_FILE_MB = 30
export const UPLOAD_MAX_FILE_BYTES = UPLOAD_MAX_FILE_MB * 1024 * 1024

export function isFileWithinUploadLimit(file: File): boolean {
  return file.size <= UPLOAD_MAX_FILE_BYTES
}

export function uploadLimitErrorLabel(fileName?: string): string {
  const name = fileName ? `"${fileName}" ` : ''
  return `${name}melebihi batas ${UPLOAD_MAX_FILE_MB}MB`
}
