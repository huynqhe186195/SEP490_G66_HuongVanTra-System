import { useEffect, useState } from 'react'
import { parseUtcDateTime } from '../../../utils/vietnamDateTime.js'

export function getQrExpiryTimestamp(expiresAtUtc) {
  const date = parseUtcDateTime(expiresAtUtc)
  return date ? date.getTime() : null
}

export function isQrExpired(expiresAtUtc, isExpiredFlag = false) {
  if (isExpiredFlag) return true
  const expiryMs = getQrExpiryTimestamp(expiresAtUtc)
  return expiryMs != null && expiryMs <= Date.now()
}

export function useQrExpiryCountdown(expiresAtUtc, isExpired, expiredMessage) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!expiresAtUtc) {
      setLabel('')
      return undefined
    }

    const tick = () => {
      const expiryMs = getQrExpiryTimestamp(expiresAtUtc)
      if (expiryMs == null) {
        setLabel('')
        return
      }

      const remainingMs = expiryMs - Date.now()
      if (remainingMs <= 0 || isExpired) {
        setLabel(expiredMessage)
        return
      }

      const minutes = Math.floor(remainingMs / 60000)
      const seconds = Math.floor((remainingMs % 60000) / 1000)
      setLabel(`QR hết hạn sau ${minutes}:${String(seconds).padStart(2, '0')}`)
    }

    tick()
    const timerId = setInterval(tick, 1000)
    return () => clearInterval(timerId)
  }, [expiresAtUtc, isExpired, expiredMessage])

  return label
}
