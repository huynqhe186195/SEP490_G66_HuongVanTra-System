/**
 * Gắn count từ API statusCounts vào options của StatusFilterChips.
 * Chip "Tất cả" (value rỗng) = tổng các count (nếu có).
 */
export function applyStatusCounts(options = [], statusCounts = null) {
  if (!statusCounts || typeof statusCounts !== 'object') return options

  const seen = new Set()
  let total = 0
  let hasAny = false
  for (const [key, value] of Object.entries(statusCounts)) {
    const lower = String(key).toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    const n = Number(value)
    if (!Number.isFinite(n)) continue
    hasAny = true
    total += n
  }

  const withCounts = options.map((option) => {
    const value = String(option.value ?? '')
    if (!value) return option
    const count = statusCounts[value] ?? statusCounts[value.toLowerCase()]
    if (count == null || !Number.isFinite(Number(count))) return option
    return { ...option, count: Number(count) }
  })

  if (!hasAny) return options
  return withCounts.map((option) => (
    String(option.value ?? '') === '' ? { ...option, count: total } : option
  ))
}
