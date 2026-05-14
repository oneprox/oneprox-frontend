/**
 * Rate penagihan di DB disimpan sebagai fraksi desimal (0.02 = 2%, default 0.01 = 1%).
 * Beberapa data lama bisa tersimpan sebagai angka persen utuh (2 = 2%) karena input lama.
 */

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

/** Tampilan persen di tabel / ringkasan */
export function formatBillingRatePercent(rate: number | null | undefined): string {
  const r = rate ?? 0.01
  if (!Number.isFinite(r)) return '0%'
  if (r > 1) {
    const s = trimTrailingZeros(r.toFixed(2))
    return `${s}%`
  }
  const pct = r * 100
  const s = trimTrailingZeros(pct.toFixed(2))
  return `${s}%`
}

/** Nilai awal field input "Rate (%)" dari nilai DB */
export function storedRateToPercentInput(rate: number | null | undefined): string {
  const r = rate ?? 0.01
  if (!Number.isFinite(r)) return '1'
  if (r > 1) {
    return trimTrailingZeros(r.toFixed(2))
  }
  const pct = r * 100
  return trimTrailingZeros(pct.toFixed(4)) || '0'
}

/** Angka yang user ketik sebagai persen → fraksi untuk API */
export function percentNumberToFraction(percentValue: number): number {
  return percentValue / 100
}
