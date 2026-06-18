import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { vietnamNowLabel } from '../../../utils/vietnamDateTime.js'
import { fetchOrder, returnOrder } from '../../orders/services/ordersApi.js'
import { calcReturnLineAmount, calcMembershipDiscountAmount, getOrderPaidRatio, getReturnUnitPrice } from '../../orders/utils/returnPricing.js'
import { fetchOrderTransferQrByOrderId, fetchPosCustomerContext, fetchPosProducts } from '../services/posApi.js'
import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import ReturnOrderSidebar from '../components/ReturnOrderSidebar.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
}

function parseMoneyInput(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function clampQty(value, max) {
  const n = Math.floor(Number(value) || 0)
  return Math.min(Math.max(0, n), max)
}

const RETURN_REASON_OPTIONS = [
  { id: 'DAMAGED', label: 'Sản phẩm bị lỗi / hư hỏng' },
  { id: 'NOT_AS_DESCRIBED', label: 'Sản phẩm không đúng mô tả / hình ảnh' },
  { id: 'WRONG_ITEM', label: 'Giao sai sản phẩm / sai loại / sai quy cách' },
  { id: 'SHIPPING_DAMAGE', label: 'Đóng gói bị hư hỏng khi vận chuyển' },
  { id: 'NEAR_EXPIRY', label: 'Sản phẩm gần hết hạn / kém chất lượng' },
  { id: 'CUSTOMER_CHANGED_MIND', label: 'Khách đổi ý' },
  { id: 'CUSTOMER_ORDERED_WRONG', label: 'Khách mua nhầm / mua dư' },
  { id: 'OTHER', label: 'Lý do khác' },
]

function mapOrderLineToReturnLine(line, paidRatio = 1) {
  const originalQty = Number(line.quantity) || 0
  const alreadyReturned = Number(line.returnedQuantity) || 0
  const remaining = Math.max(0, originalQty - alreadyReturned)
  const listUnitPrice = Number(line.unitPrice) || 0
  return {
    lineId: line.id,
    skuId: line.skuId,
    name: line.skuSnapshotName,
    code: line.skuSnapshotCode || '',
    listUnitPrice,
    unitPrice: getReturnUnitPrice(listUnitPrice, paidRatio),
    originalSoldQty: originalQty,
    soldQty: remaining,
    returnQty: remaining,
  }
}

function ReturnLineTable({ rows, onQtyChange, onRemove, emptyLabel }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center px-4 text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead className="bg-[#f8f9fa] text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-10 px-2 py-2" />
            <th className="px-3 py-2 font-semibold">Hàng hóa</th>
            <th className="w-24 px-3 py-2 text-center font-semibold">SL</th>
            <th className="w-28 px-3 py-2 text-right font-semibold">Giá đã trả</th>
            <th className="w-28 px-3 py-2 text-right font-semibold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lineTotal = row.unitPrice * row.returnQty
            return (
              <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onRemove(row.key)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Xóa dòng"
                  >
                    <Icon className="text-[18px]">delete</Icon>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800">{row.name}</p>
                  {row.code ? <p className="text-xs text-slate-500">{row.code}</p> : null}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={row.maxQty ?? row.returnQty}
                    value={row.returnQty}
                    onChange={(e) => onQtyChange(row.key, clampQty(e.target.value, row.maxQty ?? 999))}
                    className="mx-auto block h-8 w-16 rounded border border-slate-300 text-center text-sm outline-none focus:border-[#356647]"
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.unitPrice)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatMoney(lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReturnOrderPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const exchangeSearchRef = useRef(null)

  const [order, setOrder] = useState(null)
  const [customerContext, setCustomerContext] = useState(null)
  const [returnLines, setReturnLines] = useState([])
  const [exchangeCart, setExchangeCart] = useState([])
  const [returnSearch, setReturnSearch] = useState('')
  const [exchangeSearch, setExchangeSearch] = useState('')
  const [exchangeResults, setExchangeResults] = useState([])
  const [isSearchingExchange, setIsSearchingExchange] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState([])
  const [otherReason, setOtherReason] = useState('')
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [refundTransactionRef, setRefundTransactionRef] = useState('')
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [exchangeOrderDiscountPercent, setExchangeOrderDiscountPercent] = useState(0)
  const [exchangeOrderDiscountAmountFixed, setExchangeOrderDiscountAmountFixed] = useState(0)
  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!orderId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const detail = await fetchOrder(orderId)
        if (!mounted) return
        if (detail.orderStatus !== 'Completed') {
          showError('Chỉ trả hàng trên hóa đơn đã hoàn tất.')
          navigate('/pos', { replace: true })
          return
        }
        const paidRatio = getOrderPaidRatio(detail)
        const lines = detail.items
          .map((line) => mapOrderLineToReturnLine(line, paidRatio))
          .filter((line) => line.soldQty > 0 && line.returnQty > 0)
        if (lines.length === 0) {
          showError('Hóa đơn này đã trả hết hàng, không còn dòng nào để trả.')
          navigate('/pos', { replace: true })
          return
        }
        setOrder(detail)
        setReturnLines(lines)
        if (detail.customerId) {
          fetchPosCustomerContext(detail.customerId)
            .then((context) => {
              if (mounted) setCustomerContext(context)
            })
            .catch(() => {
              if (mounted) setCustomerContext(null)
            })
        } else {
          setCustomerContext(null)
        }
      } catch (error) {
        if (mounted) {
          showError(error.message)
          navigate('/pos', { replace: true })
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  const filteredReturnLines = useMemo(() => {
    const q = returnSearch.trim().toLowerCase()
    const rows = returnLines.map((line) => ({
      ...line,
      key: line.lineId,
      maxQty: line.soldQty,
    }))
    if (!q) return rows
    return rows.filter((line) => {
      const name = String(line.name || '').toLowerCase()
      const code = String(line.code || '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [returnLines, returnSearch])

  const exchangeRows = useMemo(
    () =>
      exchangeCart.map((item) => ({
        ...item,
        key: item.sku,
        unitPrice: Number(item.price) || 0,
        returnQty: item.qty,
        maxQty: 9999,
      })),
    [exchangeCart],
  )

  const tierDiscountPercent = useMemo(() => {
    if (!customerContext || isVipCustomerType(customerContext.customerType)) return 0
    return Number(customerContext.tierDiscountPercent ?? 0)
  }, [customerContext])

  const canUseVipManualAdjustments = isVipCustomerType(customerContext?.customerType)
  const usesFixedExchangeOrderDiscount =
    canUseVipManualAdjustments && (exchangeOrderDiscountAmountFixed || 0) > 0

  useEffect(() => {
    if (!canUseVipManualAdjustments) {
      setExchangeOrderDiscountPercent(0)
      setExchangeOrderDiscountAmountFixed(0)
    }
  }, [canUseVipManualAdjustments])

  const paidRatio = useMemo(() => getOrderPaidRatio(order), [order])

  const totals = useMemo(() => {
    const returnOriginalTotal = returnLines.reduce(
      (sum, line) => sum + line.listUnitPrice * line.returnQty,
      0,
    )
    const returnItemsTotal = returnLines.reduce(
      (sum, line) => sum + calcReturnLineAmount(line.listUnitPrice, line.returnQty, paidRatio),
      0,
    )
    const returnDiscount = Math.max(0, returnOriginalTotal - returnItemsTotal)
    const returnFee = 0
    const returnNetTotal = returnItemsTotal + returnFee

    const purchaseItemsTotal = exchangeCart.reduce((sum, item) => sum + item.price * item.qty, 0)
    const membershipDiscountAmount = calcMembershipDiscountAmount(purchaseItemsTotal, tierDiscountPercent)
    let manualExchangeDiscountAmount = 0
    if (canUseVipManualAdjustments && purchaseItemsTotal > 0) {
      if (usesFixedExchangeOrderDiscount) {
        manualExchangeDiscountAmount = Math.min(purchaseItemsTotal, exchangeOrderDiscountAmountFixed)
      } else if (exchangeOrderDiscountPercent > 0) {
        manualExchangeDiscountAmount = Math.round(
          (purchaseItemsTotal * exchangeOrderDiscountPercent) / 100,
        )
      }
    }
    const purchaseDiscount = membershipDiscountAmount + manualExchangeDiscountAmount
    const purchaseNetTotal = Math.max(0, purchaseItemsTotal - purchaseDiscount)

    const customerOwes = purchaseNetTotal - returnNetTotal
    return {
      returnOriginalTotal,
      returnItemsTotal,
      returnDiscount,
      returnFee,
      returnNetTotal,
      purchaseItemsTotal,
      purchaseDiscount,
      membershipDiscountAmount,
      manualExchangeDiscountAmount,
      tierDiscountPercent,
      tierCode: customerContext?.tierCode ?? '',
      purchaseNetTotal,
      customerOwes,
    }
  }, [
    returnLines,
    exchangeCart,
    paidRatio,
    tierDiscountPercent,
    customerContext?.tierCode,
    canUseVipManualAdjustments,
    exchangeOrderDiscountPercent,
    exchangeOrderDiscountAmountFixed,
    usesFixedExchangeOrderDiscount,
  ])

  useEffect(() => {
    const owed = Math.max(0, totals.customerOwes)
    setAmountPaidInput(owed > 0 ? String(Math.round(owed)) : '')
    if (totals.customerOwes < 0) {
      setPaymentMethod('CASH')
    }
  }, [totals.customerOwes])

  const selectedReasonLabels = useMemo(
    () =>
      RETURN_REASON_OPTIONS
        .filter((option) => selectedReasons.includes(option.id))
        .map((option) => option.label),
    [selectedReasons],
  )

  const hasOtherReason = selectedReasons.includes('OTHER')

  const toggleReturnReason = (reasonId) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId) ? prev.filter((item) => item !== reasonId) : [...prev, reasonId],
    )
    if (reasonId === 'OTHER' && hasOtherReason) {
      setOtherReason('')
    }
  }

  function buildReturnNote() {
    const parts = []
    if (note.trim()) parts.push(note.trim())
    if (totals.customerOwes < 0 && paymentMethod === 'TRANSFER' && refundTransactionRef.trim()) {
      parts.push(`Mã GD hoàn: ${refundTransactionRef.trim()}`)
    }
    return parts.join(' | ') || null
  }

  const searchExchangeProducts = useCallback(async (term) => {
    const q = term.trim()
    if (!q) {
      setExchangeResults([])
      return
    }
    setIsSearchingExchange(true)
    try {
      const products = await fetchPosProducts({ search: q, limit: 12 })
      setExchangeResults(Array.isArray(products) ? products : [])
    } catch {
      setExchangeResults([])
    } finally {
      setIsSearchingExchange(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => searchExchangeProducts(exchangeSearch), 300)
    return () => window.clearTimeout(timer)
  }, [exchangeSearch, searchExchangeProducts])

  const addExchangeProduct = (product) => {
    const sku = product.sku ?? product.id
    setExchangeCart((prev) => {
      const existing = prev.find((item) => item.sku === sku)
      if (existing) {
        return prev.map((item) => (item.sku === sku ? { ...item, qty: item.qty + 1 } : item))
      }
      return [
        ...prev,
        {
          sku,
          skuId: product.productId,
          name: product.name,
          code: product.sku || '',
          price: Number(product.price) || 0,
          qty: 1,
        },
      ]
    })
    setExchangeSearch('')
    setExchangeResults([])
    exchangeSearchRef.current?.focus()
  }

  const updateReturnQty = (key, qty) => {
    setReturnLines((prev) => prev.map((line) => (line.lineId === key ? { ...line, returnQty: qty } : line)))
  }

  const removeReturnLine = (key) => {
    setReturnLines((prev) => prev.filter((line) => line.lineId !== key))
  }

  const updateExchangeQty = (key, qty) => {
    if (qty <= 0) {
      setExchangeCart((prev) => prev.filter((item) => item.sku !== key))
      return
    }
    setExchangeCart((prev) => prev.map((item) => (item.sku === key ? { ...item, qty } : item)))
  }

  const removeExchangeLine = (key) => {
    setExchangeCart((prev) => prev.filter((item) => item.sku !== key))
  }

  const canSubmit = returnLines.some((line) => line.returnQty > 0)

  const handleSubmit = async () => {
    if (!canSubmit) {
      showError('Chọn ít nhất một dòng hàng để trả.')
      return
    }

    if (selectedReasons.length === 0) {
      showError('Vui lòng chọn ít nhất một lý do trả/đổi hàng.')
      return
    }

    if (hasOtherReason && otherReason.trim().length < 10) {
      showError('Vui lòng nhập lý do khác ít nhất 10 ký tự.')
      return
    }

    const payExtra = totals.customerOwes > 0
    if (payExtra && paymentMethod === 'CASH') {
      const paid = parseMoneyInput(amountPaidInput)
      if (paid + 0.01 < totals.customerOwes) {
        showError(`Khách cần trả thêm ${formatMoney(Math.round(totals.customerOwes))} đ tại quầy.`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const result = await returnOrder(order.id, {
        items: returnLines
          .filter((line) => line.returnQty > 0)
          .map((line) => ({
            orderDetailId: line.lineId,
            returnQuantity: line.returnQty,
          })),
        paymentMethod,
        customerPaidAmount:
          totals.customerOwes > 0 && paymentMethod === 'CASH' ? parseMoneyInput(amountPaidInput) : 0,
        exchangeItems: exchangeCart.map((item) => ({
          skuId: item.skuId,
          skuSnapshotName: item.name,
          skuSnapshotCode: item.code || null,
          quantity: item.qty,
          unitPrice: item.price,
        })),
        exchangeManualDiscount: totals.manualExchangeDiscountAmount,
        note: buildReturnNote(),
        reasons: selectedReasonLabels,
        otherReason: hasOtherReason ? otherReason : null,
      })

      const refund = Number(result?.refundAmount || 0)
      const exchangeCode = result?.exchangeOrderCode
      const exchangeOrderId = result?.exchangeOrderId
      const payExtra = totals.customerOwes > 0

      if (payExtra && paymentMethod === 'TRANSFER' && exchangeOrderId) {
        const qrAmount = Math.round(totals.customerOwes)
        const qrInfo = await fetchOrderTransferQrByOrderId(exchangeOrderId)
        showSuccess(
          `Phiếu trả ${result.returnCode} · quét QR ${formatMoney(qrAmount)} đ cho đơn đổi ${exchangeCode}.`,
        )
        navigate('/pos/payment/qr', {
          state: {
            orderId: exchangeOrderId,
            orderCode: exchangeCode,
            orderLabel: `${result.returnCode} · ${exchangeCode}`,
            total: qrAmount,
            qrPayload: qrInfo.qrPayload,
            qrImageUrl: qrInfo.qrImageUrl,
            transferContent: qrInfo.transferContent || exchangeCode,
            transferAccountNumber: qrInfo.transferAccountNumber,
            paymentMode: qrInfo.paymentMode,
            qrExpiresAtUtc: qrInfo.qrExpiresAtUtc,
            customer: order.customerSnapshotName || '',
            paymentMethod: 'TRANSFER',
          },
        })
        return
      }

      if (exchangeOrderId) {
        showSuccess(
          refund > 0
            ? `Trả hàng ${result.returnCode}: hoàn ${formatMoney(refund)} đ · đơn đổi ${exchangeCode}.`
            : `Trả hàng ${result.returnCode} · đơn đổi ${exchangeCode}.`,
        )
        navigate('/orders/exchange?tab=exchange')
        return
      }

      showSuccess(
        refund > 0
          ? `Phiếu ${result.returnCode}: hoàn ${formatMoney(refund)} đ cho khách.`
          : `Phiếu ${result.returnCode} đã lưu.`,
      )
      navigate('/orders/exchange?tab=returns')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f6f4ec] text-slate-600">
        Đang tải hóa đơn...
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 bg-[#f6f4ec]">
        <p className="text-slate-600">Không tìm thấy hóa đơn.</p>
        <Link to="/pos" className="text-[#356647] hover:underline">
          Về POS
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#f6f4ec]">
      <header className="shrink-0 border-b border-[#c1c9c0]/60 bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#356647] hover:bg-[#356647]/10"
          >
            <Icon className="text-[18px]">arrow_back</Icon>
            POS
          </button>

          <div className="relative min-w-[200px] flex-1">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</Icon>
            <input
              type="text"
              placeholder="Tìm hàng trả (F3)"
              value={returnSearch}
              onChange={(e) => setReturnSearch(e.target.value)}
              className="w-full rounded-full border border-slate-300 bg-[#f8f9fa] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#356647]"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[#356647] bg-[#356647]/5 px-3 py-1.5 text-sm font-semibold text-[#356647]">
            <Icon className="text-[18px]">assignment_return</Icon>
            Trả hàng
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-[1_1_45%] flex-col border-b border-[#c1c9c0] bg-white">
            <div className="shrink-0 border-b border-slate-100 bg-[#f8f9fa] px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Hàng trả</p>
            </div>
            <CustomScrollArea className="min-h-0 flex-1">
              <ReturnLineTable
                rows={filteredReturnLines}
                onQtyChange={updateReturnQty}
                onRemove={removeReturnLine}
                emptyLabel="Không có hàng trả. Thêm từ hóa đơn gốc hoặc đổi bộ lọc tìm kiếm."
              />
            </CustomScrollArea>
          </section>

          <section className="flex min-h-0 flex-[1_1_55%] flex-col bg-white">
            <div className="shrink-0 bg-[#538463] px-3 py-2">
              <div className="relative">
                <input
                  ref={exchangeSearchRef}
                  type="text"
                  placeholder="Tìm hàng đổi / mua thêm..."
                  value={exchangeSearch}
                  onChange={(e) => setExchangeSearch(e.target.value)}
                  className="w-full rounded border-0 bg-white py-2 pl-3 pr-10 text-sm outline-none ring-2 ring-transparent focus:ring-white/40"
                />
                <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-500">
                  barcode_scanner
                </Icon>
              </div>
              {exchangeSearch.trim() ? (
                <CustomScrollArea className="mt-2 rounded bg-white shadow-lg" contentClassName="max-h-40">
                  {isSearchingExchange ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Đang tìm...</p>
                  ) : exchangeResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Không tìm thấy sản phẩm.</p>
                  ) : (
                    exchangeResults.map((product) => (
                      <button
                        key={product.sku ?? product.id}
                        type="button"
                        onClick={() => addExchangeProduct(product)}
                        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-0"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-800">{product.name}</span>
                        <span className="shrink-0 font-semibold text-[#356647]">{formatMoney(product.price)}</span>
                      </button>
                    ))
                  )}
                </CustomScrollArea>
              ) : null}
            </div>
            <CustomScrollArea className="min-h-0 flex-1">
              <ReturnLineTable
                rows={exchangeRows}
                onQtyChange={updateExchangeQty}
                onRemove={removeExchangeLine}
                emptyLabel="Tìm và thêm hàng đổi / mua thêm ở thanh tìm kiếm phía trên."
              />
            </CustomScrollArea>
          </section>

          <section className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Lý do trả/đổi hàng</p>
              <span className="text-[11px] text-slate-500">Bắt buộc</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {RETURN_REASON_OPTIONS.map((reason) => {
                const selected = selectedReasons.includes(reason.id)
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => toggleReturnReason(reason.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                      selected
                        ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                        : 'border-slate-200 bg-[#fbf9f1] text-slate-600 hover:border-[#356647]/40'
                    }`}
                  >
                    {reason.label}
                  </button>
                )
              })}
            </div>
            {hasOtherReason ? (
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={300}
                placeholder="Nhập lý do khác, ít nhất 10 ký tự..."
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#356647]"
              />
            ) : null}
          </section>

          <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Icon className="text-[18px] text-slate-400">edit_note</Icon>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú (VD: thu hồi/giao qua ship, bưu điện, địa chỉ...)"
                className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </div>

        <ReturnOrderSidebar
          customerName={order.customerSnapshotName}
          customerPhone=""
          createdAtLabel={vietnamNowLabel()}
          sourceOrderCode={order.orderCode}
          returnOriginalTotal={totals.returnOriginalTotal}
          returnItemsTotal={totals.returnItemsTotal}
          returnDiscount={totals.returnDiscount}
          returnFee={totals.returnFee}
          returnNetTotal={totals.returnNetTotal}
          purchaseItemsTotal={totals.purchaseItemsTotal}
          purchaseDiscount={totals.purchaseDiscount}
          membershipDiscountAmount={totals.membershipDiscountAmount}
          manualExchangeDiscountAmount={totals.manualExchangeDiscountAmount}
          tierDiscountPercent={totals.tierDiscountPercent}
          tierCode={totals.tierCode}
          purchaseNetTotal={totals.purchaseNetTotal}
          customerOwes={totals.customerOwes}
          amountPaid={amountPaidInput}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          onAmountPaidChange={setAmountPaidInput}
          refundTransactionRef={refundTransactionRef}
          onRefundTransactionRefChange={setRefundTransactionRef}
          canUseVipManualAdjustments={canUseVipManualAdjustments}
          exchangeOrderDiscountPercent={exchangeOrderDiscountPercent}
          usesFixedExchangeOrderDiscount={usesFixedExchangeOrderDiscount}
          onExchangeOrderDiscountPercentChange={(value) => {
            const pct = Math.min(100, Math.max(0, Number(value) || 0))
            setExchangeOrderDiscountPercent(pct)
            if (pct > 0) setExchangeOrderDiscountAmountFixed(0)
          }}
          onOpenExchangeOfferModal={() => setOfferModalOpen(true)}
          formatMoney={formatMoney}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
          onSubmit={handleSubmit}
        />

        <OrderOfferModal
          isOpen={offerModalOpen}
          onClose={() => setOfferModalOpen(false)}
          initialPercent={exchangeOrderDiscountPercent}
          initialFixedAmount={exchangeOrderDiscountAmountFixed}
          maxFixedAmount={totals.purchaseItemsTotal}
          onConfirm={({ percent, fixedAmount, warning }) => {
            setExchangeOrderDiscountPercent(percent)
            setExchangeOrderDiscountAmountFixed(fixedAmount)
            if (warning) showError(warning)
          }}
        />
      </div>
    </div>
  )
}

export default ReturnOrderPage
