import { useCallback, useEffect, useRef, useState } from 'react'

const SPLIT_MEDIA = '(min-width: 1024px)'
const DIVIDER_WIDTH = 6

function readStoredRatio(storageKey, defaultRatio) {
  if (!storageKey) return defaultRatio
  try {
    const value = Number(localStorage.getItem(storageKey))
    if (!Number.isFinite(value)) return defaultRatio
    return Math.min(0.72, Math.max(0.22, value))
  } catch {
    return defaultRatio
  }
}

function ResizableSplitPane({
  startPanel,
  endPanel,
  storageKey,
  defaultRatio = 0.38,
  minStartPx = 260,
  minEndPx = 320,
  fallbackMinStartPx = minStartPx,
  fallbackMinEndPx = minEndPx,
  startClassName = '',
  endClassName = '',
  className = '',
}) {
  const containerRef = useRef(null)
  const ratioRef = useRef(readStoredRatio(storageKey, defaultRatio))
  const [ratio, setRatio] = useState(ratioRef.current)
  const [isDragging, setIsDragging] = useState(false)
  const [isSplit, setIsSplit] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(SPLIT_MEDIA).matches : true,
  )
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const media = window.matchMedia(SPLIT_MEDIA)
    const sync = () => setIsSplit(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(node)
    setContainerWidth(node.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const persistRatio = useCallback(
    (nextRatio) => {
      ratioRef.current = nextRatio
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, String(nextRatio))
      } catch {
        // ignore
      }
    },
    [storageKey],
  )

  const clampRatio = useCallback(
    (nextRatio) => {
      if (containerWidth <= 0) return nextRatio
      const canUseIdealLimits = containerWidth >= minStartPx + minEndPx + DIVIDER_WIDTH
      const effectiveMinStartPx = canUseIdealLimits ? minStartPx : fallbackMinStartPx
      const effectiveMinEndPx = canUseIdealLimits ? minEndPx : fallbackMinEndPx
      const minRatio = effectiveMinStartPx / containerWidth
      const maxRatio = 1 - (effectiveMinEndPx + DIVIDER_WIDTH) / containerWidth
      const safeMin = Math.min(minRatio, maxRatio)
      const safeMax = Math.max(minRatio, maxRatio)
      return Math.min(safeMax, Math.max(safeMin, nextRatio))
    },
    [containerWidth, fallbackMinEndPx, fallbackMinStartPx, minEndPx, minStartPx],
  )

  const applyRatio = useCallback(
    (nextRatio, { persist = false } = {}) => {
      const clamped = clampRatio(nextRatio)
      setRatio(clamped)
      ratioRef.current = clamped
      if (persist) persistRatio(clamped)
    },
    [clampRatio, persistRatio],
  )

  const startDrag = useCallback(
    (event) => {
      if (!isSplit || !containerRef.current) return
      event.preventDefault()

      const rect = containerRef.current.getBoundingClientRect()
      const startX = event.clientX
      const startRatio = ratioRef.current

      setIsDragging(true)

      const onMove = (moveEvent) => {
        moveEvent.preventDefault()
        const delta = moveEvent.clientX - startX
        applyRatio(startRatio + delta / rect.width)
      }

      const onUp = (upEvent) => {
        upEvent.preventDefault()
        const delta = upEvent.clientX - startX
        applyRatio(startRatio + delta / rect.width, { persist: true })
        setIsDragging(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [applyRatio, isSplit],
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

  const safeRatio = isSplit ? clampRatio(ratio) : ratio
  const leftWidth =
    isSplit && containerWidth > 0
      ? Math.round(safeRatio * containerWidth)
      : null

  const gridStyle = isSplit
    ? {
        gridTemplateColumns:
          leftWidth != null
            ? `${leftWidth}px ${DIVIDER_WIDTH}px minmax(0, 1fr)`
            : `${safeRatio * 100}% ${DIVIDER_WIDTH}px minmax(0, 1fr)`,
      }
    : undefined

  return (
    <div
      ref={containerRef}
      className={`grid min-h-0 flex-1 overflow-hidden ${className}`.trim()}
      style={gridStyle}
    >
      <section className={`min-h-0 min-w-0 overflow-hidden ${startClassName}`.trim()}>
        {startPanel}
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để chỉnh kích thước panel"
        aria-valuenow={leftWidth ?? undefined}
        onPointerDown={startDrag}
        onDoubleClick={() => applyRatio(defaultRatio, { persist: true })}
        className={`relative z-30 hidden touch-none select-none lg:block ${
          isDragging ? 'bg-[#356647]/35' : 'bg-[#c1c9c0] hover:bg-[#356647]/25'
        }`}
        style={{ cursor: 'col-resize' }}
      >
        <div className="absolute inset-y-0 -left-2 -right-2" />
      </div>

      <section className={`min-h-0 min-w-0 overflow-hidden ${endClassName}`.trim()}>
        {endPanel}
      </section>
    </div>
  )
}

export default ResizableSplitPane
