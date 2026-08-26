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

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date)
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
  const isRecordedPayment =
    receipt.paymentMethodLabel === 'Tiền mặt' || receipt.paymentMethodLabel === 'Chuyển khoản'

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

  const isDepositReceipt = Number(receipt.depositAmount ?? 0) > 0
  const paymentRows = isRecordedPayment
    ? `
      <div class="receipt-total-row">
        <span>${isDepositReceipt ? 'Đã nhận cọc' : 'Khách trả'}</span>
        <span>${formatMoney(receipt.customerPaid ?? receipt.amountPaid ?? 0)}</span>
      </div>
      ${
        (receipt.debtAmount ?? 0) > 0
          ? `<div class="receipt-total-row receipt-debt">
        <span>${isDepositReceipt ? 'Còn lại thu khi nhận hàng' : 'Còn nợ (đơn)'}</span>
        <span>${formatMoney(receipt.debtAmount)}</span>
      </div>`
          : ''
      }
      <div class="receipt-total-row">
        <span>Tiền thừa</span>
        <span>${(receipt.change ?? 0) > 0 ? formatMoney(receipt.change) : '—'}</span>
      </div>`
    : ''

  const backorderRows = receipt.isBackorder
    ? `
      <div class="receipt-divider"></div>
      <div class="receipt-meta receipt-highlight">ĐƠN HẸN KHÁCH GIAO SAU</div>
      <div class="receipt-meta">Hình thức: ${receipt.fulfillmentPreference === 'CompleteDelivery'
        ? 'Nhận một lần khi đủ hàng'
        : 'Nhận trước phần hàng sẵn'}</div>
      <div class="receipt-meta">Dự kiến: ${escapeHtml(receipt.estimatedReadyFromLabel || formatDateTime(receipt.estimatedReadyFrom))} - ${escapeHtml(receipt.estimatedReadyToLabel || formatDateTime(receipt.estimatedReadyTo))}</div>
      ${receipt.pickupDate || receipt.pickupDateLabel
        ? `<div class="receipt-meta">Hẹn lấy: ${escapeHtml(receipt.pickupDateLabel || formatDate(receipt.pickupDate))}</div>`
        : ''}
      ${receipt.pickupContactName
        ? `<div class="receipt-meta">Người nhận: ${escapeHtml(receipt.pickupContactName)}${receipt.pickupContactPhone ? ` — ${escapeHtml(receipt.pickupContactPhone)}` : ''}</div>`
        : ''}
      ${receipt.pickupCode
        ? `<div class="receipt-meta receipt-highlight">MÃ NHẬN HÀNG: ${escapeHtml(receipt.pickupCode)}</div>
      <div class="receipt-meta">Vui lòng giữ hoá đơn và đọc mã này khi tới lấy hàng.</div>`
        : ''}`
    : ''

  return `<div class="receipt-paper">
      <div class="receipt-brand">HƯƠNG VÂN TRÀ</div>
      <div class="receipt-title">HÓA ĐƠN BÁN HÀNG</div>
      ${
        receipt.isReprint
          ? `<div class="receipt-reprint-banner">BẢN IN LẠI</div>
      <div class="receipt-meta">Lần in lại: ${escapeHtml(receipt.reprintNumber ?? 1)}</div>
      <div class="receipt-meta">Thời điểm in lại: ${escapeHtml(receipt.reprintedAtLabel || '—')}</div>`
          : ''
      }
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
        <span class="receipt-label">Thanh toán</span>
        <span class="receipt-value receipt-highlight">${escapeHtml(receipt.paymentMethodLabel)}</span>
      </div>
      <div class="receipt-divider"></div>
      ${itemsHtml}
      ${backorderRows}
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
      ${paymentRows}
      <div class="receipt-divider"></div>
      <div class="receipt-thanks">Cảm ơn quý khách!</div>
      <div class="receipt-footer-note">Hẹn gặp lại tại Hương Vân Trà</div>
    </div>`
}
