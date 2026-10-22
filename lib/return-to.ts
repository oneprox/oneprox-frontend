import { usePathname, useSearchParams } from 'next/navigation'

/** Nama query param untuk URL tujuan kembali (mis. dashboard dengan section & aset terpilih). */
export const RETURN_TO_PARAM = 'returnTo'

/** Hanya terima path internal (`/...`), tolak URL eksternal / protocol-relative (`//host`). */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/** Tambahkan `returnTo` ke href, mempertahankan query yang sudah ada. */
export function withReturnTo(href: string, returnTo: string): string {
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`
}

/** URL halaman saat ini (path + query), dipakai sebagai `returnTo` untuk link keluar. */
export function useCurrentUrl(): string {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

/** Baca `returnTo` yang valid dari URL halaman saat ini. */
export function useReturnTo(): string | null {
  const searchParams = useSearchParams()
  return safeReturnTo(searchParams.get(RETURN_TO_PARAM))
}
