function toMMDDYYYY(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split('T')[0].split('-')
    return `${m}-${d}-${y}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return toMMDDYYYY(date)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  // Extract date/time from source string to avoid timezone shifts from UTC conversion
  const dateStr = value.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-')
    const timeMatch = value.match(/T(\d{2}:\d{2})/)
    return `${m}-${d}-${y}${timeMatch ? ' ' + timeMatch[1] : ''}`
  }
  // Fallback for non-ISO formats
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${mm}-${dd}-${yyyy} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}
