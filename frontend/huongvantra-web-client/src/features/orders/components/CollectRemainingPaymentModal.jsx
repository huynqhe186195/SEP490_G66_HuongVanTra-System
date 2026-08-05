import { useCallback, useEffect, useRef, useState } from 'react'
import { formatVnd, formatVndInput, parseVndInput } from '../../../utils/vietnamCurrency.js'
import {
  fetchOrderRemainingPaymentStatus,
  fetchOrderRemainingQr,
  refreshOrderRemainingQr,
  resolveTransferQrImageUrl,
} from '../../pos/services/posApi.js'
import { isQrExpired, useQrExpiryCountdown } from '../../pos/utils/qrExpiry.js'

const METHODS = [
  { value: 'Cash', label: 'Tiền mặt', icon: 'payments' },
  { value: 'VietQR', label: 'Chuyển khoản QR', icon: 'qr_code_2' },
]

const POLL_INTERVAL_MS = 3000
const QR_EXPIRED_MESSAGE = 'Mã QR đã hết hạn. Bấm「Tạo mã QR mới」để khách quét lại.'

export default function CollectRemainingPaymentModal({
  isOpen,
  order,
  remainingAmount = 0,
  isSubmitting = false,
  onClose,
  onConfirm,
  onPaid,
}) {
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [amountInput, setAmountInput] = useState('')
  const [qrData, setQrData] = useState(null)
  const [qrError, setQrError] = useState('')
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const paidRef = useRef(false)

  const isTransfer = paymentMethod !== 'Cash'
  const orderId = order?.id ?? null

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('Cash')
      setAmountInput('')
      setQrData(null)
      setQrError('')
      paidRef.current = false
    }
  }, [isOpen])

  // Chỉ tạo QR khi thu ngân thực sự chọn chuyển khoản — tránh sinh Payment thừa.
  useEffect(() => {
    if (!isOpen || !isTransfer || !orderId) return
    let cancelled = false
    setIsLoadingQr(true)
    setQrError('')
    fetchOrderRemainingQr(orderId)
      .then((qr) => {
        if (!cancelled) setQrData(qr)
      })
      .catch((error) => {
        if (!cancelled) setQrError(error?.message || 'Không tạo được mã QR.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQr(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, isTransfer, orderId])

  const pollStatus = useCallback(async () => {
    if (!orderId || paidRef.current) return
    try {
      const status = await fetchOrderRemainingPaymentStatus(orderId)
      if (status.isPaid) {
        paidRef.current = true
        onPaid?.(status)
      }
    } catch {
      // Lỗi mạng tạm thời — vòng poll kế tiếp sẽ thử lại.
    }
  }, [orderId, onPaid])

  useEffect(() => {
    if (!isOpen || !isTransfer || !orderId) return undefined
    pollStatus()
    const timerId = setInterval(pollStatus, POLL_INTERVAL_MS)
    return () => clearInterval(timerId)
  }, [isOpen, isTransfer, orderId, pollStatus])

  const qrExpired = isQrExpired(qrData?.qrExpiresAtUtc, qrData?.isExpired)
  const qrExpiryLabel = useQrExpiryCountdown(qrData?.qrExpiresAtUtc, qrExpired, QR_EXPIRED_MESSAGE)

  async function handleRefreshQr() {
    if (!orderId || isRefreshing) return
    setIsRefreshing(true)
    setQrError('')
    try {
      setQrData(await refreshOrderRemainingQr(orderId))
    } catch (error) {
      setQrError(error?.message || 'Không tạo được mã QR mới.')
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!isOpen) return null

  const due = Number(remainingAmount) || 0
  // Chuyển khoản: khách quét mã đúng số còn nợ, không có tiền thừa.
  const amount = isTransfer ? due : parseVndInput(amountInput) ?? due
  const isAmountValid = amount >= due
  const changeAmount = Math.max(0, amount - due)

  const qrImageUrl = qrData ? resolveTransferQrImageUrl(qrData) : ''
  const canConfirm = isAmountValid && !isTransfer

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="collect-remaining-title"
      >
        <header className="shrink-0 border-b border-[#f0eee6] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">
            Đơn {order?.orderCode || ''}
          </p>
          <h2 id="collect-remaining-title" className="mt-1 text-xl font-bold text-[#1b1c17]">
            Thu tiền còn lại &amp; giao hàng
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-[#f0eee6] bg-[#fbf9f1] p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#717971]">Tổng đơn</span>
              <span className="font-semibold tabular-nums text-[#1b1c17]">
                {formatVnd(order?.finalAmount ?? 0)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[#717971]">Đã đặt cọc</span>
              <span className="font-semibold tabular-nums text-[#356647]">
                {formatVnd(order?.depositAmount ?? 0)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-[#e4e3db] pt-1.5">
              <span className="font-bold text-[#1b1c17]">Còn phải thu</span>
              <span className="text-lg font-bold tabular-nums text-[#7e5700]">{formatVnd(due)}</span>
            </div>
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#717971]">Hình thức thanh toán</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {METHODS.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setPaymentMethod(method.value)}
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50 ${
                  paymentMethod === method.value
                    ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                    : 'border-[#c1c9c0] bg-white text-[#414942] hover:bg-[#f6f4ec]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{method.icon}</span>
                {method.label}
              </button>
            ))}
          </div>

          {!isTransfer ? (
            <>
              <label htmlFor="collect-remaining-amount" className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#717971]">
                Số tiền khách trả
              </label>
              <input
                id="collect-remaining-amount"
                type="text"
                inputMode="numeric"
                value={amountInput === '' ? formatVndInput(due) : formatVndInput(amountInput)}
                onChange={(event) => setAmountInput(event.target.value)}
                disabled={isSubmitting}
                className="mt-1.5 w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-right text-2xl font-bold tabular-nums outline-none focus:border-[#356647] disabled:opacity-50"
              />
              {!isAmountValid ? (
                <p className="mt-1.5 text-xs font-semibold text-[#7e5700]">
                  Số tiền phải tối thiểu {formatVnd(due)}.
                </p>
              ) : changeAmount > 0 ? (
                <p className="mt-1.5 text-xs font-semibold text-[#414942]">
                  Tiền thừa trả khách: {formatVnd(changeAmount)}
                </p>
              ) : null}
            </>
          ) : null}

          {isTransfer ? (
            <div className="mt-4 rounded-xl border border-[#356647]/25 bg-[#356647]/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#356647]">
                Khách quét mã để chuyển khoản
              </p>
              <p className="mt-1 text-xs text-[#414942]">
                Hệ thống tự kiểm tra mỗi 3 giây và hoàn tất đơn ngay khi tiền về.
              </p>

              {isLoadingQr ? (
                <p className="mt-4 text-center text-sm text-[#717971]">Đang tạo mã QR…</p>
              ) : qrError ? (
                <p className="mt-3 text-xs font-semibold text-[#7e5700]">{qrError}</p>
              ) : qrImageUrl ? (
                <>
                  <div className="mt-3 flex justify-center">
                    {qrExpired ? (
                      <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#c1c9c0] bg-white px-4 text-center">
                        <span className="material-symbols-outlined text-[40px] text-[#7e5700]">timer_off</span>
                        <p className="text-xs font-semibold text-[#7e5700]">
                          Mã QR đã hết hạn. Vui lòng tạo mã mới cho khách quét.
                        </p>
                      </div>
                    ) : (
                      <img
                        src={qrImageUrl}
                        alt="Mã VietQR thanh toán phần còn lại"
                        className="h-56 w-56 rounded-xl border border-[#c1c9c0] bg-white object-contain p-1"
                      />
                    )}
                  </div>
                  {qrExpiryLabel ? (
                    <p
                      className={`mt-2 text-center text-xs font-bold ${
                        qrExpired ? 'text-[#7e5700]' : 'text-[#356647]'
                      }`}
                    >
                      {qrExpiryLabel}
                    </p>
                  ) : null}
                  {qrExpired ? (
                    <button
                      type="button"
                      onClick={handleRefreshQr}
                      disabled={isRefreshing}
                      className="mt-2 w-full rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {isRefreshing ? 'Đang tạo…' : 'Tạo mã QR mới'}
                    </button>
                  ) : null}
                  <div className="mt-3 space-y-1 text-xs text-[#414942]">
                    <p>
                      Số tài khoản:{' '}
                      <span className="font-semibold tabular-nums text-[#1b1c17]">
                        {qrData?.transferAccountNumber || '—'}
                      </span>
                    </p>
                    <p>
                      Số tiền: <span className="font-bold text-[#7e5700]">{formatVnd(due)}</span>
                    </p>
                    <p>
                      Nội dung:{' '}
                      <span className="font-semibold text-[#1b1c17]">{qrData?.transferContent || ''}</span>
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#f0eee6] bg-[#fbf9f1] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
          >
            {isTransfer ? 'Đóng' : 'Huỷ'}
          </button>
          {!isTransfer ? (
            <button
              type="button"
              onClick={() => onConfirm({ paymentMethod, amount, transactionRef: null })}
              disabled={isSubmitting || !canConfirm}
              className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận thu & giao hàng'}
            </button>
          ) : (
            <span className="self-center text-xs font-semibold text-[#356647]">
              Đang chờ khách chuyển khoản…
            </span>
          )}
        </footer>
      </div>
    </div>
  )
}
