import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { promptDialog } from '../../../app/dialog.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
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
import { formatVietnamDate, formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import BackorderRefundModal from '../components/BackorderRefundModal.jsx'
import CodVerifyModal from '../components/CodVerifyModal.jsx'
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx'
import { parseCodDebtSettlement, parseExpectedCollectedAmount } from '../../customers/utils/codDebtSettlementUtils.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import OrderProductsSection from '../components/OrderProductsSection.jsx'
import OrderReturnsSection from '../components/OrderReturnsSection.jsx'
import OrderStockReservationSection from '../components/OrderStockReservationSection.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import OrderTransferQrPanel from '../components/OrderTransferQrPanel.jsx'
import OrderUpdateMetaModal from '../components/OrderUpdateMetaModal.jsx'
import ReceiptReprintModal from '../components/ReceiptReprintModal.jsx'
import CollectRemainingPaymentModal from '../components/CollectRemainingPaymentModal.jsx'
import {
  cancelOrder,
  cancelOverdueDepositOrder,
  collectRemainingAndDeliver,
  completeBackorderRefund,
  completeOrder,
  fetchOrder,
  fetchReturnsByOrderId,
  markOrderDelivered,
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
  canMarkDelivered,
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
  getPickupDueBadge,
  getPaymentMethodLabel,
  getPaymentPurposeLabel,
  getRefundStatusLabel,
  getOrderPaymentMethodLabel,
  resolveOrderPaymentDisplay,
  getOrderRemainingDebt,
  getPrimaryPayment,
  normalizeOrderKey,
  requiresShippingAddress,
} from '../utils/orderDisplay.js'
import { fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'
import { fetchStoreProducts } from '../../products/services/productsApi.js'
import { fetchCustomerById } from '../../customers/services/customersApi.js'
import { isUsableShippingAddress } from '../../customers/utils/shippingAddress.js'
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
  const [isCollectRemainingOpen, setIsCollectRemainingOpen] = useState(false)
  const [isBackorderRefundOpen, setIsBackorderRefundOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [isReprintOpen, setIsReprintOpen] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
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
  // COD đã đồng bộ kho: chuyển «đang giao» không phụ thuộc ca quầy (khớp MarkShippingAsync).
  const inventorySyncedForShip = normalizeOrderKey(order?.inventorySyncStatus) === 'Synced'
  const canApplyShip = contractOrder
    ? canOperateContract && canShipContract
    : (canManage && (canMutate || (canShipOrder(order) && inventorySyncedForShip)))
  const shipLockReason = !canShipOrder(order) || (contractOrder && !canShipContract)
    ? ''
    : !canManage && !canOperateContract
      ? 'Cần tài khoản Sale/Manager (quyền lập đơn COD/POS) để chuyển sang đang giao.'
      : checkingShift
        ? 'Đang kiểm tra ca Kệ Hàng…'
        : !canApplyShip
          ? 'Chưa mở / ngoài giờ ca Kệ Hàng — vào «Ca của tôi» hoặc đăng nhập Manager. (Sau khi kho đã đồng bộ thì Sale vẫn ship được.)'
          : ''

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
    const itemLines = (order?.items ?? []).map((line) => ({
      line,
      display: resolveOrderLineDisplay(line, catalogLookups),
    }))

    const bundleLines = (order?.customBundles ?? []).flatMap((bundle) => {
      const packingLabel =
        String(bundle.packingStatus || '').toLowerCase() === 'packed'
          ? 'Đã đóng gói'
          : 'Chờ đóng gói'
      const bundleTag = bundle.label?.trim()
        ? `Gói custom — ${bundle.label.trim()}`
        : 'Gói custom'

      return (bundle.ingredients ?? []).map((ing, index) => ({
        line: {
          id: ing.id || `custom-${bundle.id}-${index}`,
          skuId: ing.materialSkuId,
          skuSnapshotName: ing.materialSnapshotName,
          skuSnapshotCode: ing.materialSkuCode,
          quantity: ing.quantity,
          returnedQuantity: 0,
          unitPrice: ing.unitPrice,
          subTotal: ing.subTotal,
          isGift: false,
        },
        display: {
          productName: ing.materialSnapshotName || 'Nguyên liệu custom',
          skuCode: ing.materialSkuCode || '',
          categoryName: bundleTag,
          packagingType: `${bundleTag} · ${packingLabel}`,
          imageUrl: null,
          origin: null,
          flavorProfile: null,
          weightLabel: null,
        },
      }))
    })

    return [...itemLines, ...bundleLines]
  }, [order?.items, order?.customBundles, catalogLookups])

  async function handleConfirmCancel() {
    if (!canApplyChanges || !order) return
    setConfirmCancelOpen(false)
    const wasShipping = String(order.orderStatus || '').trim() === 'Shipping'
    const goCodCancelled = fromCod || isCodChannelOrder(order)
    try {
      setIsSaving(true)
      await cancelOrder(order.id)
      if (goCodCancelled) {
      showSuccess(
          wasShipping
            ? 'Đã hủy. Hàng chờ tại Kiểm tra hàng trả (Bán lại → về Kệ).'
            : 'Đã hủy đơn. Xem lại tại Quản lý đơn COD → tab Đã hủy.',
        )
        navigate('/orders/cod?tab=cancelled', { replace: true })
        return
      }
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
    const hasDepositToForfeit = Number(order.depositAmount) > 0
    const reason = await promptDialog({
      title: hasDepositToForfeit ? 'Khách hủy đơn (không hoàn cọc)' : 'Hủy đơn chờ nguyên liệu',
      message: hasDepositToForfeit
        ? `Tiền cọc ${formatVnd(order.depositAmount ?? 0)} sẽ không được hoàn lại theo chính sách đặt cọc.`
        : 'Yêu cầu hủy sẽ được gửi cho Manager duyệt hoàn tiền.',
      placeholder: 'Nhập lý do khách hủy đơn...',
      confirmLabel: 'Xác nhận hủy đơn',
      required: true,
      tone: 'danger',
      suggestions: getReasonSuggestions('backorderCustomerCancel'),
    })
    if (!reason?.trim()) return
    try {
      setIsSaving(true)
      const updated = await requestBackorderCancellation(order.id, reason)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess(
        Number(order.depositAmount) > 0
          ? 'Đã hủy đơn. Tiền cọc không được hoàn lại theo chính sách đặt cọc.'
          : 'Đã gửi yêu cầu hủy và hoàn tiền để Manager duyệt.',
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // POS-06 (cọc): Manager hủy đơn quá hạn nhận hàng 7 ngày, giữ lại tiền cọc.
  async function handleCancelOverdueDeposit() {
    if (!isManager || !order) return
    const reason = await promptDialog({
      title: 'Hủy đơn quá hạn nhận hàng',
      message: `Đơn đã quá hạn nhận hàng. Tiền cọc ${formatVnd(order.depositAmount ?? 0)} sẽ được giữ lại, không hoàn cho khách.`,
      placeholder: 'Nhập lý do hủy đơn quá hạn...',
      confirmLabel: 'Hủy đơn & giữ cọc',
      required: true,
      tone: 'danger',
      suggestions: getReasonSuggestions('backorderOverdueCancel'),
    })
    if (!reason?.trim()) return
    try {
      setIsSaving(true)
      const updated = await cancelOverdueDepositOrder(order.id, reason)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess(`Đã hủy đơn quá hạn. Giữ lại tiền cọc ${formatVnd(order.depositAmount ?? 0)}.`)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCollectRemaining(payload) {
    if (!order) return
    try {
      setIsSaving(true)
      const updated = await collectRemainingAndDeliver(order.id, payload)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      setIsCollectRemainingOpen(false)
      showSuccess('Đã thu đủ tiền và giao hàng cho khách.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // QR thu phần còn lại: webhook SePay đã hoàn tất đơn, chỉ cần đồng bộ lại màn hình.
  async function handleRemainingPaid() {
    setIsCollectRemainingOpen(false)
    setTimelineRefreshKey((key) => key + 1)
    await loadOrder()
    showSuccess('Khách đã chuyển khoản. Đơn đã hoàn tất.')
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

  function handleOpenBackorderRefund() {
    if (!canFinalizeRefund || !order) return
    setIsBackorderRefundOpen(true)
  }

  async function handleConfirmBackorderRefund({ refundMethod, refundEvidence, immediateItemsReturned }) {
    if (!canFinalizeRefund || !order) return
    try {
      setIsSaving(true)
      const updated = await completeBackorderRefund(
        order.id,
        refundMethod,
        refundEvidence,
        immediateItemsReturned,
      )
      setOrder(updated)
      setIsBackorderRefundOpen(false)
      setTimelineRefreshKey((key) => key + 1)
      showSuccess('Đã ghi nhận hoàn tiền và hủy đơn.')
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
    if (!order) return
    if (action === 'ship') {
      if (!canApplyShip) return
    } else if (!canApplyChanges) {
      return
    }
    try {
      setIsSaving(true)
      if (action === 'ship') {
        await shipOrder(order.id)
        showSuccess('Đã chuyển sang trạng thái đang giao.')
      } else if (action === 'complete') {
        await completeOrder(order.id)
        showSuccess('Đã hoàn tất đơn hàng.')
      } else if (action === 'markDelivered') {
        await markOrderDelivered(order.id)
        showSuccess('Đã ghi nhận giao hàng cho khách.')
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
  const pickupDueBadge = getPickupDueBadge(order)
  const hasDeposit = Number(order.depositAmount) > 0
  const paymentBreakdown = (order.payments || []).filter((row) => row?.paymentPurpose === 'Deposit' || row?.paymentPurpose === 'RemainingAtPickup')
  const deliveredByName = String(order.deliveredByName || '').startsWith('SePay Webhook')
    ? order.sellerName
    : order.deliveredByName
  const remainingAtPickup = hasDeposit ? Math.max(0, Number(order.remainingAmountDue) || 0) : 0
  const normalizedStatus = String(order.orderStatus || '').trim()
  const isAwaitingFulfillment = ['WaitingMaterials', 'WaitingTransfer', 'WaitingProduction', 'ReadyToDeliver']
    .includes(normalizedStatus)
  const isCancellationRequested = normalizedStatus === 'CancellationRequested'
  const hasCollectedPayment = order.payments?.some((row) => row.paymentStatus === 'Success')
  const contractStepHint = contractOrder
    ? {
        PendingPayment: 'Bước 1/3 — Đã lập đơn và giữ chỗ hàng. Chờ kho soạn và xác nhận xuất hàng.',
        Processing: 'Bước 1/3 — Đơn đang xử lý. Chờ kho soạn và xác nhận xuất hàng.',
        Shipping: 'Bước 2/3 — Kho đã xuất hàng. Chờ kế toán xác nhận khách đã nhận để ghi công nợ.',
        Completed: 'Bước 3/3 — Khách đã nhận hàng, công nợ đã ghi theo điều khoản hợp đồng.',
        Cancelled: 'Đơn đã hủy. Nếu hủy sau khi đang giao, tồn Kệ không tự hoàn — xử lý qua trả hàng / kiểm tra hàng trả.',
      }[String(order.orderStatus || '').trim()] || ''
    : ''

  return (
    <PageShell>
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-1 pb-8 sm:px-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            className="text-sm font-semibold text-[#538463] hover:underline"
            to={
              fromCod || isCodChannelOrder(order)
                ? String(order.orderStatus || '').trim() === 'Cancelled'
                  ? '/orders/cod?tab=cancelled'
                  : '/orders/cod'
                : fromExchange || isExchangeOrder(order)
                  ? '/orders/exchange'
                  : '/orders'
            }
          >
            ←{' '}
            {fromCod || isCodChannelOrder(order)
              ? String(order.orderStatus || '').trim() === 'Cancelled'
                ? 'Đơn COD đã hủy'
                : 'Quản lý đơn COD'
              : fromExchange || isExchangeOrder(order)
                ? 'Trả / đổi hàng'
                : 'Danh sách đơn'}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{order.orderCode}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <p className="text-sm text-slate-500">
              {isExchangeOrder(order) ? getOrderKindLabel(order.orderKind) : getOrderChannelLabel(order.orderChannel)} · Tạo lúc{' '}
              {formatVietnamDateTime(order.createdAt)}
            </p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(order.orderStatus)}`}>
              {getOrderStatusLabel(order.orderStatus)}
            </span>
            {pickupDueBadge ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pickupDueBadge.className}`}>
                {pickupDueBadge.label}
              </span>
            ) : null}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventorySyncMeta.className}`}>
              {inventorySyncMeta.label}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          {canRunActions ? (
            <>
              {isAwaitingFulfillment && canApplyChanges ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={hasCollectedPayment
                    ? handleRequestBackorderCancellation
                    : () => runAction('cancel')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  {hasDeposit
                    ? 'Khách hủy đơn (không hoàn cọc)'
                    : hasCollectedPayment
                      ? 'Yêu cầu hủy & hoàn tiền'
                      : 'Hủy đơn chờ nguyên liệu'}
                </button>
              ) : null}
              {isManager && pickupDueBadge?.canCancelOverdue ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleCancelOverdueDeposit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">event_busy</span>
                  Manager hủy đơn quá hạn
                </button>
              ) : null}
              {canReviewRefund && isCancellationRequested && order.refundStatus === 'PendingApproval' ? (
                <>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleReviewBackorderCancellation(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Duyệt hoàn tiền
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleReviewBackorderCancellation(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">block</span>
                    Từ chối yêu cầu hủy
                  </button>
                </>
              ) : null}
              {canFinalizeRefund && isCancellationRequested && order.refundStatus === 'Approved' ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleOpenBackorderRefund}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
                  Xác nhận đã hoàn tiền
                </button>
              ) : null}
              {canShipOrder(order) && (!contractOrder || canShipContract) ? (
                <button
                  type="button"
                  disabled={isSaving || !canApplyShip}
                  title={shipLockReason || undefined}
                  onClick={() => runAction('ship')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                  {contractOrder ? 'Xác nhận đã xuất hàng khỏi kho' : 'Chuyển sang đang giao'}
                </button>
              ) : null}
              {canCompleteOrder(order) && (!contractOrder || canReceiveContract) ? (
                <button
                  type="button"
                  disabled={isSaving || !canApplyChanges}
                  onClick={() => runAction('complete')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  {contractOrder ? 'Khách đã nhận hàng — ghi công nợ' : 'Hoàn tất đơn'}
                </button>
              ) : null}
              {canMarkDelivered(order) ? (
                remainingAtPickup > 0 ? (
                  <button
                    type="button"
                    disabled={isSaving || !canApplyChanges}
                    onClick={() => setIsCollectRemainingOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    {normalizedStatus === 'Completed'
                      ? `Thu ${formatVnd(remainingAtPickup)} còn lại`
                      : `Thu ${formatVnd(remainingAtPickup)} còn lại & giao hàng`}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving || !canApplyChanges}
                    onClick={() => runAction('markDelivered')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#457053] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory</span>
                    Đã giao hàng cho khách
                  </button>
                )
              ) : null}
              {canCollectCod && canVerifyCod(order) ? (
                <button
                  type="button"
                  disabled={isSaving || !canMutate}
                  onClick={() => setIsCodVerifyOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">price_check</span>
                  Đã giao &amp; thu tiền (COD)
                </button>
              ) : null}
              {canManage && canReturnOrder(order) ? (
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={() => canMutate && navigate(`/pos/returns/${order.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#538463]/40 bg-[#f6f4ec] px-3 py-2 text-sm font-bold text-[#356647] shadow-sm hover:bg-[#ebe8dc] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">assignment_return</span>
                  Trả hàng / Đổi
                </button>
              ) : null}
              {canReprintReceipt(order) ? (
                <button
                  type="button"
                  disabled={isReprinting}
                  onClick={() => setIsReprintOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  In lại hóa đơn
                </button>
              ) : null}
              {canCancelOrder(order) && !isAwaitingFulfillment && !isCancellationRequested ? (
                <button
                  type="button"
                  disabled={isSaving || !canApplyChanges}
                  onClick={() => runAction('cancel')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Hủy đơn
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setIsTimelineOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Lịch sử đơn hàng
          </button>
        </div>
      </div>

      {shipLockReason && canShipOrder(order) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Nút «Chuyển sang đang giao» đang khóa</p>
          <p className="mt-1">{shipLockReason}</p>
          {!inventorySyncedForShip ? (
            <p className="mt-1 text-amber-800">
              Đợi Thủ kho xác nhận xuất/SX (trạng thái «Đã đồng bộ kho») — sau đó Sale có thể chuyển đang giao kể cả ngoài giờ ca.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Khách hàng</h2>
            <OrderCustomerCell snapshot={order.customerSnapshotName} customerId={order.customerId} />
            {isUsableShippingAddress(order.shippingAddress) ? (
              <p className="mt-2 text-sm text-slate-600">{order.shippingAddress}</p>
            ) : requiresShippingAddress(order.orderChannel) ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Chưa có địa chỉ giao hàng hợp lệ
              </p>
            ) : null}
          </section>

          <OrderProductsSection
            order={order}
            orderLines={orderLines}
            constrained={compactProducts}
            className=""
          />
        </div>

        <aside className="space-y-4">
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
                ĐƠN HẸN KHÁCH GIAO SAU
              </h2>
              <dl className="space-y-1.5 text-sm text-slate-700">
                <div className="flex justify-between gap-3">
                  <dt>Hình thức nhận</dt>
                  <dd className="text-right font-semibold">
                    {order.fulfillmentPreference === 'CompleteDelivery'
                      || (order.customBundles || []).some((b) => (b.ingredients || []).length > 0)
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
                  <dd className="font-semibold">{getRefundStatusLabel(order.refundStatus)}</dd>
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

          {order.pickupDate || order.deliveredAt || order.pickupCode ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Hẹn lấy hàng</h2>
              {order.pickupCode ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Mã nhận hàng</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-amber-900">
                    {order.pickupCode}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">Đối chiếu mã này trước khi bấm &quot;Đã giao&quot;.</p>
                </div>
              ) : null}
              <dl className="space-y-2 text-sm text-slate-700">
                {order.pickupDate ? (
                  <div className="flex justify-between gap-3">
                    <dt>Ngày hẹn</dt>
                    <dd className="font-semibold">{formatVietnamDate(order.pickupDate)}</dd>
                  </div>
                ) : null}
                {order.pickupContactName?.trim() ? (
                  <div className="flex justify-between gap-3">
                    <dt>Người nhận</dt>
                    <dd className="font-semibold">{order.pickupContactName}</dd>
                  </div>
                ) : null}
                {order.pickupContactPhone?.trim() ? (
                  <div className="flex justify-between gap-3">
                    <dt>Số điện thoại</dt>
                    <dd className="font-semibold tabular-nums">{order.pickupContactPhone}</dd>
                  </div>
                ) : null}
                {order.deliveredAt ? (
                  <div className="flex justify-between gap-3">
                    <dt>Đã giao</dt>
                    <dd className="font-semibold text-emerald-700">
                      {deliveredByName || order.sellerName || '—'} · {formatVietnamDateTime(order.deliveredAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {order.pickupNote?.trim() ? (
                <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">Ghi chú: {order.pickupNote}</p>
              ) : null}
            </section>
          ) : null}

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

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Người bán</h2>
                <p className="text-sm font-semibold text-slate-800">
                  {order.sellerName?.trim() ? order.sellerName : '—'}
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thanh toán</h2>
                {payment ? (
                  <>
                    <p className="text-sm text-slate-700">{getOrderPaymentMethodLabel(order)}</p>
                    {paymentBreakdown.length > 0 ? (
                      <dl className="mt-2 space-y-1 text-xs text-slate-600">
                        {paymentBreakdown.map((row) => (
                          <div key={row.id} className="flex justify-between gap-3">
                            <dt>{getPaymentPurposeLabel(row.paymentPurpose)}: {getPaymentMethodLabel(row.paymentMethod)}</dt>
                            <dd className="font-semibold text-slate-800">{formatVnd(row.amount)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
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
                    {hasDeposit ? (
                      <p className="mt-2 text-xs text-[#7e5700]">
                        Đã đặt cọc {formatVnd(order.depositAmount)}
                        {remainingAtPickup > 0
                          ? ` — còn ${formatVnd(remainingAtPickup)} thu khi khách nhận hàng.`
                          : ' — đã thu đủ.'}
                      </p>
                    ) : null}
                    {payment.isCodVerified ? (
                      <p className="mt-2 text-xs text-emerald-700">COD đã xác nhận</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Chưa có thanh toán.</p>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {String(order.orderChannel).toUpperCase() === 'COD' || contractOrder ? (
        <OrderStockReservationSection orderId={order.id} refreshKey={timelineRefreshKey} />
      ) : null}

      {isTimelineOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsTimelineOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Lịch sử đơn hàng</h2>
                <p className="mt-0.5 text-sm text-slate-500">{order.orderCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTimelineOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <OrderTimeline orderId={order.id} refreshKey={timelineRefreshKey} />
            </div>
          </div>
        </div>
      ) : null}

      <CollectRemainingPaymentModal
        isOpen={isCollectRemainingOpen}
        order={order}
        remainingAmount={remainingAtPickup}
        isSubmitting={isSaving}
        onClose={() => setIsCollectRemainingOpen(false)}
        onConfirm={handleCollectRemaining}
        onPaid={handleRemainingPaid}
      />

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
                  codExpectedAmount:
                    parseExpectedCollectedAmount(codPayment?.codDebtSettlementJson)
                    ?? order.codExpectedAmount
                    ?? codPayment?.amount
                    ?? null,
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

      <BackorderRefundModal
        isOpen={isBackorderRefundOpen}
        order={order}
        isSaving={isSaving}
        hasImmediateItems={
          order?.fulfillmentPreference === 'PartialDelivery'
          && order?.items?.some((item) => Number(item.immediateFulfilledQuantity || 0) > 0)
        }
        onClose={() => setIsBackorderRefundOpen(false)}
        onConfirm={handleConfirmBackorderRefund}
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
