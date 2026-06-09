import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  fetchOrderTransferQrByOrderId,
  fetchPosOrderPaymentStatus,
  fetchPosSepaySetup,
  fetchPosTransferPaymentInfo,
  refreshOrderTransferQr,
  resolveTransferQrImageUrl,
} from '../../pos/services/posApi.js'

const POLL_INTERVAL_MS = 3000

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}

function paymentStatusLabel(status, isPaid) {
  if (isPaid) return 'Đã thanh toán'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'pending_payment') return 'Chờ chuyển khoản'
  if (normalized === 'paid' || normalized === 'success') return 'Đã thanh toán'
  return status || 'Đang chờ'
}

function useQrExpiryCountdown(expiresAtUtc, isExpired) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!expiresAtUtc) {
      setLabel('')
      return undefined
    }

    const tick = () => {
      const remainingMs = new Date(expiresAtUtc).getTime() - Date.now()
      if (remainingMs <= 0 || isExpired) {
        setLabel('Mã QR đã hết hạn. Bấm「Tạo mã QR mới」hoặc hủy đơn nếu khách không thanh toán.')
        return
      }
      const minutes = Math.floor(remainingMs / 60000)
      const seconds = Math.floor((remainingMs % 60000) / 1000)
      setLabel(`QR hết hạn sau ${minutes}:${String(seconds).padStart(2, '0')}`)
    }

    tick()
    const timerId = setInterval(tick, 1000)
    return () => clearInterval(timerId)
  }, [expiresAtUtc, isExpired])

  return label
}

