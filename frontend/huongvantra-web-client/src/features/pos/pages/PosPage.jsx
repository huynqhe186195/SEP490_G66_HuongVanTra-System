import { useEffect, useRef, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import CustomerDetailModal from '../components/CustomerDetailModal.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import PaymentReceiptModal from '../components/PaymentReceiptModal.jsx'
import {
  confirmOrderPayment,
  createPosOrderOffline,
  createPosOrderOnline,
  fetchPosCustomers,
  fetchPosProducts,
  resolvePosStoreId,
} from '../services/posApi.js'
import { loadPosSeller } from '../utils/posSeller.js'

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Tiền mặt', icon: 'payments' },
  { id: 'TRANSFER', label: 'Chuyển khoản', icon: 'account_balance' },
]

function Icon({ children, className = '', filled = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {children}
    </span>
  )
}

function getLineGross(item) {
  return item.qty * item.price
}

function getLineDiscount(item) {
  const gross = getLineGross(item)
  const value = item.lineDiscountValue || 0
  if (item.lineDiscountType === 'amount') {
    return Math.min(gross, value)
  }
  return Math.min(gross, Math.round((gross * value) / 100))
}

function getLineTotal(item) {
  return Math.max(getLineGross(item) - getLineDiscount(item), 0)
}

function createEmptySession() {
  return {
    searchValue: '',
    cartItems: [],
    orderDiscountPercent: 0,
    selectedCustomer: null,
    customerSearchValue: '',
    paymentMethod: 'CASH',
    amountPaidInput: '',
  }
}

