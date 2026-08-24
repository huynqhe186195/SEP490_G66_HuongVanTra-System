import { useEffect, useState } from 'react'
import { formatVnd, formatVndInput, parseVndInput } from '../../../utils/vietnamCurrency.js'
import { fetchPosCustomers } from '../services/posApi.js'
import { PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'
import {
  fetchSkuStocks,
  fetchStoreSkuStocks,
} from '../../inventory/services/inventoryStockApi.js'

const toDateInputValue = (date) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const addDays = (days) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '')

const NAME_PATTERN = /^[\p{L}\s]+$/u
const PHONE_PATTERN = /^0\d{9}$/
const DEPOSIT_RATIO = 0.5

function countInclusiveDaysUntil(dateValue) {
  if (!dateValue) return 0
  const target = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(target.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000))
}

function formatWaitLabel(days) {
  if (days <= 0) return 'trong ngày'
  if (days === 1) return '1 ngày'
  return `${days} ngày`
}

function formatQty(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function QtyColumnHeaders({ availableLabel }) {
  return (
    <div className="flex shrink-0 items-center gap-4 text-right">
      <p className="min-w-[2.25rem] text-[10px] uppercase tracking-wide text-[#717971]">Đặt</p>
      <p className="min-w-[3.5rem] text-[10px] uppercase tracking-wide text-[#717971]">{availableLabel}</p>
      <p className="min-w-[2.25rem] text-[10px] uppercase tracking-wide text-[#717971]">Chờ</p>
    </div>
  )
}

function QtyStats({ ordered, ready, pending }) {
  return (
    <div className="flex shrink-0 items-center gap-4 text-right">
      <p className="min-w-[2.25rem] text-sm tabular-nums text-[#414942]">{formatQty(ordered)}</p>
      <p className={`min-w-[3.5rem] text-sm tabular-nums ${ready ? 'text-[#356647]' : 'text-[#717971]'}`}>
        {ready ? formatQty(ready) : '—'}
      </p>
      <p className={`min-w-[2.25rem] text-sm tabular-nums ${pending ? 'text-[#7e5700]' : 'text-[#717971]'}`}>
        {pending ? formatQty(pending) : '—'}
      </p>
    </div>
  )
}

export default function BackorderConfirmModal({
  isOpen,
  message = '',
  lines = [],
  availableQuantity = 0,
  backorderQuantity = 0,
  estimatedReadyFrom = null,
  selectedCustomer = null,
  orderTotal = 0,
  isSubmitting = false,
  /** COD: không bắt cọc khi khách đồng ý chờ hàng. */
  skipDeposit = false,
  /** Đơn có gói custom: chỉ nhận một lần khi đủ hàng. */
  forceCompleteDelivery = false,
  /** CASH | TRANSFER — mặc định theo phương thức đang chọn trên POS. */
  preferredDepositPaymentMethod = 'CASH',
  customBundles = [],
  onAccept,
  onDecline,
  onCustomerSelected,
}) {
  const [selectedPreference, setSelectedPreference] = useState(null)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupNote, setPickupNote] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [depositInput, setDepositInput] = useState('')
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('CASH')
  const [customerMatches, setCustomerMatches] = useState([])
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [customerSearchDone, setCustomerSearchDone] = useState(false)
  const [warehouseStockBySkuId, setWarehouseStockBySkuId] = useState(() => new Map())

  const lineReadyQty = (line) =>
    Number(line.finishedDeductedQuantity || 0) + Number(line.warehouseDeductedQuantity || 0)
  const lineOrderedQty = (line) => {
    const ordered = Number(line.orderedQuantity || 0)
    if (ordered > 0) return ordered
    return lineReadyQty(line) + Number(line.pendingBomQuantity || 0)
  }
  const activeCustomBundles = (customBundles || []).filter((bundle) => (bundle.ingredients || []).length > 0)
  const hasCustomBundles = activeCustomBundles.length > 0

  const linesReadyTotal = lines.reduce((sum, line) => sum + lineReadyQty(line), 0)
  const linesPendingTotal = lines.reduce((sum, line) => sum + Number(line.pendingBomQuantity || 0), 0)
  // API đôi khi trả availableQuantity=0 dù lines vẫn có phần sẵn — ưu tiên tổng từ lines.
  const stockAvailableQuantity = Math.max(Number(availableQuantity) || 0, linesReadyTotal)
  const stockBackorderQuantity = Math.max(Number(backorderQuantity) || 0, linesPendingTotal)
  const canChooseFulfillment = stockAvailableQuantity > 0

  /** COD / custom: ẩn chọn cách nhận, mặc định nhận một lần khi đủ hàng. */
  const showFulfillmentChoice = !skipDeposit && !forceCompleteDelivery && canChooseFulfillment
  const fulfillmentPreference = skipDeposit || forceCompleteDelivery
    ? 'CompleteDelivery'
    : canChooseFulfillment
      ? selectedPreference ?? 'PartialDelivery'
      : 'CompleteDelivery'

  const effectiveAvailableQuantity = stockAvailableQuantity
  const effectiveBackorderQuantity = stockBackorderQuantity

  const availableLabel = skipDeposit ? 'Đang có' : 'Giao ngay'

  const minPickupDate = toDateInputValue(addDays(1))
  const rawSuggestedPickupDate = estimatedReadyFrom
    ? toDateInputValue(new Date(estimatedReadyFrom))
    : toDateInputValue(addDays(3))
  const suggestedPickupDate =
    /^\d{4}-\d{2}-\d{2}$/.test(rawSuggestedPickupDate) && rawSuggestedPickupDate >= minPickupDate
      ? rawSuggestedPickupDate
      : minPickupDate
  const effectivePickupDate = pickupDate || suggestedPickupDate
  const isPickupDateValid = /^\d{4}-\d{2}-\d{2}$/.test(effectivePickupDate)
    && effectivePickupDate >= minPickupDate
  const waitDays = countInclusiveDaysUntil(effectivePickupDate)

  const effectiveContactName = (contactName || selectedCustomer?.fullName || '').trim()
  // Khớp input (max 10 số): validate trên chuỗi đã cắt, tránh SĐT hồ sơ >10 số làm disable nút
  // trong khi ô input vẫn hiện đủ 10 số hợp lệ.
  const effectiveContactPhone = normalizePhone(contactPhone || selectedCustomer?.phone || '').slice(0, 10)
  const isContactNameValid = effectiveContactName.length > 0 && NAME_PATTERN.test(effectiveContactName)
  const isContactPhoneValid = PHONE_PATTERN.test(effectiveContactPhone)

  const total = Number(orderTotal) || 0
  const minDeposit = Math.ceil(total * DEPOSIT_RATIO)

  // Đồng bộ state với hồ sơ khách khi mở modal — tránh value hiển thị fallback nhưng state rỗng.
  useEffect(() => {
    if (!isOpen) return
    setContactPhone(normalizePhone(selectedCustomer?.phone || '').slice(0, 10))
    setContactName((selectedCustomer?.fullName || '').trim())
    setPickupDate('')
    setPickupNote('')
    setSelectedPreference(null)
    setDepositInput(minDeposit > 0 ? String(minDeposit) : '')
    setDepositPaymentMethod(preferredDepositPaymentMethod === 'TRANSFER' ? 'TRANSFER' : 'CASH')
  }, [isOpen, selectedCustomer?.customerId, selectedCustomer?.phone, selectedCustomer?.fullName, minDeposit, preferredDepositPaymentMethod])

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelled = false
    async function loadWarehouseStock() {
      try {
        const stocks = await fetchSkuStocks().catch(() => fetchStoreSkuStocks().catch(() => []))
        if (cancelled) return
        const stockMap = new Map()
        for (const row of stocks || []) {
          if (!row?.skuId) continue
          const qty = Number(row.warehouseQuantityOnHand) || Number(row.quantityOnHand) || 0
          stockMap.set(row.skuId, qty)
        }
        setWarehouseStockBySkuId(stockMap)
      } catch {
        if (!cancelled) setWarehouseStockBySkuId(new Map())
      }
    }
    loadWarehouseStock()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || selectedCustomer?.customerId) {
      setCustomerMatches([])
      setCustomerSearchDone(false)
      setIsSearchingCustomer(false)
      return undefined
    }

    const phone = normalizePhone(contactPhone)
    const name = contactName.trim()
    const search = PHONE_PATTERN.test(phone) ? phone : name.length >= 3 ? name : ''
    if (!search) {
      setCustomerMatches([])
      setCustomerSearchDone(false)
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    const timerId = setTimeout(async () => {
      setIsSearchingCustomer(true)
      try {
        const results = await fetchPosCustomers({ search, limit: 5, signal: controller.signal })
        if (!cancelled) {
          setCustomerMatches(results)
          setCustomerSearchDone(true)
        }
      } catch {
        if (!cancelled) {
          setCustomerMatches([])
          setCustomerSearchDone(false)
        }
      } finally {
        if (!cancelled) setIsSearchingCustomer(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timerId)
      controller.abort()
    }
  }, [contactName, contactPhone, isOpen, selectedCustomer?.customerId])

  const depositAmount = parseVndInput(depositInput)
  const isDepositValid =
    skipDeposit
    || total <= 0
    || (depositAmount != null && depositAmount >= minDeposit && depositAmount <= total)

  const canAccept = isPickupDateValid && isContactNameValid && isContactPhoneValid && isDepositValid
  const acceptBlockReason = !canAccept
    ? [
        !isContactPhoneValid ? 'SĐT phải đúng 10 số, bắt đầu bằng 0' : null,
        !isContactNameValid ? 'Họ tên chỉ gồm chữ cái và khoảng trắng' : null,
        !isPickupDateValid ? 'Ngày hẹn phải từ ngày mai trở đi' : null,
        !isDepositValid ? 'Cọc chưa đủ điều kiện' : null,
      ].filter(Boolean).join(' · ')
    : ''

  const customIngredientPreview = activeCustomBundles.flatMap((bundle, index) => {
    const bundleQty = Math.max(1, Math.floor(Number(bundle.bundleQuantity) || 1))
    return (bundle.ingredients || []).map((ing, ingIndex) => {
      const required = Math.max(1, Math.floor(Number(ing.quantity) || 1)) * bundleQty
      const available = Number(warehouseStockBySkuId.get(ing.materialSkuId) ?? 0)
      const shortage = Math.max(0, required - available)
      return {
        key: `${index}-${ingIndex}-${ing.materialSkuId || ing.materialSkuCode}`,
        bundleIndex: index,
        skuId: ing.materialSkuId,
        name: ing.materialSnapshotName || ing.materialSkuCode || 'Nguyên liệu',
        skuCode: ing.materialSkuCode || '',
        required,
        available,
        shortage,
      }
    })
  })
  const customShortageTotal = customIngredientPreview.reduce((sum, row) => sum + row.shortage, 0)
  const customWaitQty = activeCustomBundles.reduce(
    (sum, bundle) => sum + Math.max(1, Math.floor(Number(bundle.bundleQuantity) || 1)),
    0,
  )
  const customSkuIds = new Set(
    customIngredientPreview.map((row) => row.skuId).filter(Boolean),
  )
  const catalogOnlyLines = lines.filter((line) => {
    if (line.skuId && customSkuIds.has(line.skuId)) return false
    const code = String(line.skuCode || '').trim().toLowerCase()
    if (code && customIngredientPreview.some((row) => String(row.skuCode || '').trim().toLowerCase() === code)) {
      return false
    }
    const name = String(line.skuName || '').trim().toLowerCase()
    if (name && customIngredientPreview.some((row) => String(row.name || '').trim().toLowerCase() === name)) {
      return false
    }
    return true
  })
  const showCatalogSection = catalogOnlyLines.length > 0
  const shortIngredientNames = customIngredientPreview
    .filter((row) => row.shortage > 0)
    .map((row) => row.name)
    .filter((name, index, list) => list.indexOf(name) === index)

  if (!isOpen) return null

  // Dòng giao được ngay: đã trừ đủ kho thành phẩm, không còn phần phải chờ.
  const readyLines = lines.filter(
    (line) => Number(line.pendingBomQuantity || 0) <= 0 && lineReadyQty(line) > 0,
  )
  const lineQty = lineReadyQty

  const inputCls = (valid) =>
    `mt-1 w-full rounded-xl border px-3 py-2 text-sm text-[#1b1c17] focus:outline-none disabled:opacity-50 ${
      valid ? 'border-[#c1c9c0] bg-white focus:border-[#356647]' : 'border-[#7e5700] bg-[#7e5700]/5'
    }`

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: 'min(94vh, 820px)' }}
        role="alertdialog"
        aria-labelledby="backorder-confirm-title"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#f0eee6] px-5 py-3.5">
          <span className="material-symbols-outlined text-[22px] text-[#7e5700]">inventory_2</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Hàng chưa đủ để giao ngay</p>
            <h2 id="backorder-confirm-title" className="text-base font-bold text-[#1b1c17]">
              {message || 'Sản phẩm tạm hết — khách có đồng ý chờ hàng không?'}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {showCatalogSection ? (
              <>
                <span className="rounded-lg bg-[#356647]/10 px-3 py-1.5 text-xs font-bold text-[#356647]">
                  Thành phẩm {availableLabel.toLowerCase()} {formatQty(effectiveAvailableQuantity)}
                </span>
                <span className="rounded-lg bg-[#7e5700]/10 px-3 py-1.5 text-xs font-bold text-[#7e5700]">
                  Thành phẩm chờ {formatQty(effectiveBackorderQuantity)}
                </span>
              </>
            ) : null}
            {hasCustomBundles ? (
              <span className="rounded-lg bg-[#7e5700]/10 px-3 py-1.5 text-xs font-bold text-[#7e5700]">
                {customWaitQty} gói cá nhân · hẹn {formatWaitLabel(waitDays)}
                {customShortageTotal > 0 && shortIngredientNames[0]
                  ? ` · thiếu ${shortIngredientNames[0]}`
                  : ''}
              </span>
            ) : null}
          </div>
        </header>

        {/* Body — 2 cột */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1.35fr_1fr]">
          {/* Cột trái: chi tiết sản phẩm + lựa chọn nhận hàng */}
          <div className="flex min-h-0 flex-col overflow-y-auto border-b border-[#f0eee6] px-5 py-4 lg:border-b-0 lg:border-r">
            {showCatalogSection ? (
              <section className="overflow-hidden rounded-xl border border-[#f0eee6]">
                <div className="flex items-center justify-between gap-3 border-b border-[#f0eee6] bg-[#fbf9f1] px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#414942]">Thành phẩm</p>
                  <QtyColumnHeaders availableLabel={availableLabel} />
                </div>
                <ul className="divide-y divide-[#f0eee6]">
                  {catalogOnlyLines.map((line) => (
                    <li key={line.skuId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <p className="min-w-0 truncate text-sm font-normal text-[#1b1c17]">{line.skuName}</p>
                      <QtyStats
                        ordered={lineOrderedQty(line)}
                        ready={lineQty(line)}
                        pending={Number(line.pendingBomQuantity || 0)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {hasCustomBundles ? (
              <section className={`overflow-hidden rounded-xl border border-[#f0eee6] ${showCatalogSection ? 'mt-3' : ''}`}>
                <div className="flex items-center justify-between gap-3 border-b border-[#f0eee6] bg-[#fbf9f1] px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#414942]">{PERSONAL_PRODUCT_LABEL}</p>
                  <QtyColumnHeaders availableLabel={availableLabel} />
                </div>
                <ul className="divide-y divide-[#f0eee6]">
                  {activeCustomBundles.flatMap((bundle, index) => {
                    const bundleRows = customIngredientPreview.filter((row) => row.bundleIndex === index)
                    const showBundleTitle = activeCustomBundles.length > 1
                    const items = []
                    if (showBundleTitle) {
                      items.push(
                        <li key={`custom-title-${index}`} className="bg-[#fbf9f1]/70 px-3 py-1.5 text-xs text-[#717971]">
                          {bundle.label || `${PERSONAL_PRODUCT_LABEL} #${index + 1}`}
                        </li>,
                      )
                    }
                    bundleRows.forEach((row) => {
                      items.push(
                        <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <p className="min-w-0 truncate text-sm font-normal text-[#1b1c17]">{row.name}</p>
                          <QtyStats
                            ordered={row.required}
                            ready={row.available}
                            pending={row.shortage}
                          />
                        </li>,
                      )
                    })
                    return items
                  })}
                </ul>
              </section>
            ) : null}

            {showCatalogSection && hasCustomBundles ? (
              <p className="mt-3 text-xs text-[#717971]">
                Thành phẩm và {PERSONAL_PRODUCT_LABEL.toLowerCase()} giao một lần khi đủ cả hai.
              </p>
            ) : hasCustomBundles ? (
              <p className="mt-3 text-xs text-[#717971]">
                Giao khi Thủ kho đóng gói xong, hẹn {formatWaitLabel(waitDays)}.
              </p>
            ) : null}

            {showFulfillmentChoice ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Khách nhận hàng thế nào?</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    {
                      value: 'PartialDelivery',
                      title: 'Nhận trước phần hàng sẵn',
                      icon: 'local_shipping',
                      detail: `Giao ngay ${effectiveAvailableQuantity} sản phẩm, ${effectiveBackorderQuantity} sản phẩm còn lại giao sau.`,
                      names: readyLines,
                    },
                    {
                      value: 'CompleteDelivery',
                      title: 'Nhận một lần khi đủ hàng',
                      icon: 'inventory',
                      detail: 'Giữ toàn bộ đơn, giao một lần khi đã đủ hàng.',
                      names: [],
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 ${
                        fulfillmentPreference === option.value
                          ? 'border-[#356647] bg-[#356647]/5'
                          : 'border-[#c1c9c0] bg-white hover:bg-[#f6f4ec]'
                      }`}
                    >
                      <span className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="backorder-fulfillment"
                          value={option.value}
                          checked={fulfillmentPreference === option.value}
                          onChange={() => setSelectedPreference(option.value)}
                          disabled={isSubmitting}
                          className="mt-0.5 accent-[#356647]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-[#1b1c17]">{option.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[#717971]">{option.detail}</span>
                        </span>
                      </span>
                      {option.names.length > 0 ? (
                        <span className="rounded-lg bg-[#356647]/10 px-2.5 py-1.5">
                          <span className="block text-[11px] font-bold uppercase tracking-wide text-[#356647]">
                            Giao ngay hôm nay
                          </span>
                          {option.names.map((line) => (
                            <span key={line.skuId} className="mt-0.5 block text-xs text-[#356647]">
                              • {line.skuName} × {lineQty(line)}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Cột phải: form thông tin + đặt cọc */}
          <div className="flex min-h-0 flex-col overflow-y-auto px-5 py-4">
            {/* Người nhận hàng */}
            <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Người tới nhận hàng</p>
            {selectedCustomer?.customerId ? (
              <p className="mt-0.5 text-xs text-[#414942]">Lấy từ hồ sơ khách, có thể sửa nếu người khác tới nhận.</p>
            ) : (
              <p className="mt-0.5 text-xs text-[#7e5700]">Khách vãng lai — bắt buộc nhập để đối chiếu khi lấy hàng.</p>
            )}
            <div className="relative mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="backorder-contact-phone" className="block text-xs font-semibold text-[#414942]">
                    Số điện thoại <span className="text-[#7e5700]">*</span>
                  </label>
                  <input
                    id="backorder-contact-phone"
                    type="tel"
                    inputMode="numeric"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(normalizePhone(event.target.value).slice(0, 10))}
                    maxLength={10}
                    disabled={isSubmitting}
                    placeholder="09xxxxxxxx"
                    className={inputCls(isContactPhoneValid)}
                  />
                  {!isContactPhoneValid ? (
                    <p className="mt-1 text-xs text-[#7e5700]">SĐT phải đúng 10 số, bắt đầu bằng 0.</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="backorder-contact-name" className="block text-xs font-semibold text-[#414942]">
                    Họ tên <span className="text-[#7e5700]">*</span>
                  </label>
                  <input
                    id="backorder-contact-name"
                    type="text"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Nguyễn Văn A"
                    className={inputCls(isContactNameValid)}
                  />
                  {!isContactNameValid ? (
                    <p className="mt-1 text-xs text-[#7e5700]">Họ tên chỉ gồm chữ cái và khoảng trắng.</p>
                  ) : null}
                </div>
              </div>
              {!selectedCustomer?.customerId && (isSearchingCustomer || customerMatches.length > 0 || customerSearchDone) ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white p-2 text-xs shadow-xl">
                {isSearchingCustomer ? <p className="text-[#717971]">Đang tìm hồ sơ khách hàng...</p> : null}
                {!isSearchingCustomer && customerMatches.length === 0 && customerSearchDone ? (
                  <p className="text-[#717971]">Chưa thấy hồ sơ phù hợp — tiếp tục với khách vãng lai.</p>
                ) : null}
                {customerMatches.map((customer) => (
                  <button
                    key={customer.customerId}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (onCustomerSelected?.(customer) === false) return
                      setContactName(customer.fullName || '')
                      setContactPhone(normalizePhone(customer.phone).slice(0, 10))
                      setCustomerMatches([])
                      setCustomerSearchDone(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#f6f4ec] disabled:opacity-50"
                  >
                    <span><strong className="text-[#1b1c17]">{customer.fullName}</strong> · {customer.phone || '—'}</span>
                    <span className="font-semibold text-[#356647]">Dùng khách này</span>
                  </button>
                ))}
                </div>
              ) : null}
            </div>

            {/* Ngày hẹn */}
            <div className="mt-3">
              <label htmlFor="backorder-pickup-date" className="block text-xs font-semibold text-[#414942]">
                Ngày hẹn lấy hàng <span className="text-[#7e5700]">*</span>
              </label>
              <input
                id="backorder-pickup-date"
                type="date"
                value={effectivePickupDate}
                min={minPickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                disabled={isSubmitting}
                className={inputCls(isPickupDateValid)}
              />
              {!isPickupDateValid ? (
                <p className="mt-1 text-xs text-[#7e5700]">Phải từ ngày mai trở đi.</p>
              ) : hasCustomBundles ? (
                <p className="mt-1 text-xs text-[#717971]">
                  Gói cá nhân hẹn nhận sau {formatWaitLabel(waitDays)}.
                </p>
              ) : null}
            </div>

            {/* Ghi chú — ngắn */}
            <div className="mt-3">
              <label htmlFor="backorder-pickup-note" className="block text-xs font-semibold text-[#414942]">
                Ghi chú <span className="font-normal text-[#717971]">(tuỳ chọn)</span>
              </label>
              <textarea
                id="backorder-pickup-note"
                value={pickupNote}
                onChange={(event) => setPickupNote(event.target.value)}
                disabled={isSubmitting}
                rows={2}
                placeholder="Ví dụ: khách gọi trước khi tới, giao buổi chiều..."
                className="mt-1 w-full resize-none rounded-xl border border-[#c1c9c0] bg-white px-3 py-2 text-sm leading-relaxed text-[#1b1c17] focus:border-[#356647] focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Tiền đặt cọc — chỉ POS; COD không bắt cọc */}
            {!skipDeposit && total > 0 ? (
              <div className="mt-3 space-y-2.5">
                <div className="rounded-xl border border-[#7e5700]/30 bg-[#fbf9f1] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor="backorder-deposit" className="block text-sm font-bold text-[#1b1c17]">
                        Tiền đặt cọc <span className="text-[#7e5700]">*</span>
                      </label>
                      <p className="mt-0.5 text-xs text-[#717971]">Đơn {formatVnd(total)} · tối thiểu 50%</p>
                    </div>
                    <input
                      id="backorder-deposit"
                      type="text"
                      inputMode="numeric"
                      value={formatVndInput(depositInput)}
                      onChange={(event) => setDepositInput(event.target.value)}
                      disabled={isSubmitting}
                      placeholder={formatVndInput(minDeposit)}
                      className={`w-36 shrink-0 rounded-xl border px-3 py-2 text-right text-base font-bold tabular-nums text-[#1b1c17] focus:outline-none disabled:opacity-50 ${
                        isDepositValid ? 'border-[#c1c9c0] bg-white focus:border-[#356647]' : 'border-[#7e5700] bg-[#7e5700]/5'
                      }`}
                    />
                  </div>
                  {!isDepositValid ? (
                    <p className="mt-1.5 text-xs font-semibold text-[#7e5700]">
                      {depositAmount != null && depositAmount > total
                        ? `Không được vượt quá ${formatVnd(total)}.`
                        : `Tối thiểu 50% — ${formatVnd(minDeposit)}.`}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[#414942]">
                      Còn lại thu khi nhận:{' '}
                      <span className="font-bold text-[#1b1c17]">
                        {formatVnd(Math.max(0, total - (depositAmount ?? 0)))}
                      </span>
                    </p>
                  )}
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-[#414942]">Thu cọc bằng</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'CASH', label: 'Tiền mặt', icon: 'payments' },
                        { id: 'TRANSFER', label: 'QR / chuyển khoản', icon: 'qr_code_2' },
                      ].map((method) => {
                        const active = depositPaymentMethod === method.id
                        return (
                          <button
                            key={method.id}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setDepositPaymentMethod(method.id)}
                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold disabled:opacity-50 ${
                              active
                                ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                                : 'border-[#c1c9c0] bg-white text-[#414942] hover:bg-[#f6f4ec]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">{method.icon}</span>
                            {method.label}
                          </button>
                        )
                      })}
                    </div>
                    {depositPaymentMethod === 'TRANSFER' ? (
                      <p className="mt-1.5 text-xs text-[#717971]">
                        Sau khi xác nhận, khách quét QR đúng số cọc — phần còn lại thu khi nhận hàng.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-red-600">warning</span>
                  <div className="text-xs leading-relaxed text-red-800">
                    <p className="font-bold text-red-700">Tiền cọc KHÔNG được hoàn lại</p>
                    <p className="mt-0.5">
                      Khách hủy đơn hoặc quá <span className="font-bold">7 ngày</span> kể từ ngày hẹn không tới nhận —
                      cửa hàng giữ toàn bộ cọc. Hãy thông báo rõ với khách.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-col gap-2 border-t border-[#f0eee6] bg-[#fbf9f1] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onDecline}
            disabled={isSubmitting}
            className="rounded-xl border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
          >
            Khách không chờ
          </button>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            {acceptBlockReason ? (
              <p className="text-xs font-semibold text-[#7e5700]">{acceptBlockReason}</p>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onAccept({
                  fulfillmentPreference,
                  pickupDate: effectivePickupDate,
                  pickupNote: pickupNote.trim() || null,
                  pickupContactName: effectiveContactName,
                  pickupContactPhone: effectiveContactPhone,
                  depositAmount: skipDeposit || total <= 0 ? null : depositAmount,
                  depositPaymentMethod:
                    skipDeposit || total <= 0 ? null : depositPaymentMethod,
                })
              }
              disabled={isSubmitting || !canAccept}
              className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Khách đồng ý chờ'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
