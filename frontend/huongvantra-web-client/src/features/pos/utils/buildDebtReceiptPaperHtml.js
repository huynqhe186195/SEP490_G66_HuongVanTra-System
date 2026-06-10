function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildDebtReceiptCode(transactionId) {
  const raw = String(transactionId || '').replace(/-/g, '').toUpperCase()
  const suffix = raw.slice(0, 8) || '00000000'
  return `PTCN-${suffix}`
}

/** Phiếu thu công nợ — in riêng, không gộp vào hóa đơn bán hàng. */
export function buildDebtReceiptPaperHtml(receipt) {
  if (!receipt) return ''

  return `<div class="receipt-paper">
      <div class="receipt-brand">HƯƠNG VÂN TRÀ</div>
      <div class="receipt-title">PHIẾU THU CÔNG NỢ</div>
      <div class="receipt-meta receipt-highlight">Số phiếu: ${escapeHtml(receipt.receiptCode || '—')}</div>
      <div class="receipt-meta">${escapeHtml(receipt.createdAtLabel)}</div>
      <div class="receipt-divider"></div>
      <div class="receipt-row">
        <span class="receipt-label">Khách</span>
        <span class="receipt-value">${escapeHtml(receipt.customerName || 'Khách lẻ')}</span>
      </div>
      ${
        receipt.customerCode
          ? `<div class="receipt-row">
        <span class="receipt-label">Mã KH</span>
        <span class="receipt-value">${escapeHtml(receipt.customerCode)}</span>
      </div>`
          : ''
      }
      <div class="receipt-row">
        <span class="receipt-label">Thu ngân</span>
        <span class="receipt-value">${escapeHtml(receipt.sellerName || 'NV POS')}${
          receipt.sellerRole ? ` · ${escapeHtml(receipt.sellerRole)}` : ''
        }</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Hình thức</span>
        <span class="receipt-value receipt-highlight">${escapeHtml(receipt.paymentMethodLabel || 'Tiền mặt')}</span>
      </div>
      ${
        receipt.relatedOrderCode
          ? `<div class="receipt-row">
        <span class="receipt-label">Đơn liên quan</span>
        <span class="receipt-value">${escapeHtml(receipt.relatedOrderCode)}</span>
      </div>`
          : ''
      }
      <div class="receipt-divider"></div>
      <div class="receipt-total-row">
        <span>Nợ trước</span>
        <span>${formatMoney(receipt.balanceBefore)} đ</span>
      </div>
      <div class="receipt-total-row receipt-grand">
        <span>THU NỢ</span>
        <span>${formatMoney(receipt.amount)} đ</span>
      </div>
      ${
        Array.isArray(receipt.allocations) && receipt.allocations.length
          ? `<div class="receipt-divider"></div>
      <div class="receipt-meta" style="text-align:left;padding:0 2px;font-weight:600;">Trừ theo đơn:</div>
      ${receipt.allocations
        .map(
          (row) => `<div class="receipt-row">
        <span class="receipt-label">${escapeHtml(row.orderCode)}</span>
        <span class="receipt-value">${formatMoney(row.amount)} đ</span>
      </div>`,
        )
        .join('')}`
          : ''
      }
      <div class="receipt-total-row">
        <span>Còn nợ</span>
        <span>${formatMoney(receipt.balanceAfter)} đ</span>
      </div>
      ${
        receipt.note
          ? `<div class="receipt-divider"></div>
      <div class="receipt-meta" style="text-align:left;padding:0 2px;">${escapeHtml(receipt.note)}</div>`
          : ''
      }
      <div class="receipt-divider"></div>
      <div class="receipt-thanks">Cảm ơn quý khách!</div>
      <div class="receipt-footer-note">Phiếu thu công nợ — không phải hóa đơn bán hàng</div>
    </div>`
}
