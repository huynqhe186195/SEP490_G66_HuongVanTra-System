import { useEffect, useMemo, useState } from 'react'
import { TABLE_PAGE_SIZE } from '../components/shared/TablePagination.jsx'

/** Số item mỗi ngày trong khoảng lọc (theo guideline UI). */
export const DATE_AWARE_PAGE_SIZE_PER_DAY = 10
export const DATE_AWARE_PAGE_SIZE_MIN = TABLE_PAGE_SIZE
export const DATE_AWARE_PAGE_SIZE_MAX = 100

/**
 * Đếm số ngày inclusive giữa hai chuỗi `YYYY-MM-DD`.
 * Trả về 0 nếu thiếu/không hợp lệ.
 */
export function countInclusiveFilterDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86_400_000) + 1
}

/**
 * pageSize = 10 × số ngày lọc, clamp [10, 100].
 * Không có khoảng ngày → giữ fallback (mặc định 10).
 */
export function getDateAwarePageSize(
  fromDate,
  toDate,
  {
    perDay = DATE_AWARE_PAGE_SIZE_PER_DAY,
    min = DATE_AWARE_PAGE_SIZE_MIN,
    max = DATE_AWARE_PAGE_SIZE_MAX,
    fallback = DATE_AWARE_PAGE_SIZE_MIN,
  } = {},
) {
  const days = countInclusiveFilterDays(fromDate, toDate)
  if (days <= 0) return fallback
  return Math.min(max, Math.max(min, days * perDay))
}

export function getDateAwarePageSizeOptions(suggestedSize) {
  const base = [10, 20, 30, 50, 100]
  const suggested = Number(suggestedSize) || DATE_AWARE_PAGE_SIZE_MIN
  return [...new Set([...base, suggested])].sort((a, b) => a - b)
}

/**
 * Đồng bộ pageSize theo khoảng ngày.
 * Đổi ngày → auto cập nhật theo công thức.
 * User đổi pageSize thủ công → giữ đến khi đổi ngày.
 */
export function useDateAwarePageSize(fromDate, toDate, {
  perDay = DATE_AWARE_PAGE_SIZE_PER_DAY,
  min = DATE_AWARE_PAGE_SIZE_MIN,
  max = DATE_AWARE_PAGE_SIZE_MAX,
  fallback = DATE_AWARE_PAGE_SIZE_MIN,
} = {}) {
  const suggested = useMemo(
    () => getDateAwarePageSize(fromDate, toDate, { perDay, min, max, fallback }),
    [fromDate, toDate, perDay, min, max, fallback],
  )
  const [pageSize, setPageSizeState] = useState(suggested)
  const [userOverrode, setUserOverrode] = useState(false)

  useEffect(() => {
    setUserOverrode(false)
    setPageSizeState(suggested)
  }, [suggested])

  function setPageSize(next) {
    const size = Math.max(1, Number(next) || DATE_AWARE_PAGE_SIZE_MIN)
    setUserOverrode(true)
    setPageSizeState(size)
  }

  const pageSizeOptions = useMemo(
    () => getDateAwarePageSizeOptions(userOverrode ? pageSize : suggested),
    [pageSize, suggested, userOverrode],
  )

  return { pageSize, setPageSize, suggestedPageSize: suggested, pageSizeOptions }
}
