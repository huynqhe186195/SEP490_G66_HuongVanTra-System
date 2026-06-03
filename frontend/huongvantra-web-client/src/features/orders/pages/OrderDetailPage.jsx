import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { canAccessModule, canConfirmStockDeduct, canViewStockDeductOps } from '../../../app/navigation.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  applyOrderCoupon,
  confirmCodCompleted,
  confirmOrderPayment,
  fetchOrder,
  fetchOrderAccess,
  fetchOrderPaymentQr,
  fetchOrderPaymentStatus,
  markCodReminded,
  rejectCodOrder,
  updateOrderAdjustments,
  updateOrderItems,
  updateOrderStatus,
} from '../services/ordersApi.js'
import { fetchPosProducts, resolvePosStoreId, resolveTransferQrImageUrl } from '../../pos/services/posApi.js'
import { formatPromotionLabel } from '../../pos/utils/posPromotionUtils.js'
import StockDeductPreviewModal from '../../inventory/components/StockDeductPreviewModal.jsx'
import {
  canConfirmCod,
  canEditOrderItems,
  formatVnd,
  getOrderChannelLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  getQueueStatusLabel,
  getStockStatusClass,
  getStockStatusLabel,
  isCodOrder,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  STOCK_STATUS_OPTIONS,
} from '../utils/orderDisplay.js'

const EDIT_ORDER_STATUS_OPTIONS = ORDER_STATUS_OPTIONS.filter((o) => o.value)
const EDIT_PAYMENT_STATUS_OPTIONS = PAYMENT_STATUS_OPTIONS.filter((o) => o.value)
const PAYMENT_POLL_INTERVAL_MS = 5000

