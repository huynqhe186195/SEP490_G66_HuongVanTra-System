import { forwardRef } from 'react'
import './paymentReceipt.css'

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

const ReceiptPaper = forwardRef(function ReceiptPaper({ receipt }, ref) {
  if (!receipt) return null

  const hasDiscount = Number(receipt.totalDiscount || 0) > 0
  const isCash = receipt.paymentMethodLabel === 'Tiền mặt'

  return (
    <div ref={ref} className="receipt-paper">
      <div className="receipt-brand">HƯƠNG VÂN TRÀ</div>
      <div className="receipt-title">HÓA ĐƠN BÁN HÀNG</div>
      {receipt.isReprint ? (
        <>
          <div className="receipt-reprint-banner">BẢN IN LẠI</div>
          <div className="receipt-meta">Lần in lại: {receipt.reprintNumber ?? 1}</div>
          <div className="receipt-meta">Thời điểm in lại: {receipt.reprintedAtLabel || '—'}</div>
        </>
      ) : null}
      {receipt.invoiceCode ? (
        <div className="receipt-meta receipt-highlight">Số HĐ: {receipt.invoiceCode}</div>
      ) : null}
      <div className="receipt-meta">Mã đơn: {receipt.orderCode || '—'}</div>
      <div className="receipt-meta">{receipt.createdAtLabel}</div>

      <div className="receipt-divider" />

      <div className="receipt-row">
        <span className="receipt-label">Khách</span>
        <span className="receipt-value">{receipt.customerName || 'Khách lẻ'}</span>
      </div>
      <div className="receipt-row">
        <span className="receipt-label">Thu ngân</span>
        <span className="receipt-value">
          {receipt.sellerName || 'NV POS'}
          {receipt.sellerRole ? ` · ${receipt.sellerRole}` : ''}
        </span>
      </div>
      <div className="receipt-row">
        <span className="receipt-label">Thanh toán</span>
        <span className="receipt-value receipt-highlight">{receipt.paymentMethodLabel}</span>
      </div>

      <div className="receipt-divider" />

      {receipt.items.map((item, index) => (
        <div key={`${item.sku}-${index}`} className="receipt-item">
          <div className="receipt-item-name">{item.name}</div>
          <div className="receipt-item-line">
            <span>
              {formatQty(item.qty)} × {formatMoney(item.price)}
            </span>
            <span className="receipt-item-total">{formatMoney(item.total)}</span>
          </div>
          <div className="receipt-item-sku">{item.sku}</div>
          {Number(item.immediateFulfilledQuantity || 0) > 0 ? (
            <div className="receipt-item-sku">
              Giao ngay: {formatQty(item.immediateFulfilledQuantity)}
            </div>
          ) : null}
          {Number(item.reservedFinishedQuantity || 0) > 0 ? (
            <div className="receipt-item-sku">
              Đã giữ: {formatQty(item.reservedFinishedQuantity)}
            </div>
          ) : null}
          {Number(item.backorderQuantity || 0) > 0 ? (
            <div className="receipt-item-sku">
              Chờ nguyên liệu: {formatQty(item.backorderQuantity)}
            </div>
          ) : null}
        </div>
      ))}

      {receipt.isBackorder ? (
        <>
          <div className="receipt-divider" />
          <div className="receipt-meta receipt-highlight">ĐƠN CHỜ NGUYÊN LIỆU</div>
          <div className="receipt-meta">
            Hình thức: {receipt.fulfillmentPreference === 'CompleteDelivery'
              ? 'Nhận một lần khi đủ hàng'
              : 'Nhận trước phần hàng sẵn'}
          </div>
          <div className="receipt-meta">
            Dự kiến: {receipt.estimatedReadyFromLabel || '—'} - {receipt.estimatedReadyToLabel || '—'}
          </div>
          {receipt.pickupDateLabel ? (
            <div className="receipt-meta">Hẹn lấy: {receipt.pickupDateLabel}</div>
          ) : null}
          {receipt.pickupContactName ? (
            <div className="receipt-meta">
              Người nhận: {receipt.pickupContactName}
              {receipt.pickupContactPhone ? ` — ${receipt.pickupContactPhone}` : ''}
            </div>
          ) : null}
          {receipt.pickupCode ? (
            <>
              <div className="receipt-meta receipt-highlight">MÃ NHẬN HÀNG: {receipt.pickupCode}</div>
              <div className="receipt-meta">Vui lòng giữ hoá đơn và đọc mã này khi tới lấy hàng.</div>
            </>
          ) : null}
        </>
      ) : null}

      <div className="receipt-divider" />

      <div className="receipt-total-row">
        <span>Tạm tính</span>
        <span>{formatMoney(receipt.grossSubtotal)}</span>
      </div>
      {hasDiscount ? (
        <div className="receipt-total-row receipt-discount">
          <span>Giảm giá</span>
          <span>-{formatMoney(receipt.totalDiscount)}</span>
        </div>
      ) : null}
      <div className="receipt-total-row receipt-grand">
        <span>TỔNG CỘNG</span>
        <span>{formatMoney(receipt.total)} đ</span>
      </div>

      {isCash ? (
        <>
          <div className="receipt-total-row">
            <span>Khách đưa</span>
            <span>{formatMoney(receipt.customerPaid ?? receipt.amountPaid ?? 0)}</span>
          </div>
          {(receipt.debtAmount ?? 0) > 0 ? (
            <div className="receipt-total-row receipt-debt">
              <span>Còn nợ</span>
              <span>{formatMoney(receipt.debtAmount)}</span>
            </div>
          ) : null}
          <div className="receipt-total-row">
            <span>Tiền thừa</span>
            <span>{(receipt.change ?? 0) > 0 ? formatMoney(receipt.change) : '—'}</span>
          </div>
        </>
      ) : null}

      <div className="receipt-divider" />

      <div className="receipt-thanks">Cảm ơn quý khách!</div>
      <div className="receipt-footer-note">Hẹn gặp lại tại Hương Vân Trà</div>
    </div>
  )
})

export default ReceiptPaper
