export function getVietQrConfig() {
  return {
    bankBin: String(import.meta.env.VITE_VIETQR_BANK_BIN || '').trim(),
    accountNumber: String(import.meta.env.VITE_VIETQR_ACCOUNT_NUMBER || '').trim(),
    accountName: String(import.meta.env.VITE_VIETQR_ACCOUNT_NAME || '').trim(),
    bankName: String(import.meta.env.VITE_VIETQR_BANK_NAME || '').trim(),
  }
}

export function isVietQrConfigured(config = getVietQrConfig()) {
  return Boolean(config.bankBin && config.accountNumber)
}

export function buildVietQrImageUrl({ bankBin, accountNumber, accountName, amount, addInfo }) {
  if (!bankBin || !accountNumber) return ''

  const params = new URLSearchParams()
  const normalizedAmount = Math.round(Number(amount) || 0)
  if (normalizedAmount > 0) params.set('amount', String(normalizedAmount))
  if (addInfo) params.set('addInfo', String(addInfo).trim())
  if (accountName) params.set('accountName', accountName)

  const query = params.toString()
  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.jpg${query ? `?${query}` : ''}`
}

export function buildQrExpiryUtc(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}
