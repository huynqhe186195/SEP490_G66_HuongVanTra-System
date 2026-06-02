import { RECEIPT_PRINT_CSS } from './receiptPrintStyles.js'

/**
 * In biên lai trong iframe riêng — tránh lệch khổ khi window.print() trên cả trang POS.
 * @param {HTMLElement} paperElement — phần tử .receipt-paper
 */
export function printReceipt(paperElement) {
  if (!paperElement) return

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'In hóa đơn')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'

  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  if (!win) {
    document.body.removeChild(iframe)
    return
  }

  const doc = win.document
  doc.open()
  doc.write(
    `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Hóa đơn</title>
  <style>${RECEIPT_PRINT_CSS}</style>
</head>
<body>${paperElement.outerHTML}</body>
</html>`,
  )
  doc.close()

  const removeIframe = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }

  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    win.onafterprint = removeIframe
    setTimeout(removeIframe, 2000)
    win.focus()
    win.print()
  }

  iframe.onload = () => {
    setTimeout(doPrint, 50)
  }
}
