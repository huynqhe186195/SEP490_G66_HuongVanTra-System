import { useEffect, useMemo, useRef, useState } from 'react'

import { Link, useNavigate } from 'react-router-dom'

import PageHeader from '../../../components/shared/PageHeader.jsx'

import PageShell from '../../../components/shared/PageShell.jsx'

import { showError, showInfo, showSuccess } from '../../../app/toast.js'

import { fetchStoreSkus } from '../../products/services/productSkusApi.js'

import OrderCustomerSection from '../components/OrderCustomerSection.jsx'
import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import {
  getPosBaseUnitLabel,
  normalizePosBaseQuantity,
} from '../../pos/utils/posQuantity.js'

import { createOrder } from '../services/ordersApi.js'
import { createCheckoutAttemptManager } from '../utils/checkoutAttempt.js'
import { validateZeroTotalCheckout } from '../../pos/utils/posDiscountValidation.js'

import { loadAuthSession } from '../../auth/services/authSession.js'

import { canViewAllOrders } from '../../auth/utils/permissions.js'

import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'

import {

  calcOrderLineSubtotal,

  formatVnd,

  getCreateOrderPaymentOptions,

  isPosChannel,

  ORDER_CHANNEL_CREATE_OPTIONS,

  requiresShippingAddress,

} from '../utils/orderDisplay.js'



const EMPTY_LINE = {
  skuId: '',
  skuSnapshotName: '',
  skuSnapshotCode: '',
  quantity: 1,
  unitPrice: 0,
  inventoryUnit: '',
  priceUnit: '',
}

function calculateCreatePricing(items, discountAmount, customer) {
  const subtotal = calcOrderLineSubtotal(items)
  const isVip = isVipCustomerType(customer?.customerType)
  const manualDiscountAmount = isVip
    ? Math.max(0, Number(discountAmount) || 0)
    : 0
  const tierDiscountPercent = isVip
    ? 0
    : Number(customer?.tier?.discountPercent ?? customer?.tierDiscountPercent ?? 0)
  const membershipDiscountAmount = Math.round(
    Math.max(0, subtotal - manualDiscountAmount) * tierDiscountPercent / 100,
  )

  return {
    subtotal,
    manualDiscountAmount,
    membershipDiscountAmount,
    finalAmount: Math.max(
      0,
      subtotal - manualDiscountAmount - membershipDiscountAmount,
    ),
  }
}