function OrderDetailPage() {
  const { id } = useParams()
  const canManageCod = canAccessModule(loadAuthSession(), 'cod_ops')
  const canViewStockDeduct = canViewStockDeductOps(loadAuthSession())
  const canExecuteStockDeduct = canConfirmStockDeduct(loadAuthSession())
  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [orderAccess, setOrderAccess] = useState({ canEdit: true, mode: 'All' })

  const [orderStatus, setOrderStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [manualDiscount, setManualDiscount] = useState('')
  const [deductAmount, setDeductAmount] = useState('')

  const [editLines, setEditLines] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [paymentQr, setPaymentQr] = useState(null)
  const [isLoadingPaymentQr, setIsLoadingPaymentQr] = useState(false)
  const [paymentQrCooldownUntil, setPaymentQrCooldownUntil] = useState(0)
  const [paymentPollError, setPaymentPollError] = useState('')
  const paymentConfirmedRef = useRef(false)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const [stockPreviewOpen, setStockPreviewOpen] = useState(false)

  const canEditOrder = orderAccess.canEdit !== false
  const itemsEditable = useMemo(
    () => canEditOrder && canEditOrderItems(order),
    [order, canEditOrder],
  )

  const syncEditLinesFromOrder = (data) => {
    setEditLines(
      (data?.items ?? []).map((item, index) => ({
        key: `${item.productId}-${item.isGift ? 1 : 0}-${item.id ?? index}`,
        productId: item.productId,
        productName: item.productName || item.productSku,
        productSku: item.productSku,
        unitPrice: Number(item.unitPrice ?? 0),
        quantity: Number(item.quantity ?? 0),
        isGift: Boolean(item.isGift),
      })),
    )
  }

  const syncForm = (data) => {
    setOrderStatus(String(data.orderStatus || '').toLowerCase())
    setPaymentStatus(String(data.paymentStatus || '').toLowerCase())
    setStockStatus(String(data.stockStatus || '').toLowerCase())
    setNotes(data.notes || '')
    setShippingAddress(data.shippingAddress || '')
    setManualDiscount(String(data.manualDiscount ?? ''))
    setDeductAmount(String(data.deductAmount ?? ''))
    setPromoCodeInput(data.promotion?.promoCode || '')
  }

  const loadOrder = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await fetchOrder(id)
      setOrder(data)
      syncForm(data)
      syncEditLinesFromOrder(data)
      setPaymentQr(null)
      setPaymentQrCooldownUntil(0)
    } catch (error) {
      setOrder(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const refreshOrderAfterPayment = useCallback(async (invoiceCode) => {
    if (!id) return
    try {
      const data = await fetchOrder(id)
      setOrder(data)
      syncForm(data)
      syncEditLinesFromOrder(data)
      setPaymentQr(null)
      setPaymentQrCooldownUntil(0)
      showSuccess(
        invoiceCode
          ? `Khách đã thanh toán · Số HĐ: ${invoiceCode}`
          : 'Khách đã thanh toán. Đơn đã được cập nhật tự động.',
      )
    } catch (error) {
      showError(error.message)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    let mounted = true
    fetchOrderAccess()
      .then((access) => {
        if (mounted) setOrderAccess(access)
      })
      .catch(() => {
        if (mounted) setOrderAccess({ canEdit: true, mode: 'All' })
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!itemsEditable) {
      setProductResults([])
      return undefined
    }

    const term = productSearch.trim()
    if (term.length < 2) {
      setProductResults([])
      return undefined
    }

    const storeId = order?.storeId > 0 ? order.storeId : resolvePosStoreId()
    const timer = setTimeout(async () => {
      setIsSearchingProducts(true)
      try {
        const items = await fetchPosProducts({ storeId, search: term, limit: 12 })
        setProductResults(items)
      } catch {
        setProductResults([])
      } finally {
        setIsSearchingProducts(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [productSearch, itemsEditable, order?.storeId])

  const handleAddProduct = (product) => {
    setEditLines((prev) => {
      const existing = prev.find((line) => line.productId === product.productId && !line.isGift)
      if (existing) {
        return prev.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...prev,
        {
          key: `new-${product.productId}-0-${Date.now()}`,
          productId: product.productId,
          productName: product.name,
          productSku: product.sku,
          unitPrice: product.price,
          quantity: 1,
          isGift: false,
        },
      ]
    })
    setProductSearch('')
    setProductResults([])
  }

  const handleLineQtyChange = (key, rawQty) => {
    const qty = Math.max(0, Number(rawQty) || 0)
    setEditLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: qty } : line)),
    )
  }

  const handleRemoveLine = (key) => {
    setEditLines((prev) => prev.filter((line) => line.key !== key))
  }

  const handleSaveItems = async () => {
    if (!order?.id) return
    const lines = editLines.filter((line) => line.quantity > 0)
    if (lines.length === 0) {
      showError('Đơn phải có ít nhất một dòng sản phẩm.')
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateOrderItems(order.id, lines)
      setOrder(updated)
      syncForm(updated)
      syncEditLinesFromOrder(updated)
      setPaymentQr(null)
      setPaymentQrCooldownUntil(0)
      showSuccess('Đã cập nhật sản phẩm. Bấm xem QR — hệ thống chỉ tạo VA mới khi tổng tiền đổi.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadPaymentQr = async (force = false) => {
    if (!order?.id) return
    if (!force && paymentQrCooldownUntil > Date.now()) {
      showError('Vui lòng đợi vài giây trước khi tạo lại QR.')
      return
    }

    setIsLoadingPaymentQr(true)
    try {
      const qr = await fetchOrderPaymentQr(order.id, { force })
      setPaymentQr(qr)
      setPaymentQrCooldownUntil(Date.now() + 30_000)
      if (qr.createdNewVa) {
        showSuccess('Đã tạo VA thanh toán mới cho đơn.')
      }
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoadingPaymentQr(false)
    }
  }

  const paymentQrOnCooldown = paymentQrCooldownUntil > Date.now()

  const handleSaveStatus = async () => {
    if (!order?.id) return
    setIsSaving(true)
    try {
      const updated = await updateOrderStatus(order.id, {
        orderStatus,
        paymentStatus,
        stockStatus,
      })
      setOrder(updated)
      syncForm(updated)
      showSuccess('Đã cập nhật trạng thái đơn.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAdjustments = async () => {
    if (!order?.id) return

    const parsedManual = manualDiscount === '' ? null : Number(manualDiscount)
    if (parsedManual !== null) {
      if (parsedManual < 0) {
        showError('Chiết khấu thủ công không được âm.')
        return
      }
      const subtotal = Number(order.subTotal ?? 0)
      if (parsedManual > subtotal) {
        showError('Chiết khấu thủ công không được vượt tạm tính đơn hàng.')
        return
      }
    }

    setIsSaving(true)
    try {
      const updated = await updateOrderAdjustments(order.id, {
        manualDiscount: parsedManual === null ? undefined : parsedManual,
        deductAmount: deductAmount === '' ? undefined : Number(deductAmount),
        notes,
        shippingAddress,
      })
      setOrder(updated)
      syncForm(updated)
      showSuccess('Đã cập nhật thông tin đơn.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const runCodAction = async (action) => {
    if (!order?.id) return
    setIsSaving(true)
    try {
      if (action === 'confirm') {
        await confirmCodCompleted(order.id)
        showSuccess('Đã xác nhận giao hàng và thu tiền.')
      } else if (action === 'remind') {
        await markCodReminded(order.id)
        showSuccess('Đã đánh dấu đã nhắc khách.')
      } else if (action === 'reject') {
        const reason = window.prompt('Lý do khách từ chối nhận (tuỳ chọn):') ?? ''
        if (reason === null) {
          setIsSaving(false)
          return
        }
        await rejectCodOrder(order.id, reason)
        showSuccess('Đã hủy đơn COD.')
      }
      await loadOrder()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!order?.id) return
    setIsSaving(true)
    try {
      await confirmOrderPayment(order.id)
      showSuccess('Đã xác nhận thanh toán.')
      await loadOrder()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyPromoCode = async () => {
    if (!order?.id) return
    const code = promoCodeInput.trim()
    if (!code) {
      showError('Vui lòng nhập mã giảm giá.')
      return
    }

    setIsApplyingPromo(true)
    try {
      const updated = await applyOrderCoupon(order.id, code)
      setOrder(updated)
      syncForm(updated)
      setPromoCodeInput(updated.promotion?.promoCode || code.toUpperCase())
      showSuccess(`Đã áp dụng mã ${updated.promotion?.promoCode || code}.`)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsApplyingPromo(false)
    }
  }

  const cod = order && isCodOrder(order)
  const showCodActions = order && cod && canManageCod && canConfirmCod(order)
  const canConfirmPayment =
    canEditOrder &&
    order &&
    !cod &&
    String(order.paymentStatus).toLowerCase() !== 'paid' &&
    String(order.orderStatus).toLowerCase() !== 'cancelled'

  const canApplyCoupon =
    canEditOrder &&
    order &&
    String(order.paymentStatus).toLowerCase() !== 'paid' &&
    String(order.orderStatus).toLowerCase() !== 'cancelled'

  const paymentMethodKey = String(order?.paymentMethod || '').toUpperCase()
  const needsTransferQr = paymentMethodKey === 'VIETQR' || paymentMethodKey === 'TRANSFER'
  const shouldPollTransferPayment =
    Boolean(order?.id) &&
    canConfirmPayment &&
    needsTransferQr &&
    Boolean(paymentQr)

  useEffect(() => {
    paymentConfirmedRef.current = false
  }, [order?.id])

  useEffect(() => {
    if (!shouldPollTransferPayment || paymentConfirmedRef.current) {
      return undefined
    }

    const poll = async () => {
      if (!order?.id || paymentConfirmedRef.current) return

      try {
        const status = await fetchOrderPaymentStatus(order.id)
        setPaymentPollError('')

        if (status.isPaid) {
          paymentConfirmedRef.current = true
          await refreshOrderAfterPayment(status.invoiceCode)
        }
      } catch (error) {
        setPaymentPollError(error.message || 'Không kiểm tra được trạng thái thanh toán.')
      }
    }

    poll()
    const timerId = setInterval(poll, PAYMENT_POLL_INTERVAL_MS)
    return () => clearInterval(timerId)
  }, [order?.id, refreshOrderAfterPayment, shouldPollTransferPayment])

  const paymentQrImageUrl = paymentQr
    ? resolveTransferQrImageUrl({
        qrImageUrl: paymentQr.qrImageUrl,
        qrPayload: paymentQr.qrPayload,
      })
    : ''

  const queueStatus = String(order?.stockDeductQueue?.status || '').toLowerCase()
  const canOpenStockPreview =
    canViewStockDeduct &&
    order?.stockDeductQueue &&
    (queueStatus === 'waiting' || queueStatus === 'insufficient')
  const canExecuteStockOnOrder = canOpenStockPreview && canExecuteStockDeduct
  const showStockDeductBlock =
    order?.stockDeductQueue ||
    ['pending_deduct', 'waiting_stock'].includes(String(order?.stockStatus || '').toLowerCase())

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto sm:gap-6">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            Chi tiết đơn {order?.orderCode ? `#${order.orderCode}` : id ? `#${id}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chỉnh sửa trạng thái và ghi chú. Tạo đơn mới tại{' '}
            <Link className="font-semibold text-[#538463] hover:underline" to="/pos">
              POS
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            to="/orders"
          >
            Danh sách đơn
          </Link>
          {cod && canManageCod ? (
            <Link
              className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              to="/orders/cod"
            >
              Quản lý COD
            </Link>
          ) : null}
          {canViewStockDeduct ? (
            <Link
              className="rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-5 py-2.5 text-sm font-semibold text-[#538463] hover:bg-[#538463]/10"
              to="/orders/stock-deduct"
            >
              Chờ trừ kho
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? <p className="text-slate-500">Đang tải chi tiết đơn...</p> : null}
      {!isLoading && !order ? <p className="text-slate-500">Không tìm thấy đơn hàng.</p> : null}

      {!isLoading && order ? (
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-[1.5rem] bg-white p-4 shadow-sm sm:p-6 lg:col-span-2 lg:p-8">
            <h2 className="mb-6 text-xl font-extrabold text-slate-800">Thông tin &amp; sản phẩm</h2>

            {!canEditOrder ? (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Bạn chỉ được xem đơn hàng do mình tạo. Liên hệ quản lý chi nhánh nếu cần chỉnh sửa.
              </p>
            ) : null}

            <div className="mb-6 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
                {getOrderStatusLabel(order.orderStatus)}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(order.paymentStatus)}`}>
                {getPaymentStatusLabel(order.paymentStatus)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {getOrderChannelLabel(order.orderCode)}
              </span>
              {cod ? (
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  COD
                </span>
              ) : null}
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(order.stockStatus)}`}
              >
                {getStockStatusLabel(order.stockStatus)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mã đơn</span>
                <p className="mt-1 text-base font-semibold text-slate-800">{order.orderCode}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Khách hàng</span>
                <p className="mt-1 text-base font-semibold text-slate-800">{order.customerName}</p>
                {order.customerPhone ? <p className="text-sm text-slate-500">{order.customerPhone}</p> : null}
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Thu ngân</span>
                <p className="mt-1 text-base font-semibold text-slate-800">{order.cashierName}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Thanh toán</span>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {getPaymentMethodLabel(order.paymentMethod)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Trừ kho</span>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {getStockStatusLabel(order.stockStatus)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ngày tạo</span>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {formatVietnamDateTime(order.createdAt)}
                </p>
              </div>
            </div>

            {itemsEditable ? (
              <div className="mt-8 space-y-4 rounded-xl border border-[#b9d4b0]/40 bg-[#fbfdf9] p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chỉnh sửa sản phẩm</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Thêm, bớt số lượng hoặc đổi sản phẩm trước khi thu tiền. Nếu đơn đã trừ kho, hệ thống hoàn kho cũ rồi trừ lại theo danh sách mới.
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="search"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Tìm sản phẩm (tối thiểu 2 ký tự)..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {isSearchingProducts ? (
                    <p className="mt-1 text-xs text-slate-400">Đang tìm...</p>
                  ) : null}
                  {productResults.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {productResults.map((product) => (
                        <li key={product.productId}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#fbf9f1]"
                            onClick={() => handleAddProduct(product)}
                          >
                            <span>
                              <span className="font-medium text-slate-800">{product.name}</span>
                              <span className="ml-2 text-xs text-slate-400">{product.sku}</span>
                            </span>
                            <span className="text-xs font-semibold text-[#538463]">{formatVnd(product.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fbf9f1] text-xs font-bold uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-right">SL</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {editLines.map((line) => {
                        const lineTotal = line.isGift ? 0 : line.unitPrice * line.quantity
                        return (
                          <tr key={line.key}>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {line.productName || line.productSku}
                              <span className="ml-2 text-xs text-slate-400">{line.productSku}</span>
                              {line.isGift ? <span className="ml-2 text-xs text-[#538463]">(Quà)</span> : null}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                                value={line.quantity}
                                onChange={(e) => handleLineQtyChange(line.key, e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatVnd(lineTotal)}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveLine(line.key)}
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-[#538463] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={isSaving}
                  onClick={handleSaveItems}
                >
                  Lưu sản phẩm &amp; tính lại tổng
                </button>
              </div>
            ) : (
              <div className="mt-8 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbf9f1] text-xs font-bold uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3 text-right">SL</th>
                      <th className="px-4 py-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.productName || item.productSku}
                          <span className="ml-2 text-xs text-slate-400">{item.productSku}</span>
                          {item.isGift ? <span className="ml-2 text-xs text-[#538463]">(Quà)</span> : null}
                        </td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatVnd(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!itemsEditable && order?.paymentStatus?.toLowerCase() === 'paid' ? (
                  <p className="mt-2 px-1 text-xs text-slate-500">
                    Đơn đã thu tiền — không thể đổi sản phẩm tại đây. Tạo đơn mới tại POS nếu cần bổ sung.
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-6 space-y-1 text-right text-sm">
              <p className="text-slate-500">
                Tạm tính: <span className="font-semibold text-slate-800">{formatVnd(order.subTotal)}</span>
              </p>
              {order.manualDiscount > 0 ? (
                <p className="text-slate-500">
                  CK thủ công: <span className="font-semibold text-slate-800">-{formatVnd(order.manualDiscount)}</span>
                </p>
              ) : null}
              {order.couponDiscount > 0 ? (
                <p className="text-slate-500">
                  Giảm mã{order.promotion?.promoCode ? ` (${order.promotion.promoCode})` : ''}:{' '}
                  <span className="font-semibold text-slate-800">-{formatVnd(order.couponDiscount)}</span>
                </p>
              ) : null}
              <p className="text-lg font-bold text-[#538463]">Tổng: {formatVnd(order.totalAmount)}</p>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[1.5rem] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-800">Chỉnh sửa trạng thái</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái đơn</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                  >
                    {EDIT_ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thanh toán</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    {EDIT_PAYMENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Trừ kho</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)}
                  >
                    {STOCK_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveStatus}
                  className="w-full rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                >
                  Lưu trạng thái
                </button>
              </div>
            </section>

            <section className="rounded-[1.5rem] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-800">Mã giảm giá</h2>
              {order.promotion ? (
                <div className="mb-3 rounded-xl border border-[#538463]/30 bg-[#538463]/5 px-4 py-3">
                  <p className="text-sm font-semibold text-[#538463]">
                    {formatPromotionLabel(order.promotion)}
                  </p>
                  {order.couponDiscount > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Giảm thực tế: {formatVnd(order.couponDiscount)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mb-3 text-sm text-slate-500">Chưa áp mã giảm giá.</p>
              )}
              {canApplyCoupon ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                    placeholder="VD: SALE10"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyPromoCode()
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isApplyingPromo || isSaving || !promoCodeInput.trim()}
                    onClick={handleApplyPromoCode}
                    className="shrink-0 rounded-lg bg-[#538463] px-4 py-2 text-sm font-semibold text-white hover:bg-[#457053] disabled:opacity-50"
                  >
                    {isApplyingPromo ? '...' : 'Áp dụng'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Không thể đổi mã sau khi đơn đã thanh toán hoặc bị hủy.
                </p>
              )}
            </section>

            <section className="rounded-[1.5rem] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-800">Ghi chú &amp; giao hàng</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Địa chỉ giao</span>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ghi chú nội bộ</span>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">CK thủ công (đ)</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Giảm trừ (đ)</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveAdjustments}
                  className="w-full rounded-xl border border-[#538463] bg-white px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/5 disabled:opacity-50"
                >
                  Lưu thông tin
                </button>
              </div>
            </section>

            {showStockDeductBlock ? (
              <section className="rounded-[1.5rem] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-800">Trừ kho</h2>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(order.stockStatus)}`}
                    >
                      {getStockStatusLabel(order.stockStatus)}
                    </span>
                    {order.stockDeductQueue ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Queue: {getQueueStatusLabel(order.stockDeductQueue.status)}
                      </span>
                    ) : null}
                  </div>

                  {order.stockShortages?.length ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">Thiếu nguyên liệu</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-900">
                        {order.stockShortages.map((row) => (
                          <li key={row.materialId}>
                            {row.materialName || `NVL #${row.materialId}`}: cần {row.requiredQuantity}, có{' '}
                            {row.availableQuantity}, thiếu {row.shortageQuantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {canOpenStockPreview ? (
                    <button
                      type="button"
                      onClick={() => setStockPreviewOpen(true)}
                      className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white ${
                        canExecuteStockOnOrder
                          ? 'bg-[#538463] hover:bg-[#457053]'
                          : 'bg-slate-500 hover:bg-slate-600'
                      }`}
                    >
                      {canExecuteStockOnOrder ? 'Xem preview & trừ kho' : 'Xem preview trừ kho'}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {order.stockStatus === 'deducted'
                        ? 'Đơn đã trừ kho.'
                        : 'Không có thao tác trừ kho cho đơn này.'}
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.5rem] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-800">Thao tác thanh toán</h2>

              {canConfirmPayment || showCodActions ? (
                <p className="mb-4 rounded-lg bg-[#fbf9f1] px-3 py-2 text-sm text-slate-600">
                  Số cần thu:{' '}
                  <strong className="text-[#538463]">{formatVnd(order.totalAmount)}</strong>
                  {needsTransferQr ? (
                    <span className="block text-xs text-slate-500 mt-1">
                      POS: QR hết hạn sau 5 phút. Trang đơn: VA 24h. Bấm lại trong 30 giây không tạo thêm VA trên SePay.
                      Sau khi mở QR, hệ thống tự cập nhật khi khách chuyển khoản (SePay webhook).
                    </span>
                  ) : null}
                  {cod ? (
                    <span className="block text-xs text-slate-500 mt-1">
                      COD: thu tiền mặt khi giao, sau đó bấm &quot;Đã giao &amp; thu tiền&quot;.
                    </span>
                  ) : null}
                  {paymentMethodKey === 'CASH' ? (
                    <span className="block text-xs text-slate-500 mt-1">
                      Tiền mặt: thu đủ tại quầy rồi xác nhận đã thu.
                    </span>
                  ) : null}
                </p>
              ) : null}

              {canConfirmPayment && needsTransferQr ? (
                <div className="mb-4 space-y-3">
                  <button
                    type="button"
                    disabled={isLoadingPaymentQr || isSaving || paymentQrOnCooldown}
                    onClick={() => handleLoadPaymentQr(false)}
                    className="w-full rounded-xl border border-[#538463] bg-white px-4 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#538463]/5 disabled:opacity-50"
                  >
                    {isLoadingPaymentQr
                      ? 'Đang tải QR...'
                      : paymentQrOnCooldown
                        ? 'Đã có QR (chờ vài giây)'
                        : paymentQr
                          ? 'Xem lại QR'
                          : 'Xem / tạo QR thanh toán'}
                  </button>
                  {paymentQr?.hint ? (
                    <p className="text-xs text-slate-500">{paymentQr.hint}</p>
                  ) : null}
                  {paymentQr && paymentQrImageUrl ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                      <img
                        src={paymentQrImageUrl}
                        alt="QR thanh toán"
                        className="mx-auto max-h-56 w-auto rounded-lg bg-white p-2"
                      />
                      {paymentQr.transferAccountNumber ? (
                        <p className="mt-2 text-xs text-slate-500">
                          VA: <strong>{paymentQr.transferAccountNumber}</strong>
                        </p>
                      ) : null}
                      {paymentQr.transferContent ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Nội dung CK: <strong>{paymentQr.transferContent}</strong>
                        </p>
                      ) : null}
                      {paymentQr.qrExpiresAtUtc ? (
                        <p className="mt-2 text-xs font-semibold text-amber-700">
                          Hết hạn QR/VA: {formatVietnamDateTime(paymentQr.qrExpiresAtUtc)}
                        </p>
                      ) : null}
                      {shouldPollTransferPayment ? (
                        <p className="mt-3 text-xs font-semibold text-[#538463]">
                          Đang chờ khách quét QR / chuyển khoản — trang sẽ tự cập nhật khi nhận tiền.
                        </p>
                      ) : null}
                      {paymentPollError ? (
                        <p className="mt-2 text-xs text-red-600">{paymentPollError}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showCodActions ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runCodAction('confirm')}
                    className="w-full rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Đã giao &amp; thu tiền
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runCodAction('remind')}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-50"
                  >
                    Đã nhắc khách
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runCodAction('reject')}
                    className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Khách từ chối — hủy
                  </button>
                </div>
              ) : canConfirmPayment && needsTransferQr ? (
                <p className="text-sm text-slate-500">
                </p>
              ) : canConfirmPayment ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmPayment}
                  className="w-full rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Xác nhận đã thu tiền
                </button>
              ) : (
                <p className="text-sm text-slate-500">Không còn thao tác thanh toán cho đơn này.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {stockPreviewOpen && order?.stockDeductQueue ? (
        <StockDeductPreviewModal
          queueId={order.stockDeductQueue.id}
          orderCode={order.orderCode}
          readOnly={!canExecuteStockDeduct}
          onClose={() => setStockPreviewOpen(false)}
          onConfirmed={loadOrder}
        />
      ) : null}
    </div>
  )
}

export default OrderDetailPage
