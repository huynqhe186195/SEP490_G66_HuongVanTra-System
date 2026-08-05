import { normalizeShiftTemplateName } from '../../shifts/services/shiftsApi.js'

/** Tên ca hiển thị trên POS — không kèm khung giờ (vd. "Ca 1 · 08:00–12:00" → "Ca 1"). */
export function shiftDisplayName(source) {
  if (!source) return ''
  if (typeof source === 'object') {
    const fromTemplate = normalizeShiftTemplateName(source.templateName || '')
    if (fromTemplate) return fromTemplate
    return shiftDisplayName(source.shiftLabel || source.label || '')
  }
  return normalizeShiftTemplateName(
    String(source)
      .replace(/\s*[·•]\s*\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2}\s*$/u, '')
      .trim(),
  )
}