function OrderTransferQrPanel({ orderId, orderCode, total, customerName, onPaid }) {
  const [qrData, setQrData] = useState(null)
  const [bankInfo, setBankInfo] = useState(null)
  const [sepaySetup, setSepaySetup] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [invoiceCode, setInvoiceCode] = useState('')
  const [pollError, setPollError] = useState('')
  const [expectedTransferContent, setExpectedTransferContent] = useState('')
  const [expectedAmount, setExpectedAmount] = useState(0)
  const completedRef = useRef(false)
  const isQrExpired =
    Boolean(qrData?.isExpired) ||
    (qrData?.qrExpiresAtUtc && new Date(qrData.qrExpiresAtUtc).getTime() <= Date.now())
  const qrExpiryLabel = useQrExpiryCountdown(qrData?.qrExpiresAtUtc, isQrExpired)

  const loadQr = useCallback(async () => {
    if (!orderId) return
    try {
      setIsLoading(true)
      const [qr, bank, setup] = await Promise.all([
        fetchOrderTransferQrByOrderId(orderId),
        fetchPosTransferPaymentInfo(),
        fetchPosSepaySetup().catch(() => null),
      ])
      setQrData(qr)
      setBankInfo(bank)
      setSepaySetup(setup)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadQr()
  }, [loadQr])

  const finishPaid = useCallback(
    (status) => {
      if (completedRef.current) return
      completedRef.current = true
      showSuccess(
        status?.invoiceCode
          ? `Đã thanh toán · Số HĐ: ${status.invoiceCode}`
          : `Đã thanh toán · Đơn ${orderCode}`,
      )
      onPaid?.(status)
    },
    [onPaid, orderCode],
  )

  const pollPaymentStatus = useCallback(async () => {
    if (!orderId || completedRef.current) return

    try {
      const status = await fetchPosOrderPaymentStatus(orderId)
      setPollError('')
      setPaymentStatus(status.paymentStatus || '')
      setIsPaid(status.isPaid)
      if (status.invoiceCode) setInvoiceCode(status.invoiceCode)
      if (status.expectedTransferContent) setExpectedTransferContent(status.expectedTransferContent)
      if (status.expectedAmount > 0) setExpectedAmount(status.expectedAmount)

      if (status.isPaid) {
        finishPaid(status)
      }
    } catch (error) {
      setPollError(error.message || 'Không kiểm tra được trạng thái thanh toán.')
    }
  }, [orderId, finishPaid])

  useEffect(() => {
    if (!orderId || completedRef.current) return undefined

    pollPaymentStatus()
    const timerId = setInterval(pollPaymentStatus, POLL_INTERVAL_MS)
    return () => clearInterval(timerId)
  }, [orderId, pollPaymentStatus])

  const transferNote = useMemo(() => {
    if (expectedTransferContent) return expectedTransferContent
    if (qrData?.transferContent) return qrData.transferContent
    return String(orderCode || '').trim().toUpperCase()
  }, [expectedTransferContent, qrData?.transferContent, orderCode])

  const displayAmount = expectedAmount > 0 ? expectedAmount : total || 0
  const qrImageUrl = !isQrExpired
    ? resolveTransferQrImageUrl({
        qrImageUrl: qrData?.qrImageUrl,
        qrPayload: qrData?.qrPayload,
      })
    : ''
  const receiveAccount = qrData?.transferAccountNumber || bankInfo?.accountNumber || '—'
  const usesSepayVa =
    qrData?.paymentMode === 'sepay_order_va' || qrData?.paymentMode === 'sepay_static_va'
  const isLegacyMainAccountQr =
    !usesSepayVa && receiveAccount.replace(/\D/g, '') === (bankInfo?.accountNumber || '').replace(/\D/g, '')
  const statusText = paymentStatusLabel(paymentStatus, isPaid)

  const handleCopyTransferNote = async () => {
    try {
      await navigator.clipboard.writeText(transferNote)
      showSuccess('Đã sao chép nội dung chuyển khoản.')
    } catch {
      showError('Không sao chép được. Vui lòng chọn và copy thủ công.')
    }
  }

  async function handleRefreshQr() {
    if (!orderId || isRefreshing) return
    try {
      setIsRefreshing(true)
      const qr = await refreshOrderTransferQr(orderId)
      setQrData(qr)
      showSuccess('Đã tạo mã QR mới.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[#356647]/25 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#356647]">
            Thanh toán chuyển khoản
          </h2>
          <p className="mt-1 text-2xl font-bold text-[#356647]">
            {formatMoney(displayAmount)} đ
          </p>
          {customerName ? <p className="mt-1 text-sm text-slate-600">{customerName}</p> : null}
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {!isPaid ? (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-600" aria-hidden />
          ) : null}
          <span>{statusText}</span>
        </div>
      </div>

      {qrExpiryLabel ? (
        <p
          className={`mb-3 text-xs font-semibold ${isQrExpired ? 'text-red-600' : 'text-[#7e5700]'}`}
        >
          {qrExpiryLabel}
        </p>
      ) : null}

      {invoiceCode ? (
        <p className="mb-3 text-sm font-semibold text-[#356647]">
          Số HĐ: {invoiceCode}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải mã QR...</p>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto w-full max-w-[220px] rounded-2xl border-2 border-[#356647]/20 bg-white p-3">
            {isQrExpired ? (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-slate-500">
                <span className="material-symbols-outlined text-4xl text-red-400">qr_code_2</span>
                <p className="font-semibold text-red-600">QR đã hết hạn</p>
                <p>Không dùng mã cũ để tránh nhầm lẫn thời gian thanh toán.</p>
              </div>
            ) : qrImageUrl ? (
              <img src={qrImageUrl} alt="Mã QR chuyển khoản" className="aspect-square w-full object-contain" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center px-2 text-center text-xs text-slate-500">
                Chưa có QR — kiểm tra cấu hình SePay / PosTransferPayment
              </div>
            )}
          </div>

          {isQrExpired ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={isRefreshing}
                onClick={handleRefreshQr}
                className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                {isRefreshing ? 'Đang tạo...' : 'Tạo mã QR mới'}
              </button>
              <p className="text-center text-xs text-slate-500">
                Vẫn có thể chuyển khoản thủ công theo thông tin bên dưới — hệ thống tự xác nhận qua SePay.
              </p>
            </div>
          ) : (
            <p className="text-center text-xs leading-relaxed text-slate-500">
              Khách quét QR hoặc chuyển khoản — hệ thống tự xác nhận qua SePay (webhook).
            </p>
          )}

          {isLegacyMainAccountQr && !isQrExpired ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="font-semibold">QR trỏ tài khoản chính — SePay có thể không ghi nhận</p>
              <p className="mt-1">
                {sepaySetup?.setupMessage ||
                  'Cấu hình Sepay:ApiToken hoặc StaticVaNumber trong appsettings, restart order-service.'}
              </p>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl bg-[#f6f4ec] p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Ngân hàng</span>
              <span className="text-right font-semibold text-slate-800">{bankInfo?.bankName || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">{usesSepayVa ? 'Số VA' : 'Số tài khoản'}</span>
              <span className="break-all text-right font-semibold text-slate-800">{receiveAccount}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-[#c1c9c0]/50 pt-2">
              <span className="text-slate-500">Nội dung CK</span>
              <button
                type="button"
                onClick={handleCopyTransferNote}
                className="max-w-[60%] break-all text-right font-semibold text-[#356647] hover:underline"
              >
                {transferNote}
              </button>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Số tiền</span>
              <span className="font-bold text-[#356647]">{formatMoney(displayAmount)} đ</span>
            </div>
          </div>

          {pollError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{pollError}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default OrderTransferQrPanel
