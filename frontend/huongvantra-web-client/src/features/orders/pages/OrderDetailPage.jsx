import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateOrder } from '../../auth/utils/permissions.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CodVerifyModal from '../components/CodVerifyModal.jsx'
import { parseCodDebtSettlement } from '../../customers/utils/codDebtSettlementUtils.js'
import OrderCustomerCell from '../components/OrderCustomerCell.jsx'
import OrderProductsSection from '../components/OrderProductsSection.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import OrderTransferQrPanel from '../components/OrderTransferQrPanel.jsx'
import OrderUpdateMetaModal from '../components/OrderUpdateMetaModal.jsx'
import {
  cancelOrder,
  completeOrder,
  fetchOrder,
  shipOrder,
  updateOrder,
} from '../services/ordersApi.js'
import {
  canCancelOrder,
  canCompleteOrder,
  canEditOrderMeta,
  canShipOrder,
  canVerifyCod,
  isCodChannelOrder,
  isPendingPaymentOrder,
  isPendingTransferPayment,
  formatVnd,
  resolveInventorySyncMeta,
  getOrderChannelLabel,
  getOrderKindLabel,
  isExchangeOrder,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  getPrimaryPayment,
} from '../utils/orderDisplay.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { buildProductCatalogLookups, resolveOrderLineDisplay } from '../../products/utils/productDisplay.js'
function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromCod = searchParams.get('from') === 'cod'
  const fromExchange = searchParams.get('from') === 'exchange'
  const canManage = canCreateOrder(loadAuthSession())

  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isCodVerifyOpen, setIsCodVerifyOpen] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [catalogLookups, setCatalogLookups] = useState(() => buildProductCatalogLookups())

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
          fetchProducts({ isActive: true, page: 1, pageSize: 100 }),
          fetchAllActiveSkus(100),
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
    if (!canManage || !order) return
    try {
      setIsSaving(true)
      const updated = await updateOrder(order.id, values)
      setOrder(updated)
      setTimelineRefreshKey((key) => key + 1)
      setIsUpdateModalOpen(false)
      showSuccess('Đã cập nhật đơn hàng.')
    } catch (error) {
      showError(error.message)
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

  async function runAction(action) {
    if (!canManage || !order) return
    try {
      setIsSaving(true)
      if (action === 'ship') {
        await shipOrder(order.id)
        showSuccess('Đã chuyển sang trạng thái đang giao.')
      } else if (action === 'complete') {
        await completeOrder(order.id)
        showSuccess('Đã hoàn tất đơn hàng.')
      } else if (action === 'cancel') {
        if (!window.confirm('Hủy đơn hàng này?')) return
        await cancelOrder(order.id)
        showSuccess('Đã hủy đơn hàng.')
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
  const showTransferQr = isPendingTransferPayment(order)
  const compactProducts = isPendingPaymentOrder(order)
  const inventorySyncMeta = resolveInventorySyncMeta(order)

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
                ? 'Đơn đổi hàng'
                : 'Danh sách đơn'}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{order.orderCode}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isExchangeOrder(order) ? getOrderKindLabel(order.orderKind) : getOrderChannelLabel(order.orderChannel)} · Tạo lúc{' '}
            {formatVietnamDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && canEditOrderMeta(order) ? (
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
              total={order.finalAmount}
              customerName={order.customerSnapshotName}
              onPaid={() => {
                loadOrder()
                setTimelineRefreshKey((key) => key + 1)
              }}
            />
          ) : null}

          {payment && !showTransferQr ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thanh toán</h2>
              <p className="text-sm text-slate-700">{getPaymentMethodLabel(payment.paymentMethod)}</p>
              <p className="mt-1 text-sm font-semibold">{formatVnd(payment.amount)}</p>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClass(payment.paymentStatus)}`}>
                {getPaymentStatusLabel(payment.paymentStatus)}
              </span>
              {payment.isCodVerified ? (
                <p className="mt-2 text-xs text-emerald-700">COD đã xác nhận</p>
              ) : null}
            </section>
          ) : null}

          {canManage ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Thao tác</h2>
              <div className="flex flex-col gap-2">
                {canShipOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runAction('ship')}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Chuyển sang đang giao
                  </button>
                ) : null}
                {canCompleteOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => runAction('complete')}
                    className="rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                  >
                    Hoàn tất đơn
                  </button>
                ) : null}
                {canVerifyCod(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsCodVerifyOpen(true)}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Đã giao &amp; thu tiền (COD)
                  </button>
                ) : null}
                {canCancelOrder(order) ? (
                  <button
                    type="button"
                    disabled={isSaving}
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
        isSaving={isSaving}
        onClose={() => setIsUpdateModalOpen(false)}
        onSave={handleSaveMeta}
      />

    </div>
    </PageShell>
  )
}

export default OrderDetailPage