function OrderCreatePage() {

  const navigate = useNavigate()

  const session = loadAuthSession()

  const isManager = canViewAllOrders(session)

  const [isSaving, setIsSaving] = useState(false)
  const checkoutAttemptRef = useRef(createCheckoutAttemptManager())

  const [skuOptions, setSkuOptions] = useState([])

  const [shelfOnDuty, setShelfOnDuty] = useState(null)

  const [checkingShift, setCheckingShift] = useState(!isManager)

  const [form, setForm] = useState({

    orderChannel: 'POS',

    customerId: null,
    selectedCustomer: null,

    customerSnapshotName: '',

    shippingAddress: '',

    note: '',

    discountAmount: 0,

    paidAmount: 0,

    paymentMethod: 'Cash',

    items: [{ ...EMPTY_LINE }],

  })



  useEffect(() => {

    let mounted = true

    async function loadSkus() {

      try {

        const result = await fetchStoreSkus({ isActive: true, pageSize: 100 })

        if (mounted) setSkuOptions(result.items)

      } catch (error) {

        if (mounted) showError(error.message)

      }

    }

    loadSkus()

    return () => {

      mounted = false

    }

  }, [])



  const {
    subtotal,
    manualDiscountAmount,
    membershipDiscountAmount,
    finalAmount,
  } = useMemo(
    () => calculateCreatePricing(
      form.items,
      form.discountAmount,
      form.selectedCustomer,
    ),
    [form.discountAmount, form.items, form.selectedCustomer],
  )

  const canUseManualDiscount = isVipCustomerType(form.selectedCustomer?.customerType)

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



  useEffect(() => {
    if (!isPosChannel(form.orderChannel)) return
    setForm((prev) => ({
      ...prev,
      paidAmount: calculateCreatePricing(
        prev.items,
        prev.discountAmount,
        prev.selectedCustomer,
      ).finalAmount,
    }))
  }, [finalAmount, form.orderChannel])



  const needsShippingAddress = requiresShippingAddress(form.orderChannel)

  const isPos = isPosChannel(form.orderChannel)

  const paymentOptions = useMemo(
    () => getCreateOrderPaymentOptions(form.orderChannel),
    [form.orderChannel],
  )



  function handleChannelChange(channel) {
    setForm((prev) => {
      const nextIsPos = isPosChannel(channel)
      const nextPayment = nextIsPos ? 'Cash' : prev.paymentMethod === 'COD' ? prev.paymentMethod : 'COD'
      return {
        ...prev,
        orderChannel: channel,
        paymentMethod: nextPayment,
        paidAmount: nextIsPos
          ? calculateCreatePricing(
              prev.items,
              prev.discountAmount,
              prev.selectedCustomer,
            ).finalAmount
          : prev.paidAmount,
      }
    })
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }



  function updateCustomer(patch) {
    const changesCustomer = Object.prototype.hasOwnProperty.call(patch, 'selectedCustomer')
    const nextCustomer = changesCustomer ? patch.selectedCustomer : form.selectedCustomer
    const mustClearManualDiscount = changesCustomer
      && !isVipCustomerType(nextCustomer?.customerType)
      && Number(form.discountAmount || 0) > 0

    setForm((prev) => ({
      ...prev,
      ...patch,
      ...(mustClearManualDiscount ? { discountAmount: 0 } : {}),
    }))
    if (mustClearManualDiscount) {
      showInfo('Đã xóa chiết khấu thủ công vì khách mới không phải khách đối ngoại (VIP).')
    }

  }



  function updateLine(index, patch) {

    setForm((prev) => ({

      ...prev,

      items: prev.items.map((line, i) => (i === index ? { ...line, ...patch } : line)),

    }))

  }



  function handleSkuPick(index, skuId) {

    const sku = skuOptions.find((item) => String(item.id) === String(skuId))

    if (!sku) {

      updateLine(index, {
        skuId: '',
        skuSnapshotName: '',
        skuSnapshotCode: '',
        unitPrice: 0,
        inventoryUnit: '',
        priceUnit: '',
      })

      return

    }

    updateLine(index, {

      skuId: sku.id,

      skuSnapshotName: sku.productName
        ? `${sku.productName}${sku.packagingType ? ` — ${sku.packagingType}` : ''}`
        : sku.packagingType || sku.skuCode,

      skuSnapshotCode: sku.skuCode,

      unitPrice: sku.basePrice,
      inventoryUnit: sku.inventoryUnit,
      priceUnit: sku.priceUnit,

    })

  }



  function addLine() {

    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_LINE }] }))

  }



  function removeLine(index) {

    setForm((prev) => ({

      ...prev,

      items: prev.items.length <= 1 ? prev.items : prev.items.filter((_, i) => i !== index),

    }))

  }



  async function handleSubmit(event) {

    event.preventDefault()
    if (isSaving || checkoutAttemptRef.current.isProcessing()) return



    if (!canMutate) {
      showError('Bạn chưa đến ca / chưa được duyệt ca quầy — không thể tạo đơn.')
      return
    }

    let items
    try {
      items = form.items
        .filter((line) => line.skuId)
        .map((line) => ({
          skuId: line.skuId,
          skuSnapshotName: line.skuSnapshotName,
          skuSnapshotCode: line.skuSnapshotCode,
          quantity: normalizePosBaseQuantity(line.quantity, line.inventoryUnit),
          unitPrice: Number(line.unitPrice),
        }))
    } catch (error) {
      showError(error?.message || 'Số lượng không hợp lệ.')
      return
    }



    if (!items.length) {

      showError('Vui lòng thêm ít nhất một SKU.')

      return

    }



    if (needsShippingAddress && !form.shippingAddress.trim()) {

      showError('Kênh online cần địa chỉ giao hàng.')

      return

    }

    const zeroTotalCheck = validateZeroTotalCheckout({
      items,
      finalAmount,
    })
    if (!zeroTotalCheck.ok) {
      showError(zeroTotalCheck.error)
      return
    }

    const enteredPaidAmount = form.paymentMethod === 'COD'
      ? 0
      : Number(form.paidAmount || 0)
    if (!form.customerId && enteredPaidAmount < finalAmount) {
      showError('Khách lẻ phải thanh toán đủ. Vui lòng đăng ký hoặc chọn khách hàng trước khi bán nợ/thanh toán một phần.')
      return
    }



    try {

      setIsSaving(true)

      const paidAmount = form.paymentMethod === 'COD'
        ? 0
        : Math.min(Number(form.paidAmount || 0), finalAmount)

      const request = {

        customerId: form.customerId || null,

        customerSnapshotName: form.customerSnapshotName.trim() || null,

        orderChannel:
          form.paymentMethod === 'COD' && !isPosChannel(form.orderChannel) ? 'COD' : form.orderChannel,

        shippingAddress: form.shippingAddress,

        note: form.note,

        discountAmount: manualDiscountAmount,

        paidAmount,

        paymentMethod: form.paymentMethod,

        payments: paidAmount > 0
          ? [{ paymentMethod: form.paymentMethod, amount: paidAmount }]
          : [],

        items,

      }
      const created = await checkoutAttemptRef.current.submit(
        request,
        (idempotencyKey) => createOrder(request, { idempotencyKey }),
      )

      showSuccess(`Đã tạo đơn ${created.orderCode}.`)

      navigate(`/orders/${created.id}`)

    } catch (error) {

      showError(error.message)

    } finally {

      setIsSaving(false)

    }

  }



  return (

    <PageShell>

      <PageHeader

        title="Tạo đơn hàng"

        titleInfo="Tạo đơn bán trực tiếp tại quầy, Zalo, điện thoại hoặc website."

        rightContent={

          <Link className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/orders">

            Quay lại

          </Link>

        }

      />



      {!checkingShift && !canMutate ? (

        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">

          <span className="material-symbols-outlined text-[18px]">schedule</span>

          <p>

            Ngoài giờ ca — chỉ xem, không tạo đơn mới.{' '}

            <Link to="/my-shifts" className="font-semibold underline">

              Vào «Lịch làm việc»

            </Link>{' '}

            để đăng ký hoặc chờ đến giờ ca.

          </p>

        </div>

      ) : null}



      <form className="space-y-6" onSubmit={handleSubmit}>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

          <h2 className="mb-4 text-lg font-bold text-slate-800">Thông tin đơn</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            <label className="space-y-1">

              <span className="text-xs font-semibold text-slate-500">Kênh bán *</span>

              <select

                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"

                value={form.orderChannel}

                onChange={(e) => handleChannelChange(e.target.value)}

              >

                {ORDER_CHANNEL_CREATE_OPTIONS.map((opt) => (

                  <option key={opt.value} value={opt.value}>

                    {opt.label}

                  </option>

                ))}

              </select>
              {isPos ? (
                <p className="text-xs text-slate-500">
                  Bán tại quầy — không bắt buộc địa chỉ giao. Đơn thanh toán đủ sẽ được hoàn tất ngay.
                </p>
              ) : null}
            </label>

            <label className="space-y-1 md:col-span-2">

              <span className="text-xs font-semibold text-slate-500">Ghi chú</span>

              <textarea

                className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"

                value={form.note}

                onChange={(e) => updateField('note', e.target.value)}

              />

            </label>

          </div>

        </section>



        <OrderCustomerSection

          customerId={form.customerId}

          customerSnapshotName={form.customerSnapshotName}

          shippingAddress={form.shippingAddress}

          requireShippingAddress={needsShippingAddress}

          onChange={updateCustomer}

        />



        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center justify-between gap-3">

            <h2 className="text-lg font-bold text-slate-800">Sản phẩm (SKU)</h2>

            <button type="button" className="text-sm font-semibold text-[#538463]" onClick={addLine}>

              + Thêm dòng

            </button>

          </div>



          <div className="space-y-3">

            {form.items.map((line, index) => (

              <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-[#fbf9f1] p-4 md:grid-cols-12">

                <label className="space-y-1 md:col-span-5">

                  <span className="text-xs font-semibold text-slate-500">SKU *</span>

                  <select

                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"

                    value={line.skuId}

                    onChange={(e) => handleSkuPick(index, e.target.value)}

                  >

                    <option value="">Chọn SKU...</option>

                    {skuOptions.map((sku) => (

                      <option key={sku.id} value={sku.id}>

                        {[sku.productName, sku.packagingType || sku.skuCode].filter(Boolean).join(' — ')} · {formatVnd(sku.basePrice)}

                      </option>

                    ))}

                  </select>

                </label>

                <label className="space-y-1 md:col-span-2">

                  <span className="text-xs font-semibold text-slate-500">
                    SL {line.inventoryUnit ? `(${getPosBaseUnitLabel(line.inventoryUnit)})` : ''}
                  </span>

                  <input

                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"

                    inputMode="numeric"

                    min="1"

                    value={line.quantity}

                    onChange={(e) => updateLine(index, { quantity: e.target.value })}

                  />

                </label>

                <label className="space-y-1 md:col-span-3">

                  <span className="text-xs font-semibold text-slate-500">Đơn giá</span>

                  <input

                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"

                    inputMode="decimal"

                    value={line.unitPrice}

                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}

                  />

                </label>

                <div className="flex items-end justify-between gap-2 md:col-span-2">

                  <p className="text-sm font-semibold text-[#356647]">

                    {formatVnd(Number(line.quantity || 0) * Number(line.unitPrice || 0))}

                  </p>

                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => removeLine(index)}>

                    Xóa

                  </button>

                </div>

              </div>

            ))}

          </div>

        </section>



        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

          <h2 className="mb-4 text-lg font-bold text-slate-800">Thanh toán</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <label className="space-y-1">

              <span className="text-xs font-semibold text-slate-500">Phương thức *</span>

              <select

                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"

                value={form.paymentMethod}

                onChange={(e) => updateField('paymentMethod', e.target.value)}

              >

                {paymentOptions.map((opt) => (

                  <option key={opt.value} value={opt.value}>

                    {opt.label}

                  </option>

                ))}

              </select>

            </label>

            {canUseManualDiscount ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Chiết khấu thủ công VIP</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  inputMode="decimal"
                  value={form.discountAmount}
                  onChange={(e) => updateField('discountAmount', e.target.value)}
                />
              </label>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                Chiết khấu thủ công chỉ dành cho khách đối ngoại (VIP). Ưu đãi hạng thành viên được tự động áp dụng.
              </div>
            )}

            {form.paymentMethod !== 'COD' ? (

              <label className="space-y-1">

                <span className="text-xs font-semibold text-slate-500">Đã thu</span>

                <input

                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"

                  inputMode="decimal"

                  value={form.paidAmount}

                  onChange={(e) => updateField('paidAmount', e.target.value)}

                />

              </label>

            ) : null}

          </div>



          <div className="mt-4 rounded-xl bg-[#fbf9f1] p-4 text-sm">

            <div className="flex justify-between py-1">

              <span>Tạm tính</span>

              <span>{formatVnd(subtotal)}</span>

            </div>

            {manualDiscountAmount > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Chiết khấu thủ công VIP</span>
                <span>-{formatVnd(manualDiscountAmount)}</span>
              </div>
            ) : null}

            {membershipDiscountAmount > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Ưu đãi hạng thành viên</span>
                <span>-{formatVnd(membershipDiscountAmount)}</span>
              </div>
            ) : null}

            <div className="flex justify-between py-1 font-bold text-[#356647]">

              <span>Thành tiền</span>

              <span>{formatVnd(finalAmount)}</span>

            </div>

          </div>

        </section>



        <div className="flex flex-wrap gap-3">

          <button

            type="submit"

            disabled={isSaving || !canMutate}

            className="rounded-xl bg-[#538463] px-6 py-3 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"

          >

            {isSaving ? 'Đang tạo...' : 'Tạo đơn hàng'}

          </button>

          <Link className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700" to="/orders">

            Hủy

          </Link>

        </div>

      </form>

    </PageShell>

  )

}



export default OrderCreatePage


