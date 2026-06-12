import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import AddCustomerModal from '../components/AddCustomerModal.jsx'
import CustomerDetailModal from '../components/CustomerDetailModal.jsx'
import OrderOfferModal from '../components/OrderOfferModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import SelectReturnOrderModal from '../components/SelectReturnOrderModal.jsx'
import PosCategoryFilterSidebar from '../components/PosCategoryFilterSidebar.jsx'
import PosPaymentSidebar from '../components/PosPaymentSidebar.jsx'
import {
  expandCategoryFilterIds,
  formatCategoryFilterSummary,
} from '../../products/utils/categoryTreeUtils.js'
import { printReceiptFromData, printReceiptSequence } from '../utils/printReceipt.js'
import { formatVietnamDateTimeMinute, vietnamNowLabel } from '../../../utils/vietnamDateTime.js'
import {
  applyCustomerDebtPayment,
  fetchCustomerOpenDebts,
} from '../../customers/services/customersApi.js'
import OverpaymentDebtModal from '../../customers/components/OverpaymentDebtModal.jsx'
import { clampDebtSettlement } from '../../customers/utils/debtAllocationEditor.js'
import { serializeCodDebtSettlement } from '../../customers/utils/codDebtSettlementUtils.js'
import { buildDebtReceiptFromPayment } from '../../customers/utils/debtPaymentUtils.js'
import {
  applyPromotionPreview,
  buildTakeawayOrderPayload,
  createPosOrderOffline,
  createPosOrderOnline,
  createTakeawayCodOrder,
  createTakeawayVietQrOrder,
  fetchApplicablePromotions,
  fetchPosCustomerContext,
  fetchPosCustomers,
  fetchPosProducts,
  resolvePosStoreId,
} from '../services/posApi.js'
import { loadPosSeller } from '../utils/posSeller.js'
import {
  normalizeOrderDiscountInput,
  validatePosDiscountsBeforePayment,
} from '../utils/posDiscountValidation.js'
import { formatCustomerOrderSnapshot, isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import { fetchPendingCatalogSync, syncCatalogToStore } from '../../products/services/catalogSyncApi.js'
import { fetchCategories } from '../../products/services/categoriesApi.js'
import ProductImage from '../../products/components/ProductImage.jsx'
import {
  computeCouponDiscount,
  formatPromotionDiscountText as formatPromotionDiscountLabel,
  formatPromotionScopeLabel,
} from '../utils/posPromotionUtils.js'

const SALES_MODES = [
  { id: 'counter', label: 'Bán trực tiếp', icon: 'storefront' },
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

const PRICE_FILTER_OPTIONS = [
  { id: '', label: 'Tất cả giá' },
  { id: 'asc', label: 'Giá thấp → cao' },
  { id: 'desc', label: 'Giá cao → thấp' },
  { id: 'under-50k', label: 'Dưới 50.000 đ' },
  { id: '50k-200k', label: '50.000 – 200.000 đ' },
  { id: 'over-200k', label: 'Trên 200.000 đ' },
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

function getPromotionApplyErrorMessage(error) {
  const messages = [
    error?.message,
    ...(Array.isArray(error?.apiErrors) ? error.apiErrors : []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const message = messages[0] || ''
  const normalized = messages
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (
    normalized.includes('don hang can toi thieu') ||
    normalized.includes('don hang chua dat gia tri toi thieu') ||
    normalized.includes('minimum order')
  ) {
    return 'Đơn hàng chưa đạt giá trị tối thiểu'
  }
  return message || 'Có lỗi xảy ra.'
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
    overpaymentAction: 'return_change',
    debtSettlement: null,
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
  const [availablePromotions, setAvailablePromotions] = useState([])
  const [isPromotionListLoading, setIsPromotionListLoading] = useState(false)
  const [applicablePromotionsSignature, setApplicablePromotionsSignature] = useState('')
  const [isPromotionDropdownOpen, setIsPromotionDropdownOpen] = useState(false)
  const [searchProducts, setSearchProducts] = useState([])
  const [posCategories, setPosCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [isCategoryFilterSidebarOpen, setIsCategoryFilterSidebarOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [catalogReloadKey, setCatalogReloadKey] = useState(0)
  const [isCatalogSyncing, setIsCatalogSyncing] = useState(false)
  const [pendingCatalogSync, setPendingCatalogSync] = useState(0)
  const [tabCloseConfirm, setTabCloseConfirm] = useState(null)
  const [savedShippingAddresses, setSavedShippingAddresses] = useState([])
  const [isLoadingShippingAddresses, setIsLoadingShippingAddresses] = useState(false)
  const [useCustomShippingAddress, setUseCustomShippingAddress] = useState(false)
  const [seller, setSeller] = useState({ name: 'Nhân viên POS', role: '—', display: 'Nhân viên POS · —' })
  const [isPaymentSidebarOpen, setIsPaymentSidebarOpen] = useState(false)
  const [customerOpenDebts, setCustomerOpenDebts] = useState([])
  const [isLoadingOpenDebts, setIsLoadingOpenDebts] = useState(false)
  const [overpaymentDebtModalOpen, setOverpaymentDebtModalOpen] = useState(false)
  const [debtModalMode, setDebtModalMode] = useState('configure')
  const discountPopoverRef = useRef(null)
  const priceFilterRef = useRef(null)
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false)
  const [priceFilter, setPriceFilter] = useState('')
  const promotionCartSignatureRef = useRef('')

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
    overpaymentAction = 'return_change',
    debtSettlement = null,
    shippingAddress = '',
    orderNote = '',
  } = session ?? createEmptySession(salesMode)

  const paymentMethod = sessionPaymentMethod ?? (isTakeaway ? 'COD' : 'CASH')
  const isTransferPayment = paymentMethod === 'TRANSFER'
  const isCodTakeaway = isTakeaway && paymentMethod === 'COD'
  const isTransferTakeaway = isTakeaway && isTransferPayment

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
  }, [catalogReloadKey])

  useEffect(() => {
    let mounted = true
    fetchPendingCatalogSync()
      .then((pending) => {
        if (mounted) setPendingCatalogSync(pending.total ?? 0)
      })
      .catch(() => {
        if (mounted) setPendingCatalogSync(0)
      })
    return () => {
      mounted = false
    }
  }, [catalogReloadKey])

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
  const customerCurrentDebt = Number(selectedCustomer?.currentDebt || 0)
  const change = Math.max(amountPaid - total, 0)
  const transferQrAmount = isTransferPayment ? (amountPaid > 0 ? amountPaid : total) : 0
  const transferOverpayToDebt =
    overpaymentAction === 'apply_to_debt' && isTransferPayment && change > 0 && customerCurrentDebt > 0
      ? Math.min(change, customerCurrentDebt)
      : 0
  const codExpectedAmount = isCodTakeaway ? (amountPaid > 0 ? amountPaid : total) : 0
  const codOverpayToDebt =
    overpaymentAction === 'apply_to_debt' && isCodTakeaway && change > 0 && customerCurrentDebt > 0
      ? Math.min(change, customerCurrentDebt)
      : 0
  // Tiền mặt: để trống = ghi nợ toàn bộ. CK: để trống = QR đủ tiền; nhập vượt đơn = QR đúng số nhập (trừ nợ).
  const recordedPaymentAmount = amountPaid >= total ? total : amountPaid
  const debtAmount = isTransferPayment
    ? transferQrAmount >= total
      ? 0
      : Math.max(total - transferQrAmount, 0)
    : Math.max(total - recordedPaymentAmount, 0)
  const debtReductionFromOverpay =
    overpaymentAction === 'apply_to_debt' && change > 0 && customerCurrentDebt > 0
      ? Math.min(change, customerCurrentDebt)
      : 0
  const displayChange = Math.max(change - debtReductionFromOverpay, 0)
  const isTransferQrFlow = isTransferPayment && !isTakeaway
  const isDebtSale = !isTransferPayment && amountPaid === 0 && total > 0
  const isPartialPayment = amountPaid > 0 && amountPaid < total
  const canApplyOverpayToDebt = change > 0 && customerCurrentDebt > 0
  useEffect(() => {
    if (!selectedCustomer?.customerId || customerCurrentDebt <= 0) {
      setCustomerOpenDebts([])
      return undefined
    }

    let cancelled = false
    setIsLoadingOpenDebts(true)
    fetchCustomerOpenDebts(selectedCustomer.customerId)
      .then((items) => {
        if (!cancelled) setCustomerOpenDebts(items)
      })
      .catch(() => {
        if (!cancelled) setCustomerOpenDebts([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOpenDebts(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.customerId, customerCurrentDebt])

  useEffect(() => {
    if (debtSettlement) {
      updateActiveSession({ debtSettlement: null, overpaymentAction: 'return_change' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset debt plan when payment inputs change
  }, [selectedCustomer?.customerId, change, amountPaidInput])

  useEffect(() => {
    let cancelled = false

    const timerId = setTimeout(async () => {
      setIsSearchLoading(true)
      try {
        const items = await fetchPosProducts({
          storeId: resolvePosStoreId(),
          search: searchValue.trim(),
          limit: searchValue.trim() ? 80 : 60,
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
  }, [searchValue, activeTabId, catalogReloadKey])

  async function handleRefreshCatalog() {
    setIsCatalogSyncing(true)
    try {
      const pending = await fetchPendingCatalogSync()
      setPendingCatalogSync(pending.total ?? 0)
      const result = await syncCatalogToStore()
      setCatalogReloadKey((value) => value + 1)
      const total = result.categoriesSynced + result.productsSynced + result.skusSynced
      setPendingCatalogSync(0)
      if (total > 0) {
        showSuccess(
          `Đã đồng bộ ${result.categoriesSynced} DM, ${result.productsSynced} SP, ${result.skusSynced} SKU từ kho.`,
        )
      } else if ((pending.total ?? 0) > 0) {
        showSuccess('Đã đồng bộ — danh sách POS đang tải lại.')
      } else {
        showSuccess('Catalog đã cập nhật — không có mục mới từ kho.')
      }
    } catch (error) {
      showError(error.message || 'Không đồng bộ được catalog. Thử đăng nhập lại.')
    } finally {
      setIsCatalogSyncing(false)
    }
  }

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
    if (!isPriceFilterOpen) return undefined

    function handlePointerDown(event) {
      if (priceFilterRef.current?.contains(event.target)) return
      setIsPriceFilterOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isPriceFilterOpen])

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
      .catch(() => { })

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

  const buildPromotionCartSignature = () =>
    JSON.stringify({
      items: cartItems.map((item) => ({
        skuId: item.productId,
        quantity: item.qty,
        unitPrice: item.price,
        lineDiscountType: item.lineDiscountType,
        lineDiscountValue: item.lineDiscountValue || 0,
      })),
      orderDiscountPercent: effectiveOrderDiscountPercent,
      orderDiscountAmountFixed: effectiveOrderDiscountAmountFixed,
      customerId: selectedCustomer?.customerId || null,
    })

  const getPromotionManualDiscount = () => Math.round(itemDiscountTotal + orderDiscountAmount)

  const buildPromotionPreviewItems = () =>
    cartItems.map((item) => ({
      skuId: item.productId,
      quantity: item.qty,
      unitPrice: item.price,
      subTotal: getLineGross(item),
    }))

  useEffect(() => {
    const currentSignature = buildPromotionCartSignature()
    if (!appliedPromotion) {
      promotionCartSignatureRef.current = currentSignature
      return
    }
    if (!promotionCartSignatureRef.current) {
      promotionCartSignatureRef.current = currentSignature
      return
    }
    if (promotionCartSignatureRef.current !== currentSignature) {
      promotionCartSignatureRef.current = currentSignature
      updateActiveSession({ appliedPromotion: null, promoCodeInput: '' })
      showError('Giỏ hàng hoặc chiết khấu đã thay đổi. Vui lòng áp dụng lại mã giảm giá.')
    }
  }, [
    appliedPromotion,
    cartItems,
    effectiveOrderDiscountAmountFixed,
    effectiveOrderDiscountPercent,
    selectedCustomer?.customerId,
  ])

  useEffect(() => {
    setAvailablePromotions([])
    setApplicablePromotionsSignature('')
  }, [
    cartItems,
    effectiveOrderDiscountAmountFixed,
    effectiveOrderDiscountPercent,
    selectedCustomer?.customerId,
  ])

  const applyPromotionToCurrentCart = async ({ promotion = null, code = '' } = {}) => {
    const promoCode = (code || promotion?.promoCode || '').trim()
    if (!promoCode) {
      showError('Vui lòng nhập mã giảm giá.')
      return
    }
    if (!cartItems.length) {
      showError('Vui lòng thêm sản phẩm trước khi áp dụng mã giảm giá.')
      return
    }

    const nextPromotion = await applyPromotionPreview({
      promotionId: promotion?.id ?? null,
      promotionCode: promoCode,
      customerId: selectedCustomer?.customerId || null,
      items: buildPromotionPreviewItems(),
      manualDiscount: getPromotionManualDiscount(),
    })
    updateActiveSession({ appliedPromotion: nextPromotion, promoCodeInput: nextPromotion.promoCode })
    promotionCartSignatureRef.current = buildPromotionCartSignature()
    setIsPromotionDropdownOpen(false)
    showSuccess(`Đã áp dụng mã ${nextPromotion.promoCode}.`)
  }

  const loadAvailablePromotions = async () => {
    if (!cartItems.length) {
      setAvailablePromotions([])
      setApplicablePromotionsSignature('')
      setIsPromotionDropdownOpen(false)
      return
    }

    const currentSignature = buildPromotionCartSignature()
    setIsPromotionDropdownOpen(true)
    if (applicablePromotionsSignature === currentSignature || isPromotionListLoading) return

    setIsPromotionListLoading(true)
    try {
      const items = await fetchApplicablePromotions({
        customerId: selectedCustomer?.customerId || null,
        items: buildPromotionPreviewItems(),
        manualDiscount: getPromotionManualDiscount(),
      })
      setAvailablePromotions(items)
      setApplicablePromotionsSignature(currentSignature)
    } catch (error) {
      setAvailablePromotions([])
      setApplicablePromotionsSignature('')
      showError(error.message)
    } finally {
      setIsPromotionListLoading(false)
    }
  }

  const handleSelectPromotion = async (promotion) => {
    setIsApplyingPromo(true)
    try {
      await applyPromotionToCurrentCart({ promotion })
    } catch (error) {
      showError(getPromotionApplyErrorMessage(error))
    } finally {
      setIsApplyingPromo(false)
    }
  }

  const handleApplyPromoCode = async () => {
    const code = promoCodeInput.trim()
    if (!code) {
      showError('Vui lòng nhập mã giảm giá.')
      return
    }
    setIsApplyingPromo(true)
    try {
      await applyPromotionToCurrentCart({ code })
    } catch (error) {
      showError(getPromotionApplyErrorMessage(error))
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

  const handleAmountPaidChange = (rawValue) => {
    const digits = String(rawValue).replace(/\D/g, '')
    updateActiveSession({
      amountPaidInput: digits ? formatMoney(Number(digits)) : '',
    })
  }

  const handleQuickAmount = (value) => {
    updateActiveSession({
      amountPaidInput: value > 0 ? formatMoney(value) : '',
    })
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
  const isZeroAmountSale = total === 0 && grossSubtotal > 0
  const canPayCash = hasCartItems && hasCustomerSelected
  const canPayTransfer = hasCartItems && hasCustomerSelected && total > 0
  const canPayTakeaway =
    hasCartItems && hasCustomerSelected && hasShippingAddress && (isTransferPayment ? total > 0 : true)
  const canPay = isTakeaway
    ? canPayTakeaway && !isSubmitting
    : (isTransferPayment ? canPayTransfer : canPayCash) && !isSubmitting
  const normalizedPromoSearch = promoCodeInput.trim().toUpperCase()
  const visibleAvailablePromotions = availablePromotions
    .filter((promotion) =>
      !normalizedPromoSearch ||
      promotion.promoCode.toUpperCase().includes(normalizedPromoSearch),
    )
    .slice(0, 8)

  const formatPromotionDiscountText = (promotion) =>
    formatPromotionDiscountLabel(promotion)

  const formatPromotionValidityText = (promotion) => {
    const from = promotion.validFromUtc ? formatVietnamDateTimeMinute(promotion.validFromUtc) : null
    const to = promotion.validToUtc ? formatVietnamDateTimeMinute(promotion.validToUtc) : null
    if (from && to) return `HSD ${from} đến ${to}`
    if (from) return `Từ ${from}`
    if (to) return `HSD đến ${to}`
    return ''
  }

  const appliedPromotionScopeText = (() => {
    if (!appliedPromotion) return ''
    if (String(appliedPromotion.scopeType || 'ORDER').toUpperCase() !== 'SKU') {
      return 'Áp dụng toàn đơn'
    }

    const skuIds = new Set((appliedPromotion.skuScopes ?? []).map((scope) => scope.skuId))
    const names = cartItems
      .filter((item) => skuIds.has(item.productId))
      .map((item) => item.name || item.productName || item.sku)
      .filter(Boolean)

    return names.length
      ? `Áp dụng cho: ${[...new Set(names)].join(', ')}`
      : 'Áp dụng cho SKU cụ thể'
  })()

  const buildOrderPayload = (method, amount) => {
    const storeId = resolvePosStoreId()
    const manualDiscount = Math.round(itemDiscountTotal + orderDiscountAmount)
    return {
      storeId,
      customerId: selectedCustomer.customerId,
      customerSnapshotName: formatCustomerOrderSnapshot(selectedCustomer),
      promotionId: appliedPromotion?.id ?? null,
      promotionCode: appliedPromotion?.promoCode ?? null,
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

  const buildReceiptData = ({
    orderCode,
    method,
    invoiceCode,
    orderTotal,
    changeAmount = displayChange,
  }) => {
    const receiptTotal = orderTotal ?? total
    const isRecordedPayment = method === 'CASH' || method === 'TRANSFER'
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
      amountPaid: isRecordedPayment ? recordedPaymentAmount : receiptTotal,
      customerPaid: isRecordedPayment ? amountPaid : receiptTotal,
      change: isRecordedPayment ? changeAmount : 0,
      debtAmount: isRecordedPayment ? debtAmount : 0,
      isDebtSale: method === 'CASH' && isDebtSale,
      isPartialCashPayment: isRecordedPayment && isPartialPayment,
    }
  }

  const applyOverpaymentToDebt = async (customerId, orderCode, orderId, amount, allocations = null) => {
    if (!customerId || amount <= 0) return null
    return applyCustomerDebtPayment(customerId, {
      amount,
      note: `Trừ từ tiền thừa đơn ${orderCode}`,
      sourceOrderId: orderId,
      allocations,
    })
  }

  const resolveDebtApplyAmount = (overrideSettlement) => {
    const settlement = overrideSettlement ?? debtSettlement
    if (!settlement) {
      return overpaymentAction === 'apply_to_debt' ? debtReductionFromOverpay : 0
    }
    return settlement.payDebtsEnabled ? Number(settlement.allocatedAmount || 0) : 0
  }

  const resolveChangeAfterDebt = (debtSettlement, debtApplyAmount) => {
    if (debtSettlement) {
      return Math.max(change - debtApplyAmount, 0)
    }
    return displayChange
  }

  const buildTransferDebtSettlement = (debtSettlement, orderId) => {
    const amount = resolveDebtApplyAmount(debtSettlement)
    if (amount <= 0 || !selectedCustomer?.customerId) return null
    return {
      customerId: selectedCustomer.customerId,
      orderId,
      amount,
      allocations: debtSettlement?.allocations ?? null,
      balanceBefore: customerCurrentDebt,
      customerName: selectedCustomer.fullName || '',
      customerCode: selectedCustomer.customerCode || '',
    }
  }

  const needsDebtSettlementOnPay =
    change > 0 && canApplyOverpayToDebt && overpaymentAction === 'apply_to_debt'

  const openDebtAllocationModal = (mode = 'configure') => {
    if (!canApplyOverpayToDebt) return
    setDebtModalMode(mode)
    setOverpaymentDebtModalOpen(true)
  }

  const handleOpenDebtAllocation = () => {
    updateActiveSession({ overpaymentAction: 'apply_to_debt' })
    openDebtAllocationModal('configure')
  }

  const handleOverpaymentActionChange = (action) => {
    updateActiveSession({
      overpaymentAction: action,
      ...(action === 'return_change' ? { debtSettlement: null } : {}),
    })
  }

  const finalizeRecordedPayment = async ({ method, createOrder, debtSettlement = null }) => {
    const debtApplyAmount = resolveDebtApplyAmount(debtSettlement)
    const changeAfterDebt = resolveChangeAfterDebt(debtSettlement, debtApplyAmount)
    const payload = buildOrderPayload(method, recordedPaymentAmount)
    const result = await createOrder(payload)

    let debtPayment = null
    if (debtApplyAmount > 0 && selectedCustomer?.customerId) {
      debtPayment = await applyOverpaymentToDebt(
        selectedCustomer.customerId,
        result.orderCode,
        result.orderId,
        debtApplyAmount,
        debtSettlement?.allocations ?? null,
      )
    }

    if (recordedPaymentAmount >= total) {
      const debtNote =
        debtApplyAmount > 0
          ? ` · In phiếu thu nợ ${formatMoney(debtApplyAmount)} đ`
          : changeAfterDebt > 0
            ? ` · Thừa ${formatMoney(changeAfterDebt)} đ`
            : ''
      showSuccess(
        result.invoiceCode
          ? total === 0
            ? `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}${debtNote}`
            : `Thanh toán thành công. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}${debtNote}`
          : total === 0
            ? `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode}${debtNote}`
            : `Thanh toán thành công. Đơn: ${result.orderCode}${debtNote}`,
      )
    } else if (isDebtSale) {
      showSuccess(`Ghi đơn ${result.orderCode} thành công. Dư nợ: ${formatMoney(debtAmount)} đ.`)
    } else {
      showSuccess(
        `Ghi đơn ${result.orderCode}. Đã thu ${formatMoney(recordedPaymentAmount)} đ, còn nợ ${formatMoney(debtAmount)} đ.`,
      )
    }

    const receipts = [
      buildReceiptData({
        orderCode: result.orderCode,
        method,
        invoiceCode: result.invoiceCode,
        changeAmount: changeAfterDebt,
      }),
    ]

    if (debtPayment && debtApplyAmount > 0) {
      receipts.push(
        buildDebtReceiptFromPayment({
          payment: debtPayment,
          customerName: selectedCustomer?.fullName,
          customerCode: selectedCustomer?.customerCode,
          paymentMethodLabel:
            method === 'TRANSFER' ? 'Chuyển khoản' : method === 'COD' ? 'COD' : 'Tiền mặt',
          balanceBefore: customerCurrentDebt,
          relatedOrderCode: result.orderCode,
          sellerName: seller.name,
          sellerRole: seller.role,
        }),
      )
    }

    resetCheckoutState()
    await printReceiptSequence(receipts)
  }

  const resetCheckoutState = () => {
    updateActiveSession(createEmptySession(salesMode))
    setOpenDiscountSku(null)
    setIsPaymentSidebarOpen(false)
  }

  const openPaymentSidebar = () => {
    if (!hasCartItems) {
      showError('Giỏ hàng trống.')
      return
    }
    setIsPaymentSidebarOpen(true)
  }

  const handleTakeawayPayment = async (debtSettlement = null) => {
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
      customerSnapshotName: formatCustomerOrderSnapshot(selectedCustomer),
      shippingAddress: address,
      note: orderNote,
      cartItems,
      manualDiscount,
      promotionId: appliedPromotion?.id ?? null,
      promotionCode: appliedPromotion?.promoCode ?? null,
    })

    if (isTransferPayment) {
      const result = await createTakeawayVietQrOrder(payload, { qrAmount: transferQrAmount })
      const transferDebtSettlement = buildTransferDebtSettlement(debtSettlement, result.orderId)

      showSuccess(
        transferDebtSettlement
          ? `Đã tạo đơn mang đi ${result.orderCode}. Quét QR ${formatMoney(transferQrAmount)} đ (gồm trừ nợ ${formatMoney(transferDebtSettlement.amount)} đ).`
          : `Đã tạo đơn mang đi ${result.orderCode}. Quét QR ${formatMoney(transferQrAmount)} đ để thanh toán.`,
      )
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
          total: result.qrAmount || transferQrAmount,
          qrPayload: result.qrPayload,
          qrImageUrl: result.qrImageUrl,
          transferContent: result.transferContent,
          transferAccountNumber: result.transferAccountNumber,
          paymentMode: result.paymentMode,
          qrExpiresAtUtc: result.qrExpiresAtUtc,
          customer: selectedCustomer?.fullName || '',
          paymentMethod: 'TRANSFER',
          receipt,
          debtSettlement: transferDebtSettlement,
        },
      })
      return
    }

    if (amountPaid > 0 && amountPaid < total) {
      showError('Số tiền khách trả phải bằng hoặc lớn hơn thành tiền.')
      return
    }

    const activeSettlement = debtSettlement ?? null
    const codDebtSettlementJson = serializeCodDebtSettlement(activeSettlement)
    const result = await createTakeawayCodOrder(payload, codExpectedAmount, { codDebtSettlementJson })
    const debtNote =
      activeSettlement?.payDebtsEnabled && Number(activeSettlement.allocatedAmount || 0) > 0
        ? ` · Dự kiến trừ nợ ${formatMoney(activeSettlement.allocatedAmount)} đ khi thu COD`
        : ''
    showSuccess(`Đã tạo đơn COD ${result.orderCode}. Theo dõi tại Quản lý đơn COD.${debtNote}`)
    const receipt = buildReceiptData({
      orderCode: result.orderCode,
      method: 'COD',
      orderTotal: result.totalAmount,
    })
    resetCheckoutState()
    printReceiptFromData(receipt)
  }

  const executePayment = async (debtSettlement = null) => {
    if (isTakeaway) {
      await handleTakeawayPayment(debtSettlement)
      return
    }

    if (isTransferPayment) {
      const payload = buildOrderPayload('TRANSFER', 0)
      const result = await createPosOrderOnline(payload, { qrAmount: transferQrAmount })
      const transferDebtSettlement = buildTransferDebtSettlement(debtSettlement, result.orderId)

      showSuccess(
        transferDebtSettlement
          ? `Đã tạo đơn ${result.orderCode}. Quét QR ${formatMoney(transferQrAmount)} đ (gồm trừ nợ ${formatMoney(transferDebtSettlement.amount)} đ).`
          : `Đã tạo đơn ${result.orderCode}. Quét mã QR ${formatMoney(transferQrAmount)} đ để thanh toán.`,
      )
      const receipt = buildReceiptData({ orderCode: result.orderCode, method: 'TRANSFER' })
      resetCheckoutState()
      navigate('/pos/payment/qr', {
        state: {
          orderId: result.orderId,
          orderCode: result.orderCode,
          orderLabel: result.orderCode,
          total: result.qrAmount || transferQrAmount,
          qrPayload: result.qrPayload,
          qrImageUrl: result.qrImageUrl,
          transferContent: result.transferContent,
          transferAccountNumber: result.transferAccountNumber,
          paymentMode: result.paymentMode,
          qrExpiresAtUtc: result.qrExpiresAtUtc,
          customer: selectedCustomer?.fullName || '',
          paymentMethod: 'TRANSFER',
          receipt,
          debtSettlement: transferDebtSettlement,
        },
      })
      return
    }

    await finalizeRecordedPayment({
      method: 'CASH',
      createOrder: createPosOrderOffline,
      debtSettlement,
    })
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
    } else {
      if (!validateDiscountsBeforePayment()) {
        return
      }

      if (!canPay) {
        if (isTransferPayment && isZeroAmountSale) {
          showError('Đơn 0 đ vui lòng chọn thanh toán tiền mặt.')
        }
        return
      }
    }

    if (needsDebtSettlementOnPay && !debtSettlement) {
      showError('Vui lòng bấm "Tính vào công nợ" để chọn hóa đơn cần trừ.')
      openDebtAllocationModal('configure')
      return
    }

    setIsSubmitting(true)
    try {
      await executePayment(debtSettlement)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOverpaymentDebtConfirm = async (result) => {
    setOverpaymentDebtModalOpen(false)
    if (debtModalMode === 'configure') {
      updateActiveSession({ overpaymentAction: 'apply_to_debt', debtSettlement: result })
      return
    }

    setIsSubmitting(true)
    try {
      await executePayment(result)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOverpaymentDebtSkip = async () => {
    setOverpaymentDebtModalOpen(false)
    if (debtModalMode === 'configure') {
      handleOverpaymentActionChange('return_change')
      return
    }

    setIsSubmitting(true)
    try {
      await executePayment({
        payDebtsEnabled: false,
        allocations: [],
        allocatedAmount: 0,
        creditToCustomer: change,
      })
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSearchQuery = searchValue.trim().length > 0

  const filteredSearchProducts = useMemo(() => {
    let items = searchProducts
    if (selectedCategoryIds.length > 0) {
      const allowedCategoryIds = expandCategoryFilterIds(selectedCategoryIds, posCategories)
      items = items.filter((item) => allowedCategoryIds.has(Number(item.categoryId)))
    }
    if (priceFilter === 'under-50k') {
      items = items.filter((item) => Number(item.price) < 50000)
    } else if (priceFilter === '50k-200k') {
      items = items.filter((item) => {
        const price = Number(item.price)
        return price >= 50000 && price <= 200000
      })
    } else if (priceFilter === 'over-200k') {
      items = items.filter((item) => Number(item.price) > 200000)
    }
    if (priceFilter === 'asc' || priceFilter === 'desc') {
      items = [...items].sort((a, b) => {
        const diff = Number(a.price) - Number(b.price)
        return priceFilter === 'asc' ? diff : -diff
      })
    }
    return items
  }, [searchProducts, selectedCategoryIds, posCategories, priceFilter])

  const selectedCategorySummary = useMemo(
    () => formatCategoryFilterSummary(selectedCategoryIds, posCategories),
    [selectedCategoryIds, posCategories],
  )

  const selectedPriceFilterLabel = useMemo(
    () => PRICE_FILTER_OPTIONS.find((option) => option.id === priceFilter)?.label ?? null,
    [priceFilter],
  )

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
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:rounded-[28px]">
      <header className="border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="relative w-[min(720px,82%)] shrink-0">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">search</Icon>
            <input
              className="w-full rounded-full border border-[#c1c9c0] bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
              placeholder="Tìm SP, SKU, barcode..."
              type="text"
              value={searchValue}
              onChange={(event) => updateActiveSession({ searchValue: event.target.value })}
            />
            <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">barcode_scanner</Icon>
          </div>

          <div className="flex shrink-0 items-center gap-1">
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
                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors ${activeTabId === tab.id ? 'bg-[#356647] text-white shadow-sm' : 'bg-[#eae8e0] text-[#414942] hover:bg-[#e4e3db]'
                  }`}
              >
                <span>{tab.label}</span>
                {tabItemCount > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTabId === tab.id ? 'bg-white/20 text-white' : 'bg-[#356647]/15 text-[#356647]'
                      }`}
                  >
                    {tabItemCount}
                  </span>
                ) : null}
                {tabHasCustomer ? (
                  <span
                    className={`material-symbols-outlined text-[14px] ${activeTabId === tab.id ? 'text-white/90' : 'text-[#356647]'
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        {/* Left: cart */}
        <section className="order-1 flex min-h-[42vh] w-full min-w-0 flex-col border-t border-[#c1c9c0] bg-[#f6f4ec] xl:min-h-0 xl:min-w-[min(100%,300px)] xl:max-w-[min(100%,48%)] xl:flex-[1_1_360px] xl:border-r xl:border-t-0 xl:shadow-[4px_0_20px_rgba(0,0,0,0.04)]">
          <div className="flex min-h-0 flex-1 flex-col bg-white">
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
                  <p className="mt-1 text-xs text-[#717971]">Chọn sản phẩm bên phải để thêm.</p>
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
                              className={`ml-1 text-[11px] sm:text-xs ${Number(item.stockQuantity) <= 0 ? 'font-semibold text-[#7e5700]' : ''
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
                            className={`whitespace-nowrap rounded-lg px-1.5 py-1 text-right text-sm font-bold tabular-nums transition-colors sm:text-base ${isDiscountOpen
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
                                    className={`px-3 py-2 text-xs font-bold ${isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
                                      }`}
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateLineDiscountType(item.sku, 'amount')}
                                    className={`px-3 py-2 text-xs font-bold ${!isPercent ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'
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

            <div className="shrink-0 border-t border-[#c1c9c0]/50 bg-white px-3 py-2.5">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#717971]" htmlFor="cart-order-note">
                Ghi chú đơn hàng
              </label>
              <textarea
                id="cart-order-note"
                rows={2}
                maxLength={500}
                placeholder="VD: Gói quà, giao giờ hành chính..."
                className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-3 py-2 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                value={orderNote}
                onChange={(event) => updateActiveSession({ orderNote: event.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Right: customer + product catalog */}
        <section className="order-2 flex min-h-[38vh] min-w-0 flex-1 flex-col bg-white text-base xl:min-h-0">
          <div className="relative z-30 shrink-0 overflow-visible border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-3">
            <div className="flex items-start gap-2">
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
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-3 py-2 text-left shadow-sm"
                >
                  <Icon className="shrink-0 text-[20px] text-[#356647]">person</Icon>
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
                <div className="relative min-w-0 flex-1">
                  <div className="relative min-w-0">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">person</Icon>
                    <input
                      className="w-full rounded-full border border-[#c1c9c0] bg-white py-2.5 pl-9 pr-11 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                      placeholder="Tìm tên, SĐT, mã KH..."
                      value={customerSearchValue}
                      onChange={(event) => updateActiveSession({ customerSearchValue: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setOpenModal('customer')}
                      className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#356647] text-white hover:bg-[#4e7f5e]"
                      aria-label="Thêm khách hàng"
                      title="Thêm khách hàng"
                    >
                      <Icon className="text-[18px]">add</Icon>
                    </button>
                  </div>
                  {!selectedCustomer && isCustomerSearchLoading ? (
                    <p className="mt-1.5 text-xs text-[#717971]">Đang tìm khách hàng...</p>
                  ) : null}
                  {showCustomerDropdown ? (
                    <div className="custom-scrollbar absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
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
                    <p className="mt-1.5 text-xs text-[#717971]">Không tìm thấy khách hàng.</p>
                  ) : null}
                </div>
              )}

              <div ref={priceFilterRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPriceFilterOpen((open) => !open)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                    priceFilter
                      ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                      : 'border-[#c1c9c0] bg-white text-[#717971] hover:border-[#356647]/40 hover:text-[#356647]'
                  }`}
                  title={selectedPriceFilterLabel ? `Giá: ${selectedPriceFilterLabel}` : 'Lọc / sắp xếp theo giá'}
                  aria-label="Lọc theo giá"
                >
                  <Icon className="text-[22px]">sell</Icon>
                  {priceFilter ? (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#356647] ring-2 ring-[#f6f4ec]" />
                  ) : null}
                </button>
                {isPriceFilterOpen ? (
                  <div className="custom-scrollbar absolute right-0 top-full z-50 mt-1 w-56 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white p-2 shadow-2xl">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#717971]">Giá</p>
                    {PRICE_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.id || 'all'}
                        type="button"
                        onClick={() => {
                          setPriceFilter(option.id)
                          setIsPriceFilterOpen(false)
                        }}
                        className={`mb-0.5 flex w-full rounded-lg px-3 py-2 text-left text-sm font-semibold last:mb-0 ${
                          priceFilter === option.id
                            ? 'bg-[#356647] text-white'
                            : 'text-[#414942] hover:bg-[#f6f4ec]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {posCategories.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryFilterSidebarOpen(true)
                    setIsPriceFilterOpen(false)
                  }}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selectedCategoryIds.length > 0
                      ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                      : 'border-[#c1c9c0] bg-white text-[#717971] hover:border-[#356647]/40 hover:text-[#356647]'
                  }`}
                  title={selectedCategorySummary ? `Lọc: ${selectedCategorySummary}` : 'Lọc theo nhóm hàng'}
                  aria-label="Lọc theo nhóm hàng"
                >
                  <Icon className="text-[22px]">filter_list</Icon>
                  {selectedCategoryIds.length > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#356647] ring-2 ring-[#f6f4ec]" />
                  ) : null}
                </button>
              ) : null}
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
                  {selectedCategorySummary ? (
                    <span className="ml-1 font-normal normal-case text-[#356647]">· {selectedCategorySummary}</span>
                  ) : null}
                  {selectedPriceFilterLabel && priceFilter ? (
                    <span className="ml-1 font-normal normal-case text-[#356647]">· {selectedPriceFilterLabel}</span>
                  ) : null}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshCatalog}
                    disabled={isSearchLoading || isCatalogSyncing}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#356647] hover:bg-[#f0eee6] disabled:opacity-50"
                    title="Tải DM/SP/SKU mới từ kho sang cửa hàng"
                  >
                    <Icon className={`text-[16px] ${isCatalogSyncing ? 'animate-spin' : ''}`}>sync</Icon>
                    {isCatalogSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
                    {pendingCatalogSync > 0 && !isCatalogSyncing ? (
                      <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">
                        {pendingCatalogSync}
                      </span>
                    ) : null}
                  </button>
                  <span className="text-xs text-[#717971]">{filteredSearchProducts.length} SP</span>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-3">
                {isSearchLoading ? (
                  <p className="px-1 py-3 text-sm text-[#717971]">Đang tải sản phẩm...</p>
                ) : filteredSearchProducts.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-[#717971]">
                    {hasSearchQuery || selectedCategoryIds.length > 0 || priceFilter
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

          <div className="shrink-0 border-t border-[#c1c9c0] bg-[#f6f4ec] p-4">
            <button
              type="button"
              disabled={!hasCartItems}
              onClick={openPaymentSidebar}
              className="flex w-full flex-col items-center justify-center rounded-xl bg-[#356647] py-3.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              <span className="text-[10px] opacity-70">F12</span>
              Thanh toán
            </button>
          </div>
        </section>

      </div>

      <PosPaymentSidebar
        isOpen={isPaymentSidebarOpen}
        onClose={() => {
          setIsPaymentSidebarOpen(false)
          setIsPromotionDropdownOpen(false)
        }}
        formatMoney={formatMoney}
        total={total}
        grossSubtotal={grossSubtotal}
        itemDiscountTotal={itemDiscountTotal}
        orderDiscountAmount={orderDiscountAmount}
        orderDiscountPercent={orderDiscountPercent}
        couponDiscountAmount={couponDiscountAmount}
        membershipDiscountAmount={membershipDiscountAmount}
        appliedPromotion={appliedPromotion}
        selectedCustomer={selectedCustomer}
        tierDiscountPercent={tierDiscountPercent}
        canUseOrderDiscount={canUseOrderDiscount}
        usesFixedOrderDiscount={usesFixedOrderDiscount}
        isZeroAmountSale={isZeroAmountSale}
        hasCartItems={hasCartItems}
        isTakeaway={isTakeaway}
        paymentMethod={paymentMethod}
        paymentMethods={paymentMethods}
        onPaymentMethodChange={(id) => updateActiveSession({ paymentMethod: id })}
        isTransferPayment={isTransferPayment}
        isCodTakeaway={isCodTakeaway}
        isTransferTakeaway={isTransferTakeaway}
        customerCurrentDebt={customerCurrentDebt}
        amountPaidInput={amountPaidInput}
        onAmountPaidChange={handleAmountPaidChange}
        transferQrAmount={transferQrAmount}
        amountPaid={amountPaid}
        debtAmount={debtAmount}
        change={change}
        displayChange={displayChange}
        canApplyOverpayToDebt={canApplyOverpayToDebt}
        overpaymentAction={overpaymentAction}
        onOverpaymentActionChange={handleOverpaymentActionChange}
        onOpenDebtAllocation={handleOpenDebtAllocation}
        confirmedDebtAllocationAmount={
          debtSettlement?.payDebtsEnabled ? Number(debtSettlement.allocatedAmount || 0) : 0
        }
        isDebtSale={isDebtSale}
        isPartialPayment={isPartialPayment}
        isTransferQrFlow={isTransferQrFlow}
        onQuickAmount={handleQuickAmount}
        onConfirm={handlePayment}
        isSubmitting={isSubmitting}
        canPay={canPay}
        onOpenCustomerDetail={() => setOpenModal('customer-detail')}
        onClearCustomer={() =>
          updateActiveSession({
            selectedCustomer: null,
            customerSearchValue: '',
            orderDiscountPercent: 0,
            orderDiscountAmountFixed: 0,
          })
        }
        shippingAddress={shippingAddress}
        onShippingAddressChange={(value) => updateActiveSession({ shippingAddress: value })}
        savedShippingAddresses={savedShippingAddresses}
        useCustomShippingAddress={useCustomShippingAddress}
        onSavedShippingAddressChange={handleSavedShippingAddressChange}
        isLoadingShippingAddresses={isLoadingShippingAddresses}
        hasShippingAddress={hasShippingAddress}
        orderDiscountPercentInput={orderDiscountPercent}
        onOrderDiscountPercentChange={updateOrderDiscountPercent}
        onOpenOfferModal={() => setOpenModal('offer')}
        promoCodeInput={promoCodeInput}
        onPromoCodeChange={(value) => updateActiveSession({ promoCodeInput: value })}
        onApplyPromoCode={handleApplyPromoCode}
        onClearPromoCode={handleClearPromoCode}
        isApplyingPromo={isApplyingPromo}
        visibleAvailablePromotions={visibleAvailablePromotions}
        isPromotionDropdownOpen={isPromotionDropdownOpen}
        isPromotionListLoading={isPromotionListLoading}
        onLoadAvailablePromotions={loadAvailablePromotions}
        onSelectPromotion={handleSelectPromotion}
        onClosePromotionDropdown={() => setIsPromotionDropdownOpen(false)}
        formatPromotionDiscountText={formatPromotionDiscountText}
        formatPromotionValidityText={formatPromotionValidityText}
        formatPromotionScopeLabel={formatPromotionScopeLabel}
        appliedPromotionScopeText={appliedPromotionScopeText}
      />

      <footer className="shrink-0 border-t border-[#d8d6ce] bg-white px-4">
        <div className="flex items-end gap-8">
          {SALES_MODES.map((mode) => {
            const isActive = salesMode === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setSalesMode(mode.id)
                  setOpenDiscountSku(null)
                  setIsPaymentSidebarOpen(false)
                }}
                className={`relative flex items-center gap-2 px-1 pb-3 pt-3.5 text-sm font-semibold transition-colors ${isActive ? 'text-[#356647]' : 'text-[#5c635c] hover:text-[#1b1c17]'
                  }`}
              >
                <Icon className="text-[22px]" filled={isActive}>
                  {mode.icon}
                </Icon>
                <span>{mode.label}</span>
                {isActive ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-[#356647]"
                    aria-hidden
                  />
                ) : null}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setOpenModal('return-order')}
          className="mb-2 inline-flex items-center gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-4 py-2 text-sm font-semibold text-[#356647] transition hover:bg-[#356647]/10"
        >
          <Icon className="text-[20px]">assignment_return</Icon>
          Trả hàng
        </button>
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
        onCustomerUpdated={(updated) => {
          updateActiveSession({ selectedCustomer: updated })
        }}
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
      <OverpaymentDebtModal
        isOpen={overpaymentDebtModalOpen}
        excessAmount={change}
        customerCurrentDebt={customerCurrentDebt}
        openDebts={customerOpenDebts}
        isLoading={isLoadingOpenDebts}
        formatMoney={formatMoney}
        initialSettlement={debtSettlement}
        onClose={() => setOverpaymentDebtModalOpen(false)}
        onSkip={handleOverpaymentDebtSkip}
        onConfirm={handleOverpaymentDebtConfirm}
      />
      <SelectReturnOrderModal
        isOpen={openModal === 'return-order'}
        onClose={() => setOpenModal(null)}
        onSelectOrder={(order) => {
          setOpenModal(null)
          navigate(`/pos/returns/${order.id}`)
        }}
        onQuickReturn={() => {
          setOpenModal(null)
          showError('Trả nhanh (không chọn hóa đơn) sẽ được bổ sung sau.')
        }}
      />
      <PosCategoryFilterSidebar
        isOpen={isCategoryFilterSidebarOpen}
        categories={posCategories}
        selectedIds={selectedCategoryIds}
        onClose={() => setIsCategoryFilterSidebarOpen(false)}
        onSkip={() => setIsCategoryFilterSidebarOpen(false)}
        onConfirm={(ids) => {
          setSelectedCategoryIds(ids)
          setIsCategoryFilterSidebarOpen(false)
        }}
      />
    </div>
  )
}

export default PosPage
