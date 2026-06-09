import { useEffect, useMemo, useState } from 'react'

import { Link, useNavigate } from 'react-router-dom'

import PageHeader from '../../../components/shared/PageHeader.jsx'

import PageShell from '../../../components/shared/PageShell.jsx'

import { showError, showSuccess } from '../../../app/toast.js'

import { fetchSkus } from '../../products/services/productSkusApi.js'

import OrderCustomerSection from '../components/OrderCustomerSection.jsx'

import { createOrder } from '../services/ordersApi.js'

import {

  calcOrderFinalAmount,

  calcOrderLineSubtotal,

  formatVnd,

  getCreateOrderPaymentOptions,

  isPosChannel,

  ORDER_CHANNEL_CREATE_OPTIONS,

  requiresShippingAddress,

} from '../utils/orderDisplay.js'



const EMPTY_LINE = { skuId: '', skuSnapshotName: '', skuSnapshotCode: '', quantity: 1, unitPrice: 0 }



function OrderCreatePage() {

  const navigate = useNavigate()

  const [isSaving, setIsSaving] = useState(false)

  const [skuOptions, setSkuOptions] = useState([])

  const [form, setForm] = useState({

    orderChannel: 'POS',

    customerId: null,

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

        const result = await fetchSkus({ isActive: true, pageSize: 100 })

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



  useEffect(() => {
    if (!isPosChannel(form.orderChannel)) return
    setForm((prev) => ({
      ...prev,
      paidAmount: calcOrderFinalAmount(prev.items, prev.discountAmount),
    }))
  }, [form.orderChannel, form.items, form.discountAmount])



  const subtotal = useMemo(() => calcOrderLineSubtotal(form.items), [form.items])

  const finalAmount = useMemo(

    () => calcOrderFinalAmount(form.items, form.discountAmount),

    [form.items, form.discountAmount],

  )



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
        paidAmount: nextIsPos ? calcOrderFinalAmount(prev.items, prev.discountAmount) : prev.paidAmount,
      }
    })
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }



  function updateCustomer(patch) {

    setForm((prev) => ({ ...prev, ...patch }))

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

      updateLine(index, { skuId: '', skuSnapshotName: '', skuSnapshotCode: '', unitPrice: 0 })

      return

    }

    updateLine(index, {

      skuId: sku.id,

      skuSnapshotName: sku.packagingType || sku.skuCode,

      skuSnapshotCode: sku.skuCode,

      unitPrice: sku.basePrice,

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



    const items = form.items

      .filter((line) => line.skuId)

      .map((line) => ({

        skuId: line.skuId,

        skuSnapshotName: line.skuSnapshotName,

        skuSnapshotCode: line.skuSnapshotCode,

        quantity: Number(line.quantity),

        unitPrice: Number(line.unitPrice),

      }))



    if (!items.length) {

      showError('Vui lòng thêm ít nhất một SKU.')

      return

    }



    if (needsShippingAddress && !form.shippingAddress.trim()) {

      showError('Kênh online cần địa chỉ giao hàng.')

      return

    }



    try {

      setIsSaving(true)

      const created = await createOrder({

        customerId: form.customerId || null,

        customerSnapshotName: form.customerSnapshotName.trim() || null,

        orderChannel:
          form.paymentMethod === 'COD' && !isPosChannel(form.orderChannel) ? 'COD' : form.orderChannel,

        shippingAddress: form.shippingAddress,

        note: form.note,

        discountAmount: Number(form.discountAmount || 0),

        paidAmount: (() => {
          if (form.paymentMethod === 'COD') return 0
          const paid = Number(form.paidAmount || 0)
          if (isPosChannel(form.orderChannel) && paid < finalAmount) return finalAmount
          return paid
        })(),

        paymentMethod: form.paymentMethod,

        items,

      })

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

        description="Tạo đơn bán trực tiếp tại quầy, Zalo, điện thoại hoặc website."

        rightContent={

          <Link className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/orders">

            Quay lại

          </Link>

        }

      />



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

                        {sku.skuCode} · {sku.packagingType} · {formatVnd(sku.basePrice)}

                      </option>

                    ))}

                  </select>

                </label>

                <label className="space-y-1 md:col-span-2">

                  <span className="text-xs font-semibold text-slate-500">SL</span>

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

            <label className="space-y-1">

              <span className="text-xs font-semibold text-slate-500">Giảm giá</span>

              <input

                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"

                inputMode="decimal"

                value={form.discountAmount}

                onChange={(e) => updateField('discountAmount', e.target.value)}

              />

            </label>

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

            <div className="flex justify-between py-1 font-bold text-[#356647]">

              <span>Thành tiền</span>

              <span>{formatVnd(finalAmount)}</span>

            </div>

          </div>

        </section>



        <div className="flex flex-wrap gap-3">

          <button

            type="submit"

            disabled={isSaving}

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


