/**
 * Rentang kalender bulan berjalan di Asia/Jakarta (ISO 8601 dengan offset +07:00)
 * untuk query backend `date_from` / `date_to` (validasi express-validator isISO8601).
 */
export function getJakartaCalendarMonthIsoRange(reference = new Date()): {
  date_from: string
  date_to: string
  period: string
} {
  const tz = 'Asia/Jakarta'
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  })
  const parts = dtf.formatToParts(reference)
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const monthNum = Number(parts.find((p) => p.type === 'month')!.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, monthNum, 0).getDate()
  const period = `${year}-${pad(monthNum)}`
  const offset = '+07:00'
  const date_from = `${year}-${pad(monthNum)}-01T00:00:00.000${offset}`
  const date_to = `${year}-${pad(monthNum)}-${pad(lastDay)}T23:59:59.999${offset}`
  return { date_from, date_to, period }
}
