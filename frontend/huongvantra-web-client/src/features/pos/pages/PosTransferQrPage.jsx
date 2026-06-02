import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  confirmOrderPayment,
  fetchPosOrderPaymentStatus,
  fetchPosTransferPaymentInfo,
  resolveTransferQrImageUrl,
  simulatePosPaymentWebhook,
} from '../services/posApi.js'

const POLL_INTERVAL_MS = 3000
const showSimulateWebhook =
  import.meta.env.DEV || import.meta.env.VITE_POS_ALLOW_SIMULATE_WEBHOOK === 'true'

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
  const [bankInfo, setBankInfo] = useState(null)
  const [isLoadingBank, setIsLoadingBank] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('')
  const completedRef = useRef(false)

  const completeCheckout = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    showSuccess(`Đã xác nhận thanh toán đơn ${payment?.orderCode || payment?.orderId}.`)
    navigate('/pos', {
      replace: true,
      state: payment?.receipt ? { receipt: payment.receipt } : undefined,
    })
  }, [navigate, payment?.orderCode, payment?.orderId, payment?.receipt])

  useEffect(() => {
    let mounted = true

    async function loadBankInfo() {
      try {
        setIsLoadingBank(true)
        const data = await fetchPosTransferPaymentInfo()
        if (mounted) {
          setBankInfo(data)
        }
      } catch (error) {
        if (mounted) {
          showError(error.message)
        }
      } finally {
        if (mounted) {
          setIsLoadingBank(false)
        }
      }
    }

    loadBankInfo()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!payment?.orderId || completedRef.current) {
      return undefined
    }

    let cancelled = false

    async function pollStatus() {
      try {
        const status = await fetchPosOrderPaymentStatus(payment.orderId)
        if (cancelled || completedRef.current) return

        setPaymentStatus(status.paymentStatus || '')
        if (status.isPaid) {
          completeCheckout()
        }
      } catch {
        // Bỏ qua lỗi poll tạm thời
      }
    }

    pollStatus()
    const timerId = setInterval(pollStatus, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timerId)
    }
  }, [payment?.orderId, completeCheckout])

  const transferNote = useMemo(() => {
    if (payment?.transferContent) {
      return payment.transferContent
    }
    return buildTransferNote(payment?.orderCode || payment?.orderLabel, payment?.customer)
  }, [payment?.transferContent, payment?.orderCode, payment?.orderLabel, payment?.customer])

  const qrImageUrl = resolveTransferQrImageUrl({
    qrImageUrl: payment?.qrImageUrl,
    qrPayload: payment?.qrPayload,
  })

  const handleConfirmReceived = async () => {
    if (!payment?.orderId) {
      showError('Không tìm thấy mã đơn hàng để xác nhận.')
      return
    }

    setIsConfirming(true)
    try {
      await confirmOrderPayment(payment.orderId, {
        paymentReference: `POS-TRANSFER-${payment.orderCode || payment.orderId}`,
        note: 'Xác nhận chuyển khoản từ POS',
      })
      completeCheckout()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleSimulateWebhook = async () => {
    if (!payment?.orderId) return

    setIsSimulating(true)
    try {
      await simulatePosPaymentWebhook(payment.orderId, {
        paymentReference: `SIM-${payment.orderCode || payment.orderId}`,
        note: 'Mô phỏng webhook chuyển khoản',
      })
      completeCheckout()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSimulating(false)
    }
  }

  if (!payment?.total || payment.paymentMethod !== 'TRANSFER' || !payment.orderId) {
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
          {payment.orderCode ? <p className="mt-1 text-sm text-[#414942]">{payment.orderCode}</p> : null}
          {payment.customer ? <p className="mt-0.5 text-xs text-[#717971]">{payment.customer}</p> : null}
          {paymentStatus ? (
            <p className="mt-2 text-xs text-[#717971]">
              Trạng thái: <span className="font-semibold text-[#356647]">{paymentStatus}</span>
              <span className="ml-1">(đang chờ webhook / xác nhận)</span>
            </p>
          ) : null}
        </header>

        <div className="flex flex-1 flex-col items-center gap-6 p-6">
          <div className="rounded-2xl border-2 border-[#356647]/20 bg-white p-4 shadow-inner">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="Mã QR chuyển khoản" className="h-[280px] w-[280px] object-contain" />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-[#717971]">
                Không có dữ liệu QR
              </div>
            )}
          </div>

          <p className="text-center text-sm text-[#717971]">Quét mã bằng app ngân hàng hoặc chuyển khoản thủ công</p>

          {isLoadingBank ? (
            <p className="text-sm text-[#717971]">Đang tải thông tin tài khoản...</p>
          ) : (
            <div className="w-full space-y-3 rounded-xl bg-[#f6f4ec] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#717971]">Ngân hàng</span>
                <span className="font-semibold text-[#1b1c17]">{bankInfo?.bankName || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#717971]">Số tài khoản</span>
                <span className="font-semibold text-[#1b1c17]">{bankInfo?.accountNumber || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-[#717971]">Chủ tài khoản</span>
                <span className="text-right font-semibold text-[#1b1c17]">{bankInfo?.accountHolder || '—'}</span>
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
          )}

          {showSimulateWebhook ? (
            <div className="w-full rounded-xl border border-dashed border-[#7e5700]/40 bg-[#fec25b]/10 p-4 text-sm">
              <p className="font-semibold text-[#7e5700]">Dev: mô phỏng webhook</p>
              <p className="mt-1 text-xs text-[#717971]">
                Giả lập ngân hàng đã báo tiền về — đơn sẽ tự chuyển sang đã thanh toán (giống webhook thật).
              </p>
              <button
                type="button"
                disabled={isSimulating || isConfirming}
                onClick={handleSimulateWebhook}
                className="mt-3 w-full rounded-lg border border-[#7e5700] bg-white py-2.5 text-sm font-bold text-[#7e5700] hover:bg-[#fec25b]/20 disabled:opacity-50"
              >
                {isSimulating ? 'Đang mô phỏng...' : 'Mô phỏng webhook (khách đã CK)'}
              </button>
            </div>
          ) : null}
        </div>

        {/* <footer className="grid grid-cols-2 gap-3 border-t border-[#c1c9c0] p-4">
          <Link
            to="/pos"
            className="flex items-center justify-center rounded-xl border border-[#c1c9c0] bg-white py-3 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec]"
          >
            Hủy
          </Link>
          <button
            type="button"
            disabled={isConfirming || isSimulating}
            className="flex items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            onClick={handleConfirmReceived}
          >
            {isConfirming ? 'Đang xác nhận...' : 'Đã nhận tiền'}
          </button>
        </footer> */}
      </div>
    </div>
  )
}

export default PosTransferQrPage
