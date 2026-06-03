import { useRef } from 'react'
import ReceiptPaper from './ReceiptPaper.jsx'
import './paymentReceipt.css'
import { printReceipt, printReceiptFromData } from '../utils/printReceipt.js'

function PaymentReceiptModal({ isOpen, receipt, onClose }) {
  const paperRef = useRef(null)

  if (!isOpen || !receipt) return null

  const handlePrint = () => {
    if (paperRef.current) {
      printReceipt(paperRef.current)
    } else {
      printReceiptFromData(receipt)
    }
  }

  return (
    <div className="receipt-overlay" onClick={onClose} role="presentation">
      <div className="receipt-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Hóa đơn">
        <div className="receipt-print-area">
          <ReceiptPaper ref={paperRef} receipt={receipt} />
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
