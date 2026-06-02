import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'

const searchResults = [
  {
    group: 'Sản phẩm',
    items: [
      {
        name: 'Trà Xanh Thái Nguyên Thượng Hạng',
        sku: 'TX-TN-001',
        stock: 'Tồn: 15',
        price: 150000,
        image: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?q=80&w=800&auto=format&fit=crop',
      },
      {
        name: 'Hồng Trà Cổ Thụ Hà Giang',
        sku: 'HT-HG-002',
        stock: 'Tồn: 8',
        price: 220000,
        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
      },
      {
        name: 'Trà Ô Long Lâm Đồng',
        sku: 'OL-LD-003',
        stock: 'Tồn: 20',
        price: 320000,
        image: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?q=80&w=800&auto=format&fit=crop',
      },
      {
        name: 'Trà Sen Tây Hồ',
        sku: 'TS-TH-004',
        stock: 'Tồn: 12',
        price: 450000,
        image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=800&auto=format&fit=crop',
      },
    ],
  },
]

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

function PosPage() {
  const navigate = useNavigate()
  const [tabs, setTabs] = useState([
    { id: 1, label: 'Hóa đơn 1' },
    { id: 2, label: 'Hóa đơn 2' },
  ])
  const [activeTabId, setActiveTabId] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [openModal, setOpenModal] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [cartItems, setCartItems] = useState([])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

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
  const change = Math.max(amountPaid - total, 0)

  const filteredResults = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) {
      return []
    }

    return searchResults.flatMap((section) =>
      section.items
        .filter((item) => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
        .map((item) => ({ ...item, group: section.group })),
    )
  }, [searchValue])

  const addTab = () => {
    const nextId = tabs.length ? Math.max(...tabs.map((tab) => tab.id)) + 1 : 1
    const nextTab = { id: nextId, label: `Hóa đơn ${nextId}` }
    setTabs((currentTabs) => [...currentTabs, nextTab])
    setActiveTabId(nextId)
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
  }

  const addToCart = (product) => {
    setCartItems((currentItems) => {
      const existing = currentItems.find((item) => item.sku === product.sku)
      if (existing) {
        return currentItems.map((item) =>
          item.sku === product.sku
            ? { ...item, qty: Number((item.qty + item.step).toFixed(2)) }
            : item,
        )
      }

      return [
        ...currentItems,
        {
          sku: product.sku,
          name: product.name,
          qty: 1,
          unit: 'x',
          price: product.price,
          step: 1,
          lineDiscountType: 'percent',
          lineDiscountValue: 0,
        },
      ]
    })
    setSearchValue('')
  }

  const updateQuantity = (sku, direction) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) => {
          if (item.sku !== sku) {
            return item
          }

          const nextQty = direction === 'inc' ? item.qty + item.step : item.qty - item.step
          return { ...item, qty: Number(nextQty.toFixed(2)) }
        })
        .filter((item) => item.qty > 0),
    )
  }

  const updateLineDiscountType = (sku, discountType) => {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.sku === sku ? { ...item, lineDiscountType: discountType, lineDiscountValue: 0 } : item,
      ),
    )
  }

  const updateLineDiscountValue = (sku, rawValue) => {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.sku !== sku) {
          return item
        }

        if (item.lineDiscountType === 'amount') {
          return { ...item, lineDiscountValue: parseMoneyInput(rawValue) }
        }

        return { ...item, lineDiscountValue: Math.min(100, Math.max(0, Number(rawValue) || 0)) }
      }),
    )
  }

  const removeItem = (sku) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.sku !== sku))
  }

  const handleQuickAmount = (value) => {
    setAmountPaidInput(String(value))
  }

  const hasCartItems = cartItems.length > 0
  const isTransferPayment = paymentMethod === 'TRANSFER'
  const canPayCash = total > 0 && amountPaid >= total
  const canPayTransfer = total > 0 && hasCartItems
  const canPay = isTransferPayment ? canPayTransfer : canPayCash

  const handlePayment = () => {
    if (!canPay) {
      return
    }

    if (isTransferPayment) {
      navigate('/pos/payment/qr', {
        state: {
          total,
          orderLabel: activeTab.label,
          customer: selectedCustomer,
          paymentMethod: 'TRANSFER',
        },
      })
      return
    }

    // Tiền mặt: giữ chỗ cho luồng hoàn tất đơn sau.
  }

  const showSearchDropdown = searchValue.trim().length > 0 && filteredResults.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)]">
      <header className="border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
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
              className={`flex items-center rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTabId === tab.id ? 'bg-[#356647] text-white shadow-sm' : 'bg-[#eae8e0] text-[#414942] hover:bg-[#e4e3db]'
              }`}
            >
              <span>{tab.label}</span>
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
          ))}

          <button type="button" onClick={addTab} className="rounded-lg px-3 py-1.5 text-[#356647] transition-colors hover:bg-[#356647]/10">
            <Icon>add</Icon>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: search + cart lines (larger touch targets) */}
        <section className="order-1 flex min-w-0 flex-1 flex-col bg-white text-base">
          <div className="relative z-20 shrink-0 border-b border-[#c1c9c0]/60 bg-[#f6f4ec] p-5">
            <div className="relative">
              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-[#717971]">search</Icon>
              <input
                className="w-full rounded-full border border-[#c1c9c0] bg-white py-3.5 pl-12 pr-12 text-base outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                placeholder="Tìm sản phẩm, SKU, barcode..."
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                autoFocus
              />
              <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-[22px] text-[#717971]">barcode_scanner</Icon>
            </div>

            {showSearchDropdown ? (
              <div className="custom-scrollbar absolute left-5 right-5 top-full z-30 mt-2 max-h-[min(45vh,400px)] overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
                {filteredResults.map((item) => (
                  <button
                    key={item.sku}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="flex w-full items-center gap-3 border-b border-[#f0eee6] p-3.5 text-left last:border-b-0 hover:bg-[#f6f4ec]"
                  >
                    {item.image ? (
                      <img className="h-12 w-12 rounded-lg object-cover" src={item.image} alt={item.name} />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#ceebc1]">
                        <Icon className="text-[24px] text-[#4a6242]">eco</Icon>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-medium">{item.name}</div>
                      <div className="text-xs text-[#717971]">{item.sku}</div>
                    </div>
                    <div className="shrink-0 text-base font-bold text-[#356647]">{formatMoney(item.price)}</div>
                  </button>
                ))}
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

                  return (
                    <div
                      key={item.sku}
                      className="flex items-center gap-3 rounded-xl border border-[#c1c9c0]/50 bg-[#fbf9f1] px-3 py-3"
                    >
                      <div className="min-w-0 flex-[1.2]">
                        <p className="truncate text-base font-semibold leading-snug text-[#1b1c17]" title={item.name}>
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-sm text-[#717971]">{formatMoney(item.price)} đ</p>
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

                      <div className="flex w-[9.5rem] shrink-0 overflow-hidden rounded-lg border border-[#c1c9c0] bg-white">
                        <div className="flex shrink-0 border-r border-[#c1c9c0]">
                          <button
                            type="button"
                            onClick={() => updateLineDiscountType(item.sku, 'percent')}
                            className={`px-2.5 py-2 text-xs font-bold ${
                              isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLineDiscountType(item.sku, 'amount')}
                            className={`px-2.5 py-2 text-xs font-bold ${
                              !isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
                            }`}
                          >
                            đ
                          </button>
                        </div>
                        <input
                          type={isPercent ? 'number' : 'text'}
                          inputMode="numeric"
                          min={isPercent ? 0 : undefined}
                          max={isPercent ? 100 : undefined}
                          className="min-w-0 flex-1 py-2 pl-2 pr-2 text-sm outline-none"
                          placeholder="0"
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

                      <div className="w-[5.5rem] shrink-0 text-right text-base font-bold text-[#356647]">
                        {formatMoney(lineTotal)}
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
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Khách hàng</label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">person</Icon>
                  <input
                    readOnly
                    className="w-full rounded-lg border border-[#c1c9c0]/60 bg-[#fbf9f1] py-2 pl-9 pr-2 text-sm outline-none"
                    placeholder="Chưa chọn khách"
                    value={selectedCustomer}
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
                      setOrderDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
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
                    placeholder="0"
                    value={amountPaidInput}
                    onChange={(event) => setAmountPaidInput(event.target.value.replace(/\D/g, ''))}
                  />
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
                    {formatMoney(change)} đ
                  </div>
                  {amountPaid > 0 && amountPaid < total ? (
                    <p className="mt-1 text-sm font-medium text-[#ba1a1a]">Thiếu {formatMoney(total - amountPaid)} đ</p>
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
                    onClick={() => setPaymentMethod(method.id)}
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
              {isTransferPayment ? 'Thanh toán · QR' : 'Thanh toán'}
            </button>
          </div>
        </section>
      </div>

      <AddCustomerModal
        isOpen={openModal === 'customer'}
        onClose={() => setOpenModal(null)}
        onSaved={(name) => {
          setSelectedCustomer(name)
          setOpenModal(null)
        }}
      />
      <OrderOfferModal
        isOpen={openModal === 'offer'}
        onClose={() => setOpenModal(null)}
        onConfirm={(percent) => {
          setOrderDiscountPercent(percent)
          setOpenModal(null)
        }}
      />
    </div>
  )
}

export default PosPage
