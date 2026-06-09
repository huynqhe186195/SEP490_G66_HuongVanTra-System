import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import CustomerDetailModal from '../components/CustomerDetailModal.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { printReceiptFromData } from '../utils/printReceipt.js'
import { vietnamNowLabel } from '../../../utils/vietnamDateTime.js'
import {
  buildTakeawayOrderPayload,
  createPosOrderOffline,
  createPosOrderOnline,
  createTakeawayCodOrder,
  createTakeawayVietQrOrder,
  fetchPosCustomerContext,
  fetchPosCustomers,
  fetchPosProducts,
  fetchPromotionByCode,
  resolvePosStoreId,
} from '../services/posApi.js'
import { loadPosSeller } from '../utils/posSeller.js'
import {
  normalizeOrderDiscountInput,
  validatePosDiscountsBeforePayment,
} from '../utils/posDiscountValidation.js'
import { computeCouponDiscount, formatPromotionLabel } from '../utils/posPromotionUtils.js'
import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import { fetchCategories } from '../../products/services/categoriesApi.js'
import ProductImage from '../../products/components/ProductImage.jsx'

const SALES_MODES = [
  { id: 'counter', label: 'Bán tại quầy', icon: 'storefront' },
  { id: 'takeaway', label: 'Bán COD', icon: 'local_shipping' },
]

const COUNTER_PAYMENT_METHODS = [
  { id: 'CASH', label: 'Tiền mặt', icon: 'payments' },
  { id: 'TRANSFER', label: 'Chuyển khoản', icon: 'account_balance' },
]

const TAKEAWAY_PAYMENT_METHODS = [
  { id: 'COD', label: 'COD — thu khi giao', icon: 'local_shipping' },
  { id: 'TRANSFER', label: 'Chuyển khoản / VietQR', icon: 'account_balance' },
]

function createWorkspace(mode = 'counter') {
  const empty = () => createEmptySession(mode)
  if (mode === 'takeaway') {
    return {
      tabs: [{ id: 1, label: 'Hóa đơn 1' }],
      activeTabId: 1,
      sessions: { 1: empty() },
    }
  }
  return {
    tabs: [{ id: 1, label: 'Hóa đơn 1' }],
    activeTabId: 1,
    sessions: { 1: empty() },
  }
}

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
  const percent = Math.min(100, Math.max(0, value))
  return Math.min(gross, Math.round((gross * percent) / 100))
}

function getLineTotal(item) {
  return Math.max(getLineGross(item) - getLineDiscount(item), 0)
}

/** Chuẩn hóa CK dòng — không vượt thành tiền dòng. */
function clampLineDiscountItem(item) {
  const gross = getLineGross(item)
  const value = item.lineDiscountValue || 0
  if (!value) {
    return item
  }

  if (item.lineDiscountType === 'amount') {
    const capped = Math.min(Math.max(0, value), gross)
    return capped === value ? item : { ...item, lineDiscountValue: capped }
  }

  const cappedPercent = Math.min(100, Math.max(0, value))
  return cappedPercent === value ? item : { ...item, lineDiscountValue: cappedPercent }
}

function clampCartLineDiscounts(cartItems) {
  return (Array.isArray(cartItems) ? cartItems : []).map(clampLineDiscountItem)
}

function computePosTotals(
  cartItems,
  orderDiscountPercent,
  orderDiscountAmountFixed,
  tierDiscountPercent,
  appliedPromotion = null,
) {
  const items = Array.isArray(cartItems) ? cartItems : []
  const grossSubtotal = items.reduce((sum, item) => sum + getLineGross(item), 0)
  const itemDiscountTotal = items.reduce((sum, item) => sum + getLineDiscount(item), 0)
  const subtotalAfterItemDiscount = items.reduce((sum, item) => sum + getLineTotal(item), 0)
  const fixedOrderDiscount = Math.max(0, Math.round(Number(orderDiscountAmountFixed) || 0))
  const orderDiscountAmount =
    fixedOrderDiscount > 0
      ? Math.min(fixedOrderDiscount, subtotalAfterItemDiscount)
      : Math.round((subtotalAfterItemDiscount * orderDiscountPercent) / 100)
  const totalBeforeCoupon = Math.max(subtotalAfterItemDiscount - orderDiscountAmount, 0)
  const couponDiscountAmount = computeCouponDiscount(totalBeforeCoupon, appliedPromotion)
  const totalBeforeTier = Math.max(totalBeforeCoupon - couponDiscountAmount, 0)
  const membershipDiscountAmount =
    tierDiscountPercent > 0 ? Math.round((totalBeforeTier * tierDiscountPercent) / 100) : 0
  const total = Math.max(totalBeforeTier - membershipDiscountAmount, 0)
  const totalDiscount =
    itemDiscountTotal + orderDiscountAmount + couponDiscountAmount + membershipDiscountAmount

  return {
    grossSubtotal,
    itemDiscountTotal,
    subtotalAfterItemDiscount,
    orderDiscountAmount,
    couponDiscountAmount,
    membershipDiscountAmount,
    total,
    totalDiscount,
  }
}

function createEmptySession(mode = 'counter') {
  return {
    searchValue: '',
    cartItems: [],
    orderDiscountPercent: 0,
    orderDiscountAmountFixed: 0,
    promoCodeInput: '',
    appliedPromotion: null,
    selectedCustomer: null,
    customerSearchValue: '',
    paymentMethod: mode === 'takeaway' ? 'COD' : 'CASH',
    amountPaidInput: '',
    shippingAddress: '',
    orderNote: '',
  }
}

