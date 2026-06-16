import { useCallback, useEffect, useRef, useState } from 'react'

function readStoredWidth(storageKey, defaultWidth) {
  if (!storageKey) return defaultWidth
  try {
    const value = Number(localStorage.getItem(storageKey))
    if (!Number.isFinite(value)) return defaultWidth
    return value
  } catch {
    return defaultWidth
  }
}

function resolveMaxWidth(maxWidth) {
  if (typeof maxWidth === 'function') return maxWidth()
  return maxWidth
}

function clampWidth(nextWidth, minWidth, maxWidth) {
  const max = resolveMaxWidth(maxWidth)
  return Math.min(max, Math.max(minWidth, Math.round(nextWidth)))
}

export function useResizableWidth({
  storageKey,
  defaultWidth = 448,
  minWidth = 320,
  maxWidth = () => Math.min(760, Math.round(window.innerWidth * 0.92)),
  direction = 'from-right',
}) {
  const widthRef = useRef(
    clampWidth(readStoredWidth(storageKey, defaultWidth), minWidth, maxWidth),
  )
  const [width, setWidth] = useState(widthRef.current)
  const [isDragging, setIsDragging] = useState(false)

  const persistWidth = useCallback(
    (nextWidth) => {
      widthRef.current = nextWidth
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, String(nextWidth))
      } catch {
        // ignore
      }
    },
    [storageKey],
  )

  const applyWidth = useCallback(
    (nextWidth, { persist = false } = {}) => {
      const clamped = clampWidth(nextWidth, minWidth, maxWidth)
      setWidth(clamped)
      widthRef.current = clamped
      if (persist) persistWidth(clamped)
    },
    [maxWidth, minWidth, persistWidth],
  )

  const resetWidth = useCallback(() => {
    applyWidth(defaultWidth, { persist: true })
  }, [applyWidth, defaultWidth])

  const startResize = useCallback(
    (event) => {
      event.preventDefault()

      const startX = event.clientX
      const startWidth = widthRef.current

      setIsDragging(true)

      const onMove = (moveEvent) => {
        moveEvent.preventDefault()
        const delta = direction === 'from-right' ? startX - moveEvent.clientX : moveEvent.clientX - startX
        applyWidth(startWidth + delta)
      }

      const onUp = (upEvent) => {
        upEvent.preventDefault()
        const delta = direction === 'from-right' ? startX - upEvent.clientX : upEvent.clientX - startX
        applyWidth(startWidth + delta, { persist: true })
        setIsDragging(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [applyWidth, direction],
  )

  useEffect(() => {
    if (!isDragging) return undefined
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [isDragging])

  return {
    width,
    isDragging,
    startResize,
    resetWidth,
  }
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
