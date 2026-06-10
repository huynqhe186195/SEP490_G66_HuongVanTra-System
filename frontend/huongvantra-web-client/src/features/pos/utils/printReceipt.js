import { buildDebtReceiptPaperHtml } from './buildDebtReceiptPaperHtml.js'
import { buildReceiptPaperHtml } from './buildReceiptPaperHtml.js'
import { RECEIPT_PRINT_CSS } from './receiptPrintStyles.js'

function printReceiptHtml(paperHtml, { title = 'Hóa đơn' } = {}) {
  if (!paperHtml) return Promise.resolve()

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', title)
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'

    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    if (!win) {
      document.body.removeChild(iframe)
      resolve()
      return
    }

    const doc = win.document
    doc.open()
    doc.write(
      `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${RECEIPT_PRINT_CSS}</style>
</head>
<body>${paperHtml}</body>
</html>`,
    )
    doc.close()

    const finish = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
      resolve()
    }

    let printed = false
    const doPrint = () => {
      if (printed) return
      printed = true
      win.onafterprint = finish
      setTimeout(finish, 2500)
      win.focus()
      win.print()
    }

    iframe.onload = () => {
      setTimeout(doPrint, 50)
    }
    setTimeout(doPrint, 120)
  })
}

/**
 * In biên lai trong iframe riêng — tránh lệch khổ khi window.print() trên cả trang POS.
 * @param {HTMLElement} paperElement — phần tử .receipt-paper
 */
export function printReceipt(paperElement) {
  if (!paperElement) return
  printReceiptHtml(paperElement.outerHTML)
}

/** Mở hộp thoại in trình duyệt từ object hóa đơn (không cần route / trang riêng). */
export function printReceiptFromData(receipt) {
  return printReceiptHtml(buildReceiptPaperHtml(receipt), { title: 'Hóa đơn bán hàng' })
}

/** In phiếu thu công nợ riêng. */
export function printDebtReceiptFromData(receipt) {
  return printReceiptHtml(buildDebtReceiptPaperHtml(receipt), { title: 'Phiếu thu công nợ' })
}

/** In lần lượt nhiều phiếu (hóa đơn bán → phiếu thu nợ). */
export async function printReceiptSequence(receipts) {
  for (const receipt of receipts) {
    if (!receipt) continue
    if (receipt.kind === 'debt') {
      await printDebtReceiptFromData(receipt)
    } else {
      await printReceiptFromData(receipt)
    }
  }
}
