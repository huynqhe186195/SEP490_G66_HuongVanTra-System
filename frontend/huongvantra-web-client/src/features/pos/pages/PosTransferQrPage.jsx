import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  fetchPosOrderPaymentStatus,
  fetchPosSepaySetup,
  fetchPosTransferPaymentInfo,
  resolveTransferQrImageUrl,
} from '../services/posApi.js'

const POLL_INTERVAL_MS = 5000

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}

function useQrExpiryCountdown(expiresAtUtc) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!expiresAtUtc) {
      setLabel('')
      return undefined
    }

    const tick = () => {
      const remainingMs = new Date(expiresAtUtc).getTime() - Date.now()
      if (remainingMs <= 0) {
        setLabel('QR đã hết hạn. Quay POS để tạo đơn thanh toán mới.')
        return
      }
      const minutes = Math.floor(remainingMs / 60000)
      const seconds = Math.floor((remainingMs % 60000) / 1000)
      setLabel(`QR hết hạn sau ${minutes}:${String(seconds).padStart(2, '0')}`)
    }

    tick()
    const timerId = setInterval(tick, 1000)
    return () => clearInterval(timerId)
  }, [expiresAtUtc])

  return label
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
  const completedRef = useRef(false)
  const qrExpiryLabel = useQrExpiryCountdown(payment?.qrExpiresAtUtc)
  const isQrExpired = payment?.qrExpiresAtUtc && new Date(payment.qrExpiresAtUtc).getTime() <= Date.now()

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

      navigate('/pos', {
        replace: true,
        state: receipt ? { receipt } : undefined,
      })
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
    if (payment?.transferContent) {
      return payment.transferContent
    }
    return (payment?.orderCode || payment?.orderLabel || '').trim().toUpperCase()
  }, [expectedTransferContent, payment?.transferContent, payment?.orderCode, payment?.orderLabel])

  const displayAmount = expectedAmount > 0 ? expectedAmount : payment?.total || 0

  const qrImageUrl = resolveTransferQrImageUrl({
    qrImageUrl: payment?.qrImageUrl,
    qrPayload: payment?.qrPayload,
  })

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
    payment.transferAccountNumber || bankInfo?.accountNumber || '—'
  const usesSepayVa =
    payment.paymentMode === 'sepay_order_va' || payment.paymentMode === 'sepay_static_va'
  const isLegacyMainAccountQr =
    !usesSepayVa && receiveAccount.replace(/\D/g, '') === (bankInfo?.accountNumber || '').replace(/\D/g, '')
  const statusText = paymentStatusLabel(paymentStatus, isPaid)

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
          <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Thanh toán chuyển khoản · SePay</p>
          <h1 className="mt-1 text-3xl font-bold text-[#356647]">{formatMoney(displayAmount)} đ</h1>
          {payment.orderCode ? <p className="mt-1 text-sm text-[#414942]">Mã đơn: {payment.orderCode}</p> : null}
          {payment.customer ? <p className="mt-0.5 text-xs text-[#717971]">{payment.customer}</p> : null}
          {qrExpiryLabel ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                isQrExpired ? 'text-red-600' : 'text-[#7e5700]'
              }`}
            >
              {qrExpiryLabel}
            </p>
          ) : null}

          <div
            className={`mx-auto mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isPaid ? 'bg-[#356647]/15 text-[#356647]' : 'bg-[#fec25b]/25 text-[#7e5700]'
            }`}
          >
            {!isPaid ? (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#7e5700]" aria-hidden />
            ) : (
              <Icon className="text-[16px]">check_circle</Icon>
            )}
            {statusText}
            {!isPaid ? <span className="font-normal text-[#717971]">· chờ SePay</span> : null}
          </div>

          {invoiceCode ? (
            <p className="mt-2 text-sm font-semibold text-[#356647]">Số HĐ: {invoiceCode}</p>
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

          <p className="text-center text-sm text-[#717971]">
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
            <div className="w-full space-y-3 rounded-xl bg-[#f6f4ec] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#717971]">Ngân hàng</span>
                <span className="font-semibold text-[#1b1c17]">{bankInfo?.bankName || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#717971]">{usesSepayVa ? 'Số VA (chuyển vào đây)' : 'Số tài khoản'}</span>
                <span className="break-all text-right font-semibold text-[#1b1c17]">{receiveAccount}</span>
              </div>
              {usesSepayVa && bankInfo?.accountNumber ? (
                <div className="flex justify-between gap-4 text-xs text-[#717971]">
                  <span>TK gốc (không CK vào)</span>
                  <span>{bankInfo.accountNumber}</span>
                </div>
              ) : null}
              {bankInfo?.accountHolder ? (
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-[#717971]">Chủ tài khoản</span>
                  <span className="text-right font-semibold text-[#1b1c17]">{bankInfo.accountHolder}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-[#c1c9c0]/60 pt-3">
                <span className="text-[#717971]">Nội dung CK</span>
                <button
                  type="button"
                  onClick={handleCopyTransferNote}
                  className="inline-flex max-w-[60%] items-center gap-1 text-right font-semibold text-[#356647] hover:underline"
                  title="Sao chép nội dung CK"
                >
                  <span className="break-all">{transferNote}</span>
                  <Icon className="shrink-0 text-[18px]">content_copy</Icon>
                </button>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#717971]">Số tiền</span>
                <span className="font-bold text-[#356647]">{formatMoney(displayAmount)} đ</span>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[#c1c9c0] p-4">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="flex w-full items-center justify-center rounded-xl border border-[#c1c9c0] bg-white py-3 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec]"
          >
            Quay lại POS
          </button>
        </footer>
      </div>
    </div>
  )
}

export default PosTransferQrPage
