import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import OrderCustomerSection from '../components/OrderCustomerSection.jsx'
import { isCorporateCustomerType } from '../../customers/utils/customerDisplay.js'
import { fetchActiveContractForCustomer } from '../../contracts/services/contractsApi.js'
import { normalizePosBaseQuantity } from '../../pos/utils/posQuantity.js'
import { createOrder } from '../services/ordersApi.js'
import { createCheckoutAttemptManager } from '../utils/checkoutAttempt.js'
import { validateZeroTotalCheckout } from '../../pos/utils/posDiscountValidation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateB2BOrder } from '../../auth/utils/permissions.js'
import { calcOrderLineSubtotal, formatVnd } from '../utils/orderDisplay.js'

const B2B_PAYMENT_OPTIONS = [
  { value: 'Debt', label: 'Ghi nợ (thanh toán sau)' },
  { value: 'Cash', label: 'Tiền mặt' },
  { value: 'BankTransfer', label: 'Chuyển khoản' },
]

function OrderCreatePage() {
  const navigate = useNavigate()
  const session = loadAuthSession()
  const canCreate = canCreateB2BOrder(session)

  const [isSaving, setIsSaving] = useState(false)
  const checkoutAttemptRef = useRef(createCheckoutAttemptManager())

  const [form, setForm] = useState({
    customerId: null,
    selectedCustomer: null,
    customerSnapshotName: '',
    shippingAddress: '',
    note: '',
    paidAmount: 0,
    paymentMethod: 'Debt',
    items: [],
  })

  const [contractState, setContractState] = useState({
    customerId: null,
    contract: null,
    loading: false,
    error: null,
  })

  const isCorporateCustomer = isCorporateCustomerType(form.selectedCustomer?.customerType)

  useEffect(() => {
    if (!form.customerId) {
      setContractState({ customerId: null, contract: null, loading: false, error: null })
      return undefined
    }
    if (!isCorporateCustomer) {
      setContractState({ customerId: form.customerId, contract: null, loading: false, error: null })
      return undefined
    }

    let mounted = true
    setContractState((prev) => ({ ...prev, loading: true, error: null }))
    fetchActiveContractForCustomer(form.customerId)
      .then((contract) => {
        if (!mounted) return
        setContractState({ customerId: form.customerId, contract, loading: false, error: null })
      })
      .catch((error) => {
        if (!mounted) return
        setContractState({
          customerId: form.customerId,
          contract: null,
          loading: false,
          error: error?.message || 'Không tải được hợp đồng của khách hàng.',
        })
      })

    return () => { mounted = false }
  }, [isCorporateCustomer, form.customerId])

  const contractLoaded = contractState.customerId === form.customerId && !contractState.loading
  const contract = contractLoaded ? contractState.contract : null
  const contractError = contractLoaded ? contractState.error : null

  // Khi hợp đồng thay đổi: reset selection về trống
  useEffect(() => {
    setForm((prev) => ({ ...prev, items: [] }))
    setSelectedSkuIds(new Set())
    setLineQty({})
  }, [contract?.id])

  // selectedSkuIds: tập các skuId đã được tick chọn
  const [selectedSkuIds, setSelectedSkuIds] = useState(new Set())
  // lineQty: { [skuId]: quantity string } cho phần input số lượng
  const [lineQty, setLineQty] = useState({})

  // Sync form.items từ selectedSkuIds + lineQty mỗi khi thay đổi
  useEffect(() => {
    if (!contract?.lineItems?.length) return
    const items = contract.lineItems
      .filter((li) => li.skuId && selectedSkuIds.has(li.skuId))
      .map((li) => ({
        skuId: li.skuId,
        skuSnapshotName: li.productName || li.skuCode || '',
        skuSnapshotCode: li.skuCode || '',
        quantity: lineQty[li.skuId] ?? 1,
        unitPrice: li.unitPrice || 0,
        inventoryUnit: li.unit || 'Piece',
        priceUnit: li.unit || '',
      }))
    setForm((prev) => ({ ...prev, items }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkuIds, lineQty, contract?.id])

  function toggleSkuSelection(skuId) {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev)
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return next
    })
  }

  function updateLineQty(skuId, value) {
    const contractItem = contract?.lineItems?.find((li) => li.skuId === skuId)
    const max = contractItem?.quantity ?? Infinity
    const clamped = Math.min(Math.max(1, Number(value) || 1), max)
    setLineQty((prev) => ({ ...prev, [skuId]: clamped }))
  }

  const subtotal = useMemo(() => calcOrderLineSubtotal(form.items), [form.items])
  // Chiết khấu tự động theo % đã thỏa thuận trong hợp đồng — không nhập tay
  const discountAmount = useMemo(() => {
    const percent = Number(contract?.discountPercent ?? 0)
    if (!contract || !(percent > 0)) return 0
    return Math.round(Math.max(0, subtotal) * percent / 100)
  }, [subtotal, contract])
  const finalAmount = Math.max(0, subtotal - discountAmount)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateCustomer({ customerId, customerSnapshotName, selectedCustomer, shippingAddress }) {
    setForm((prev) => ({
      ...prev,
      customerId: customerId ?? prev.customerId,
      customerSnapshotName: customerSnapshotName ?? prev.customerSnapshotName,
      selectedCustomer: selectedCustomer !== undefined ? selectedCustomer : prev.selectedCustomer,
      shippingAddress: shippingAddress ?? prev.shippingAddress,
    }))
  }

  const contractDueDate = useMemo(() => {
    const days = Number(contract?.paymentTermDays ?? 0)
    if (!contract || !(days > 0)) return null
    const due = new Date()
    due.setDate(due.getDate() + days)
    return due
  }, [contract])

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving || checkoutAttemptRef.current.isProcessing()) return

    if (!canCreate) {
      showError('Chỉ Kế toán hoặc Quản lý mới được lập đơn bán theo hợp đồng.')
      return
    }
    if (!form.customerId) {
      showError('Vui lòng chọn khách hàng doanh nghiệp.')
      return
    }
    if (!isCorporateCustomer) {
      showError('Trang này chỉ dùng để lập đơn cho khách hàng doanh nghiệp.')
      return
    }
    if (!contract) {
      showError('Khách doanh nghiệp cần hợp đồng đang hiệu lực mới tạo được đơn.')
      return
    }
    if (!form.items.length) {
      showError('Vui lòng chọn ít nhất một sản phẩm từ danh mục hợp đồng.')
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
          quantity: normalizePosBaseQuantity(line.quantity, 'Piece'),
          unitPrice: Number(line.unitPrice),
        }))
    } catch (error) {
      showError(error?.message || 'Số lượng không hợp lệ.')
      return
    }

    if (!items.length) {
      showError('Vui lòng chọn ít nhất một sản phẩm.')
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

    const creditLimit = Number(contract.creditLimit ?? 0)
    if (creditLimit > 0) {
      const currentDebt = Number(form.selectedCustomer?.currentDebt ?? 0)
      const paidNow = form.paymentMethod === 'Debt' ? 0 : Math.min(Number(form.paidAmount || 0), finalAmount)
      const unpaid = Math.max(0, finalAmount - paidNow)
      if (currentDebt + unpaid > creditLimit) {
        showError(
          `Vượt hạn mức công nợ. Đang nợ ${formatVnd(currentDebt)}, đơn ghi nợ ${formatVnd(unpaid)}, hạn mức ${formatVnd(creditLimit)}.`,
        )
        return
      }
    }

    try {
      setIsSaving(true)
      const paidAmount = form.paymentMethod === 'Debt'
        ? 0
        : Math.min(Number(form.paidAmount || 0), finalAmount)

      const request = {
        customerId: form.customerId,
        customerSnapshotName: form.customerSnapshotName.trim() || null,
        orderChannel: 'B2B',
        contractId: contract.id,
        shippingAddress: form.shippingAddress || null,
        note: form.note || null,
        discountAmount,
        paidAmount,
        paymentMethod: form.paymentMethod,
        payments: paidAmount > 0 ? [{ paymentMethod: form.paymentMethod, amount: paidAmount }] : [],
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

  const isBlocked = !canCreate || (contractLoaded && !contract && !!form.customerId && isCorporateCustomer)

  return (
    <PageShell>
      <PageHeader
        title="Tạo đơn bán theo hợp đồng"
        titleInfo="Lập đơn hàng B2B dựa trên hợp đồng đang hiệu lực của khách doanh nghiệp."
        rightContent={
          <Link className="rounded-xl border border-[#c1c9c0]/40 px-4 py-2.5 text-sm font-semibold text-[#717971] hover:bg-[#f0eee6]" to="/orders">
            Quay lại
          </Link>
        }
      />

      {!canCreate ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="material-symbols-outlined text-[18px]">lock</span>
          <p>Chỉ Kế toán hoặc Quản lý mới được lập đơn bán theo hợp đồng.</p>
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>

        <OrderCustomerSection
          customerId={form.customerId}
          customerSnapshotName={form.customerSnapshotName}
          shippingAddress={form.shippingAddress}
          requireShippingAddress={false}
          customerTypeFilter="CORPORATE"
          hideModeSwitcher
          onChange={updateCustomer}
        />

        {contractState.loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#c1c9c0]/40 bg-[#fafaf7] px-4 py-3 text-sm text-[#717971]">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Đang tải hợp đồng...
          </div>
        ) : null}

        {isCorporateCustomer && contractError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <p>
              {contractError}{' '}
              <Link className="font-semibold underline" to={`/contracts/new?customerId=${form.customerId || ''}`}>
                Tạo hợp đồng
              </Link>
            </p>
          </div>
        ) : null}

        {isCorporateCustomer && contractLoaded && !contract && !contractError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="material-symbols-outlined text-[18px]">description</span>
            <p>
              Khách doanh nghiệp này chưa có hợp đồng đang hiệu lực.{' '}
              <Link className="font-semibold underline" to={`/contracts/new?customerId=${form.customerId || ''}`}>
                Tạo hợp đồng
              </Link>
            </p>
          </div>
        ) : null}

        {contract ? (
          <section className="rounded-2xl border border-[#c1c9c0] bg-[#e8f0e9] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#1b1c17]">
                Hợp đồng · {contract.contractCode}
              </h2>
              <Link className="text-sm font-semibold text-[#356647] underline" to={`/contracts/${contract.id}`}>
                Xem hợp đồng
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold text-[#717971]">Chiết khấu hợp đồng</dt>
                <dd className="font-semibold text-[#1b1c17]">
                  {Number(contract.discountPercent ?? 0) > 0
                    ? `${Number(contract.discountPercent)}%`
                    : 'Không có'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#717971]">Hạn mức công nợ</dt>
                <dd className="font-semibold text-[#1b1c17]">
                  {Number(contract.creditLimit ?? 0) > 0 ? formatVnd(contract.creditLimit) : 'Không giới hạn'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#717971]">Đang nợ</dt>
                <dd className="font-semibold text-[#1b1c17]">
                  {formatVnd(form.selectedCustomer?.currentDebt ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#717971]">Hạn thanh toán</dt>
                <dd className="font-semibold text-[#1b1c17]">
                  {contractDueDate
                    ? `${contractDueDate.toLocaleDateString('vi-VN')} (${contract.paymentTermDays} ngày)`
                    : 'Thu ngay'}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {contract ? (
          <section className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Danh mục hàng hóa theo hợp đồng</p>
                <p className="mt-0.5 text-xs text-[#8a9186]">Tick chọn sản phẩm cần giao lần này — giá theo hợp đồng, không chỉnh được</p>
              </div>
              {contract.lineItems?.length > 0 ? (
                <span className="text-xs text-[#8a9186]">{selectedSkuIds.size}/{contract.lineItems.length} đã chọn</span>
              ) : null}
            </div>

            {!contract.lineItems?.length ? (
              <p className="rounded-xl bg-[#f0eee6] px-4 py-3 text-sm text-[#8a9186]">
                Hợp đồng chưa có dòng hàng hóa. Hãy bổ sung trong trang hợp đồng trước.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#c1c9c0]/40">
                <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-[#f0eee6]">
                      <tr>
                        <th className="w-10 px-3 py-2.5 text-center text-xs font-semibold text-[#717971]">Chọn</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#717971]">Tên hàng / Mã SKU</th>
                        <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-[#717971]">Đơn giá HĐ</th>
                        <th className="w-28 px-3 py-2.5 text-center text-xs font-semibold text-[#717971]">Số lượng lần này</th>
                        <th className="w-36 px-3 py-2.5 text-right text-xs font-semibold text-[#717971]">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c1c9c0]/30 bg-white">
                      {contract.lineItems.map((li) => {
                        const checked = selectedSkuIds.has(li.skuId)
                        const qty = lineQty[li.skuId] ?? 1
                        const lineAmt = checked ? Number(qty || 0) * Number(li.unitPrice || 0) : 0
                        return (
                          <tr
                            key={li.skuId}
                            className={`cursor-pointer transition-colors ${checked ? 'bg-[#538463]/5 hover:bg-[#538463]/10' : 'hover:bg-[#fafaf7]'}`}
                            onClick={() => toggleSkuSelection(li.skuId)}
                          >
                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSkuSelection(li.skuId)}
                                className="h-4 w-4 cursor-pointer accent-[#538463]"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-sm font-medium text-[#1b1c17]">{li.productName || '—'}</p>
                              {li.skuCode ? <p className="text-[11px] text-[#8a9186]">{li.skuCode}</p> : null}
                            </td>
                            <td className="px-3 py-3 text-right text-sm text-[#1b1c17]">
                              {formatVnd(li.unitPrice)}
                            </td>
                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={li.quantity}
                                  disabled={!checked}
                                  value={lineQty[li.skuId] ?? 1}
                                  onChange={(e) => updateLineQty(li.skuId, e.target.value)}
                                  className="w-16 rounded-lg border border-[#c1c9c0]/60 bg-white px-2 py-1.5 text-center text-sm focus:border-[#538463] focus:outline-none focus:ring-1 focus:ring-[#538463]/30 disabled:bg-[#f0eee6] disabled:text-[#aaa] disabled:cursor-not-allowed"
                                />
                                <span className="text-xs text-[#1b1c17] whitespace-nowrap font-medium">/ {li.quantity}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-semibold whitespace-nowrap">
                              {checked
                                ? <span className="text-[#356647]">{formatVnd(lineAmt)}</span>
                                : <span className="text-[#c1c9c0]">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {contract ? (
          <section className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-[#1b1c17]">Thanh toán</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Phương thức *</span>
                <select
                  className="w-full rounded-xl border border-[#c1c9c0]/40 px-3 py-2.5 text-sm focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                  value={form.paymentMethod}
                  onChange={(e) => updateField('paymentMethod', e.target.value)}
                >
                  {B2B_PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {discountAmount > 0 ? (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#717971]">Chiết khấu theo hợp đồng</span>
                  <p className="rounded-xl border border-[#c1c9c0]/40 bg-[#f0eee6] px-3 py-2.5 text-sm text-[#1b1c17]">
                    -{formatVnd(discountAmount)} ({Number(contract.discountPercent ?? 0)}%)
                  </p>
                </div>
              ) : null}

              {form.paymentMethod !== 'Debt' ? (
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[#717971]">Đã thu</span>
                  <input
                    className="w-full rounded-xl border border-[#c1c9c0]/40 px-3 py-2.5 text-sm focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    inputMode="decimal"
                    value={form.paidAmount}
                    onChange={(e) => updateField('paidAmount', e.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl bg-[#f0eee6] p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-[#717971]">Tạm tính</span>
                <span className="text-[#1b1c17]">{formatVnd(subtotal)}</span>
              </div>
              {discountAmount > 0 ? (
                <div className="flex justify-between py-1 text-[#717971]">
                  <span>Chiết khấu hợp đồng</span>
                  <span>-{formatVnd(discountAmount)}</span>
                </div>
              ) : null}
              <div className="h-px bg-[#c1c9c0]/30 my-1" />
              <div className="flex justify-between py-1 font-bold text-[#356647]">
                <span>Thành tiền</span>
                <span>{formatVnd(finalAmount)}</span>
              </div>
            </div>
          </section>
        ) : null}

        {contract ? (
          <section className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-5 shadow-sm">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Ghi chú</span>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-[#c1c9c0]/40 px-3 py-2.5 text-sm focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                value={form.note}
                onChange={(e) => updateField('note', e.target.value)}
              />
            </label>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSaving || isBlocked || !contract || form.items.length === 0}
            className="rounded-xl bg-[#356647] px-6 py-3 text-sm font-bold text-white hover:bg-[#4a6242] disabled:opacity-50"
          >
            {isSaving ? 'Đang tạo...' : 'Tạo đơn hàng'}
          </button>
          <Link className="rounded-xl border border-[#c1c9c0]/40 px-6 py-3 text-sm font-semibold text-[#717971] hover:bg-[#f0eee6]" to="/orders">
            Hủy
          </Link>
        </div>

      </form>
    </PageShell>
  )
}

export default OrderCreatePage

