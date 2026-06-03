import { useRef } from 'react'
import './paymentReceipt.css'
import { printReceipt } from '../utils/printReceipt.js'

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

function PaymentReceiptModal({ isOpen, receipt, onClose }) {
  const paperRef = useRef(null)

  if (!isOpen || !receipt) return null

  const hasDiscount = Number(receipt.totalDiscount || 0) > 0
  const isCash = receipt.paymentMethodLabel === 'Tiền mặt'

  const handlePrint = () => {
    if (paperRef.current) {
      printReceipt(paperRef.current)
    }
  }

  return (
    <div className="receipt-overlay" onClick={onClose} role="presentation">
      <div className="receipt-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Hóa đơn">
        <div className="receipt-print-area">
          <div ref={paperRef} className="receipt-paper">
            <div className="receipt-brand">HƯƠNG VÂN TRÀ</div>
            <div className="receipt-title">HÓA ĐƠN BÁN HÀNG</div>
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
              <span className="receipt-label">TT</span>
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
              </div>
            ))}

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
        </div>

        <div className="receipt-actions no-print">
          <button type="button" className="receipt-btn receipt-btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="receipt-btn receipt-btn-primary" onClick={handlePrint}>
            In hóa đơn
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentReceiptModal
