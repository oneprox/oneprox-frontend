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
  if (rate === 0) return '0'
  const r = rate ?? 0.01
  if (!Number.isFinite(r)) return '1'
  if (r > 1) {
    return trimTrailingZeros(r.toFixed(2))
  }
  const pct = r * 100
  return trimTrailingZeros(pct.toFixed(4)) || '0'
}

/** Nilai awal field input "PPN (%)" dari fraksi desimal DB (0.11 = 11%, 0 = 0%) */
export function storedPpnPercentToInput(fraction: number | null | undefined): string {
  if (fraction === 0) return '0'
  if (fraction == null || !Number.isFinite(fraction)) return ''
  if (fraction > 1) {
    return trimTrailingZeros(fraction.toFixed(2))
  }
  const pct = fraction * 100
  return trimTrailingZeros(pct.toFixed(4)) || '0'
}

/** Parse input persen PPN; kosong dianggap 0% */
export function parsePpnPercentInput(value: string): number {
  const v = (value ?? '').trim()
  if (v === '') return 0
  const normalized = v.replace(/[^\d,\.]/g, '').replace(',', '.')
  const firstDot = normalized.indexOf('.')
  const safe =
    firstDot === -1
      ? normalized
      : normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '')
  const n = Number(safe)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Angka yang user ketik sebagai persen → fraksi untuk API */
export function percentNumberToFraction(percentValue: number): number {
  return percentValue / 100
}

/** Hitung PPN (Rp) dan total tagihan dari jumlah dasar + fraksi PPN */
export function computePpnAndBillingAmount(amount: number, ppnPercentFraction: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const safeFraction = Number.isFinite(ppnPercentFraction) ? ppnPercentFraction : 0
  const ppn = safeAmount * safeFraction
  const billing_amount = safeAmount + ppn
  return { ppn, billing_amount }
}
