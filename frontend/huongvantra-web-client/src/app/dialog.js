/**
 * App dialog API — thay window.confirm / prompt / alert.
 * DialogProvider lắng nghe event `app-dialog` và resolve Promise.
 */

function openDialog(detail) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent('app-dialog', {
        detail: { ...detail, resolve },
      }),
    )
  })
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   tone?: 'danger' | 'primary',
 * }} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
  return openDialog({
    kind: 'confirm',
    title: options.title ?? 'Xác nhận',
    message: options.message ?? '',
    confirmLabel: options.confirmLabel ?? 'Xác nhận',
    cancelLabel: options.cancelLabel ?? 'Hủy bỏ',
    tone: options.tone ?? 'danger',
  })
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   defaultValue?: string,
 *   placeholder?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   required?: boolean,
 *   presets?: string[],
 *   presetsLabel?: string,
 *   tone?: 'danger' | 'primary',
 *   suggestions?: string[],
 * }} [options]
 * @returns {Promise<string|null>} null nếu hủy
 */
export function promptDialog(options = {}) {
  return openDialog({
    kind: 'prompt',
    title: options.title ?? 'Nhập thông tin',
    message: options.message ?? '',
    defaultValue: options.defaultValue ?? '',
    placeholder: options.placeholder ?? '',
    confirmLabel: options.confirmLabel ?? 'Xác nhận',
    cancelLabel: options.cancelLabel ?? 'Hủy bỏ',
    required: Boolean(options.required),
    presets: Array.isArray(options.presets) ? options.presets : [],
    presetsLabel: options.presetsLabel ?? 'Lý do thường gặp',
    tone: options.tone ?? 'primary',
    suggestions: Array.isArray(options.suggestions) ? options.suggestions : [],
  })
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 * }} [options]
 * @returns {Promise<void>}
 */
export function alertDialog(options = {}) {
  return openDialog({
    kind: 'alert',
    title: options.title ?? 'Thông báo',
    message: options.message ?? '',
    confirmLabel: options.confirmLabel ?? 'Đã hiểu',
    tone: 'primary',
  }).then(() => undefined)
}
