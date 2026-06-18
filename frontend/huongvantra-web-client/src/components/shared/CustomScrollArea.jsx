import { useCallback, useEffect, useRef, useState } from 'react'

function CustomScrollArea({
  children,
  className = '',
  contentClassName = '',
  thumbClassName = '',
  hideWhenNotOverflowing = true,
  allowHorizontalScroll = false,
}) {
  const scrollRef = useRef(null)
  const idleTimerRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [indicator, setIndicator] = useState({
    visible: false,
    height: 0,
    top: 0,
  })

  const updateIndicator = useCallback(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const { clientHeight, scrollHeight, scrollTop } = scrollElement
    const maxScrollTop = scrollHeight - clientHeight

    if (clientHeight <= 0 || maxScrollTop <= 1) {
      setIndicator((current) =>
        current.visible && hideWhenNotOverflowing
          ? { visible: false, height: 0, top: 0 }
          : { ...current, visible: !hideWhenNotOverflowing },
      )
      return
    }

    const minThumbHeight = 28
    const thumbHeight = Math.max(
      minThumbHeight,
      Math.round((clientHeight / scrollHeight) * clientHeight),
    )
    const maxThumbTop = Math.max(0, clientHeight - thumbHeight)
    const thumbTop = Math.round((scrollTop / maxScrollTop) * maxThumbTop)
    const next = {
      visible: true,
      height: thumbHeight,
      top: Math.min(maxThumbTop, Math.max(0, thumbTop)),
    }

    setIndicator((current) => {
      if (
        current.visible === next.visible &&
        current.height === next.height &&
        current.top === next.top
      ) {
        return current
      }

      return next
    })
  }, [hideWhenNotOverflowing])

  const markActive = useCallback(() => {
    setIsActive(true)
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = window.setTimeout(() => {
      setIsActive(false)
    }, 900)
  }, [])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return undefined

    const handleScroll = () => {
      updateIndicator()
      markActive()
    }
    const handleResize = () => updateIndicator()

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateIndicator)
      resizeObserver.observe(scrollElement)
      Array.from(scrollElement.children).forEach((child) => resizeObserver.observe(child))
    }

    const frameId = window.requestAnimationFrame(updateIndicator)

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [children, markActive, updateIndicator])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateIndicator)
    return () => window.cancelAnimationFrame(frameId)
  }, [children, updateIndicator])

  useEffect(
    () => () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current)
      }
    },
    [],
  )

  return (
    <div
      className={`relative min-h-0 ${className}`}
      onMouseEnter={() => {
        if (indicator.visible) setIsActive(true)
      }}
      onMouseLeave={() => {
        if (idleTimerRef.current) {
          window.clearTimeout(idleTimerRef.current)
        }
        setIsActive(false)
      }}
    >
      <div
        ref={scrollRef}
        className={`native-scrollbar-hidden h-full min-h-0 ${
          allowHorizontalScroll ? 'overflow-auto' : 'overflow-x-hidden overflow-y-auto'
        } ${contentClassName}`}
      >
        {children}
      </div>

      {indicator.visible ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-1.5 transition-opacity duration-200 ${
            isActive ? 'opacity-100' : 'opacity-45'
          }`}
        >
          <div
            className={`absolute right-0.5 w-[4px] rounded-full transition-colors duration-200 ${thumbClassName}`}
            style={{
              height: `${indicator.height}px`,
              transform: `translateY(${indicator.top}px)`,
              backgroundColor: isActive
                ? 'rgba(220, 248, 229, 0.88)'
                : 'rgba(202, 242, 216, 0.62)',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

export default CustomScrollArea
