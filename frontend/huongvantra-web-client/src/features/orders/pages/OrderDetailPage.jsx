import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCompleteBackorderRefund,
  canConfirmB2BDelivery,
  canConfirmOrderShipping,
  canCreateOrder,
  canReviewBackorderRefund,
  canVerifyCodPayment,
  canViewAllOrders,
} from '../../auth/utils/permissions.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CodVerifyModal from '../components/CodVerifyModal.jsx'
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx'
import { parseCodDebtSettlement } from '../../customers/utils/codDebtSettlementUtils.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import OrderProductsSection from '../components/OrderProductsSection.jsx'
import OrderReturnsSection from '../components/OrderReturnsSection.jsx'
import OrderStockReservationSection from '../components/OrderStockReservationSection.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import OrderTransferQrPanel from '../components/OrderTransferQrPanel.jsx'
import OrderUpdateMetaModal from '../components/OrderUpdateMetaModal.jsx'
import ReceiptReprintModal from '../components/ReceiptReprintModal.jsx'
import {
  cancelOrder,
  completeBackorderRefund,
  completeOrder,
  fetchOrder,
  fetchReturnsByOrderId,
  reprintReceipt,
  requestBackorderCancellation,
  reviewBackorderCancellation,
  shipOrder,
  updateOrder,
} from '../services/ordersApi.js'
import { printReceiptFromData } from '../../pos/utils/printReceipt.js'
import {
  canCancelOrder,
  canCompleteOrder,
  canEditOrderMeta,
  canReprintReceipt,
  canReturnOrder,
  canShipOrder,
  canVerifyCod,
  isCodChannelOrder,
  isContractOrder,
  isPendingPaymentOrder,
  isPendingTransferPayment,
  formatVnd,
  resolveInventorySyncMeta,
  getOrderChannelLabel,
  getOrderKindLabel,
  isExchangeOrder,
  getOrderStatusClass,
  getOrderStatusLabel,
  getOrderPaymentMethodLabel,
  resolveOrderPaymentDisplay,
  getOrderRemainingDebt,
  getPrimaryPayment,
} from '../utils/orderDisplay.js'
import { fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'
import { fetchStoreProducts } from '../../products/services/productsApi.js'
import { fetchCustomerById } from '../../customers/services/customersApi.js'
import { buildProductCatalogLookups, resolveOrderLineDisplay } from '../../products/utils/productDisplay.js'
function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromCod = searchParams.get('from') === 'cod'
  const fromExchange = searchParams.get('from') === 'exchange'
  const session = loadAuthSession()
  const canManage = canCreateOrder(session)
  const canShipContract = canConfirmOrderShipping(session)
  const canReceiveContract = canConfirmB2BDelivery(session)
  const canCollectCod = canVerifyCodPayment(session)
  const isManager = canViewAllOrders(session)
  const canReviewRefund = canReviewBackorderRefund(session)
  const canFinalizeRefund = canCompleteBackorderRefund(session)

  const [order, setOrder] = useState(null)
  const [shelfOnDuty, setShelfOnDuty] = useState(null)
  const [checkingShift, setCheckingShift] = useState(!isManager)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isCodVerifyOpen, setIsCodVerifyOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [isReprintOpen, setIsReprintOpen] = useState(false)
  const [isReprinting, setIsReprinting] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [catalogLookups, setCatalogLookups] = useState(() => buildProductCatalogLookups())
  const [orderReturns, setOrderReturns] = useState([])
  const [orderCustomer, setOrderCustomer] = useState(null)

  const loadOrder = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await fetchOrder(id)
      setOrder(data)
    } catch (error) {
      setOrder(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (isManager) {
      setShelfOnDuty(null)
      setCheckingShift(false)
      return undefined
    }

    let mounted = true
    setCheckingShift(true)
    fetchOnDutyShift('Shelf')
      .then((duty) => {
        if (mounted) setShelfOnDuty(duty)
      })
      .catch(() => {
        if (mounted) setShelfOnDuty(null)
      })
      .finally(() => {
        if (mounted) setCheckingShift(false)
      })

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  const canMutate = isManager || Boolean(shelfOnDuty)
  const contractOrder = isContractOrder(order)
  // Đơn hợp đồng do Kế toán lập và Kho xuất — cả hai bộ phận đều làm việc ngoài ca quầy POS.
  const canOperateContract = contractOrder && (canShipContract || canReceiveContract)
  const canRunActions = canManage || canOperateContract || canReviewRefund || canFinalizeRefund
  const canApplyChanges = contractOrder ? canOperateContract : (canManage && canMutate)

  useEffect(() => {
    if (!order?.customerId) {
      setOrderCustomer(null)
      return undefined
    }

    let mounted = true
    fetchCustomerById(order.customerId)
      .then((customer) => {
        if (mounted) setOrderCustomer(customer)
      })
      .catch(() => {
        if (mounted) setOrderCustomer(null)
      })

    return () => {
      mounted = false
    }
  }, [order?.customerId])

  useEffect(() => {
    if (!id) return undefined
    let mounted = true

    async function loadReturns() {
      try {
        const data = await fetchReturnsByOrderId(id)
        if (mounted) setOrderReturns(data)
      } catch {
        if (mounted) setOrderReturns([])
      }
    }

    loadReturns()
    return () => {
      mounted = false
    }
  }, [id, timelineRefreshKey])

  useEffect(() => {
    if (!order || isLoading || fromCod || fromExchange || !id) return
    if (isExchangeOrder(order)) {
      navigate(`/orders/${id}?from=exchange`, { replace: true })
    }
  }, [order, isLoading, fromCod, fromExchange, id, navigate])

  useEffect(() => {
    let mounted = true

    async function loadCatalog() {
      try {
        const [productsResult, skus] = await Promise.all([
          fetchStoreProducts({ isActive: true, page: 1, pageSize: 100 }),
          fetchAllActiveStoreSkus(100),
        ])
        if (mounted) {
          setCatalogLookups(buildProductCatalogLookups({ products: productsResult.items, skus }))
        }
      } catch {
        if (mounted) setCatalogLookups(buildProductCatalogLookups())
      }
    }

    loadCatalog()
    return () => {
      mounted = false
    }
  }, [])

  async function handleSaveMeta(values) {
    if (!canApplyChanges || !order) return
    try {
      setIsSaving(true)
      const updated = await updateOrder(order.id, values)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      setIsUpdateModalOpen(false)
      showSuccess('Đã cập nhật đơn hàng.')
    } catch (error) {
      const message = error.message || 'Không thể cập nhật đơn hàng.'
      showError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const orderLines = useMemo(() => {
    if (!order?.items?.length) return []
    return order.items.map((line) => ({
      line,
      display: resolveOrderLineDisplay(line, catalogLookups),
    }))
  }, [order?.items, catalogLookups])

  async function handleConfirmCancel() {
    if (!canApplyChanges || !order) return
    setConfirmCancelOpen(false)
    try {
      setIsSaving(true)
      await cancelOrder(order.id)
      showSuccess('Đã hủy đơn hàng.')
      await loadOrder()
      setTimelineRefreshKey((key) => key + 1)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRequestBackorderCancellation() {
    if (!canApplyChanges || !order) return
    const reason = window.prompt('Nhập lý do yêu cầu hủy đơn chờ nguyên liệu:')
    if (!reason?.trim()) return
    try {
      setIsSaving(true)
      const updated = await requestBackorderCancellation(order.id, reason)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess('Đã gửi yêu cầu hủy và hoàn tiền để Manager duyệt.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReviewBackorderCancellation(approved) {
    if (!canReviewRefund || !order) return
    const note = window.prompt(
      approved ? 'Ghi chú duyệt hoàn tiền (không bắt buộc):' : 'Lý do từ chối (không bắt buộc):',
    )
    try {
      setIsSaving(true)
      const updated = await reviewBackorderCancellation(order.id, approved, note || '')
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess(approved ? 'Đã duyệt yêu cầu hoàn tiền.' : 'Đã từ chối yêu cầu hủy.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCompleteBackorderRefund() {
    if (!canFinalizeRefund || !order) return
    const hasImmediateItems = order.fulfillmentPreference === 'PartialDelivery'
      && order.items?.some((item) => Number(item.immediateFulfilledQuantity || 0) > 0)
    let immediateItemsReturned = false
    if (hasImmediateItems) {
      immediateItemsReturned = window.confirm(
        'Đơn đã giao một phần. Chỉ tiếp tục khi đã nhận lại đầy đủ phần hàng giao ngay. Xác nhận đã thu hồi hàng?',
      )
      if (!immediateItemsReturned) return
    }
    const refundMethod = window.prompt('Phương thức hoàn tiền (Tiền mặt/Chuyển khoản):')
    if (!refundMethod?.trim()) return
    const refundEvidence = window.prompt(
      hasImmediateItems
        ? 'Nhập mã giao dịch và bằng chứng thu hồi phần hàng đã giao/hoàn tiền:'
        : 'Nhập mã giao dịch, đường dẫn chứng từ hoặc nội dung bằng chứng hoàn tiền:',
    )
    if (!refundEvidence?.trim()) return
    try {
      setIsSaving(true)
      const updated = await completeBackorderRefund(
        order.id,
        refundMethod,
        refundEvidence,
        immediateItemsReturned,
      )
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess('Đã ghi nhận hoàn tiền, lưu bằng chứng và hủy đơn.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmReprint(reason) {
    if (!order || isReprinting) return
    try {
      setIsReprinting(true)
      const result = await reprintReceipt(order.id, reason, {
        idempotencyKey: crypto.randomUUID(),
      })
      const receipt = result?.receipt
      if (!receipt) throw new Error('Không nhận được dữ liệu hóa đơn để in lại.')

      setIsReprintOpen(false)
      showSuccess(`Đã ghi nhận lần in lại thứ ${receipt.reprintNumber}.`)
      await printReceiptFromData({
        ...receipt,
        createdAtLabel: formatVietnamDateTime(receipt.createdAt),
        reprintedAtLabel: formatVietnamDateTime(receipt.reprintedAt),
      })
    } catch (error) {
      showError(error.message || 'Không thể in lại hóa đơn.')
    } finally {
      setIsReprinting(false)
    }
  }

  async function runAction(action) {
    if (!canApplyChanges || !order) return
    try {
      setIsSaving(true)
      if (action === 'ship') {
        await shipOrder(order.id)
        showSuccess('Đã chuyển sang trạng thái đang giao.')
      } else if (action === 'complete') {
        await completeOrder(order.id)
        showSuccess('Đã hoàn tất đơn hàng.')
      } else if (action === 'cancel') {
        setIsSaving(false)
        setConfirmCancelOpen(true)
        return
      }
      await loadOrder()
      setTimelineRefreshKey((key) => key + 1)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-1 py-10 text-slate-500 sm:px-2">
          Đang tải đơn hàng...
        </div>
      </PageShell>
    )
  }

  if (!order) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl px-1 py-10 sm:px-2">
          <p className="text-slate-500">Không tìm thấy đơn hàng.</p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-[#538463]"
            to={fromCod ? '/orders/cod' : fromExchange ? '/orders/exchange' : '/orders'}
          >
            ← Quay lại {fromCod ? 'quản lý đơn COD' : fromExchange ? 'đơn đổi hàng' : 'danh sách'}
          </Link>
        </div>
      </PageShell>
    )
  }

  const payment = getPrimaryPayment(order)
  const transferPayment = order.payments?.find((row) => {
    const method = String(row?.paymentMethod || '').toUpperCase()
    return method === 'VIETQR' || method === 'BANKTRANSFER'
  })
  const transferDebtSettlement = parseCodDebtSettlement(transferPayment?.codDebtSettlementJson)
  const transferQrAmount = Number(transferPayment?.amount || order.finalAmount || 0)
    + Number(transferDebtSettlement?.allocatedAmount || 0)
  const paymentDisplay = resolveOrderPaymentDisplay(order)
  const orderRemainingDebt = getOrderRemainingDebt(order)
  const showTransferQr = isPendingTransferPayment(order)
  const compactProducts = isPendingPaymentOrder(order)
  const inventorySyncMeta = resolveInventorySyncMeta(order)
  const normalizedStatus = String(order.orderStatus || '').trim()
  const isWaitingMaterials = normalizedStatus === 'WaitingMaterials'
  const isCancellationRequested = normalizedStatus === 'CancellationRequested'
  const hasCollectedPayment = order.payments?.some((row) => row.paymentStatus === 'Success')
  const contractStepHint = contractOrder
    ? {
        PendingPayment: 'Bước 1/3 — Đã lập đơn và giữ chỗ hàng. Chờ kho soạn và xác nhận xuất hàng.',
        Processing: 'Bước 1/3 — Đơn đang xử lý. Chờ kho soạn và xác nhận xuất hàng.',
        Shipping: 'Bước 2/3 — Kho đã xuất hàng. Chờ kế toán xác nhận khách đã nhận để ghi công nợ.',
        Completed: 'Bước 3/3 — Khách đã nhận hàng, công nợ đã ghi theo điều khoản hợp đồng.',
        Cancelled: 'Đơn đã hủy — hàng giữ chỗ đã được nhả về tồn kệ.',
      }[String(order.orderStatus || '').trim()] || ''
    : ''

  return (
    <PageShell>
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 pb-8 sm:px-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm font-semibold text-[#538463] hover:underline"
            to={
              fromCod || isCodChannelOrder(order)
                ? '/orders/cod'
                : fromExchange || isExchangeOrder(order)
                  ? '/orders/exchange'
                  : '/orders'
            }
          >
            ←{' '}
            {fromCod || isCodChannelOrder(order)
              ? 'Quản lý đơn COD'
              : fromExchange || isExchangeOrder(order)
                ? 'Trả / đổi hàng'
                : 'Danh sách đơn'}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{order.orderCode}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isExchangeOrder(order) ? getOrderKindLabel(order.orderKind) : getOrderChannelLabel(order.orderChannel)} · Tạo lúc{' '}
            {formatVietnamDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canApplyChanges && canEditOrderMeta(order) ? (
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#538463]/30 bg-white px-3 py-2 text-sm font-semibold text-[#356647] shadow-sm hover:bg-[#f6f4ec]"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Cập nhật thông tin
            </button>
          ) : null}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
            {getOrderStatusLabel(order.orderStatus)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventorySyncMeta.className}`}>
            {inventorySyncMeta.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <OrderProductsSection
          order={order}
          orderLines={orderLines}
          constrained={compactProducts}
          orderId={compactProducts ? order.id : undefined}
          timelineRefreshKey={compactProducts ? timelineRefreshKey : undefined}
        />

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Khách hàng</h2>
            <OrderCustomerCell snapshot={order.customerSnapshotName} customerId={order.customerId} />
            {order.shippingAddress ? (
              <p className="mt-2 text-sm text-slate-600">{order.shippingAddress}</p>
            ) : null}
          </section>

          {contractOrder ? (
            <section className="rounded-2xl border border-[#538463]/25 bg-[#f6f4ec] p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#356647]">Đơn bán theo hợp đồng</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Mã hợp đồng</dt>
                  <dd className="font-semibold text-slate-800">{order.contractCodeSnapshot || '—'}</dd>
                </div>
                {order.contractDiscountPercentSnapshot != null ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Chiết khấu hợp đồng</dt>
                    <dd className="font-semibold text-slate-800">{order.contractDiscountPercentSnapshot}%</dd>
                  </div>
                ) : null}
                {order.contractPaymentTermDaysSnapshot != null ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Điều khoản thanh toán</dt>
                    <dd className="font-semibold text-slate-800">{order.contractPaymentTermDaysSnapshot} ngày</dd>
                  </div>
                ) : null}
                {order.dueDate ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Hạn thanh toán</dt>
                    <dd className="font-semibold text-slate-800">{formatVietnamDateTime(order.dueDate)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 border-t border-[#538463]/20 pt-3 text-xs leading-relaxed text-[#356647]">
                {contractStepHint}
              </p>
              {order.contractId ? (
                <Link
                  to={`/contracts/${order.contractId}`}
                  className="mt-2 inline-block text-xs font-semibold text-[#356647] underline"
                >
                  Xem hợp đồng
                </Link>
              ) : null}
            </section>
          ) : null}

          {order.backorderAcceptedAt ? (
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-violet-700">
                Đơn chờ nguyên liệu
              </h2>
              <dl className="space-y-1.5 text-sm text-slate-700">
                <div className="flex justify-between gap-3">
                  <dt>Hình thức nhận</dt>
                  <dd className="text-right font-semibold">
                    {order.fulfillmentPreference === 'CompleteDelivery'
                      ? 'Nhận một lần khi đủ hàng'
                      : 'Nhận trước phần hàng sẵn'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Dự kiến sẵn hàng</dt>
                  <dd className="text-right font-semibold">
                    {order.estimatedReadyFrom ? formatVietnamDateTime(order.estimatedReadyFrom) : '—'} -{' '}
                    {order.estimatedReadyTo ? formatVietnamDateTime(order.estimatedReadyTo) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Hoàn tiền</dt>
                  <dd className="font-semibold">{order.refundStatus || 'NotRequired'}</dd>
                </div>
              </dl>
              {order.cancellationReason ? (
                <p className="mt-3 text-xs text-rose-700">Lý do hủy: {order.cancellationReason}</p>
              ) : null}
              {order.cancellationRequestedAt ? (
                <p className="mt-2 text-xs text-slate-600">
                  Yêu cầu bởi {order.cancellationRequestedByName || '—'} lúc{' '}
                  {formatVietnamDateTime(order.cancellationRequestedAt)}
                </p>
              ) : null}
              {order.refundApprovedAt ? (
                <p className="mt-2 text-xs text-slate-600">
                  Duyệt bởi {order.refundApprovedByName || '—'} lúc{' '}
                  {formatVietnamDateTime(order.refundApprovedAt)}
                </p>
              ) : null}
              {order.refundedAt ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Hoàn bởi {order.refundedByName || '—'} lúc {formatVietnamDateTime(order.refundedAt)}
                  {order.refundMethod ? ` · ${order.refundMethod}` : ''}
                </p>
              ) : null}
              {order.refundEvidence ? (
                <p className="mt-2 break-words text-xs text-emerald-700">
                  Bằng chứng hoàn tiền: {order.refundEvidence}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Người bán</h2>
            <p className="text-sm font-semibold text-slate-800">
              {order.sellerName?.trim() ? order.sellerName : '—'}
            </p>
          </section>

          <OrderReturnsSection returns={orderReturns} />

          {order.note?.trim() ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Ghi chú</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{order.note}</p>
            </section>
          ) : null}

          {showTransferQr && canManage ? (
            <OrderTransferQrPanel
              orderId={order.id}
              orderCode={order.orderCode}
              total={transferQrAmount}
              customerName={order.customerSnapshotName}
              onPaid={() => {
                loadOrder()
                setTimelineRefreshKey((key) => key + 1)
              }}
            />
          ) : null}

          {payment ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thanh toán</h2>
              <p className="text-sm text-slate-700">{getOrderPaymentMethodLabel(order)}</p>
              <p className="mt-1 text-sm">
                <span className="text-slate-500">{paymentDisplay.amountCaption}: </span>
                <span className="font-semibold text-slate-800">{formatVnd(paymentDisplay.displayAmount)}</span>
              </p>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${paymentDisplay.className}`}>
                {paymentDisplay.label}
              </span>
              {paymentDisplay.detail ? (
                <p className="mt-2 text-xs text-amber-800">{paymentDisplay.detail}</p>
              ) : null}
              {orderRemainingDebt > 0 && order.customerId ? (
                <p className="mt-2 text-xs text-[#7e5700]">
                  Còn nợ {formatVnd(orderRemainingDebt)} đã ghi vào công nợ khách.{' '}
                  <Link to={`/customers/${order.customerId}/edit`} className="font-semibold underline">
                    Xem hóa đơn nợ
                  </Link>
                </p>
              ) : null}
              {payment.isCodVerified ? (
                <p className="mt-2 text-xs text-emerald-700">COD đã xác nhận</p>
              ) : null}
            </section>
          ) : null}

          {canRunActions ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thao tác</h2>
              <div className="flex flex-col gap-2">
                {isWaitingMaterials && canApplyChanges ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={hasCollectedPayment
                      ? handleRequestBackorderCancellation
                      : () => runAction('cancel')}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {hasCollectedPayment ? 'Yêu cầu hủy & hoàn tiền' : 'Hủy đơn chờ nguyên liệu'}
                  </button>
                ) : null}
                {canReviewRefund && isCancellationRequested && order.refundStatus === 'PendingApproval' ? (
                  <>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleReviewBackorderCancellation(true)}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Duyệt hoàn tiền
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleReviewBackorderCancellation(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Từ chối yêu cầu hủy
                    </button>
                  </>
                ) : null}
                {canFinalizeRefund && isCancellationRequested && order.refundStatus === 'Approved' ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleCompleteBackorderRefund}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Xác nhận đã hoàn tiền
                  </button>
                ) : null}
                {canShipOrder(order) && (!contractOrder || canShipContract) ? (
                  <button
                    type="button"
                    disabled={isSaving || !canApplyChanges}
                    onClick={() => runAction('ship')}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {contractOrder ? 'Xác nhận đã xuất hàng khỏi kho' : 'Chuyển sang đang giao'}
                  </button>
                ) : null}
                {canCompleteOrder(order) && (!contractOrder || canReceiveContract) ? (
                  <button
                    type="button"
                    disabled={isSaving || !canApplyChanges}
                    onClick={() => runAction('complete')}
                    className="rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                  >
                    {contractOrder ? 'Khách đã nhận hàng — ghi công nợ' : 'Hoàn tất đơn'}
                  </button>
                ) : null}
                {canCollectCod && canVerifyCod(order) ? (
                  <button
                    type="button"
                    disabled={isSaving || !canMutate}
                    onClick={() => setIsCodVerifyOpen(true)}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Đã giao &amp; thu tiền (COD)
                  </button>
                ) : null}
                {canManage && canReturnOrder(order) ? (
                  <button
                    type="button"
                    disabled={!canMutate}
                    onClick={() => canMutate && navigate(`/pos/returns/${order.id}`)}
                    className="rounded-xl border border-[#538463]/40 bg-[#f6f4ec] px-4 py-2.5 text-sm font-bold text-[#356647] hover:bg-[#ebe8dc] disabled:opacity-50"
                  >
                    Trả hàng / Đổi
                  </button>
                ) : null}
                {canReprintReceipt(order) ? (
                  <button
                    type="button"
                    disabled={isReprinting}
                    onClick={() => setIsReprintOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    In lại hóa đơn
                  </button>
                ) : null}
                {canCancelOrder(order) && !isWaitingMaterials && !isCancellationRequested ? (
                  <button
                    type="button"
                    disabled={isSaving || !canApplyChanges}
                    onClick={() => runAction('cancel')}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Hủy đơn
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {String(order.orderChannel).toUpperCase() === 'COD' || contractOrder ? (
        <OrderStockReservationSection orderId={order.id} refreshKey={timelineRefreshKey} />
      ) : null}

      {!compactProducts ? (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Lịch sử xử lý</h2>
          <OrderTimeline orderId={order.id} refreshKey={timelineRefreshKey} />
        </section>
      ) : null}

      <CodVerifyModal
        isOpen={isCodVerifyOpen}
        order={
          order && canVerifyCod(order)
            ? (() => {
                const codPayment = order.payments?.find(
                  (row) => String(row.paymentMethod).toUpperCase() === 'COD',
                )
                return {
                  id: order.id,
                  orderCode: order.orderCode,
                  finalAmount: order.finalAmount,
                  customerId: order.customerId,
                  customerSnapshotName: order.customerSnapshotName,
                  codPaymentId: codPayment?.id,
                  codExpectedAmount: codPayment?.amount ?? null,
                  codDebtSettlement: parseCodDebtSettlement(codPayment?.codDebtSettlementJson),
                  payments: order.payments,
                }
              })()
            : null
        }
        onClose={() => setIsCodVerifyOpen(false)}
        onVerified={() => {
          loadOrder()
          setTimelineRefreshKey((key) => key + 1)
        }}
      />

      <OrderUpdateMetaModal
        isOpen={isUpdateModalOpen}
        order={order}
        customer={orderCustomer}
        catalogLookups={catalogLookups}
        isSaving={isSaving}
        onClose={() => setIsUpdateModalOpen(false)}
        onSave={handleSaveMeta}
      />

      <ReceiptReprintModal
        isOpen={isReprintOpen}
        order={order}
        isSaving={isReprinting}
        onClose={() => setIsReprintOpen(false)}
        onConfirm={handleConfirmReprint}
      />

      <ConfirmDialog
        isOpen={confirmCancelOpen}
        title="Hủy đơn hàng"
        message={`Bạn có chắc muốn hủy đơn ${order.orderCode}? Thao tác này không thể hoàn tác.`}
        confirmLabel="Hủy đơn"
        cancelLabel="Giữ đơn"
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />

    </div>
    </PageShell>
  )
}

export default OrderDetailPage
