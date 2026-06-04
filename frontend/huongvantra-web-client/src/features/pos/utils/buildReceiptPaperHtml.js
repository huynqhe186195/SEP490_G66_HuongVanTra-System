function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatQty(value) {
  const n = Number(value) || 0
  if (Math.abs(n - Math.round(n)) < 0.001) {
    return String(Math.round(n))
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML nội dung `.receipt-paper` để in (không cần mount React). */
export function buildReceiptPaperHtml(receipt) {
  if (!receipt) return ''

  const hasDiscount = Number(receipt.totalDiscount || 0) > 0
  const isCash = receipt.paymentMethodLabel === 'Tiền mặt'

  const itemsHtml = (receipt.items || [])
    .map(
      (item) => `
      <div class="receipt-item">
        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
        <div class="receipt-item-line">
          <span>${formatQty(item.qty)} × ${formatMoney(item.price)}</span>
          <span class="receipt-item-total">${formatMoney(item.total)}</span>
        </div>
        <div class="receipt-item-sku">${escapeHtml(item.sku)}</div>
      </div>`,
    )
    .join('')

  const cashRows = isCash
    ? `
      <div class="receipt-total-row">
        <span>Khách đưa</span>
        <span>${formatMoney(receipt.customerPaid ?? receipt.amountPaid ?? 0)}</span>
      </div>
      ${
        (receipt.debtAmount ?? 0) > 0
          ? `<div class="receipt-total-row receipt-debt">
        <span>Còn nợ</span>
        <span>${formatMoney(receipt.debtAmount)}</span>
      </div>`
          : ''
      }
      <div class="receipt-total-row">
        <span>Tiền thừa</span>
        <span>${(receipt.change ?? 0) > 0 ? formatMoney(receipt.change) : '—'}</span>
      </div>`
    : ''

  return `<div class="receipt-paper">
      <div class="receipt-brand">HƯƠNG VÂN TRÀ</div>
      <div class="receipt-title">HÓA ĐƠN BÁN HÀNG</div>
      ${
        receipt.invoiceCode
          ? `<div class="receipt-meta receipt-highlight">Số HĐ: ${escapeHtml(receipt.invoiceCode)}</div>`
          : ''
      }
      <div class="receipt-meta">Mã đơn: ${escapeHtml(receipt.orderCode || '—')}</div>
      <div class="receipt-meta">${escapeHtml(receipt.createdAtLabel)}</div>
      <div class="receipt-divider"></div>
      <div class="receipt-row">
        <span class="receipt-label">Khách</span>
        <span class="receipt-value">${escapeHtml(receipt.customerName || 'Khách lẻ')}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Thu ngân</span>
        <span class="receipt-value">${escapeHtml(receipt.sellerName || 'NV POS')}${
          receipt.sellerRole ? ` · ${escapeHtml(receipt.sellerRole)}` : ''
        }</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">TT</span>
        <span class="receipt-value receipt-highlight">${escapeHtml(receipt.paymentMethodLabel)}</span>
      </div>
      <div class="receipt-divider"></div>
      ${itemsHtml}
      <div class="receipt-divider"></div>
      <div class="receipt-total-row">
        <span>Tạm tính</span>
        <span>${formatMoney(receipt.grossSubtotal)}</span>
      </div>
      ${
        hasDiscount
          ? `<div class="receipt-total-row receipt-discount">
        <span>Giảm giá</span>
        <span>-${formatMoney(receipt.totalDiscount)}</span>
      </div>`
          : ''
      }
      <div class="receipt-total-row receipt-grand">
        <span>TỔNG CỘNG</span>
        <span>${formatMoney(receipt.total)} đ</span>
      </div>
      ${cashRows}
      <div class="receipt-divider"></div>
      <div class="receipt-thanks">Cảm ơn quý khách!</div>
      <div class="receipt-footer-note">Hẹn gặp lại tại Hương Vân Trà</div>
    </div>`
}
