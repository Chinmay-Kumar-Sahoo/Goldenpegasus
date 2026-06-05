function toMMDDYYYY(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split('T')[0].split('-')
    return `${m}/${d}/${y}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return toMMDDYYYY(date)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return toMMDDYYYY(date) + ' ' + date.toISOString().slice(11, 16) + ' UTC'
}
