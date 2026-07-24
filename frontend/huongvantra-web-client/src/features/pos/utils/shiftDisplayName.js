/** Tên ca hiển thị trên POS — không kèm khung giờ (vd. "Ca sáng · 08:00–12:00" → "Ca sáng"). */
export function shiftDisplayName(source) {
  if (!source) return ''
  if (typeof source === 'object') {
    const fromTemplate = String(source.templateName || '').trim()
    if (fromTemplate) return fromTemplate
    return shiftDisplayName(source.shiftLabel || source.label || '')
  }
  return String(source)
    .replace(/\s*[·•]\s*\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2}\s*$/u, '')
    .trim()
}
