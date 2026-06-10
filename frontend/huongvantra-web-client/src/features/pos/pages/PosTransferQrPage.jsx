import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  fetchOrderTransferQrByOrderId,
  fetchPosOrderPaymentStatus,
  fetchPosSepaySetup,
  fetchPosTransferPaymentInfo,
  refreshOrderTransferQr,
  resolveTransferQrImageUrl,
} from '../services/posApi.js'
import { isQrExpired, useQrExpiryCountdown } from '../utils/qrExpiry.js'
import { printReceiptFromData } from '../utils/printReceipt.js'

const POLL_INTERVAL_MS = 3000
const QR_EXPIRED_MESSAGE =
  'Mã QR đã hết hạn. Bấm「Tạo mã QR mới」hoặc quay POS nếu khách không thanh toán.'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}

function paymentStatusLabel(status, isPaid) {
  if (isPaid) return 'Đã thanh toán'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'pending_payment') return 'Chờ chuyển khoản'
  if (normalized === 'paid') return 'Đã thanh toán'
  return status || 'Đang chờ'
}

function PosTransferQrPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const payment = location.state
  const [bankInfo, setBankInfo] = useState(null)
  const [isLoadingBank, setIsLoadingBank] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [invoiceCode, setInvoiceCode] = useState('')
  const [pollError, setPollError] = useState('')
  const [expectedTransferContent, setExpectedTransferContent] = useState('')
  const [expectedAmount, setExpectedAmount] = useState(0)
  const [sepaySetup, setSepaySetup] = useState(null)
  const [qrData, setQrData] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const completedRef = useRef(false)
  const qrExpiresAtUtc = qrData?.qrExpiresAtUtc ?? payment?.qrExpiresAtUtc
  const qrExpired = isQrExpired(qrExpiresAtUtc, qrData?.isExpired)
  const qrExpiryLabel = useQrExpiryCountdown(qrExpiresAtUtc, qrExpired, QR_EXPIRED_MESSAGE)

  useEffect(() => {
    if (!payment?.orderId) return undefined

    let mounted = true
    fetchOrderTransferQrByOrderId(payment.orderId)
      .then((qr) => {
        if (mounted) setQrData(qr)
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [payment?.orderId])

  const finishWithReceipt = useCallback(
    (status) => {
      if (completedRef.current) return
      completedRef.current = true

      const receipt = payment?.receipt
        ? {
            ...payment.receipt,
            invoiceCode: status?.invoiceCode || invoiceCode || payment.receipt.invoiceCode,
            orderCode: status?.orderCode || payment.orderCode || payment.receipt.orderCode,
          }
        : undefined

      showSuccess(
        status?.invoiceCode
          ? `Đã thanh toán · Số HĐ: ${status.invoiceCode}`
          : `Đã thanh toán · Đơn ${payment?.orderCode || payment?.orderId}`,
      )

      navigate('/pos', { replace: true })
      if (receipt) {
        printReceiptFromData(receipt)
      }
    },
    [navigate, payment?.orderCode, payment?.orderId, payment?.receipt, invoiceCode],
  )

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

    fetchPosSepaySetup()
      .then((data) => {
        if (mounted) {
          setSepaySetup(data)
        }
      })
      .catch(() => {
        if (mounted) {
          setSepaySetup(null)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const pollPaymentStatus = useCallback(async () => {
    if (!payment?.orderId || completedRef.current) return

    try {
      const status = await fetchPosOrderPaymentStatus(payment.orderId)
      setPollError('')

      setPaymentStatus(status.paymentStatus || '')
      setIsPaid(status.isPaid)
      if (status.invoiceCode) {
        setInvoiceCode(status.invoiceCode)
      }
      if (status.expectedTransferContent) {
        setExpectedTransferContent(status.expectedTransferContent)
      }
      if (status.expectedAmount > 0) {
        setExpectedAmount(status.expectedAmount)
      }

      if (status.isPaid) {
        finishWithReceipt(status)
      }
    } catch (error) {
      setPollError(error.message || 'Không kiểm tra được trạng thái thanh toán.')
    }
  }, [payment?.orderId, finishWithReceipt])

  useEffect(() => {
    if (!payment?.orderId || completedRef.current) {
      return undefined
    }

    pollPaymentStatus()
    const timerId = setInterval(pollPaymentStatus, POLL_INTERVAL_MS)
    return () => clearInterval(timerId)
  }, [payment?.orderId, pollPaymentStatus])

  const transferNote = useMemo(() => {
    if (expectedTransferContent) {
      return expectedTransferContent
    }
    if (qrData?.transferContent) {
      return qrData.transferContent
    }
    if (payment?.transferContent) {
      return payment.transferContent
    }
    return (payment?.orderCode || payment?.orderLabel || '').trim().toUpperCase()
  }, [expectedTransferContent, qrData?.transferContent, payment?.transferContent, payment?.orderCode, payment?.orderLabel])

  const displayAmount = expectedAmount > 0 ? expectedAmount : payment?.total || 0

  const qrImageUrl = !qrExpired
    ? resolveTransferQrImageUrl({
        qrImageUrl: qrData?.qrImageUrl ?? payment?.qrImageUrl,
        qrPayload: qrData?.qrPayload ?? payment?.qrPayload,
      })
    : ''

  async function handleRefreshQr() {
    if (!payment?.orderId || isRefreshing) return
    try {
      setIsRefreshing(true)
      const qr = await refreshOrderTransferQr(payment.orderId)
      setQrData(qr)
      showSuccess('Đã tạo mã QR mới.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCopyTransferNote = async () => {
    try {
      await navigator.clipboard.writeText(transferNote)
      showSuccess('Đã sao chép nội dung chuyển khoản.')
    } catch {
      showError('Không sao chép được. Vui lòng chọn và copy thủ công.')
    }
  }

  if (payment?.paymentMethod !== 'TRANSFER' || !payment.orderId) {
    return <Navigate to="/pos" replace />
  }

  const receiveAccount =
    qrData?.transferAccountNumber || payment.transferAccountNumber || bankInfo?.accountNumber || '—'
  const paymentMode = qrData?.paymentMode ?? payment.paymentMode
  const usesSepayVa =
    paymentMode === 'sepay_order_va' || paymentMode === 'sepay_static_va'
  const isLegacyMainAccountQr =
    !usesSepayVa && receiveAccount.replace(/\D/g, '') === (bankInfo?.accountNumber || '').replace(/\D/g, '')
  const statusText = paymentStatusLabel(paymentStatus, isPaid)

  return (
    <div className="mx-auto w-full max-w-lg pb-6">
      <div className="mb-3 sm:mb-4">
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
        >
          <Icon className="text-[20px]">arrow_back</Icon>
          Quay lại POS
        </button>
      </div>

      <div className="flex w-full flex-col rounded-[20px] border border-[#c1c9c0]/40 bg-white shadow-[0_10px_30px_rgba(27,28,23,0.06)] sm:rounded-[28px]">
        <header className="shrink-0 border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-4 text-center sm:px-6 sm:py-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#717971] sm:text-xs">
            Thanh toán chuyển khoản · SePay
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#356647] sm:text-3xl">
            {formatMoney(displayAmount)} đ
          </h1>
          {payment.orderCode ? (
            <p className="mt-1 break-all text-sm text-[#414942]">Mã đơn: {payment.orderCode}</p>
          ) : null}
          {payment.customer ? (
            <p className="mt-0.5 truncate text-xs text-[#717971]">{payment.customer}</p>
          ) : null}
          {qrExpiryLabel ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                qrExpired ? 'text-red-600' : 'text-[#7e5700]'
              }`}
            >
              {qrExpiryLabel}
            </p>
          ) : null}

          <div
            className={`mx-auto mt-3 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isPaid ? 'bg-[#356647]/15 text-[#356647]' : 'bg-[#fec25b]/25 text-[#7e5700]'
            }`}
          >
            {!isPaid ? (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#7e5700]" aria-hidden />
            ) : (
              <Icon className="text-[16px]">check_circle</Icon>
            )}
            <span>{statusText}</span>
            {!isPaid ? <span className="font-normal text-[#717971]">· chờ SePay</span> : null}
          </div>

          {invoiceCode ? (
            <p className="mt-2 text-sm font-semibold text-[#356647]">Số HĐ: {invoiceCode}</p>
          ) : null}
        </header>

        <div className="flex flex-col items-center gap-4 p-4 sm:gap-6 sm:p-6">
          <div className="w-full max-w-[min(100%,280px)] rounded-2xl border-2 border-[#356647]/20 bg-white p-3 shadow-inner sm:p-4">
            {qrExpired ? (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-[#717971]">
                <Icon className="text-4xl text-red-400">qr_code_2</Icon>
                <p className="font-semibold text-red-600">QR đã hết hạn</p>
                <p>Không dùng mã cũ để tránh nhầm lẫn thời gian thanh toán.</p>
              </div>
            ) : qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt="Mã QR chuyển khoản"
                className="aspect-square w-full object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center px-3 text-center text-sm text-[#717971] sm:px-4">
                Chưa có QR — kiểm tra PosTransferPayment / Sepay trong appsettings của order-service
              </div>
            )}
          </div>

          {qrExpired ? (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefreshQr}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isRefreshing ? 'Đang tạo...' : 'Tạo mã QR mới'}
            </button>
          ) : null}

          <p className="w-full text-center text-sm leading-relaxed text-[#717971]">
            {usesSepayVa
              ? 'Chuyển vào số VA bên dưới (BIDV qua SePay). Không chuyển nhầm số tài khoản chính.'
              : 'Khách quét QR hoặc chuyển khoản — hệ thống tự nhận tiền qua SePay (webhook).'}
          </p>

          {isLegacyMainAccountQr ? (
            <div className="w-full rounded-xl border border-[#ba1a1a]/40 bg-[#ba1a1a]/10 p-3 text-xs text-[#ba1a1a]">
              <p className="font-semibold">QR này trỏ tài khoản chính — SePay không ghi nhận</p>
              <p className="mt-1">
                {sepaySetup?.setupMessage ||
                  'Cấu hình Sepay:ApiToken trong appsettings (hoặc StaticVaNumber), restart API, tạo đơn CK mới.'}
              </p>
            </div>
          ) : null}
          {usesSepayVa ? (
            <div className="w-full rounded-xl border border-[#7e5700]/40 bg-[#fec25b]/15 p-3 text-xs text-[#604100]">
              <p className="font-semibold">BIDV + SePay: chuyển vào số VA bên dưới</p>
              <p className="mt-1">Giao dịch sẽ hiển thị trên lịch sử SePay và tự xác nhận đơn qua webhook.</p>
            </div>
          ) : null}

          <div className="w-full rounded-xl border border-[#356647]/30 bg-[#356647]/5 p-3 text-xs text-[#414942]">
            <p className="font-semibold text-[#356647]">Khách CK phải khớp:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {usesSepayVa ? (
                <li>
                  Số VA nhận tiền: <strong className="text-[#1b1c17]">{receiveAccount}</strong>
                </li>
              ) : (
                <li>
                  TK nhận: <strong>{receiveAccount}</strong> ({bankInfo?.bankName || '—'})
                </li>
              )}
              <li>
                Số tiền: <strong>{formatMoney(displayAmount)} đ</strong>
              </li>
              {!usesSepayVa ? (
                <li>
                  Nội dung: <strong className="text-[#1b1c17]">{transferNote}</strong> (copy y nguyên)
                </li>
              ) : null}
            </ul>
          </div>

          {pollError ? (
            <p className="w-full rounded-lg bg-[#ba1a1a]/10 px-3 py-2 text-xs font-medium text-[#ba1a1a]">
              {pollError}
            </p>
          ) : null}

          {isLoadingBank ? (
            <p className="text-sm text-[#717971]">Đang tải thông tin tài khoản...</p>
          ) : (
            <div className="w-full space-y-3 rounded-xl bg-[#f6f4ec] p-3 text-sm sm:p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="shrink-0 text-[#717971]">Ngân hàng</span>
                <span className="font-semibold text-[#1b1c17] sm:text-right">{bankInfo?.bankName || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="shrink-0 text-[#717971]">
                  {usesSepayVa ? 'Số VA (chuyển vào đây)' : 'Số tài khoản'}
                </span>
                <span className="break-all font-semibold text-[#1b1c17] sm:text-right">{receiveAccount}</span>
              </div>
              {usesSepayVa && bankInfo?.accountNumber ? (
                <div className="flex flex-col gap-1 text-xs text-[#717971] sm:flex-row sm:justify-between sm:gap-4">
                  <span>TK gốc (không CK vào)</span>
                  <span className="break-all sm:text-right">{bankInfo.accountNumber}</span>
                </div>
              ) : null}
              {bankInfo?.accountHolder ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-[#717971]">Chủ tài khoản</span>
                  <span className="break-words font-semibold text-[#1b1c17] sm:text-right">
                    {bankInfo.accountHolder}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 border-t border-[#c1c9c0]/60 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="shrink-0 text-[#717971]">Nội dung CK</span>
                <button
                  type="button"
                  onClick={handleCopyTransferNote}
                  className="inline-flex w-full items-start justify-between gap-2 text-left font-semibold text-[#356647] hover:underline sm:max-w-[65%] sm:justify-end sm:text-right"
                  title="Sao chép nội dung CK"
                >
                  <span className="min-w-0 break-all">{transferNote}</span>
                  <Icon className="shrink-0 text-[18px]">content_copy</Icon>
                </button>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-[#717971]">Số tiền</span>
                <span className="font-bold text-[#356647] sm:text-right">{formatMoney(displayAmount)} đ</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default PosTransferQrPage
