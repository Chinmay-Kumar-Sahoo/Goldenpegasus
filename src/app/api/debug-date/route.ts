import { formatDate, formatDateTime } from '@/lib/format'

export async function GET() {
  return Response.json({
    formatDate_test: formatDate('2026-03-10'),
    formatDate_iso: formatDate('2026-06-25T20:36:47.817+00:00'),
    formatDate_null: formatDate(null),
    formatDateTime_test: formatDateTime('2026-06-25T20:36:47.817+00:00'),
    formatDateTime_no_tz: formatDateTime('2026-06-25T20:36:47'),
    expected: 'All dates should use MM-DD-YYYY with dashes',
  })
}