function PosPage() {
  const [tabs, setTabs] = useState([
    { id: 1, label: 'Hóa đơn 1' },
    { id: 2, label: 'Hóa đơn 2' },
  ])
  const [activeTabId, setActiveTabId] = useState(1)
  const [sessions, setSessions] = useState({
    1: createEmptySession(),
    2: createEmptySession(),
  })
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [isCustomerSearchLoading, setIsCustomerSearchLoading] = useState(false)
  const [openModal, setOpenModal] = useState(null)
  const [openDiscountSku, setOpenDiscountSku] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchProducts, setSearchProducts] = useState([])
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [receiptModalData, setReceiptModalData] = useState(null)
  const [seller, setSeller] = useState({ name: 'Nhân viên POS', role: '—', display: 'Nhân viên POS · —' })
  const discountPopoverRef = useRef(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const session = sessions[activeTabId] ?? createEmptySession()
  const {
    searchValue,
    cartItems,
    orderDiscountPercent,
    selectedCustomer,
    customerSearchValue,
    paymentMethod,
    amountPaidInput,
  } = session

  const updateActiveSession = (updater) => {
    setSessions((current) => {
      const prevSession = current[activeTabId] ?? createEmptySession()
      const nextSession = typeof updater === 'function' ? updater(prevSession) : { ...prevSession, ...updater }
      return { ...current, [activeTabId]: nextSession }
    })
  }

  useEffect(() => {
    let mounted = true

    loadPosSeller().then((info) => {
      if (mounted) {
        setSeller(info)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(value)

  const parseMoneyInput = (value) => {
    const digits = String(value).replace(/\D/g, '')
    return digits ? Number(digits) : 0
  }

  const grossSubtotal = cartItems.reduce((sum, item) => sum + getLineGross(item), 0)
  const itemDiscountTotal = cartItems.reduce((sum, item) => sum + getLineDiscount(item), 0)
  const subtotalAfterItemDiscount = cartItems.reduce((sum, item) => sum + getLineTotal(item), 0)
  const orderDiscountAmount = Math.round((subtotalAfterItemDiscount * orderDiscountPercent) / 100)
  const total = Math.max(subtotalAfterItemDiscount - orderDiscountAmount, 0)
  const amountPaid = parseMoneyInput(amountPaidInput)
  // Để trống = ghi nợ toàn bộ đơn; nhập đủ = thanh toán hết; nhập thừa = tính tiền thừa
  const cashPaymentAmount = amountPaid >= total ? total : amountPaid
  const debtAmount = Math.max(total - cashPaymentAmount, 0)
  const change = Math.max(amountPaid - total, 0)
  const isDebtSale = paymentMethod !== 'TRANSFER' && amountPaid === 0 && total > 0
  const isPartialCashPayment = paymentMethod !== 'TRANSFER' && amountPaid > 0 && amountPaid < total

  useEffect(() => {
    let cancelled = false

    const timerId = setTimeout(async () => {
      setIsSearchLoading(true)
      try {
        const items = await fetchPosProducts({
          storeId: resolvePosStoreId(),
          search: searchValue.trim(),
          limit: 30,
        })
        if (!cancelled) {
          setSearchProducts(items)
        }
      } catch (error) {
        if (!cancelled) {
          setSearchProducts([])
          showError(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsSearchLoading(false)
        }
      }
    }, searchValue.trim() ? 250 : 0)

    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
  }, [searchValue, activeTabId])

  useEffect(() => {
    setOpenDiscountSku(null)
  }, [activeTabId])

  useEffect(() => {
    if (!openDiscountSku) return undefined

    const handlePointerDown = (event) => {
      if (discountPopoverRef.current?.contains(event.target)) {
        return
      }
      setOpenDiscountSku(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [openDiscountSku])

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearchResults([])
      return undefined
    }

    const query = customerSearchValue.trim()
    if (!query) {
      setCustomerSearchResults([])
      return undefined
    }

    let cancelled = false
    const timerId = setTimeout(async () => {
      setIsCustomerSearchLoading(true)
      try {
        const items = await fetchPosCustomers({ search: query, limit: 20 })
        if (!cancelled) {
          setCustomerSearchResults(items)
        }
      } catch (error) {
        if (!cancelled) {
          setCustomerSearchResults([])
          showError(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsCustomerSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
  }, [customerSearchValue, selectedCustomer, activeTabId])

  const addTab = () => {
    const nextId = tabs.length ? Math.max(...tabs.map((tab) => tab.id)) + 1 : 1
    const nextTab = { id: nextId, label: `Hóa đơn ${nextId}` }
    setTabs((currentTabs) => [...currentTabs, nextTab])
    setSessions((current) => ({ ...current, [nextId]: createEmptySession() }))
    setActiveTabId(nextId)
    setOpenDiscountSku(null)
  }

  const closeTab = (tabId) => {
    setTabs((currentTabs) => {
      if (currentTabs.length === 1) {
        return currentTabs
      }

      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId)
      if (tabId === activeTabId) {
        setActiveTabId(nextTabs[0]?.id ?? activeTabId)
      }
      return nextTabs
    })
    setSessions((current) => {
      const next = { ...current }
      delete next[tabId]
      return next
    })
    setOpenDiscountSku(null)
  }

  const addToCart = (product) => {
    updateActiveSession((prev) => {
      const currentItems = prev.cartItems
      const existing = currentItems.find((item) => item.sku === product.sku)
      if (existing) {
        return {
          ...prev,
          cartItems: currentItems.map((item) =>
            item.sku === product.sku
              ? { ...item, qty: Number((item.qty + item.step).toFixed(2)) }
              : item,
          ),
          searchValue: '',
        }
      }

      return {
        ...prev,
        cartItems: [
          ...currentItems,
          {
            productId: product.productId,
            sku: product.sku,
            name: product.name,
            qty: 1,
            unit: 'x',
            price: product.price,
            step: 1,
            lineDiscountType: 'percent',
            lineDiscountValue: 0,
          },
        ],
        searchValue: '',
      }
    })
  }

  const updateQuantity = (sku, direction) => {
    updateActiveSession((prev) => ({
      ...prev,
      cartItems: prev.cartItems
        .map((item) => {
          if (item.sku !== sku) {
            return item
          }

          const nextQty = direction === 'inc' ? item.qty + item.step : item.qty - item.step
          return { ...item, qty: Number(nextQty.toFixed(2)) }
        })
        .filter((item) => item.qty > 0),
    }))
  }

  const updateLineDiscountType = (sku, discountType) => {
    updateActiveSession((prev) => ({
      ...prev,
      cartItems: prev.cartItems.map((item) =>
        item.sku === sku ? { ...item, lineDiscountType: discountType, lineDiscountValue: 0 } : item,
      ),
    }))
  }

  const updateLineDiscountValue = (sku, rawValue) => {
    updateActiveSession((prev) => ({
      ...prev,
      cartItems: prev.cartItems.map((item) => {
        if (item.sku !== sku) {
          return item
        }

        if (item.lineDiscountType === 'amount') {
          return { ...item, lineDiscountValue: parseMoneyInput(rawValue) }
        }

        return { ...item, lineDiscountValue: Math.min(100, Math.max(0, Number(rawValue) || 0)) }
      }),
    }))
  }

  const removeItem = (sku) => {
    updateActiveSession((prev) => ({
      ...prev,
      cartItems: prev.cartItems.filter((item) => item.sku !== sku),
    }))
    if (openDiscountSku === sku) {
      setOpenDiscountSku(null)
    }
  }

  const handleQuickAmount = (value) => {
    updateActiveSession({ amountPaidInput: String(value) })
  }

  const formatLineDiscountLabel = (item) => {
    if (!item.lineDiscountValue) return null
    if (item.lineDiscountType === 'amount') {
      return `-${formatMoney(item.lineDiscountValue)}đ`
    }
    return `-${item.lineDiscountValue}%`
  }

  const hasCartItems = cartItems.length > 0
  const hasCustomerSelected = Boolean(selectedCustomer?.customerId)
  const isTransferPayment = paymentMethod === 'TRANSFER'
  const canPayCash = hasCartItems && total > 0 && hasCustomerSelected
  const canPayTransfer = total > 0 && hasCartItems && hasCustomerSelected
  const canPay = (isTransferPayment ? canPayTransfer : canPayCash) && !isSubmitting

  const buildOrderPayload = (method, amount) => {
    const storeId = resolvePosStoreId()
    return {
      storeId,
      customerId: selectedCustomer.customerId,
      promotionId: null,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.qty,
        isGift: 0,
      })),
      payments: [
        {
          paymentMethod: method,
          amount,
        },
      ],
    }
  }

  const buildReceiptData = ({ orderCode, method }) => ({
    orderCode: orderCode || activeTab.label,
    customerName: selectedCustomer?.fullName || 'Khách lẻ',
    paymentMethodLabel: method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt',
    createdAtLabel: new Date().toLocaleString('vi-VN'),
    sellerName: seller.name,
    sellerRole: seller.role,
    items: cartItems.map((item) => ({
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      price: item.price,
      total: getLineTotal(item),
    })),
    grossSubtotal,
    totalDiscount: itemDiscountTotal + orderDiscountAmount,
    total,
    amountPaid: method === 'CASH' ? cashPaymentAmount : total,
    customerPaid: method === 'CASH' ? amountPaid : total,
    change: method === 'CASH' ? change : 0,
    debtAmount: method === 'CASH' ? debtAmount : 0,
    isDebtSale: method === 'CASH' && isDebtSale,
    isPartialCashPayment: method === 'CASH' && isPartialCashPayment,
  })

  const resetCheckoutState = () => {
    updateActiveSession(createEmptySession())
    setOpenDiscountSku(null)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handlePayment = async () => {
    if (!hasCustomerSelected) {
      showError('Vui long chon hoac them khach hang truoc khi thanh toan.')
      return
    }

    if (!canPay) {
      return
    }

    setIsSubmitting(true)
    try {
      if (isTransferPayment) {
        const payload = buildOrderPayload('TRANSFER', total)
        const result = await createPosOrderOnline(payload)

        showSuccess(`Tao don ${result.orderCode} thanh cong.`)
        setReceiptModalData(buildReceiptData({ orderCode: result.orderCode, method: 'TRANSFER' }))
        resetCheckoutState()
        return
      }

      const payload = buildOrderPayload('CASH', cashPaymentAmount)
      const result = await createPosOrderOffline(payload)

      if (cashPaymentAmount >= total) {
        await confirmOrderPayment(result.orderId, {
          paymentReference: `POS-CASH-${result.orderCode}`,
          note: 'Auto confirm from POS cash payment',
        })
        showSuccess(`Thanh toan thanh cong. Don: ${result.orderCode}`)
      } else if (isDebtSale) {
        showSuccess(`Ghi don ${result.orderCode} thanh cong. Du no: ${formatMoney(debtAmount)} d.`)
      } else {
        showSuccess(
          `Ghi don ${result.orderCode}. Da thu ${formatMoney(cashPaymentAmount)} d, con no ${formatMoney(debtAmount)} d.`,
        )
      }
      setReceiptModalData(buildReceiptData({ orderCode: result.orderCode, method: 'CASH' }))
      resetCheckoutState()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSearchQuery = searchValue.trim().length > 0
  const showSearchDropdown = hasSearchQuery && searchProducts.length > 0
  const showSearchEmpty = hasSearchQuery && !isSearchLoading && searchProducts.length === 0

  const hasCustomerSearchQuery = customerSearchValue.trim().length > 0
  const showCustomerDropdown = !selectedCustomer && hasCustomerSearchQuery && customerSearchResults.length > 0
  const showCustomerSearchEmpty =
    !selectedCustomer && hasCustomerSearchQuery && !isCustomerSearchLoading && customerSearchResults.length === 0

  const selectCustomer = (customer) => {
    updateActiveSession({
      selectedCustomer: customer,
      customerSearchValue: '',
    })
    setCustomerSearchResults([])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)]">
      <header className="border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const tabSession = sessions[tab.id]
            const tabItemCount = tabSession?.cartItems?.length ?? 0
            const tabHasCustomer = Boolean(tabSession?.selectedCustomer?.customerId)

            return (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveTabId(tab.id)
                }
              }}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTabId === tab.id ? 'bg-[#356647] text-white shadow-sm' : 'bg-[#eae8e0] text-[#414942] hover:bg-[#e4e3db]'
              }`}
            >
              <span>{tab.label}</span>
              {tabItemCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTabId === tab.id ? 'bg-white/20 text-white' : 'bg-[#356647]/15 text-[#356647]'
                  }`}
                >
                  {tabItemCount}
                </span>
              ) : null}
              {tabHasCustomer ? (
                <span
                  className={`material-symbols-outlined text-[14px] ${
                    activeTabId === tab.id ? 'text-white/90' : 'text-[#356647]'
                  }`}
                  title="Đã chọn khách"
                >
                  person
                </span>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
                className="ml-2 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Đóng ${tab.label}`}
              >
                <Icon className="text-[16px] opacity-80">close</Icon>
              </button>
            </div>
            )
          })}

          <button type="button" onClick={addTab} className="rounded-lg px-3 py-1.5 text-[#356647] transition-colors hover:bg-[#356647]/10">
            <Icon>add</Icon>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: search + cart lines (larger touch targets) */}
        <section className="order-1 flex min-w-0 flex-1 flex-col bg-white text-base">
          <div className="relative z-30 shrink-0 overflow-visible border-b border-[#c1c9c0]/60 bg-[#f6f4ec] p-5">
            <div className="relative">
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-[#717971]">search</Icon>
              <input
                className="w-full rounded-full border border-[#c1c9c0] bg-white py-3.5 pl-12 pr-12 text-base outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Tìm sản phẩm, SKU, barcode..."
                type="text"
                value={searchValue}
                onChange={(event) => updateActiveSession({ searchValue: event.target.value })}
                autoFocus
              />
              <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-[22px] text-[#717971]">barcode_scanner</Icon>
            </div>

            {hasSearchQuery && isSearchLoading ? (
              <div className="absolute left-5 right-5 top-full z-30 mt-2 rounded-xl border border-[#c1c9c0] bg-white p-3 text-sm text-[#717971] shadow-2xl">
                Dang tim san pham...
              </div>
            ) : null}
            {showSearchDropdown ? (
              <div className="custom-scrollbar absolute left-5 right-5 top-full z-30 mt-2 max-h-[min(45vh,400px)] overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
                {searchProducts.map((item) => (
                  <button
                    key={`${item.productId}-${item.sku}`}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="flex w-full items-center gap-3 border-b border-[#f0eee6] p-3.5 text-left last:border-b-0 hover:bg-[#f6f4ec]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#ceebc1]">
                      <Icon className="text-[24px] text-[#4a6242]">eco</Icon>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-medium">{item.name}</div>
                      <div className="text-xs text-[#717971]">
                        {item.sku} · Ton: {formatMoney(item.stockQuantity || 0)}
                      </div>
                    </div>
                    <div className="shrink-0 text-base font-bold text-[#356647]">{formatMoney(item.price)}</div>
                  </button>
                ))}
              </div>
            ) : null}
            {showSearchEmpty ? (
              <div className="absolute left-5 right-5 top-full z-30 mt-2 rounded-xl border border-[#c1c9c0] bg-white p-3 text-sm text-[#717971] shadow-2xl">
                Khong tim thay san pham.
              </div>
            ) : null}
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-4 md:p-5">
            {!hasCartItems ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c1c9c0]/80 bg-[#f6f4ec]/40 p-8 text-center">
                <Icon className="mb-4 text-[72px] text-[#717971]/50">shopping_cart</Icon>
                <p className="text-lg font-semibold text-[#414942]">Chưa có sản phẩm</p>
                <p className="mt-2 text-base text-[#717971]">Tìm và chọn sản phẩm ở ô phía trên.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-[#717971]">
                  {cartItems.length} SP · {activeTab.label}
                </p>
                {cartItems.map((item) => {
                  const lineTotal = getLineTotal(item)
                  const isPercent = item.lineDiscountType !== 'amount'
                  const isDiscountOpen = openDiscountSku === item.sku
                  const discountLabel = formatLineDiscountLabel(item)

                  return (
                    <div
                      key={item.sku}
                      className="relative flex items-center gap-3 rounded-xl border border-[#c1c9c0]/50 bg-[#fbf9f1] px-3 py-3"
                    >
                      <div className="min-w-0 flex-[1.2]">
                        <p className="truncate text-base font-semibold leading-snug text-[#1b1c17]" title={item.name}>
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-sm text-[#717971]">
                          {formatMoney(item.price)} đ
                          {discountLabel ? (
                            <span className="ml-1 text-xs font-semibold text-[#7e5700]">{discountLabel}</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-[#c1c9c0] text-base">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, 'dec')}
                          className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white"
                        >
                          -
                        </button>
                        <span className="min-w-[2rem] border-x border-[#c1c9c0] px-2 text-center text-base font-semibold">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, 'inc')}
                          className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white"
                        >
                          +
                        </button>
                      </div>

                      <div className="relative w-[5.5rem] shrink-0">
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => setOpenDiscountSku(isDiscountOpen ? null : item.sku)}
                          className={`w-full rounded-lg px-1 py-1 text-right text-base font-bold transition-colors ${
                            isDiscountOpen
                              ? 'bg-[#356647] text-white'
                              : 'text-[#356647] hover:bg-[#356647]/10'
                          }`}
                          title="Bấm để chỉnh chiết khấu"
                        >
                          {formatMoney(lineTotal)} đ
                        </button>

                        {isDiscountOpen ? (
                          <div
                            ref={discountPopoverRef}
                            onMouseDown={(event) => event.stopPropagation()}
                            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-[#c1c9c0] bg-white p-3 shadow-xl"
                          >
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#717971]">
                              Chiết khấu dòng
                            </p>
                            <div className="flex overflow-hidden rounded-lg border border-[#c1c9c0]">
                              <div className="flex shrink-0 border-r border-[#c1c9c0]">
                                <button
                                  type="button"
                                  onClick={() => updateLineDiscountType(item.sku, 'percent')}
                                  className={`px-3 py-2 text-xs font-bold ${
                                    isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
                                  }`}
                                >
                                  %
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLineDiscountType(item.sku, 'amount')}
                                  className={`px-3 py-2 text-xs font-bold ${
                                    !isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
                                  }`}
                                >
                                  VNĐ
                                </button>
                              </div>
                              <input
                                type={isPercent ? 'number' : 'text'}
                                inputMode="numeric"
                                min={isPercent ? 0 : undefined}
                                max={isPercent ? 100 : undefined}
                                className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                                placeholder={isPercent ? 'Nhập %' : 'Nhập VNĐ'}
                                autoFocus
                                value={
                                  isPercent
                                    ? item.lineDiscountValue || ''
                                    : item.lineDiscountValue
                                      ? formatMoney(item.lineDiscountValue)
                                      : ''
                                }
                                onChange={(event) => updateLineDiscountValue(item.sku, event.target.value)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="shrink-0 p-1 text-[#ba1a1a] opacity-60 hover:opacity-100"
                        aria-label="Xóa"
                      >
                        <Icon className="text-[22px]">close</Icon>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: customer, discount, payment */}
        <section className="order-2 flex w-[420px] shrink-0 flex-col border-l border-[#c1c9c0] bg-[#f6f4ec] shadow-[-4px_0_20px_rgba(0,0,0,0.04)]">
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
            <div className="relative rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Khách hàng</label>
              {selectedCustomer ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenModal('customer-detail')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setOpenModal('customer-detail')
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1b1c17]">{selectedCustomer.fullName}</p>
                    <p className="truncate text-xs text-[#717971]">
                      {selectedCustomer.phone || '—'} · {selectedCustomer.customerCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      updateActiveSession({ selectedCustomer: null, customerSearchValue: '' })
                    }}
                    className="shrink-0 rounded-lg border border-[#c1c9c0] px-2 py-1 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec]"
                  >
                    Đổi
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">person</Icon>
                    <input
                      className="w-full rounded-lg border border-[#c1c9c0]/60 bg-[#fbf9f1] py-2 pl-9 pr-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                      placeholder="Tìm tên, SĐT, mã KH..."
                      value={customerSearchValue}
                      onChange={(event) => updateActiveSession({ customerSearchValue: event.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenModal('customer')}
                    className="shrink-0 rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e]"
                  >
                    Thêm KH
                  </button>
                </div>
              )}

              {!selectedCustomer && isCustomerSearchLoading ? (
                <p className="mt-2 text-xs text-[#717971]">Đang tìm khách hàng...</p>
              ) : null}
              {showCustomerDropdown ? (
                <div className="custom-scrollbar absolute left-3 right-3 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
                  {customerSearchResults.map((customer) => (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="flex w-full flex-col border-b border-[#f0eee6] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f6f4ec]"
                    >
                      <span className="text-sm font-semibold text-[#1b1c17]">{customer.fullName}</span>
                      <span className="text-xs text-[#717971]">
                        {customer.phone || '—'} · {customer.customerCode}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {showCustomerSearchEmpty ? (
                <p className="mt-2 text-xs text-[#717971]">Không tìm thấy khách hàng.</p>
              ) : null}
              {!hasCustomerSelected ? (
                <p className="mt-2 text-xs font-medium text-[#ba1a1a]">
                  Bắt buộc chọn hoặc tạo khách hàng trước khi thanh toán.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Chiết khấu đơn</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full rounded-lg border border-[#c1c9c0] py-2 pl-3 pr-7 text-sm outline-none focus:border-[#356647]"
                    value={orderDiscountPercent || ''}
                    onChange={(event) =>
                      updateActiveSession({
                        orderDiscountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      })
                    }
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#717971]">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenModal('offer')}
                  className="shrink-0 rounded-lg border border-[#356647]/40 px-3 py-2 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5"
                >
                  Tùy chỉnh
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Tổng tiền</label>
              <div className="text-3xl font-bold text-[#356647]">{formatMoney(total)} đ</div>
              {hasCartItems ? (
                <div className="mt-2 space-y-1 border-t border-[#f0eee6] pt-2 text-xs text-[#717971]">
                  <div className="flex justify-between">
                    <span>Tạm tính</span>
                    <span>{formatMoney(grossSubtotal)} đ</span>
                  </div>
                  {itemDiscountTotal > 0 ? (
                    <div className="flex justify-between text-[#356647]">
                      <span>CK từng SP</span>
                      <span>-{formatMoney(itemDiscountTotal)} đ</span>
                    </div>
                  ) : null}
                  {orderDiscountAmount > 0 ? (
                    <div className="flex justify-between text-[#356647]">
                      <span>CK đơn ({orderDiscountPercent}%)</span>
                      <span>-{formatMoney(orderDiscountAmount)} đ</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!isTransferPayment ? (
              <>
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="amount-paid">
                    Khách trả
                  </label>
                  <input
                    id="amount-paid"
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-2xl font-bold outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    
                    value={amountPaidInput}
                    onChange={(event) =>
                      updateActiveSession({ amountPaidInput: event.target.value.replace(/\D/g, '') })
                    }
                  />
                  <p className="mt-1.5 text-xs text-[#717971]">
                    Để trống: ghi nợ {formatMoney(total)} đ. Nhập {formatMoney(total)} đ hoặc bấm Đúng tiền để thanh toán hết.
                  </p>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f6f4ec] px-3 py-2 text-sm">
                    <span className="text-[#717971]">Khách trả</span>
                    <span className="font-bold text-[#1b1c17]">{formatMoney(amountPaid)} đ</span>
                  </div>
                  {debtAmount > 0 ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-[#fec25b]/20 px-3 py-2 text-sm">
                      <span className="font-semibold text-[#7e5700]">Dư nợ (đơn này)</span>
                      <span className="font-bold text-[#7e5700]">{formatMoney(debtAmount)} đ</span>
                    </div>
                  ) : null}
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[50000, 100000, 200000, 500000, 1000000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => handleQuickAmount(quick)}
                        className="rounded-lg bg-[#e4e3db] py-1.5 text-[10px] font-bold hover:bg-[#356647] hover:text-white"
                      >
                        {formatMoney(quick)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(total)}
                      className="rounded-lg bg-[#356647]/15 py-1.5 text-[10px] font-bold text-[#356647] hover:bg-[#356647] hover:text-white"
                    >
                      Đúng tiền
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#717971]">Tiền thừa</label>
                  <div className={`text-2xl font-bold ${change > 0 ? 'text-[#356647]' : 'text-[#717971]'}`}>
                    {change > 0 ? `${formatMoney(change)} đ` : '—'}
                  </div>
                  {isDebtSale ? (
                    <p className="mt-1 text-xs font-medium text-[#7e5700]">Bán ghi nợ — chưa thu tiền mặt</p>
                  ) : isPartialCashPayment ? (
                    <p className="mt-1 text-xs text-[#717971]">Thanh toán một phần, phần còn lại ghi vào dư nợ</p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 p-4 text-sm text-[#414942]">
                <p className="font-semibold text-[#356647]">Thanh toán chuyển khoản</p>
                <p className="mt-1 text-[#717971]">Bấm Thanh toán để hiển thị mã QR cho khách quét.</p>
              </div>
            )}

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Phương thức thanh toán</label>
              <div className="space-y-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => updateActiveSession({ paymentMethod: method.id })}
                    className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all ${
                      paymentMethod === method.id
                        ? 'border-[#356647] bg-[#356647]/10 font-semibold text-[#356647]'
                        : 'border-transparent bg-[#fbf9f1] hover:border-[#c1c9c0]'
                    }`}
                  >
                    <Icon className="text-[20px]" filled={paymentMethod === method.id}>
                      {method.icon}
                    </Icon>
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[#c1c9c0] p-3">
            <button
              type="button"
              className="flex flex-col items-center justify-center rounded-xl bg-[#ffdead] py-3 text-sm font-bold text-[#604100] shadow-sm hover:brightness-95"
            >
              <span className="text-[10px] opacity-70">F10</span>
              Lưu tạm
            </button>
            <button
              type="button"
              disabled={!canPay}
              onClick={handlePayment}
              className="flex flex-col items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              <span className="text-[10px] opacity-70">F12</span>
              {isSubmitting ? 'Dang xu ly...' : isTransferPayment ? 'Thanh toán · QR' : 'Thanh toán'}
            </button>
          </div>
        </section>
      </div>

      <AddCustomerModal
        isOpen={openModal === 'customer'}
        onClose={() => setOpenModal(null)}
        onSaved={(customer) => {
          selectCustomer(customer)
          setOpenModal(null)
        }}
      />
      <OrderOfferModal
        isOpen={openModal === 'offer'}
        onClose={() => setOpenModal(null)}
        onConfirm={(percent) => {
          updateActiveSession({ orderDiscountPercent: percent })
          setOpenModal(null)
        }}
      />
      <CustomerDetailModal
        isOpen={openModal === 'customer-detail'}
        customer={selectedCustomer}
        onClose={() => setOpenModal(null)}
      />
      <PaymentReceiptModal
        isOpen={Boolean(receiptModalData)}
        receipt={receiptModalData}
        onClose={() => setReceiptModalData(null)}
        onPrint={handlePrintReceipt}
      />
    </div>
  )
}

export default PosPage