function PosPage() {
  const navigate = useNavigate()
  const [salesMode, setSalesMode] = useState('counter')
  const [workspaceByMode, setWorkspaceByMode] = useState({
    counter: createWorkspace('counter'),
    takeaway: createWorkspace('takeaway'),
  })
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [isCustomerSearchLoading, setIsCustomerSearchLoading] = useState(false)
  const [openModal, setOpenModal] = useState(null)
  const [openDiscountSku, setOpenDiscountSku] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const [searchProducts, setSearchProducts] = useState([])
  const [posCategories, setPosCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [tabCloseConfirm, setTabCloseConfirm] = useState(null)
  const [savedShippingAddresses, setSavedShippingAddresses] = useState([])
  const [isLoadingShippingAddresses, setIsLoadingShippingAddresses] = useState(false)
  const [useCustomShippingAddress, setUseCustomShippingAddress] = useState(false)
  const [seller, setSeller] = useState({ name: 'Nhân viên POS', role: '—', display: 'Nhân viên POS · —' })
  const discountPopoverRef = useRef(null)

  const isTakeaway = salesMode === 'takeaway'
  const workspace = workspaceByMode[salesMode]
  const { tabs, activeTabId, sessions } = workspace
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const session = sessions[activeTabId] ?? createEmptySession(salesMode)
  const {
    searchValue = '',
    cartItems = [],
    orderDiscountPercent = 0,
    orderDiscountAmountFixed = 0,
    promoCodeInput = '',
    appliedPromotion = null,
    selectedCustomer = null,
    customerSearchValue = '',
    paymentMethod: sessionPaymentMethod,
    amountPaidInput = '',
    shippingAddress = '',
    orderNote = '',
  } = session ?? createEmptySession(salesMode)

  const paymentMethod = sessionPaymentMethod ?? (isTakeaway ? 'COD' : 'CASH')

  const paymentMethods = isTakeaway ? TAKEAWAY_PAYMENT_METHODS : COUNTER_PAYMENT_METHODS

  const patchWorkspace = (patch) => {
    setWorkspaceByMode((all) => ({
      ...all,
      [salesMode]: typeof patch === 'function' ? patch(all[salesMode]) : { ...all[salesMode], ...patch },
    }))
  }

  const updateActiveSession = (updater) => {
    patchWorkspace((ws) => {
      const prevSession = ws.sessions[ws.activeTabId] ?? createEmptySession(salesMode)
      const nextSession = typeof updater === 'function' ? updater(prevSession) : { ...prevSession, ...updater }
      return { ...ws, sessions: { ...ws.sessions, [ws.activeTabId]: nextSession } }
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

  useEffect(() => {
    let mounted = true

    fetchCategories()
      .then((items) => {
        if (mounted) {
          setPosCategories(Array.isArray(items) ? items.filter((item) => item.isActive !== false) : [])
        }
      })
      .catch(() => {
        if (mounted) setPosCategories([])
      })

    return () => {
      mounted = false
    }
  }, [])

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(value)

  const formatStock = (value) => {
    const n = Number(value) || 0
    if (Math.abs(n - Math.round(n)) < 0.001) {
      return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(n))
    }
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n)
  }

  const formatStockHint = (value) => {
    const n = Number(value) || 0
    if (n <= 0) {
      return 'Số lượng hiện tại: 0 · bán trước, trừ sau'
    }
    if (n <= 5) {
      return `Số lượng hiện tại: ${formatStock(n)} · sắp hết`
    }
    return `Số lượng hiện tại: ${formatStock(n)}`
  }

  const parseQtyInput = (value) => {
    const normalized = String(value).trim().replace(',', '.')
    if (!normalized) {
      return null
    }
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return Number(parsed.toFixed(2))
  }

  const parseMoneyInput = (value) => {
    const digits = String(value).replace(/\D/g, '')
    return digits ? Number(digits) : 0
  }

  const tierDiscountPercent = isVipCustomerType(selectedCustomer?.customerType)
    ? 0
    : Number(selectedCustomer?.tierDiscountPercent || 0)
  const canUseOrderDiscount = isVipCustomerType(selectedCustomer?.customerType)
  const effectiveOrderDiscountPercent = canUseOrderDiscount ? orderDiscountPercent : 0
  const effectiveOrderDiscountAmountFixed = canUseOrderDiscount ? orderDiscountAmountFixed : 0
  const {
    grossSubtotal,
    itemDiscountTotal,
    subtotalAfterItemDiscount,
    orderDiscountAmount,
    couponDiscountAmount,
    membershipDiscountAmount,
    total,
    totalDiscount,
  } = computePosTotals(
    cartItems,
    effectiveOrderDiscountPercent,
    effectiveOrderDiscountAmountFixed,
    tierDiscountPercent,
    appliedPromotion,
  )
  const usesFixedOrderDiscount = canUseOrderDiscount && (orderDiscountAmountFixed || 0) > 0
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
          limit: searchValue.trim() ? 40 : 60,
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

  useEffect(() => {
    const customerId = selectedCustomer?.customerId
    if (!customerId) return undefined

    let cancelled = false
    fetchPosCustomerContext(customerId)
      .then((context) => {
        if (cancelled || !context) return
        updateActiveSession((prev) => {
          if (prev.selectedCustomer?.customerId !== customerId) return prev
          return {
            ...prev,
            selectedCustomer: {
              ...prev.selectedCustomer,
              customerType: context.customerType || prev.selectedCustomer.customerType,
              currentDebt: context.currentDebt,
              tierCode: context.tierCode || prev.selectedCustomer.tierCode,
              tierId: context.tierId ?? prev.selectedCustomer.tierId,
              tierDiscountPercent: context.tierDiscountPercent ?? prev.selectedCustomer.tierDiscountPercent,
              totalSpend: context.totalSpend ?? prev.selectedCustomer.totalSpend,
            },
          }
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.customerId])

  useEffect(() => {
    if (!isTakeaway || !selectedCustomer?.customerId) {
      setSavedShippingAddresses([])
      setUseCustomShippingAddress(false)
      return undefined
    }

    let cancelled = false
    setIsLoadingShippingAddresses(true)

    fetchPosCustomerContext(selectedCustomer.customerId)
      .then((context) => {
        if (cancelled) return
        const addresses = (context.shippingAddresses ?? [])
          .map((row) => row.address?.trim())
          .filter(Boolean)
        setSavedShippingAddresses(addresses)

        const current = shippingAddress?.trim()
        if (current && addresses.some((addr) => addr === current)) {
          setUseCustomShippingAddress(false)
          return
        }

        if (addresses.length > 0) {
          setUseCustomShippingAddress(false)
          updateActiveSession({ shippingAddress: addresses[0] })
        } else {
          setUseCustomShippingAddress(true)
          if (!current) {
            updateActiveSession({ shippingAddress: '' })
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSavedShippingAddresses([])
          setUseCustomShippingAddress(true)
          showError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingShippingAddresses(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isTakeaway, selectedCustomer?.customerId])

  const addTab = () => {
    const nextId = tabs.length ? Math.max(...tabs.map((tab) => tab.id)) + 1 : 1
    const nextTab = { id: nextId, label: `Hóa đơn ${nextId}` }
    patchWorkspace((ws) => ({
      ...ws,
      tabs: [...ws.tabs, nextTab],
      sessions: { ...ws.sessions, [nextId]: createEmptySession(salesMode) },
      activeTabId: nextId,
    }))
    setOpenDiscountSku(null)
  }

  const closeTab = (tabId) => {
    patchWorkspace((ws) => {
      if (ws.tabs.length === 1) {
        return ws
      }

      const nextTabs = ws.tabs.filter((tab) => tab.id !== tabId)
      const nextSessions = { ...ws.sessions }
      delete nextSessions[tabId]

      return {
        ...ws,
        tabs: nextTabs,
        sessions: nextSessions,
        activeTabId: tabId === ws.activeTabId ? (nextTabs[0]?.id ?? ws.activeTabId) : ws.activeTabId,
      }
    })
    setOpenDiscountSku(null)
  }

  const requestCloseTab = (tabId) => {
    if (tabs.length <= 1) return

    const tabSession = sessions[tabId]
    const tabItemCount = tabSession?.cartItems?.length ?? 0
    if (tabItemCount === 0) {
      closeTab(tabId)
      return
    }

    const tab = tabs.find((item) => item.id === tabId)
    setTabCloseConfirm({ tabId, label: tab?.label ?? 'hóa đơn này' })
  }

  const handleConfirmCloseTab = () => {
    if (!tabCloseConfirm) return
    closeTab(tabCloseConfirm.tabId)
    setTabCloseConfirm(null)
  }

  const addToCart = (product) => {
    const stockOnHand = Math.max(0, Number(product.stockQuantity) || 0)

    updateActiveSession((prev) => {
      const currentItems = prev.cartItems
      const existingLine = currentItems.find((item) => item.sku === product.sku)
      if (existingLine) {
        const nextQty = Number((existingLine.qty + existingLine.step).toFixed(2))
        return {
          ...prev,
          cartItems: clampCartLineDiscounts(
            currentItems.map((item) =>
              item.sku === product.sku
                ? { ...item, qty: nextQty, stockQuantity: stockOnHand }
                : item,
            ),
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
            productName: product.productName,
            packagingType: product.packagingType,
            name: product.name,
            qty: 1,
            unit: 'x',
            price: product.price,
            step: 1,
            stockQuantity: stockOnHand,
            lineDiscountType: 'percent',
            lineDiscountValue: 0,
          },
        ],
        searchValue: '',
      }
    })
  }

  const updateQuantity = (sku, direction) => {
    const target = cartItems.find((item) => item.sku === sku)
    if (!target) {
      return
    }

    const nextQty =
      direction === 'inc'
        ? Number((target.qty + target.step).toFixed(2))
        : Number((target.qty - target.step).toFixed(2))

    updateActiveSession((prev) => ({
      ...prev,
      cartItems: clampCartLineDiscounts(
        prev.cartItems
          .map((item) => {
            if (item.sku !== sku) {
              return item
            }
            return { ...item, qty: nextQty }
          })
          .filter((item) => item.qty > 0),
      ),
    }))
  }

  const setLineQuantity = (sku, rawValue) => {
    const item = cartItems.find((row) => row.sku === sku)
    if (!item) {
      return
    }

    const parsed = parseQtyInput(rawValue)
    if (parsed == null) {
      return
    }

    if (parsed <= 0) {
      updateActiveSession((prev) => ({
        ...prev,
        cartItems: clampCartLineDiscounts(prev.cartItems.filter((row) => row.sku !== sku)),
      }))
      return
    }

    updateActiveSession((prev) => ({
      ...prev,
      cartItems: clampCartLineDiscounts(
        prev.cartItems.map((row) => (row.sku === sku ? { ...row, qty: parsed } : row)),
      ),
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
    const item = cartItems.find((row) => row.sku === sku)
    if (!item) {
      return
    }

    const gross = getLineGross(item)

    if (item.lineDiscountType === 'amount') {
      const parsed = parseMoneyInput(rawValue)
      if (parsed > gross) {
        showError(
          gross > 0
            ? `Chiết khấu không được vượt thành tiền dòng (${formatMoney(gross)} đ).`
            : 'Không thể chiết khấu khi thành tiền dòng bằng 0.',
        )
        updateActiveSession((prev) => ({
          ...prev,
          cartItems: prev.cartItems.map((row) =>
            row.sku === sku ? { ...row, lineDiscountValue: gross } : row,
          ),
        }))
        return
      }

      updateActiveSession((prev) => ({
        ...prev,
        cartItems: prev.cartItems.map((row) =>
          row.sku === sku ? { ...row, lineDiscountValue: parsed } : row,
        ),
      }))
      return
    }

    const parsed = Math.max(0, Number(rawValue) || 0)
    if (parsed > 100) {
      showError('Chiết khấu % không được vượt 100%.')
    }

    updateActiveSession((prev) => ({
      ...prev,
      cartItems: prev.cartItems.map((row) =>
        row.sku === sku ? { ...row, lineDiscountValue: Math.min(100, parsed) } : row,
      ),
    }))
  }

  const updateOrderDiscountPercent = (rawValue) => {
    const parsed = Math.max(0, Number(rawValue) || 0)
    if (parsed > 100) {
      showError('Chiết khấu đơn không được vượt 100%.')
      updateActiveSession({ orderDiscountPercent: 100, orderDiscountAmountFixed: 0 })
      return
    }
    updateActiveSession({ orderDiscountPercent: parsed, orderDiscountAmountFixed: 0 })
  }

  const handleApplyPromoCode = async () => {
    const code = promoCodeInput.trim()
    if (!code) {
      showError('Vui lòng nhập mã giảm giá.')
      return
    }
    setIsApplyingPromo(true)
    try {
      const promotion = await fetchPromotionByCode(code)
      updateActiveSession({ appliedPromotion: promotion, promoCodeInput: promotion.promoCode })
      showSuccess(`Đã áp dụng mã ${promotion.promoCode}.`)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsApplyingPromo(false)
    }
  }

  const handleClearPromoCode = () => {
    updateActiveSession({ appliedPromotion: null, promoCodeInput: '' })
  }

  const validateDiscountsBeforePayment = () => {
    const normalizedItems = clampCartLineDiscounts(cartItems)
    const cartBySku = Object.fromEntries(cartItems.map((row) => [row.sku, row]))
    const hasStaleLineDiscount = normalizedItems.some((row) => {
      const current = cartBySku[row.sku]
      return current && (row.lineDiscountValue || 0) !== (current.lineDiscountValue || 0)
    })

    if (hasStaleLineDiscount) {
      updateActiveSession({ cartItems: normalizedItems })
      showError('Đã điều chỉnh chiết khấu cho khớp thành tiền. Vui lòng kiểm tra lại trước khi thanh toán.')
      return false
    }

    const paymentCheck = validatePosDiscountsBeforePayment({
      cartItems: normalizedItems,
      orderDiscountPercent,
      orderDiscountAmountFixed,
      grossSubtotal,
      subtotalAfterItemDiscount,
      orderDiscountAmount,
      totalDiscount,
      total,
    })

    if (!paymentCheck.ok) {
      if (paymentCheck.clampOrderDiscount) {
        updateActiveSession(paymentCheck.clampOrderDiscount)
      }
      showError(paymentCheck.error)
      return false
    }

    return true
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
    const applied = getLineDiscount(item)
    if (!applied) return null
    if (item.lineDiscountType === 'amount') {
      return `-${formatMoney(applied)}đ`
    }
    const percent = Math.min(100, Math.max(0, item.lineDiscountValue || 0))
    return `-${percent}%`
  }

  const hasCartItems = cartItems.length > 0
  const hasCustomerSelected = Boolean(selectedCustomer?.customerId)
  const hasShippingAddress = Boolean(shippingAddress?.trim())
  const isTransferPayment = paymentMethod === 'TRANSFER'
  const isZeroAmountSale = total === 0 && grossSubtotal > 0
  const canPayCash = hasCartItems && hasCustomerSelected
  const canPayTransfer = hasCartItems && hasCustomerSelected && total > 0
  const canPayTakeaway =
    hasCartItems && hasCustomerSelected && hasShippingAddress && (isTransferPayment ? total > 0 : true)
  const canPay = isTakeaway
    ? canPayTakeaway && !isSubmitting
    : (isTransferPayment ? canPayTransfer : canPayCash) && !isSubmitting

  const buildOrderPayload = (method, amount) => {
    const storeId = resolvePosStoreId()
    const manualDiscount = Math.round(itemDiscountTotal + orderDiscountAmount)
    return {
      storeId,
      customerId: selectedCustomer.customerId,
      promotionId: appliedPromotion?.id ?? null,
      manualDiscount,
      note: orderNote,
      items: cartItems.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.qty,
        unitPrice: item.price,
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

  const buildReceiptData = ({ orderCode, method, invoiceCode, orderTotal }) => {
    const receiptTotal = orderTotal ?? total
    return {
    orderCode: orderCode || activeTab.label,
    invoiceCode: invoiceCode || undefined,
    customerName: selectedCustomer?.fullName || 'Khách lẻ',
    paymentMethodLabel:
      method === 'COD' ? 'COD — thu khi giao' : method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt',
    createdAtLabel: vietnamNowLabel(),
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
    totalDiscount: itemDiscountTotal + orderDiscountAmount + couponDiscountAmount + membershipDiscountAmount,
    total: receiptTotal,
    amountPaid: method === 'CASH' ? cashPaymentAmount : receiptTotal,
    customerPaid: method === 'CASH' ? amountPaid : receiptTotal,
    change: method === 'CASH' ? change : 0,
    debtAmount: method === 'CASH' ? debtAmount : 0,
    isDebtSale: method === 'CASH' && isDebtSale,
    isPartialCashPayment: method === 'CASH' && isPartialCashPayment,
  }
  }

  const resetCheckoutState = () => {
    updateActiveSession(createEmptySession(salesMode))
    setOpenDiscountSku(null)
  }

  const handleTakeawayPayment = async () => {
    const address = shippingAddress?.trim()
    if (!address) {
      showError('Vui lòng nhập địa chỉ giao hàng cho đơn mang đi.')
      return
    }

    if (!validateDiscountsBeforePayment()) {
      return
    }

    const manualDiscount = Math.round(itemDiscountTotal + orderDiscountAmount)
    const payload = buildTakeawayOrderPayload({
      storeId: resolvePosStoreId(),
      customerId: selectedCustomer.customerId,
      shippingAddress: address,
      note: orderNote,
      cartItems,
      manualDiscount,
      promotionId: appliedPromotion?.id ?? null,
    })

    if (isTransferPayment) {
      const result = await createTakeawayVietQrOrder(payload)
      showSuccess(`Đã tạo đơn mang đi ${result.orderCode}. Khách quét QR để thanh toán.`)
      const receipt = buildReceiptData({
        orderCode: result.orderCode,
        method: 'TRANSFER',
      })
      resetCheckoutState()
      navigate('/pos/payment/qr', {
        state: {
          orderId: result.orderId,
          orderCode: result.orderCode,
          orderLabel: result.orderCode,
          total: result.totalAmount || total,
          qrPayload: result.qrPayload,
          qrImageUrl: result.qrImageUrl,
          transferContent: result.transferContent,
          transferAccountNumber: result.transferAccountNumber,
          paymentMode: result.paymentMode,
          qrExpiresAtUtc: result.qrExpiresAtUtc,
          customer: selectedCustomer?.fullName || '',
          paymentMethod: 'TRANSFER',
          receipt,
        },
      })
      return
    }

    const result = await createTakeawayCodOrder(payload)
    showSuccess(`Đã tạo đơn COD ${result.orderCode}. Theo dõi tại mục Đơn COD.`)
    const receipt = buildReceiptData({
      orderCode: result.orderCode,
      method: 'COD',
      orderTotal: result.totalAmount,
    })
    resetCheckoutState()
    printReceiptFromData(receipt)
  }

  const handlePayment = async () => {
    if (!hasCustomerSelected) {
      showError('Vui lòng chọn hoặc thêm khách hàng trước khi thanh toán.')
      return
    }

    if (isTakeaway) {
      if (!canPay) {
        if (!hasShippingAddress) {
          showError('Vui lòng nhập địa chỉ giao hàng.')
        } else if (isTransferPayment && total <= 0) {
          showError('Đơn 0 đ không dùng chuyển khoản — chọn COD.')
        }
        return
      }

      setIsSubmitting(true)
      try {
        await handleTakeawayPayment()
      } catch (error) {
        showError(error.message)
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (!validateDiscountsBeforePayment()) {
      return
    }

    if (!canPay) {
      if (isTransferPayment && isZeroAmountSale) {
        showError('Đơn 0 đ vui lòng chọn thanh toán tiền mặt.')
      }
      return
    }

    setIsSubmitting(true)
    try {
      if (isTransferPayment) {
        const payload = buildOrderPayload('TRANSFER', total)
        const result = await createPosOrderOnline(payload)

        showSuccess(`Đã tạo đơn ${result.orderCode}. Vui lòng quét mã QR để thanh toán.`)
        const receipt = buildReceiptData({ orderCode: result.orderCode, method: 'TRANSFER' })
        resetCheckoutState()
        navigate('/pos/payment/qr', {
          state: {
            orderId: result.orderId,
            orderCode: result.orderCode,
            orderLabel: result.orderCode,
            total: result.totalAmount || total,
            qrPayload: result.qrPayload,
            qrImageUrl: result.qrImageUrl,
            transferContent: result.transferContent,
            transferAccountNumber: result.transferAccountNumber,
            paymentMode: result.paymentMode,
            qrExpiresAtUtc: result.qrExpiresAtUtc,
            customer: selectedCustomer?.fullName || '',
            paymentMethod: 'TRANSFER',
            receipt,
          },
        })
        return
      }

      const payload = buildOrderPayload('CASH', cashPaymentAmount)
      const result = await createPosOrderOffline(payload)

      if (cashPaymentAmount >= total) {
        showSuccess(
          result.invoiceCode
            ? total === 0
              ? `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}`
              : `Thanh toán thành công. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}`
            : total === 0
              ? `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode}`
              : `Thanh toán thành công. Đơn: ${result.orderCode}`,
        )
      } else if (isDebtSale) {
        showSuccess(`Ghi đơn ${result.orderCode} thành công. Dư nợ: ${formatMoney(debtAmount)} đ.`)
      } else {
        showSuccess(
          `Ghi đơn ${result.orderCode}. Đã thu ${formatMoney(cashPaymentAmount)} đ, còn nợ ${formatMoney(debtAmount)} đ.`,
        )
      }
      const receipt = buildReceiptData({
        orderCode: result.orderCode,
        method: 'CASH',
        invoiceCode: result.invoiceCode,
      })
      resetCheckoutState()
      printReceiptFromData(receipt)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSearchQuery = searchValue.trim().length > 0

  const filteredSearchProducts = useMemo(() => {
    if (!selectedCategoryId) return searchProducts
    const categoryId = Number(selectedCategoryId)
    return searchProducts.filter((item) => Number(item.categoryId) === categoryId)
  }, [searchProducts, selectedCategoryId])

  const hasCustomerSearchQuery = customerSearchValue.trim().length > 0
  const showCustomerDropdown = !selectedCustomer && hasCustomerSearchQuery && customerSearchResults.length > 0
  const showCustomerSearchEmpty =
    !selectedCustomer && hasCustomerSearchQuery && !isCustomerSearchLoading && customerSearchResults.length === 0

  const selectCustomer = (customer) => {
    const keepOrderDiscount = isVipCustomerType(customer?.customerType)
    updateActiveSession({
      selectedCustomer: customer,
      customerSearchValue: '',
      shippingAddress: '',
      ...(keepOrderDiscount ? {} : { orderDiscountPercent: 0, orderDiscountAmountFixed: 0 }),
    })
    setCustomerSearchResults([])
    setSavedShippingAddresses([])
    setUseCustomShippingAddress(false)
  }

  const handleSavedShippingAddressChange = (value) => {
    if (value === '__custom__') {
      setUseCustomShippingAddress(true)
      updateActiveSession({ shippingAddress: '' })
      return
    }
    setUseCustomShippingAddress(false)
    updateActiveSession({ shippingAddress: value })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:rounded-[28px]">
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
              onClick={() => patchWorkspace({ activeTabId: tab.id })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  patchWorkspace({ activeTabId: tab.id })
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
              {tabs.length > 1 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    requestCloseTab(tab.id)
                  }}
                  className="ml-2 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10"
                  aria-label={`Đóng ${tab.label}`}
                >
                  <Icon className="text-[16px] opacity-80">close</Icon>
                </button>
              ) : null}
            </div>
            )
          })}

          <button type="button" onClick={addTab} className="rounded-lg px-3 py-1.5 text-[#356647] transition-colors hover:bg-[#356647]/10">
            <Icon>add</Icon>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        {/* Left: search + product catalog */}
        <section className="order-1 flex min-h-[38vh] min-w-0 flex-1 flex-col bg-white text-base xl:min-h-0">
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

          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#c1c9c0]/40 px-4 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">
                  Danh sách sản phẩm
                  {hasSearchQuery ? (
                    <span className="ml-1 font-normal normal-case text-[#414942]">· &quot;{searchValue.trim()}&quot;</span>
                  ) : null}
                </p>
                <span className="shrink-0 text-xs text-[#717971]">{filteredSearchProducts.length} SP</span>
              </div>

              {posCategories.length > 0 ? (
                <div className="custom-scrollbar shrink-0 overflow-x-auto border-b border-[#c1c9c0]/30 px-3 py-2">
                  <div className="flex min-w-max gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId('')}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        !selectedCategoryId
                          ? 'bg-[#356647] text-white'
                          : 'bg-white text-[#414942] hover:bg-[#f0eee6]'
                      }`}
                    >
                      Tất cả
                    </button>
                    {posCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(String(category.id))}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selectedCategoryId === String(category.id)
                            ? 'bg-[#356647] text-white'
                            : 'bg-white text-[#414942] hover:bg-[#f0eee6]'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-3">
                {isSearchLoading ? (
                  <p className="px-1 py-3 text-sm text-[#717971]">Đang tải sản phẩm...</p>
                ) : filteredSearchProducts.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-[#717971]">
                    {hasSearchQuery || selectedCategoryId
                      ? 'Không tìm thấy sản phẩm phù hợp.'
                      : 'Chưa có sản phẩm để hiển thị.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                    {filteredSearchProducts.map((item) => {
                      const outOfStock = Number(item.stockQuantity) <= 0
                      return (
                        <button
                          key={`${item.productId}-${item.sku}`}
                          type="button"
                          onClick={() => addToCart(item)}
                          className="flex w-full items-center gap-2.5 rounded-xl border border-[#c1c9c0]/50 bg-[#fbf9f1] p-2.5 text-left transition-colors hover:border-[#356647]/35 hover:bg-[#f6f4ec]"
                        >
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-12 w-12 shrink-0 rounded-lg"
                            iconClassName="text-[20px]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1b1c17]">{item.name}</p>
                            <p className="truncate text-xs text-[#717971]">
                              {item.sku}
                              <span className="mx-1">·</span>
                              <span
                                className={
                                  outOfStock || Number(item.stockQuantity) <= 5
                                    ? 'font-semibold text-[#7e5700]'
                                    : ''
                                }
                              >
                                {formatStockHint(item.stockQuantity)}
                              </span>
                            </p>
                          </div>
                          <p className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[#356647]">
                            {formatMoney(item.price)} đ
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right: cart + customer + payment */}
        <section className="order-2 flex min-h-[42vh] w-full min-w-0 flex-col border-t border-[#c1c9c0] bg-[#f6f4ec] xl:max-h-none xl:min-h-0 xl:min-w-[min(100%,300px)] xl:max-w-[min(100%,48%)] xl:flex-[1_1_360px] xl:border-l xl:border-t-0 xl:shadow-[-4px_0_20px_rgba(0,0,0,0.04)]">
          <div className="flex min-h-0 flex-[1.15] flex-col border-b border-[#c1c9c0]/60 bg-white">
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Giỏ hàng</p>
              <span className="shrink-0 text-xs text-[#717971]">
                {cartItems.length} SP · {activeTab.label}
              </span>
            </div>

            <div className="custom-scrollbar min-h-[120px] flex-1 overflow-y-auto px-3 pb-3">
              {!hasCartItems ? (
                <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c1c9c0]/80 bg-[#f6f4ec]/40 p-5 text-center">
                  <Icon className="mb-2 text-[44px] text-[#717971]/50">shopping_cart</Icon>
                  <p className="text-sm font-semibold text-[#414942]">Giỏ hàng trống</p>
                  <p className="mt-1 text-xs text-[#717971]">Chọn sản phẩm bên trái để thêm.</p>
                </div>
              ) : (
                <div className="space-y-2">
                {cartItems.map((item) => {
                  const lineGross = getLineGross(item)
                  const lineTotal = getLineTotal(item)
                  const isPercent = item.lineDiscountType !== 'amount'
                  const isDiscountOpen = openDiscountSku === item.sku
                  const discountLabel = formatLineDiscountLabel(item)
                  const lineDiscountCapHint = isPercent
                    ? 'Tối đa 100%'
                    : lineGross > 0
                      ? `Tối đa ${formatMoney(lineGross)} đ`
                      : 'Thành tiền dòng: 0 đ'

                  return (
                    <div
                      key={item.sku}
                      className="relative flex flex-nowrap items-center gap-2 rounded-xl border border-[#c1c9c0]/50 bg-[#fbf9f1] px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3"
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold leading-snug text-[#1b1c17] sm:text-base" title={item.name}>
                          {item.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#717971] sm:text-sm">
                          {formatMoney(item.price)} đ
                          <span
                            className={`ml-1 text-[11px] sm:text-xs ${
                              Number(item.stockQuantity) <= 0 ? 'font-semibold text-[#7e5700]' : ''
                            }`}
                          >
                            · {formatStockHint(item.stockQuantity)}
                          </span>
                          {discountLabel ? (
                            <span className="ml-1 text-[11px] font-semibold text-[#7e5700] sm:text-xs">{discountLabel}</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-[#c1c9c0] text-sm sm:text-base">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, 'dec')}
                          className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Số lượng ${item.name}`}
                          className="w-[2.75rem] border-x border-[#c1c9c0] bg-white px-0.5 py-1 text-center text-sm font-semibold outline-none focus:bg-[#f6f4ec] focus:ring-1 focus:ring-[#356647]/30 sm:w-[3.25rem] sm:px-1 sm:text-base"
                          value={item.qty}
                          onChange={(event) => setLineQuantity(item.sku, event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, 'inc')}
                          className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white"
                        >
                          +
                        </button>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => setOpenDiscountSku(isDiscountOpen ? null : item.sku)}
                          className={`whitespace-nowrap rounded-lg px-1.5 py-1 text-right text-sm font-bold tabular-nums transition-colors sm:text-base ${
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
                            <p className="mt-2 text-[11px] text-[#717971]">{lineDiscountCapHint}</p>
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
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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
                    {isVipCustomerType(selectedCustomer.customerType) ? (
                      <p className="mt-1 inline-flex">
                        <span className="rounded-full bg-[#fec25b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#744f00]">
                          Khách VIP
                        </span>
                      </p>
                    ) : selectedCustomer.tierCode ? (
                      <p className="mt-0.5 text-xs font-semibold text-[#356647]">
                        Hạng {selectedCustomer.tierCode}
                        {tierDiscountPercent > 0 ? ` · CK ${tierDiscountPercent}%` : ''}
                      </p>
                    ) : null}
                    {Number(selectedCustomer.currentDebt) > 0 ? (
                      <p className="mt-0.5 text-xs font-semibold text-[#7e5700]">
                        Công nợ: {formatMoney(selectedCustomer.currentDebt)} đ
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      updateActiveSession({
                        selectedCustomer: null,
                        customerSearchValue: '',
                        orderDiscountPercent: 0,
                        orderDiscountAmountFixed: 0,
                      })
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
                        {Number(customer.currentDebt) > 0 ? ` · Nợ ${formatMoney(customer.currentDebt)} đ` : ''}
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
                </p>
              ) : null}
            </div>

            {isTakeaway ? (
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="shipping-address">
                  Địa chỉ giao hàng
                </label>
                {isLoadingShippingAddresses ? (
                  <p className="text-xs text-[#717971]">Đang tải địa chỉ đã giao...</p>
                ) : null}
                {!isLoadingShippingAddresses && savedShippingAddresses.length > 0 ? (
                  <select
                    id="shipping-address-select"
                    className="mb-2 w-full rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    value={useCustomShippingAddress ? '__custom__' : shippingAddress}
                    onChange={(event) => handleSavedShippingAddressChange(event.target.value)}
                  >
                    {savedShippingAddresses.map((addr) => (
                      <option key={addr} value={addr}>
                        {addr.length > 72 ? `${addr.slice(0, 72)}…` : addr}
                      </option>
                    ))}
                    <option value="__custom__">Nhập địa chỉ khác...</option>
                  </select>
                ) : null}
                {(useCustomShippingAddress || savedShippingAddresses.length === 0) && !isLoadingShippingAddresses ? (
                  <textarea
                    id="shipping-address"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="Số nhà, phường, quận, tỉnh..."
                    value={shippingAddress}
                    onChange={(event) => updateActiveSession({ shippingAddress: event.target.value })}
                  />
                ) : null}
                {!hasShippingAddress && !isLoadingShippingAddresses ? (
                  <p className="mt-2 text-xs font-medium text-[#ba1a1a]">Vui lòng chọn hoặc nhập địa chỉ giao.</p>
                ) : null}
              </div>
            ) : null}

            {canUseOrderDiscount ? (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Chiết khấu đơn</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={usesFixedOrderDiscount}
                    className="w-full rounded-lg border border-[#c1c9c0] py-2 pl-3 pr-7 text-sm outline-none focus:border-[#356647] disabled:bg-slate-50 disabled:text-slate-400"
                    value={usesFixedOrderDiscount ? '' : orderDiscountPercent || ''}
                    onChange={(event) => updateOrderDiscountPercent(event.target.value)}
                    placeholder={usesFixedOrderDiscount ? '—' : '0'}
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
              {usesFixedOrderDiscount ? (
                <p className="mt-2 text-xs font-semibold text-[#356647]">
                  CK cố định: -{formatMoney(orderDiscountAmount)} đ
                </p>
              ) : null}
              {isTakeaway ? (
                <p className="mt-2 text-xs text-[#717971]">
                  Bấm thành tiền từng SP để CK dòng. Tổng đơn gửi COD/VietQR đã trừ CK.
                </p>
              ) : null}
            </div>
            ) : null}

            <div className="rounded-xl bg-white p-3 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">
                Mã giảm giá
              </label>
              {appliedPromotion ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#356647]">
                      {formatPromotionLabel(appliedPromotion)}
                    </p>
                    {couponDiscountAmount > 0 ? (
                      <p className="text-xs text-[#717971]">Giảm {formatMoney(couponDiscountAmount)} đ</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPromoCode}
                    className="shrink-0 text-xs font-semibold text-[#717971] hover:text-[#ba1a1a]"
                  >
                    Gỡ
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm uppercase outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                    placeholder="VD: SALE10"
                    value={promoCodeInput}
                    onChange={(event) => updateActiveSession({ promoCodeInput: event.target.value.toUpperCase() })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleApplyPromoCode()
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isApplyingPromo || !promoCodeInput.trim()}
                    onClick={handleApplyPromoCode}
                    className="shrink-0 rounded-lg bg-[#356647] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e] disabled:opacity-50"
                  >
                    {isApplyingPromo ? '...' : 'Áp dụng'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]" htmlFor="order-note">
                Ghi chú đơn hàng
              </label>
              <textarea
                id="order-note"
                rows={2}
                maxLength={500}
                placeholder="VD: Gói quà, giao giờ hành chính, khách dị ứng sữa..."
                className="w-full resize-none rounded-xl border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2.5 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                value={orderNote}
                onChange={(event) => updateActiveSession({ orderNote: event.target.value })}
              />
              <p className="mt-1 text-[11px] text-[#717971]">
                Hiển thị trong quản lý đơn hàng. Tối đa 500 ký tự.
                {orderNote.length > 0 ? ` (${orderNote.length}/500)` : ''}
              </p>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Tổng tiền</label>
              <div className="text-3xl font-bold text-[#356647]">{formatMoney(total)} đ</div>
              {isZeroAmountSale ? (
                <p className="mt-1 text-xs font-medium text-[#356647]">
                  Đơn 0 đ sau chiết khấu — bấm thanh toán tiền mặt (không cần nhập tiền khách trả).
                </p>
              ) : null}
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
                  {canUseOrderDiscount && orderDiscountAmount > 0 ? (
                    <div className="flex justify-between text-[#356647]">
                      <span>
                        {usesFixedOrderDiscount ? 'CK đơn (VNĐ)' : `CK đơn (${orderDiscountPercent}%)`}
                      </span>
                      <span>-{formatMoney(orderDiscountAmount)} đ</span>
                    </div>
                  ) : null}
                  {couponDiscountAmount > 0 ? (
                    <div className="flex justify-between text-[#356647]">
                      <span>Mã {appliedPromotion?.promoCode || 'giảm giá'}</span>
                      <span>-{formatMoney(couponDiscountAmount)} đ</span>
                    </div>
                  ) : null}
                  {membershipDiscountAmount > 0 ? (
                    <div className="flex justify-between text-[#356647]">
                      <span>
                        CK hạng {selectedCustomer?.tierCode || 'VIP'} ({tierDiscountPercent}%)
                      </span>
                      <span>-{formatMoney(membershipDiscountAmount)} đ</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isTakeaway && paymentMethod === 'COD' ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-[#414942]">
                <p className="font-semibold text-orange-800">Thanh toán COD</p>
                <p className="mt-1 text-[#717971]">
                  Khách thanh toán khi nhận hàng. Đơn xuất hiện tại mục Đơn COD để nhân viên giao và xác nhận thu tiền.
                </p>
              </div>
            ) : null}

            {!isTakeaway && !isTransferPayment ? (
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
            ) : isTransferPayment ? (
              <div className="rounded-xl border border-[#356647]/20 bg-[#356647]/5 p-4 text-sm text-[#414942]">
                <p className="font-semibold text-[#356647]">Thanh toán chuyển khoản</p>
                <p className="mt-1 text-[#717971]">Bấm Thanh toán để hiển thị mã QR cho khách quét.</p>
              </div>
            ) : null}

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#717971]">Phương thức thanh toán</label>
              <div className="space-y-1.5">
                {paymentMethods.map((method) => (
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

          <div className="grid grid-cols-1 gap-2 border-t border-[#c1c9c0] p-3">
        
            <button
              type="button"
              disabled={!canPay}
              onClick={handlePayment}
              className="flex flex-col items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              <span className="text-[10px] opacity-70">F12</span>
              {isSubmitting
                ? 'Đang xử lý...'
                : isTakeaway
                  ? paymentMethod === 'TRANSFER'
                    ? 'Tạo đơn · QR'
                    : 'Tạo đơn COD'
                  : isTransferPayment
                    ? 'Thanh toán · QR'
                    : 'Thanh toán'}
            </button>
          </div>
        </section>
      </div>

      <footer className="shrink-0 border-t border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          {SALES_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setSalesMode(mode.id)
                setOpenDiscountSku(null)
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                salesMode === mode.id
                  ? 'bg-[#356647] text-white shadow-md shadow-[#356647]/25'
                  : 'border border-[#c1c9c0] bg-white text-[#414942] hover:bg-[#e4e3db]'
              }`}
            >
              <Icon className="text-[22px]" filled={salesMode === mode.id}>
                {mode.icon}
              </Icon>
              {mode.label}
            </button>
          ))}
        </div>
      </footer>

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
        initialPercent={orderDiscountPercent}
        initialFixedAmount={orderDiscountAmountFixed}
        maxFixedAmount={subtotalAfterItemDiscount}
        onClose={() => setOpenModal(null)}
        onConfirm={({ percent, fixedAmount, warning }) => {
          const result = normalizeOrderDiscountInput({
            percent,
            fixedAmount,
            subtotalAfterItemDiscount,
          })
          if (!result.ok) {
            showError(result.error)
            return
          }
          updateActiveSession({
            orderDiscountPercent: result.orderDiscountPercent,
            orderDiscountAmountFixed: result.orderDiscountAmountFixed,
          })
          if (warning || result.warning) {
            showError(warning || result.warning)
          }
          setOpenModal(null)
        }}
      />
      <CustomerDetailModal
        isOpen={openModal === 'customer-detail'}
        customer={selectedCustomer}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(tabCloseConfirm)}
        title="Xóa tab hóa đơn?"
        message={
          tabCloseConfirm
            ? `Bạn có chắc muốn đóng "${tabCloseConfirm.label}"? Giỏ hàng và thông tin khách trên tab này sẽ bị xóa.`
            : ''
        }
        confirmLabel="Xóa tab"
        cancelLabel="Hủy"
        onConfirm={handleConfirmCloseTab}
        onCancel={() => setTabCloseConfirm(null)}
      />
    </div>
  )
}

export default PosPage
