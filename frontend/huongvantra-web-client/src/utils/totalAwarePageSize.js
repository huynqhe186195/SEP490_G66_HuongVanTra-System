import { useEffect, useMemo, useState } from 'react'
import { TABLE_PAGE_SIZE } from '../components/shared/TablePagination.jsx'

/** Mục tiêu: ~5–10 trang; pageSize tăng theo total thay vì tạo quá nhiều trang. */
export const TOTAL_AWARE_PAGE_SIZE_MIN = TABLE_PAGE_SIZE
export const TOTAL_AWARE_PAGE_SIZE_MAX = 100
/** Mỗi “slot” ~20 bản ghi trước khi tăng số trang mục tiêu (xem ví dụ 100→5 trang). */
export const TOTAL_AWARE_RECORDS_PER_TARGET_PAGE = 20
export const TOTAL_AWARE_MAX_PAGES = 10

/**
 * pageSize theo tổng số bản ghi, nhằm giữ khoảng 5–10 trang.
 *
 * Ví dụ:
 * - 10 → 1 trang × 10
 * - 100 → 5 trang × 20
 * - 500 → 10 trang × 50
 *
 * Công thức: targetPages = clamp(ceil(total / 20), 1, 10)
 *            pageSize = clamp(ceil(total / targetPages), min, max)
 */
export function getTotalAwarePageSize(
  totalCount,
  {
    min = TOTAL_AWARE_PAGE_SIZE_MIN,
    max = TOTAL_AWARE_PAGE_SIZE_MAX,
    recordsPerTargetPage = TOTAL_AWARE_RECORDS_PER_TARGET_PAGE,
    maxPages = TOTAL_AWARE_MAX_PAGES,
    fallback = TOTAL_AWARE_PAGE_SIZE_MIN,
  } = {},
) {
  const total = Math.max(0, Number(totalCount) || 0)
  if (total <= 0) return fallback

  const targetPages = Math.min(maxPages, Math.max(1, Math.ceil(total / recordsPerTargetPage)))
  const size = Math.ceil(total / targetPages)
  return Math.min(max, Math.max(min, size))
}

export function getTotalAwarePageSizeOptions(suggestedSize) {
  const base = [10, 20, 30, 50, 100]
  const suggested = Number(suggestedSize) || TOTAL_AWARE_PAGE_SIZE_MIN
  return [...new Set([...base, suggested])].sort((a, b) => a - b)
}

/**
 * Đồng bộ pageSize theo totalCount.
 * totalCount đổi → tính lại theo công thức.
 * User đổi pageSize thủ công → giữ đến khi totalCount đổi.
 */
export function useTotalAwarePageSize(totalCount, {
  min = TOTAL_AWARE_PAGE_SIZE_MIN,
  max = TOTAL_AWARE_PAGE_SIZE_MAX,
  recordsPerTargetPage = TOTAL_AWARE_RECORDS_PER_TARGET_PAGE,
  maxPages = TOTAL_AWARE_MAX_PAGES,
  fallback = TOTAL_AWARE_PAGE_SIZE_MIN,
} = {}) {
  const suggested = useMemo(
    () => getTotalAwarePageSize(totalCount, { min, max, recordsPerTargetPage, maxPages, fallback }),
    [totalCount, min, max, recordsPerTargetPage, maxPages, fallback],
  )
  const [pageSize, setPageSizeState] = useState(suggested)
  const [userOverrode, setUserOverrode] = useState(false)

  useEffect(() => {
    setUserOverrode(false)
    setPageSizeState(suggested)
  }, [suggested])

  function setPageSize(next) {
    const size = Math.max(1, Number(next) || TOTAL_AWARE_PAGE_SIZE_MIN)
    setUserOverrode(true)
    setPageSizeState(size)
  }

  const pageSizeOptions = useMemo(
    () => getTotalAwarePageSizeOptions(userOverrode ? pageSize : suggested)
      .filter((size) => size <= max),
    [pageSize, suggested, userOverrode, max],
  )

  return { pageSize, setPageSize, suggestedPageSize: suggested, pageSizeOptions }
}
