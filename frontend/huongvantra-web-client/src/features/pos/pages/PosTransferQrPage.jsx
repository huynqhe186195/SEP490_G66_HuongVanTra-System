import { useMemo } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

const BANK_INFO = {
  bankName: 'Vietcombank',
  accountNumber: '1023456789',
  accountHolder: 'CONG TY HUONG VAN TRA',
}

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}

function buildTransferNote(orderLabel, customer) {
  const parts = ['POS', orderLabel?.replace(/\s+/g, '') || 'HD'].filter(Boolean)
  if (customer?.trim()) {
    parts.push(customer.trim().slice(0, 24))
  }
  return parts.join(' ').toUpperCase()
}

function PosTransferQrPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const payment = location.state

  const transferNote = useMemo(
    () => buildTransferNote(payment?.orderLabel, payment?.customer),
    [payment?.orderLabel, payment?.customer],
  )

  const qrPayload = useMemo(() => {
    if (!payment?.total) {
      return ''
    }

    return [
      BANK_INFO.bankName,
      BANK_INFO.accountNumber,
      BANK_INFO.accountHolder,
      `SO TIEN: ${payment.total}`,
      `NOI DUNG: ${transferNote}`,
    ].join('\n')
  }, [payment?.total, transferNote])

  const qrImageUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(qrPayload)}`
    : ''

  if (!payment?.total || payment.paymentMethod !== 'TRANSFER') {
    return <Navigate to="/pos" replace />
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
        >
          <Icon className="text-[20px]">arrow_back</Icon>
          Quay lại POS
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-[#c1c9c0]/40 bg-white shadow-[0_10px_30px_rgba(27,28,23,0.06)]">
        <header className="border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-6 py-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Thanh toán chuyển khoản</p>
          <h1 className="mt-1 text-3xl font-bold text-[#356647]">{formatMoney(payment.total)} đ</h1>
          {payment.orderLabel ? <p className="mt-1 text-sm text-[#414942]">{payment.orderLabel}</p> : null}
        </header>

        <div className="flex flex-1 flex-col items-center gap-6 p-6">
          <div className="rounded-2xl border-2 border-[#356647]/20 bg-white p-4 shadow-inner">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="Mã QR chuyển khoản" className="h-[280px] w-[280px] object-contain" />
            ) : null}
          </div>

          <p className="text-center text-sm text-[#717971]">Quét mã bằng app ngân hàng hoặc chuyển khoản thủ công</p>

          <div className="w-full space-y-3 rounded-xl bg-[#f6f4ec] p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#717971]">Ngân hàng</span>
              <span className="font-semibold text-[#1b1c17]">{BANK_INFO.bankName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#717971]">Số tài khoản</span>
              <span className="font-semibold text-[#1b1c17]">{BANK_INFO.accountNumber}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-[#717971]">Chủ tài khoản</span>
              <span className="text-right font-semibold text-[#1b1c17]">{BANK_INFO.accountHolder}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-[#c1c9c0]/60 pt-3">
              <span className="text-[#717971]">Nội dung CK</span>
              <span className="text-right font-semibold text-[#356647]">{transferNote}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#717971]">Số tiền</span>
              <span className="font-bold text-[#356647]">{formatMoney(payment.total)} đ</span>
            </div>
          </div>
        </div>

        <footer className="grid grid-cols-2 gap-3 border-t border-[#c1c9c0] p-4">
          <Link
            to="/pos"
            className="flex items-center justify-center rounded-xl border border-[#c1c9c0] bg-white py-3 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec]"
          >
            Hủy
          </Link>
          <button
            type="button"
            className="flex items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white shadow-md hover:brightness-110"
            onClick={() => navigate('/pos')}
          >
            Đã nhận tiền
          </button>
        </footer>
      </div>
    </div>
  )
}

export default PosTransferQrPage
