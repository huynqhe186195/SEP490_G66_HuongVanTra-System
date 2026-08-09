import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { showError, showInfo, showSuccess } from "../../../app/toast.js";
import AddCustomerModal from "../components/AddCustomerModal.jsx";
import AddCustomerAddressModal from "../components/AddCustomerAddressModal.jsx";
import CustomerDetailModal from "../components/CustomerDetailModal.jsx";
import OrderOfferModal from "../components/OrderOfferModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import PosPaymentSidebar from "../components/PosPaymentSidebar.jsx";
import PosPaymentConfirmModal from "../components/PosPaymentConfirmModal.jsx";
import BackorderConfirmModal from "../components/BackorderConfirmModal.jsx";
import EndOfDayReportModal from "../components/EndOfDayReportModal.jsx";
import SelectReturnOrderModal from "../components/SelectReturnOrderModal.jsx";
import PosCategoryFilterSidebar from "../components/PosCategoryFilterSidebar.jsx";
import CustomScrollArea from "../../../components/shared/CustomScrollArea.jsx";
import {
  expandCategoryFilterIds,
  formatCategoryFilterSummary,
} from '../../products/utils/categoryTreeUtils.js'
import { printReceiptFromData, printReceiptSequence } from '../utils/printReceipt.js'
import { formatVietnamDate, formatVietnamDateTimeMinute, vietnamNowLabel } from '../../../utils/vietnamDateTime.js'
import { createCustomerForOrder, fetchCustomerByPhone, fetchCustomerOpenDebts } from '../../customers/services/customersApi.js'
import { isUsableShippingAddress } from '../../customers/utils/shippingAddress.js'
import OverpaymentDebtModal from '../../customers/components/OverpaymentDebtModal.jsx'
import {
  clampDebtSettlement,
  resolveMaxDebtPayable,
} from '../../customers/utils/debtAllocationEditor.js'
import { buildCodMetaJson, serializeCodDebtSettlement } from '../../customers/utils/codDebtSettlementUtils.js'
import {
  applyPromotionPreview,
  buildTakeawayOrderPayload,
  createPosOrderOffline,
  createPosOrderOnline,
  createTakeawayCodOrder,
  createTakeawayCashOrder,
  createTakeawayVietQrOrder,
  fetchApplicablePromotions,
  fetchPosCustomerContext,
  fetchPosCustomers,
  fetchPosOrderPaymentStatus,
  fetchPosProducts,
  resolvePosStoreId,
} from '../services/posApi.js'
import { loadPosSeller } from '../utils/posSeller.js'
import {
  normalizeOrderDiscountInput,
  validatePosDiscountsBeforePayment,
  validateZeroTotalCheckout,
} from '../utils/posDiscountValidation.js'
import { formatCustomerOrderSnapshot, isCorporateCustomerType, isVipCustomerType } from '../../customers/utils/customerDisplay.js'
import { fetchPendingCatalogSync, syncCatalogToStore } from '../../products/services/catalogSyncApi.js'
import { fetchCategories } from '../../products/services/categoriesApi.js'
import ProductImage from '../../products/components/ProductImage.jsx'
import {
  computeCouponDiscount,
  formatPromotionDiscountText as formatPromotionDiscountLabel,
  formatPromotionScopeLabel,
} from '../utils/posPromotionUtils.js'
import ResizableSplitPane from '../../../components/shared/ResizableSplitPane.jsx'
import LoadingIndicator from '../../../components/shared/LoadingIndicator.jsx'
import { useNetworkStatus } from '../../../hooks/useNetworkStatus.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { canCreateCustomer, canUsePosCodMode, canUsePosCounterMode, canViewAllOrders } from '../../auth/utils/permissions.js'
import CustomBundlePanel from '../components/CustomBundlePanel.jsx'
import {
  getPosBaseUnitLabel,
  normalizePosBaseQuantity,
} from '../utils/posQuantity.js'
import {
  getCustomerSearchDisplayState,
  isCustomerSearchAbort,
} from '../utils/posCustomerSearch.js'
import { createCheckoutAttemptManager } from '../../orders/utils/checkoutAttempt.js'
import {
  clampPosSalesMode,
  loadPersistedPosWorkspace,
  persistPosWorkspace,
} from '../utils/posWorkspaceStorage.js'
import PosCashSessionBar, { assertCashSessionOpenForPayment } from '../components/PosCashSessionBar.jsx'
import PosShiftDutyGate from '../components/PosShiftDutyGate.jsx'
import {
  isOpenCashSessionReady,
  loadOpenCashSession,
  recordCashSale,
  refreshCashSession,
  subscribeCashSession,
} from '../utils/posCashSessionStore.js'

const ALL_SALES_MODES = [
    { id: "counter", label: "Bán trực tiếp", icon: "storefront" },
    { id: "takeaway", label: "Bán COD", icon: "local_shipping" },
];

const COUNTER_PAYMENT_METHODS = [
    { id: "CASH", label: "Tiền mặt", icon: "payments" },
    { id: "TRANSFER", label: "Chuyển khoản", icon: "account_balance" },
];

const TAKEAWAY_PAYMENT_METHODS = [
    { id: "COD", label: "COD — thu khi giao", icon: "local_shipping" },
    { id: "TRANSFER", label: "Chuyển khoản / VietQR", icon: "account_balance" },
    { id: "CASH", label: "Tiền mặt / ghi nợ", icon: "payments" },
];

const CUSTOMER_SEARCH_TYPES = [
    { id: "", label: "Tất cả loại KH" },
    { id: "GENERAL", label: "Phổ thông" },
    { id: "VIP", label: "Đối ngoại (VIP)" },
];

const CORPORATE_AT_POS_MESSAGE = "Khách doanh nghiệp phải lập đơn theo hợp đồng tại mục «Bán theo hợp đồng», không bán tại quầy POS.";

const PRICE_FILTER_OPTIONS = [
    { id: "", label: "Tất cả giá" },
    { id: "asc", label: "Giá thấp → cao" },
    { id: "desc", label: "Giá cao → thấp" },
    { id: "under-50k", label: "Dưới 50.000 đ" },
    { id: "50k-200k", label: "50.000 – 200.000 đ" },
    { id: "over-200k", label: "Trên 200.000 đ" },
];

const POS_PRODUCT_PAGE_SIZE = 18;

function createWorkspace(mode = "counter") {
    const empty = () => createEmptySession(mode);
    if (mode === "takeaway") {
        return {
            tabs: [{ id: 1, label: "Khách lẻ" }],
            activeTabId: 1,
            sessions: { 1: empty() },
        };
    }
    return {
        tabs: [{ id: 1, label: "Khách lẻ" }],
        activeTabId: 1,
        sessions: { 1: empty() },
    };
}

function Icon({ children, className = "", filled = false }) {
    return (
        <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
            {children}
        </span>
    );
}

function getLineGross(item) {
    if (item.isGift) return 0;
    return item.qty * item.price;
}

function getLineDiscount(item) {
    const gross = getLineGross(item);
    const value = item.lineDiscountValue || 0;
    if (item.lineDiscountType === "amount") {
        return Math.min(gross, value);
    }
    const percent = Math.min(100, Math.max(0, value));
    return Math.min(gross, Math.round((gross * percent) / 100));
}

function getLineTotal(item) {
    return Math.max(getLineGross(item) - getLineDiscount(item), 0);
}

/** Chuẩn hóa CK dòng — không vượt thành tiền dòng. */
function clampLineDiscountItem(item) {
    const gross = getLineGross(item);
    const value = item.lineDiscountValue || 0;
    if (!value) {
        return item;
    }

    if (item.lineDiscountType === "amount") {
        const capped = Math.min(Math.max(0, value), gross);
        return capped === value ? item : { ...item, lineDiscountValue: capped };
    }

    const cappedPercent = Math.min(100, Math.max(0, value));
    return cappedPercent === value ? item : { ...item, lineDiscountValue: cappedPercent };
}

function clampCartLineDiscounts(cartItems) {
    return (Array.isArray(cartItems) ? cartItems : []).map(clampLineDiscountItem);
}

function getPromotionApplyErrorMessage(error) {
    const messages = [error?.message, ...(Array.isArray(error?.apiErrors) ? error.apiErrors : [])].map((value) => String(value || "").trim()).filter(Boolean);
    const message = messages[0] || "";
    const normalized = messages
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (normalized.includes("don hang can toi thieu") || normalized.includes("don hang chua dat gia tri toi thieu") || normalized.includes("minimum order")) {
        return "Đơn hàng chưa đạt giá trị tối thiểu";
    }
    return message || "Có lỗi xảy ra.";
}

function computePosTotals(cartItems, orderDiscountPercent, orderDiscountAmountFixed, tierDiscountPercent, appliedPromotion = null, customBundles = []) {
    const items = Array.isArray(cartItems) ? cartItems : [];
    const bundles = Array.isArray(customBundles) ? customBundles : [];
    const bundlesTotal = bundles.reduce(
        (sum, bundle) => sum + (bundle.ingredients ?? []).reduce((s, ing) => s + (Number(ing.subTotal) || Number(ing.unitPrice) * Number(ing.quantity) || 0), 0),
        0,
    );
    const grossSubtotal = items.reduce((sum, item) => sum + getLineGross(item), 0) + bundlesTotal;
    const itemDiscountTotal = items.reduce((sum, item) => sum + getLineDiscount(item), 0);
    const subtotalAfterItemDiscount = items.reduce((sum, item) => sum + getLineTotal(item), 0) + bundlesTotal;
    const fixedOrderDiscount = Math.max(0, Math.round(Number(orderDiscountAmountFixed) || 0));
    const orderDiscountAmount =
        fixedOrderDiscount > 0 ? Math.min(fixedOrderDiscount, subtotalAfterItemDiscount) : Math.round((subtotalAfterItemDiscount * orderDiscountPercent) / 100);
    const totalBeforeCoupon = Math.max(subtotalAfterItemDiscount - orderDiscountAmount, 0);
    const couponDiscountAmount = computeCouponDiscount(totalBeforeCoupon, appliedPromotion);
    const totalBeforeTier = Math.max(totalBeforeCoupon - couponDiscountAmount, 0);
    const membershipDiscountAmount = tierDiscountPercent > 0 ? Math.round((totalBeforeTier * tierDiscountPercent) / 100) : 0;
    const total = Math.max(totalBeforeTier - membershipDiscountAmount, 0);
    const totalDiscount = itemDiscountTotal + orderDiscountAmount + couponDiscountAmount + membershipDiscountAmount;

    return {
        grossSubtotal,
        itemDiscountTotal,
        subtotalAfterItemDiscount,
        orderDiscountAmount,
        couponDiscountAmount,
        membershipDiscountAmount,
        total,
        totalDiscount,
    };
}

function createEmptySession(mode = "counter") {
    return {
        searchValue: "",
        cartItems: [],
        customBundles: [],
        orderDiscountPercent: 0,
        orderDiscountAmountFixed: 0,
        promoCodeInput: "",
        appliedPromotion: null,
        selectedCustomer: null,
        customerSearchValue: "",
        customerSearchType: "",
        paymentMethod: mode === "takeaway" ? "COD" : "CASH",
        amountPaidInput: "",
        overpaymentAction: "return_change",
        debtSettlement: null,
        shippingAddress: "",
        orderNote: "",
    };
}

function PosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const authSession = useAuthSession()
  const authUserId = authSession?.userId ? String(authSession.userId) : null
  const canSyncCatalog = canUsePosCounterMode(authSession)
  const allowedSalesModes = useMemo(() => {
    const allowCounter = canUsePosCounterMode(authSession)
    const allowCod = canUsePosCodMode(authSession)
    return ALL_SALES_MODES.filter((mode) => {
      if (mode.id === 'counter') return allowCounter
      if (mode.id === 'takeaway') return allowCod
      return false
    })
  }, [authSession])
  const allowedSalesModeIds = useMemo(
    () => allowedSalesModes.map((mode) => mode.id),
    [allowedSalesModes],
  )
  const [salesMode, setSalesMode] = useState(() => {
    const session = loadAuthSession()
    if (canUsePosCodMode(session) && !canUsePosCounterMode(session)) return 'takeaway'
    if (canUsePosCounterMode(session)) return 'counter'
    if (canUsePosCodMode(session)) return 'takeaway'
    return 'counter'
  })
  const [workspaceByMode, setWorkspaceByMode] = useState({
    counter: createWorkspace('counter'),
    takeaway: createWorkspace('takeaway'),
  })
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false)
  const [isRestoredCatalogValidating, setIsRestoredCatalogValidating] = useState(false)
  const [restoredOrderIds, setRestoredOrderIds] = useState([])

  useEffect(() => {
    if (allowedSalesModeIds.length === 0) return
    setSalesMode((prev) => clampPosSalesMode(prev, allowedSalesModeIds))
  }, [allowedSalesModeIds])

  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [isCustomerSearchLoading, setIsCustomerSearchLoading] = useState(false)
  const [customerSearchError, setCustomerSearchError] = useState('')
  const [openModal, setOpenModal] = useState(null)
  const [openDiscountSku, setOpenDiscountSku] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cashSessionOpen, setCashSessionOpen] = useState(() => isOpenCashSessionReady())
  const [shelfDayStatus, setShelfDayStatus] = useState({ dayStartDone: false, dayEndDone: false })
  const [dayEndRequested, setDayEndRequested] = useState(false)
  const [shelfOnDuty, setShelfOnDuty] = useState(null)

  useEffect(() => {
    refreshCashSession().then(() => setCashSessionOpen(isOpenCashSessionReady()))
    return subscribeCashSession(() => setCashSessionOpen(isOpenCashSessionReady()))
  }, [])

  // Đổi ca on-duty (sáng → tối) → kiểm tra lại quỹ có khớp ca mới không
  useEffect(() => {
    if (!shelfOnDuty?.slotId) return
    refreshCashSession().then(() => setCashSessionOpen(isOpenCashSessionReady()))
  }, [shelfOnDuty?.slotId])
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
  // Each entry: { address, label }
  const [isLoadingShippingAddresses, setIsLoadingShippingAddresses] = useState(false)
  const [useCustomShippingAddress, setUseCustomShippingAddress] = useState(false)
  const [seller, setSeller] = useState({ name: 'Nhân viên POS', role: '—', display: 'Nhân viên POS · —' })
  const [isPaymentSidebarOpen, setIsPaymentSidebarOpen] = useState(false)
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false)
  const [backorderPrompt, setBackorderPrompt] = useState(null)
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false)
  const [customerOpenDebts, setCustomerOpenDebts] = useState([])
  const [isLoadingOpenDebts, setIsLoadingOpenDebts] = useState(false)
  const [overpaymentDebtModalOpen, setOverpaymentDebtModalOpen] = useState(false)
  const [debtModalMode, setDebtModalMode] = useState('configure')
  const discountPopoverRef = useRef(null)
  const priceFilterRef = useRef(null)
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false)
  const [priceFilter, setPriceFilter] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [posTab, setPosTab] = useState('products')
  const promotionCartSignatureRef = useRef('')
  const previousCustomerIdRef = useRef(null)
  const checkoutAttemptRef = useRef(createCheckoutAttemptManager())
  const validatedWorkspaceUserRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setIsWorkspaceReady(false)
    setWorkspaceByMode({
      counter: createWorkspace('counter'),
      takeaway: createWorkspace('takeaway'),
    })
    setIsRestoredCatalogValidating(false)
    setRestoredOrderIds([])
    validatedWorkspaceUserRef.current = null
    if (!authUserId) return () => { cancelled = true }

    loadPersistedPosWorkspace(authUserId)
      .then((stored) => {
        if (cancelled) return
        setWorkspaceByMode(stored.workspaceByMode)
        const session = loadAuthSession()
        const ids = ALL_SALES_MODES.filter((mode) => {
          if (mode.id === 'counter') return canUsePosCounterMode(session)
          if (mode.id === 'takeaway') return canUsePosCodMode(session)
          return false
        }).map((mode) => mode.id)
        setSalesMode(clampPosSalesMode(stored.salesMode, ids))
        setRestoredOrderIds(stored.restoredOrderIds)
      })
      .catch(() => {
        if (!cancelled) showInfo('Không đọc được giỏ POS đã lưu; đã mở giỏ mới.')
      })
      .finally(() => {
        if (!cancelled) setIsWorkspaceReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [authUserId])

  useEffect(() => {
    if (!authUserId || !isWorkspaceReady) return undefined
    const timerId = setTimeout(() => {
      persistPosWorkspace(authUserId, {
        workspaceByMode,
        salesMode,
        restoredOrderIds,
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(timerId)
  }, [authUserId, isWorkspaceReady, restoredOrderIds, salesMode, workspaceByMode])

  useEffect(() => {
    if (!authUserId || !isWorkspaceReady || validatedWorkspaceUserRef.current === authUserId)
      return undefined

    const restoredItems = Object.values(workspaceByMode)
      .flatMap((modeWorkspace) => Object.values(modeWorkspace.sessions || {}))
      .flatMap((storedSession) => storedSession?.cartItems || [])
    const uniqueItems = [...new Map(
      restoredItems.map((item) => [String(item.productId || item.sku), item]),
    ).values()]
    if (!uniqueItems.length) {
      validatedWorkspaceUserRef.current = authUserId
      return undefined
    }

    let cancelled = false
    setIsRestoredCatalogValidating(true)
    Promise.all(uniqueItems.map(async (item) => {
      try {
        const matches = await fetchPosProducts({
          storeId: resolvePosStoreId(),
          search: item.sku || item.productId,
          limit: 10,
        })
        const product = matches.find((candidate) =>
          String(candidate.productId) === String(item.productId)
          || String(candidate.sku).toUpperCase() === String(item.sku).toUpperCase())
        return [String(item.productId || item.sku), {
          product: product || null,
          lookupFailed: false,
        }]
      } catch {
        return [String(item.productId || item.sku), {
          product: null,
          lookupFailed: true,
        }]
      }
    })).then((entries) => {
      if (cancelled) return
      validatedWorkspaceUserRef.current = authUserId
      const catalogByKey = new Map(entries)
      let unavailableCount = 0
      let unverifiedCount = 0
      setWorkspaceByMode((current) => Object.fromEntries(
        Object.entries(current).map(([mode, modeWorkspace]) => [
          mode,
          {
            ...modeWorkspace,
            sessions: Object.fromEntries(Object.entries(modeWorkspace.sessions).map(([tabId, storedSession]) => [
              tabId,
              {
                ...storedSession,
                cartItems: (storedSession.cartItems || []).map((item) => {
                  const lookup = catalogByKey.get(String(item.productId || item.sku))
                  const product = lookup?.product
                  if (!product) {
                    if (lookup?.lookupFailed) unverifiedCount += 1
                    else unavailableCount += 1
                    return {
                      ...item,
                      isUnavailable: true,
                      availabilityIssue: lookup?.lookupFailed ? 'catalog_error' : 'unavailable',
                    }
                  }
                  return {
                    ...item,
                    productId: product.productId,
                    sku: product.sku,
                    productName: product.productName,
                    packagingType: product.packagingType,
                    name: product.name,
                    price: product.price,
                    costPrice: product.costPrice,
                    stockQuantity: product.stockQuantity,
                    inventoryUnit: product.inventoryUnit,
                    priceUnit: product.priceUnit,
                    unit: getPosBaseUnitLabel(product.inventoryUnit),
                    categoryId: product.categoryId,
                    categoryName: product.categoryName,
                    imageUrl: product.imageUrl,
                    step: product.inventoryUnit === 'Gram' ? 1 : 1,
                    isUnavailable: false,
                    availabilityIssue: null,
                  }
                }),
              },
            ])),
          },
        ]),
      ))
      if (unavailableCount > 0) {
        showInfo(`${unavailableCount} sản phẩm trong giỏ đã lưu hiện không còn bán. Vui lòng xóa trước khi thanh toán.`)
      }
      if (unverifiedCount > 0) {
        showInfo(`${unverifiedCount} sản phẩm chưa thể xác thực với catalog. Vui lòng tải lại trước khi thanh toán.`)
      }
    }).finally(() => {
      if (!cancelled) setIsRestoredCatalogValidating(false)
    })

    return () => {
      cancelled = true
    }
  }, [authUserId, isWorkspaceReady, workspaceByMode])

  const isTakeaway = salesMode === 'takeaway'
  const showCashSessionUi = !isTakeaway && canUsePosCounterMode(authSession)
  const workspace = workspaceByMode[salesMode]
  const { tabs, activeTabId, sessions } = workspace
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const session = sessions[activeTabId] ?? createEmptySession(salesMode)
  const {
    searchValue = '',
    cartItems = [],
    customBundles = [],
    orderDiscountPercent = 0,
    orderDiscountAmountFixed = 0,
    promoCodeInput = '',
    appliedPromotion = null,
    selectedCustomer = null,
    customerSearchValue = '',
    customerSearchType = '',
    paymentMethod: sessionPaymentMethod,
    amountPaidInput = '',
    overpaymentAction = 'return_change',
    debtSettlement = null,
    shippingAddress = '',
    orderNote = '',
  } = session ?? createEmptySession(salesMode)

  const isOnline = useNetworkStatus()
  const paymentMethod = sessionPaymentMethod ?? (isTakeaway ? 'COD' : 'CASH')
  const isTransferPayment = paymentMethod === 'TRANSFER'
  const isCodTakeaway = isTakeaway && paymentMethod === 'COD'
  const isTransferTakeaway = isTakeaway && isTransferPayment

  // Khi offline: chỉ cho phép tiền mặt (CASH), ẩn TRANSFER
  const paymentMethods = (isTakeaway ? TAKEAWAY_PAYMENT_METHODS : COUNTER_PAYMENT_METHODS)
    .filter(m => isOnline || m.id === 'CASH')

    const patchWorkspace = (patch) => {
        setWorkspaceByMode((all) => ({
            ...all,
            [salesMode]: typeof patch === "function" ? patch(all[salesMode]) : { ...all[salesMode], ...patch },
        }));
    };

    const updateActiveSession = (updater) => {
        patchWorkspace((ws) => {
            const prevSession = ws.sessions[ws.activeTabId] ?? createEmptySession(salesMode);
            const nextSession = typeof updater === "function" ? updater(prevSession) : { ...prevSession, ...updater };
            return { ...ws, sessions: { ...ws.sessions, [ws.activeTabId]: nextSession } };
        });
    };

    const pendingQrSignature = useMemo(
        () => JSON.stringify(
            Object.entries(workspaceByMode).flatMap(([mode, modeWorkspace]) =>
                Object.entries(modeWorkspace.sessions || {})
                    .filter(([, tabSession]) => tabSession?.pendingQrOrderId)
                    .map(([tabId, tabSession]) => [mode, tabId, tabSession.pendingQrOrderId]),
            ),
        ),
        [workspaceByMode],
    );

    useEffect(() => {
        if (!authUserId || !location.state?.syncPosWorkspace) return undefined

        let cancelled = false
        loadPersistedPosWorkspace(authUserId)
            .then((stored) => {
                if (cancelled) return
                setWorkspaceByMode(stored.workspaceByMode)
                setSalesMode(clampPosSalesMode(stored.salesMode, allowedSalesModeIds))
                setRestoredOrderIds(stored.restoredOrderIds)
            })
            .finally(() => {
                if (!cancelled) {
                    navigate('/pos', { replace: true, state: null })
                }
            })

        return () => {
            cancelled = true
        }
    }, [allowedSalesModeIds, authUserId, location.state?.syncPosWorkspace, navigate])

    useEffect(() => {
        if (!authUserId || !isWorkspaceReady || pendingQrSignature === '[]') return undefined

        const pendingEntries = JSON.parse(pendingQrSignature).map(([mode, tabId, orderId]) => ({
            mode,
            tabId: Number(tabId),
            orderId: String(orderId),
        }))

        let cancelled = false

        Promise.all(
            pendingEntries.map(async ({ mode, tabId, orderId }) => {
                try {
                    const status = await fetchPosOrderPaymentStatus(orderId)
                    const orderStatus = String(status.orderStatus || '').toLowerCase()
                    const isStillPending = orderStatus === 'pendingpayment' || orderStatus === 'processing'
                    if (status.isPaid || !isStillPending) {
                        return { mode, tabId }
                    }
                } catch {
                    // ignore transient lookup errors
                }
                return null
            }),
        ).then((results) => {
            if (cancelled) return
            const clears = results.filter(Boolean)
            if (!clears.length) return

            setWorkspaceByMode((current) => {
                const next = { ...current }
                for (const entry of clears) {
                    const modeWorkspace = { ...next[entry.mode] }
                    const sessions = { ...modeWorkspace.sessions }
                    const tabSession = sessions[entry.tabId]
                    if (!tabSession?.pendingQrOrderId) continue
                    sessions[entry.tabId] = { ...tabSession, pendingQrOrderId: null }
                    modeWorkspace.sessions = sessions
                    next[entry.mode] = modeWorkspace
                }
                return next
            })
        })

        return () => {
            cancelled = true
        }
    }, [authUserId, isWorkspaceReady, pendingQrSignature])

    useEffect(() => {
        let mounted = true;

        loadPosSeller().then((info) => {
            if (mounted) {
                setSeller(info);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        fetchCategories()
            .then((items) => {
                if (mounted) {
                    setPosCategories(Array.isArray(items) ? items.filter((item) => item.isActive !== false) : []);
                }
            })
            .catch(() => {
                if (mounted) setPosCategories([]);
            });

        return () => {
            mounted = false;
        };
    }, [catalogReloadKey]);

    useEffect(() => {
        if (!canSyncCatalog) return undefined;
        let mounted = true;
        fetchPendingCatalogSync()
            .then((pending) => {
                if (mounted) setPendingCatalogSync(pending.total ?? 0);
            })
            .catch(() => {
                if (mounted) setPendingCatalogSync(0);
            });
        return () => {
            mounted = false;
        };
    }, [canSyncCatalog, catalogReloadKey]);

    const formatMoney = (value) =>
        new Intl.NumberFormat("vi-VN", {
            maximumFractionDigits: 0,
        }).format(value);

    const formatStock = (value) => {
        const n = Number(value) || 0;
        if (Math.abs(n - Math.round(n)) < 0.001) {
            return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));
        }
        return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
    };

    const formatCompactStock = (value) => {
        const n = Number(value) || 0;
        if (n <= 0) return "SL: 0";
        if (n <= 5) return `SL: ${formatStock(n)} \u00b7 s\u1eafp h\u1ebft`;
        return `SL: ${formatStock(n)}`;
    };

    const parseQtyInput = (value) => {
        const normalized = String(value).trim().replace(",", ".");
        if (!normalized) {
            return null;
        }
        return normalized;
    };

  const parseMoneyInput = (value) => {
    const digits = String(value).replace(/\D/g, '')
    return digits ? Number(digits) : 0
  }

  const tierDiscountPercent = isVipCustomerType(selectedCustomer?.customerType)
    ? 0
    : Number(selectedCustomer?.tierDiscountPercent || 0)
  const canUseVipManualAdjustments = isVipCustomerType(selectedCustomer?.customerType)
  const canUseOrderDiscount = canUseVipManualAdjustments
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
    customBundles,
  )
  const usesFixedOrderDiscount = canUseOrderDiscount && (orderDiscountAmountFixed || 0) > 0
  const cartItemQuantity = cartItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
  const amountPaid = parseMoneyInput(amountPaidInput)
  const customerCurrentDebt = Number(selectedCustomer?.currentDebt || 0)
  const transferQrAmount = isTransferPayment
    ? amountPaid > 0 ? amountPaid : total
    : 0
  const change = Math.max(amountPaid - total, 0)
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
  const confirmedDebtAllocation = debtSettlement?.payDebtsEnabled
    ? Math.max(0, Number(debtSettlement.allocatedAmount || 0))
    : 0
  const displayChange = Math.max(change - confirmedDebtAllocation, 0)
  const isTransferQrFlow = isTransferPayment && !isTakeaway
  const isDebtSale = paymentMethod === 'CASH' && amountPaid === 0 && total > 0
  const isPartialPayment = amountPaid > 0 && amountPaid < total
  const canApplyOverpayToDebt = change > 0 && customerCurrentDebt > 0
  useEffect(() => {
    if (!selectedCustomer?.customerId || customerCurrentDebt <= 0) {
      setCustomerOpenDebts([])
      return undefined
    }

        let cancelled = false;
        setIsLoadingOpenDebts(true);
        fetchCustomerOpenDebts(selectedCustomer.customerId)
            .then((items) => {
                if (!cancelled) setCustomerOpenDebts(items);
            })
            .catch(() => {
                if (!cancelled) setCustomerOpenDebts([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingOpenDebts(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedCustomer?.customerId, customerCurrentDebt]);

  useEffect(() => {
    const customerId = selectedCustomer?.customerId ?? null
    if (
      previousCustomerIdRef.current
      && customerId
      && previousCustomerIdRef.current !== customerId
      && debtSettlement
    ) {
      updateActiveSession({ debtSettlement: null, overpaymentAction: 'return_change' })
    }
    previousCustomerIdRef.current = customerId
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset debt plan only when switching customers
  }, [selectedCustomer?.customerId])

  useEffect(() => {
    if (!debtSettlement?.payDebtsEnabled) return

    const maxPayable = resolveMaxDebtPayable(change, customerCurrentDebt)
    const clamped = clampDebtSettlement(debtSettlement, maxPayable, customerOpenDebts, change)
    const prevAllocated = Number(debtSettlement.allocatedAmount || 0)
    const nextAllocated = Number(clamped.allocatedAmount || 0)
    const prevCredit = Number(debtSettlement.creditToCustomer ?? 0)
    const nextCredit = Number(clamped.creditToCustomer ?? 0)

    if (
      prevAllocated !== nextAllocated
      || prevCredit !== nextCredit
      || JSON.stringify(debtSettlement.allocations || []) !== JSON.stringify(clamped.allocations || [])
    ) {
      updateActiveSession({ debtSettlement: clamped })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-clamp debt plan when payment inputs change
  }, [selectedCustomer?.customerId, change, amountPaidInput, customerCurrentDebt, customerOpenDebts])

    useEffect(() => {
        let cancelled = false;

        const timerId = setTimeout(
            async () => {
                setIsSearchLoading(true);
                try {
                    const items = await fetchPosProducts({
                        storeId: resolvePosStoreId(),
                        search: searchValue.trim(),
                        limit: searchValue.trim() ? 80 : 60,
                    });
                    if (!cancelled) {
                        setSearchProducts(items);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setSearchProducts([]);
                        showError(error.message);
                    }
                } finally {
                    if (!cancelled) {
                        setIsSearchLoading(false);
                    }
                }
            },
            searchValue.trim() ? 250 : 0,
        );

        return () => {
            cancelled = true;
            clearTimeout(timerId);
        };
    }, [searchValue, activeTabId, catalogReloadKey]);

    async function handleRefreshCatalog() {
        if (!canSyncCatalog) return;
        setIsCatalogSyncing(true);
        try {
            const pending = await fetchPendingCatalogSync();
            setPendingCatalogSync(pending.total ?? 0);
            const result = await syncCatalogToStore();
            setCatalogReloadKey((value) => value + 1);
            const total = result.categoriesSynced + result.productsSynced + result.skusSynced;
            setPendingCatalogSync(0);
            if (total > 0) {
                showSuccess(`Đã đồng bộ ${result.categoriesSynced} DM, ${result.productsSynced} SP, ${result.skusSynced} SKU từ kho.`);
            } else if ((pending.total ?? 0) > 0) {
                showSuccess("Đã đồng bộ — danh sách POS đang tải lại.");
            } else {
                showSuccess("Catalog đã cập nhật — không có mục mới từ kho.");
            }
        } catch (error) {
            showError(error.message || "Không đồng bộ được catalog. Thử đăng nhập lại.");
        } finally {
            setIsCatalogSyncing(false);
        }
    }

    useEffect(() => {
        setOpenDiscountSku(null);
    }, [activeTabId]);

    useEffect(() => {
        if (!openDiscountSku) return undefined;

        const handlePointerDown = (event) => {
            if (discountPopoverRef.current?.contains(event.target)) {
                return;
            }
            setOpenDiscountSku(null);
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [openDiscountSku]);

    useEffect(() => {
        if (!isPriceFilterOpen) return undefined;

        function handlePointerDown(event) {
            if (priceFilterRef.current?.contains(event.target)) return;
            setIsPriceFilterOpen(false);
        }

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isPriceFilterOpen]);

    useEffect(() => {
        if (selectedCustomer) {
            const resetId = setTimeout(() => {
                setCustomerSearchResults([]);
                setCustomerSearchError("");
                setIsCustomerSearchLoading(false);
            }, 0);
            return () => clearTimeout(resetId);
        }

        const query = customerSearchValue.trim();
        const customerType = customerSearchType.trim();
        if (!query && !customerType) {
            const resetId = setTimeout(() => {
                setCustomerSearchResults([]);
                setCustomerSearchError("");
                setIsCustomerSearchLoading(false);
            }, 0);
            return () => clearTimeout(resetId);
        }

        let cancelled = false;
        const controller = new AbortController();
        const timerId = setTimeout(async () => {
            setIsCustomerSearchLoading(true);
            setCustomerSearchError("");
            try {
                const items = await fetchPosCustomers({
                    search: query,
                    customerType,
                    limit: 20,
                    signal: controller.signal,
                });
                if (!cancelled) {
                    setCustomerSearchResults(items);
                }
            } catch (error) {
                if (!cancelled && !isCustomerSearchAbort(error)) {
                    setCustomerSearchResults([]);
                    setCustomerSearchError(error.message || "Không thể tìm khách hàng lúc này.");
                }
            } finally {
                if (!cancelled) {
                    setIsCustomerSearchLoading(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timerId);
            controller.abort();
        };
    }, [customerSearchValue, customerSearchType, selectedCustomer, activeTabId]);

    useEffect(() => {
        const customerId = selectedCustomer?.customerId;
        if (!customerId) return undefined;

        let cancelled = false;
        fetchPosCustomerContext(customerId)
            .then((context) => {
                if (cancelled || !context) return;
                updateActiveSession((prev) => {
                    if (prev.selectedCustomer?.customerId !== customerId) return prev;
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
                    };
                });
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [selectedCustomer?.customerId]);

    useEffect(() => {
        if (!isTakeaway || !selectedCustomer?.customerId) {
            setSavedShippingAddresses([]);
            setUseCustomShippingAddress(false);
            return undefined;
        }

        let cancelled = false;
        setIsLoadingShippingAddresses(true);

        fetchPosCustomerContext(selectedCustomer.customerId)
            .then((context) => {
                if (cancelled) return;
                const addresses = (context.shippingAddresses ?? [])
                    .map((row) => ({
                        address: String(row.address || '').trim(),
                        label: String(row.label || row.address || '').trim(),
                    }))
                    .filter((row) => isUsableShippingAddress(row.address));
                setSavedShippingAddresses(addresses);

                if (addresses.length > 0) {
                    setUseCustomShippingAddress(false);
                    const current = shippingAddress?.trim();
                    if (current && addresses.some((addr) => addr.address === current)) {
                        return;
                    }
                    updateActiveSession({ shippingAddress: addresses[0].address });
                } else {
                    // Không giữ địa chỉ stale từ khách/tab trước — COD bắt buộc địa chỉ đã lưu.
                    setUseCustomShippingAddress(false);
                    updateActiveSession({ shippingAddress: '' });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setSavedShippingAddresses([]);
                    setUseCustomShippingAddress(true);
                    showError(error.message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingShippingAddresses(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isTakeaway, selectedCustomer?.customerId]);

    const refreshShippingAddresses = useCallback((preferredAddress = null) => {
        if (!selectedCustomer?.customerId) return;
        setIsLoadingShippingAddresses(true);
        fetchPosCustomerContext(selectedCustomer.customerId)
            .then((context) => {
                const addresses = (context.shippingAddresses ?? [])
                    .map((row) => ({
                        address: String(row.address || '').trim(),
                        label: String(row.label || row.address || '').trim(),
                    }))
                    .filter((row) => isUsableShippingAddress(row.address));
                setSavedShippingAddresses(addresses);
                const prefer = String(preferredAddress || '').trim();
                if (prefer && addresses.some((row) => row.address === prefer)) {
                    setUseCustomShippingAddress(false);
                    updateActiveSession({ shippingAddress: prefer });
                    return;
                }
                if (addresses.length > 0 && !shippingAddress?.trim()) {
                    setUseCustomShippingAddress(false);
                    updateActiveSession({ shippingAddress: addresses[0].address });
                }
            })
            .catch((error) => showError(error.message))
            .finally(() => setIsLoadingShippingAddresses(false));
    }, [selectedCustomer?.customerId, shippingAddress]);

    const addTab = () => {
        const nextId = tabs.length ? Math.max(...tabs.map((tab) => tab.id)) + 1 : 1;
        const nextTab = { id: nextId, label: `Khách lẻ` };
        patchWorkspace((ws) => ({
            ...ws,
            tabs: [...ws.tabs, nextTab],
            sessions: { ...ws.sessions, [nextId]: createEmptySession(salesMode) },
            activeTabId: nextId,
        }));
        setOpenDiscountSku(null);
    };

    const closeTab = (tabId) => {
        patchWorkspace((ws) => {
            if (ws.tabs.length === 1) {
                return ws;
            }

            const nextTabs = ws.tabs.filter((tab) => tab.id !== tabId);
            const nextSessions = { ...ws.sessions };
            delete nextSessions[tabId];

            return {
                ...ws,
                tabs: nextTabs,
                sessions: nextSessions,
                activeTabId: tabId === ws.activeTabId ? (nextTabs[0]?.id ?? ws.activeTabId) : ws.activeTabId,
            };
        });
        setOpenDiscountSku(null);
    };

    const requestCloseTab = (tabId) => {
        if (tabs.length <= 1) return;

        const tabSession = sessions[tabId];
        if (tabSession?.pendingQrOrderId) {
            showError("Không thể đóng giỏ đang chờ thanh toán QR. Hãy mở lại QR để hoàn tất hoặc hủy giao dịch.");
            return;
        }
        const tabItemCount = tabSession?.cartItems?.length ?? 0;
        if (tabItemCount === 0) {
            closeTab(tabId);
            return;
        }

        const tab = tabs.find((item) => item.id === tabId);
        setTabCloseConfirm({ tabId, label: tab?.label ?? "hóa đơn này" });
    };

    const handleConfirmCloseTab = () => {
        if (!tabCloseConfirm) return;
        closeTab(tabCloseConfirm.tabId);
        setTabCloseConfirm(null);
    };

    const addToCart = (product) => {
        const stockOnHand = Math.max(0, Number(product.stockQuantity) || 0);

        updateActiveSession((prev) => {
            const currentItems = prev.cartItems;
            const existingLine = currentItems.find((item) => item.sku === product.sku);
            if (existingLine) {
                const nextQty = existingLine.qty + existingLine.step;
                return {
                    ...prev,
                    cartItems: clampCartLineDiscounts(
                        currentItems.map((item) =>
                            item.sku === product.sku
                                ? {
                                      ...item,
                                      qty: nextQty,
                                      stockQuantity: stockOnHand,
                                      categoryId: item.categoryId ?? product.categoryId ?? product.CategoryId ?? null,
                                      categoryName: item.categoryName ?? product.categoryName ?? product.CategoryName ?? null,
                                  }
                                : item,
                        ),
                    ),
                    searchValue: "",
                };
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
                        inventoryUnit: product.inventoryUnit,
                        priceUnit: product.priceUnit,
                        unit: getPosBaseUnitLabel(product.inventoryUnit),
                        price: product.price,
                        categoryId: product.categoryId ?? product.CategoryId ?? null,
                        categoryName: product.categoryName ?? product.CategoryName ?? null,
                        step: 1,
                        stockQuantity: stockOnHand,
                        lineDiscountType: "percent",
                        lineDiscountValue: 0,
                        isGift: false,
                    },
                ],
                searchValue: "",
            };
        });
    };

    const updateQuantity = (sku, direction) => {
        const target = cartItems.find((item) => item.sku === sku);
        if (!target) {
            return;
        }

        const nextQty = direction === "inc" ? target.qty + target.step : target.qty - target.step;

        updateActiveSession((prev) => ({
            ...prev,
            cartItems: clampCartLineDiscounts(
                prev.cartItems
                    .map((item) => {
                        if (item.sku !== sku) {
                            return item;
                        }
                        return { ...item, qty: nextQty };
                    })
                    .filter((item) => item.qty > 0),
            ),
        }));
    };

    const setLineQuantity = (sku, rawValue) => {
        const item = cartItems.find((row) => row.sku === sku);
        if (!item) {
            return;
        }

        let parsed;
        try {
            const parsedInput = parseQtyInput(rawValue);
            if (parsedInput == null) {
                return;
            }
            parsed = normalizePosBaseQuantity(parsedInput, item.inventoryUnit);
        } catch (error) {
            showError(error?.message || "Số lượng không hợp lệ.");
            return;
        }

        if (parsed <= 0) {
            updateActiveSession((prev) => ({
                ...prev,
                cartItems: clampCartLineDiscounts(prev.cartItems.filter((row) => row.sku !== sku)),
            }));
            return;
        }

        updateActiveSession((prev) => ({
            ...prev,
            cartItems: clampCartLineDiscounts(prev.cartItems.map((row) => (row.sku === sku ? { ...row, qty: parsed } : row))),
        }));
    };

    const updateLineDiscountType = (sku, discountType) => {
        if (!canUseVipManualAdjustments) return;
        updateActiveSession((prev) => ({
            ...prev,
            cartItems: prev.cartItems.map((item) => (item.sku === sku ? { ...item, lineDiscountType: discountType, lineDiscountValue: 0 } : item)),
        }));
    };

    const toggleLineGift = (sku) => {
        if (!canUseVipManualAdjustments) {
            showError("Quà tặng chỉ áp dụng cho khách VIP / đối ngoại.");
            return;
        }
        updateActiveSession((prev) => ({
            ...prev,
            cartItems: prev.cartItems.map((item) => {
                if (item.sku !== sku) return item;
                const nextIsGift = !item.isGift;
                return {
                    ...item,
                    isGift: nextIsGift,
                    lineDiscountType: "percent",
                    lineDiscountValue: 0,
                };
            }),
        }));
        setOpenDiscountSku(null);
    };

    const updateLineDiscountValue = (sku, rawValue) => {
        if (!canUseVipManualAdjustments) return;
        const item = cartItems.find((row) => row.sku === sku);
        if (!item) {
            return;
        }

        const gross = getLineGross(item);

        if (item.lineDiscountType === "amount") {
            const parsed = parseMoneyInput(rawValue);
            if (parsed > gross) {
                showError(gross > 0 ? `Chiết khấu không được vượt thành tiền dòng (${formatMoney(gross)} đ).` : "Không thể chiết khấu khi thành tiền dòng bằng 0.");
                updateActiveSession((prev) => ({
                    ...prev,
                    cartItems: prev.cartItems.map((row) => (row.sku === sku ? { ...row, lineDiscountValue: gross } : row)),
                }));
                return;
            }

            updateActiveSession((prev) => ({
                ...prev,
                cartItems: prev.cartItems.map((row) => (row.sku === sku ? { ...row, lineDiscountValue: parsed } : row)),
            }));
            return;
        }

        const parsed = Math.max(0, Number(rawValue) || 0);
        if (parsed > 100) {
            showError("Chiết khấu % không được vượt 100%.");
        }

        updateActiveSession((prev) => ({
            ...prev,
            cartItems: prev.cartItems.map((row) => (row.sku === sku ? { ...row, lineDiscountValue: Math.min(100, parsed) } : row)),
        }));
    };

    const updateOrderDiscountPercent = (rawValue) => {
        const parsed = Math.max(0, Number(rawValue) || 0);
        if (parsed > 100) {
            showError("Chiết khấu đơn không được vượt 100%.");
            updateActiveSession({ orderDiscountPercent: 100, orderDiscountAmountFixed: 0 });
            return;
        }
        updateActiveSession({ orderDiscountPercent: parsed, orderDiscountAmountFixed: 0 });
    };

    const buildPromotionCartSignature = () =>
        JSON.stringify({
            items: cartItems.map((item) => ({
                skuId: item.productId,
                quantity: item.qty,
                unitPrice: item.price,
                categoryId: item.categoryId ?? null,
                lineDiscountType: item.lineDiscountType,
                lineDiscountValue: item.lineDiscountValue || 0,
                inventoryUnit: item.inventoryUnit,
                priceUnit: item.priceUnit,
            })),
            orderDiscountPercent: effectiveOrderDiscountPercent,
            orderDiscountAmountFixed: effectiveOrderDiscountAmountFixed,
            customerId: selectedCustomer?.customerId || null,
        });

    const getPromotionManualDiscount = () => Math.round(itemDiscountTotal + orderDiscountAmount);

    const buildPromotionPreviewItems = () =>
        cartItems.map((item) => ({
            skuId: item.productId,
            quantity: item.qty,
            unitPrice: item.price,
            subTotal: getLineGross(item),
            categoryId: item.categoryId ?? null,
            inventoryUnit: item.inventoryUnit,
            priceUnit: item.priceUnit,
        }));

    useEffect(() => {
        const currentSignature = buildPromotionCartSignature();
        if (!appliedPromotion) {
            promotionCartSignatureRef.current = currentSignature;
            return;
        }
        if (!promotionCartSignatureRef.current) {
            promotionCartSignatureRef.current = currentSignature;
            return;
        }
        if (promotionCartSignatureRef.current !== currentSignature) {
            promotionCartSignatureRef.current = currentSignature;
            updateActiveSession({ appliedPromotion: null, promoCodeInput: "" });
            showError("Giỏ hàng hoặc chiết khấu đã thay đổi. Vui lòng áp dụng lại mã giảm giá.");
        }
    }, [appliedPromotion, cartItems, effectiveOrderDiscountAmountFixed, effectiveOrderDiscountPercent, selectedCustomer?.customerId]);

    useEffect(() => {
        setAvailablePromotions([]);
        setApplicablePromotionsSignature("");
    }, [cartItems, effectiveOrderDiscountAmountFixed, effectiveOrderDiscountPercent, selectedCustomer?.customerId]);

    const applyPromotionToCurrentCart = async ({ promotion = null, code = "" } = {}) => {
        const promoCode = (code || promotion?.promoCode || "").trim();
        if (!promoCode) {
            showError("Vui lòng nhập mã giảm giá.");
            return;
        }
        if (!cartItems.length) {
            showError("Vui lòng thêm sản phẩm trước khi áp dụng mã giảm giá.");
            return;
        }

        const nextPromotion = await applyPromotionPreview({
            promotionId: promotion?.id ?? null,
            promotionCode: promoCode,
            customerId: selectedCustomer?.customerId || null,
            items: buildPromotionPreviewItems(),
            manualDiscount: getPromotionManualDiscount(),
        });
        updateActiveSession({ appliedPromotion: nextPromotion, promoCodeInput: nextPromotion.promoCode });
        promotionCartSignatureRef.current = buildPromotionCartSignature();
        setIsPromotionDropdownOpen(false);
        showSuccess(`Đã áp dụng mã ${nextPromotion.promoCode}.`);
    };

    const loadAvailablePromotions = async () => {
        if (!cartItems.length) {
            setAvailablePromotions([]);
            setApplicablePromotionsSignature("");
            setIsPromotionDropdownOpen(false);
            return;
        }

        const currentSignature = buildPromotionCartSignature();
        setIsPromotionDropdownOpen(true);
        if (applicablePromotionsSignature === currentSignature || isPromotionListLoading) return;

        setIsPromotionListLoading(true);
        try {
            const items = await fetchApplicablePromotions({
                customerId: selectedCustomer?.customerId || null,
                items: buildPromotionPreviewItems(),
                manualDiscount: getPromotionManualDiscount(),
            });
            setAvailablePromotions(items);
            setApplicablePromotionsSignature(currentSignature);
        } catch (error) {
            setAvailablePromotions([]);
            setApplicablePromotionsSignature("");
            showError(error.message);
        } finally {
            setIsPromotionListLoading(false);
        }
    };

    const handleSelectPromotion = async (promotion) => {
        setIsApplyingPromo(true);
        try {
            await applyPromotionToCurrentCart({ promotion });
        } catch (error) {
            showError(getPromotionApplyErrorMessage(error));
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleApplyPromoCode = async () => {
        const code = promoCodeInput.trim();
        if (!code) {
            showError("Vui lòng nhập mã giảm giá.");
            return;
        }
        setIsApplyingPromo(true);
        try {
            await applyPromotionToCurrentCart({ code });
        } catch (error) {
            showError(getPromotionApplyErrorMessage(error));
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleClearPromoCode = () => {
        updateActiveSession({ appliedPromotion: null, promoCodeInput: "" });
    };

    const validateDiscountsBeforePayment = () => {
        const normalizedItems = clampCartLineDiscounts(cartItems);
        const cartBySku = Object.fromEntries(cartItems.map((row) => [row.sku, row]));
        const hasStaleLineDiscount = normalizedItems.some((row) => {
            const current = cartBySku[row.sku];
            return current && (row.lineDiscountValue || 0) !== (current.lineDiscountValue || 0);
        });

        if (hasStaleLineDiscount) {
            updateActiveSession({ cartItems: normalizedItems });
            showError("Đã điều chỉnh chiết khấu cho khớp thành tiền. Vui lòng kiểm tra lại trước khi thanh toán.");
            return false;
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
        });

        if (!paymentCheck.ok) {
            if (paymentCheck.clampOrderDiscount) {
                updateActiveSession(paymentCheck.clampOrderDiscount);
            }
            showError(paymentCheck.error);
            return false;
        }

        const zeroTotalCheck = validateZeroTotalCheckout({
            items: normalizedItems,
            customBundles,
            finalAmount: total,
            hasAppliedPromotion: Boolean(appliedPromotion?.id),
            isVipCustomer: canUseVipManualAdjustments,
        });
        if (!zeroTotalCheck.ok) {
            showError(zeroTotalCheck.error);
            return false;
        }

        return true;
    };

    const removeItem = (sku) => {
        updateActiveSession((prev) => ({
            ...prev,
            cartItems: prev.cartItems.filter((item) => item.sku !== sku),
        }));
        if (openDiscountSku === sku) {
            setOpenDiscountSku(null);
        }
    };

    const handleAmountPaidChange = (rawValue) => {
        const digits = String(rawValue).replace(/\D/g, "");
        updateActiveSession({
            amountPaidInput: digits ? formatMoney(Number(digits)) : "",
        });
    };

    const handleQuickAmount = (value) => {
        updateActiveSession({
            amountPaidInput: value > 0 ? formatMoney(value) : "",
        });
    };

    const formatLineDiscountLabel = (item) => {
        const applied = getLineDiscount(item);
        if (!applied) return null;
        if (item.lineDiscountType === "amount") {
            return `-${formatMoney(applied)}đ`;
        }
        const percent = Math.min(100, Math.max(0, item.lineDiscountValue || 0));
        return `-${percent}%`;
    };

    const hasCartItems = cartItems.length > 0 || customBundles.length > 0;
    const hasUnavailableItems = cartItems.some((item) => item.isUnavailable);
    const hasPendingQrOrder = Boolean(session?.pendingQrOrderId);
    const hasCustomerSelected = Boolean(selectedCustomer?.customerId);
    const hasShippingAddress = isUsableShippingAddress(shippingAddress);
    // COD: chỉ chấp nhận địa chỉ đã lưu trên hồ sơ KH (không dùng địa chỉ gõ tạm / stale / placeholder).
    const hasSavedShippingAddress = savedShippingAddresses.some(
        (row) => String(typeof row === 'string' ? row : row.address || '').trim() === shippingAddress?.trim(),
    ) && hasShippingAddress;
    // Khách DN chỉ bán qua hợp đồng; state cũ khôi phục từ workspace storage vẫn phải bị chặn.
    const hasCorporateCustomer = isCorporateCustomerType(selectedCustomer?.customerType);
    const isZeroAmountSale = total === 0 && grossSubtotal > 0;
    // Quầy: cho phép khách vãng lai (không mã KH). COD/takeaway vẫn bắt buộc KH + địa chỉ đã lưu.
    const canPayCash = hasCartItems && !isRestoredCatalogValidating && !hasUnavailableItems && !hasPendingQrOrder && (hasCustomerSelected || !isTakeaway);
    const canPayTransfer = hasCartItems && !isRestoredCatalogValidating && !hasUnavailableItems && !hasPendingQrOrder && (hasCustomerSelected || !isTakeaway) && total > 0;
    const canPayTakeaway = hasCartItems
        && !hasUnavailableItems
        && !isRestoredCatalogValidating
        && !hasPendingQrOrder
        && hasCustomerSelected
        && hasShippingAddress
        && hasSavedShippingAddress
        && !isLoadingShippingAddresses
        && (isTransferPayment ? total > 0 : true);
    // Quầy: bắt buộc mở ca quỹ và đang trong ca quầy trước khi bán (TM + CK). COD/takeaway: chỉ cần trong ca, không khóa két / kiểm kệ.
    const canPay = !hasCorporateCustomer && (isTakeaway
        ? canPayTakeaway && Boolean(shelfOnDuty) && !isSubmitting
        : cashSessionOpen
          && shelfOnDuty
          && !shelfDayStatus.dayEndDone
          && (isTransferPayment ? canPayTransfer : canPayCash)
          && !isSubmitting);
    const normalizedPromoSearch = promoCodeInput.trim().toUpperCase();
    const visibleAvailablePromotions = availablePromotions
        .filter((promotion) => !normalizedPromoSearch || promotion.promoCode.toUpperCase().includes(normalizedPromoSearch))
        .slice(0, 8);

    const formatPromotionDiscountText = (promotion) => formatPromotionDiscountLabel(promotion);

    const formatPromotionValidityText = (promotion) => {
        const from = promotion.validFromUtc ? formatVietnamDateTimeMinute(promotion.validFromUtc) : null;
        const to = promotion.validToUtc ? formatVietnamDateTimeMinute(promotion.validToUtc) : null;
        if (from && to) return `HSD ${from} đến ${to}`;
        if (from) return `Từ ${from}`;
        if (to) return `HSD đến ${to}`;
        return "";
    };

    const appliedPromotionScopeText = (() => {
        if (!appliedPromotion) return "";
        const scopeType = String(appliedPromotion.scopeType || "ORDER").toUpperCase();
        if (scopeType === "ORDER") {
            return "Áp dụng toàn đơn";
        }

        if (scopeType === "CATEGORY") {
            const categoryIds = new Set((appliedPromotion.categoryScopes ?? []).map((scope) => Number(scope.categoryId)));
            const names = cartItems
                .filter((item) => item.categoryId !== null && item.categoryId !== undefined && categoryIds.has(Number(item.categoryId)))
                .map((item) => item.categoryName || item.name || item.productName || item.sku)
                .filter(Boolean);

            if (names.length) {
                return `Áp dụng cho: ${[...new Set(names)].join(", ")}`;
            }

            const configuredNames = (appliedPromotion.categoryScopes ?? [])
                .map((scope) => scope.categoryName || scope.categoryId)
                .filter(Boolean);

            return configuredNames.length
                ? `Áp dụng cho danh mục: ${configuredNames.join(", ")}`
                : "Áp dụng theo danh mục";
        }

        const skuIds = new Set((appliedPromotion.skuScopes ?? []).map((scope) => scope.skuId));
        const names = cartItems
            .filter((item) => skuIds.has(item.productId))
            .map((item) => item.name || item.productName || item.sku)
            .filter(Boolean);

        return names.length ? `Áp dụng cho: ${[...new Set(names)].join(", ")}` : "Áp dụng cho SKU cụ thể";
    })();

    const cartItemLines = cartItems.map((item) => ({
        key: item.sku,
        name: item.name,
        sku: item.sku,
        qty: Number(item.qty) || 0,
        unitPrice: Number(item.price) || 0,
        isGift: Boolean(item.isGift),
        lineGross: getLineGross(item),
        lineDiscount: getLineDiscount(item),
        lineTotal: getLineTotal(item),
        discountLabel: formatLineDiscountLabel(item),
    }));

    const selectedPaymentMethodLabel =
        paymentMethods.find((method) => method.id === paymentMethod)?.label ?? paymentMethod;

  const buildOrderPayload = (method, amount, debtSettlementJson = null) => {
    const storeId = resolvePosStoreId()
    // DiscountAmount chỉ mang giảm giá thủ công VIP; hạng thành viên do backend tự tính.
    const vipManualDiscount = canUseVipManualAdjustments
      ? itemDiscountTotal + orderDiscountAmount
      : 0
    const manualDiscount = Math.round(vipManualDiscount)
    const paymentAllocations = amount > 0
      ? [{
          paymentMethod: method,
          amount,
          debtSettlementJson,
        }]
      : []
    return {
      storeId,
      customerId: selectedCustomer?.customerId || null,
      customerSnapshotName: selectedCustomer
        ? formatCustomerOrderSnapshot(selectedCustomer)
        : 'Khách lẻ',
      promotionId: appliedPromotion?.id ?? null,
      promotionCode: appliedPromotion?.promoCode ?? null,
      manualDiscount,
      note: orderNote,
      items: cartItems.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.qty,
        unitPrice: item.isGift ? 0 : item.price,
        costPrice: item.costPrice ?? 0,
        categoryName: item.categoryName ?? null,
        inventoryUnit: item.inventoryUnit,
        priceUnit: item.priceUnit,
        isGift: item.isGift ? 1 : 0,
      })),
      payments: paymentAllocations,
      customBundles,
    }
  }

  const buildReceiptData = ({
    orderCode,
    method,
    invoiceCode,
    orderTotal,
    changeAmount = displayChange,
    backorderResult = null,
  }) => {
    const receiptTotal = orderTotal ?? total
    const isRecordedPayment = method === 'CASH' || method === 'TRANSFER'
    const fulfillmentBySku = new Map(
      (backorderResult?.items ?? []).map((item) => [String(item.sku || ''), item]),
    )
    return {
      orderCode: orderCode || activeTab.label,
      invoiceCode: invoiceCode || undefined,
      customerName: selectedCustomer?.fullName || 'Khách lẻ',
      paymentMethodLabel:
        method === 'COD'
          ? 'COD — thu khi giao'
          : method === 'TRANSFER'
            ? 'Chuyển khoản'
            : 'Tiền mặt',
      createdAtLabel: vietnamNowLabel(),
      sellerName: seller.name,
      sellerRole: seller.role,
      items: cartItems.map((item) => {
        const fulfillment = fulfillmentBySku.get(String(item.sku || ''))
        return {
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: getLineTotal(item),
          immediateFulfilledQuantity: Number(fulfillment?.immediateFulfilledQuantity || 0),
          reservedFinishedQuantity: Number(fulfillment?.reservedFinishedQuantity || 0),
          backorderQuantity: Number(fulfillment?.backorderQuantity || 0),
        }
      }),
      grossSubtotal,
      totalDiscount: itemDiscountTotal + orderDiscountAmount + couponDiscountAmount + membershipDiscountAmount,
      total: receiptTotal,
      amountPaid: isRecordedPayment ? recordedPaymentAmount : receiptTotal,
      customerPaid: isRecordedPayment ? amountPaid : receiptTotal,
      change: isRecordedPayment ? changeAmount : 0,
      debtAmount: isRecordedPayment ? debtAmount : 0,
      isDebtSale: method === 'CASH' && isDebtSale,
      isPartialCashPayment: isRecordedPayment && isPartialPayment,
      isBackorder: Boolean(backorderResult?.backorderAcceptedAt),
      fulfillmentPreference: backorderResult?.fulfillmentPreference || null,
      estimatedReadyFromLabel: backorderResult?.estimatedReadyFrom
        ? formatVietnamDateTimeMinute(backorderResult.estimatedReadyFrom)
        : '',
      estimatedReadyToLabel: backorderResult?.estimatedReadyTo
        ? formatVietnamDateTimeMinute(backorderResult.estimatedReadyTo)
        : '',
      pickupCode: backorderResult?.pickupCode || '',
      pickupContactName: backorderResult?.pickupContactName || '',
      pickupContactPhone: backorderResult?.pickupContactPhone || '',
      pickupDateLabel: backorderResult?.pickupDate
        ? formatVietnamDate(backorderResult.pickupDate)
        : '',
    }
  }

  const resolveDebtApplyAmount = (overrideSettlement) => {
    const settlement = overrideSettlement ?? debtSettlement
    if (!settlement?.payDebtsEnabled) return 0

    const allocated = Number(settlement.allocatedAmount || 0)
    if (allocated > 0) return allocated

    const maxPayable = resolveMaxDebtPayable(change, customerCurrentDebt)
    return maxPayable > 0 ? maxPayable : 0
  }

  const resolveChangeAfterDebt = (debtSettlement, debtApplyAmount) => {
    if (debtSettlement && debtSettlement.creditToCustomer != null) {
      return Math.max(0, Number(debtSettlement.creditToCustomer) || 0)
    }
    if (debtSettlement) {
      return Math.max(change - debtApplyAmount, 0)
    }
    return displayChange
  }

    const buildTransferDebtSettlement = (debtSettlement, orderId) => {
        const amount = resolveDebtApplyAmount(debtSettlement);
        if (amount <= 0 || !selectedCustomer?.customerId) return null;
        return {
            customerId: selectedCustomer.customerId,
            orderId,
            amount,
            allocations: debtSettlement?.allocations ?? null,
            balanceBefore: customerCurrentDebt,
            customerName: selectedCustomer.fullName || "",
            customerCode: selectedCustomer.customerCode || "",
        };
    };

    const needsDebtSettlementOnPay = change > 0 && canApplyOverpayToDebt && overpaymentAction === "apply_to_debt";

    const openDebtAllocationModal = (mode = "configure") => {
        if (!canApplyOverpayToDebt) return;
        setDebtModalMode(mode);
        setOverpaymentDebtModalOpen(true);
    };

    const handleOpenDebtAllocation = () => {
        updateActiveSession({ overpaymentAction: "apply_to_debt" });
        openDebtAllocationModal("configure");
    };

    const handleOverpaymentActionChange = (action) => {
        updateActiveSession({
            overpaymentAction: action,
            ...(action === "return_change" ? { debtSettlement: null } : {}),
        });
    };

  const finalizeRecordedPayment = async ({
    method,
    createOrder,
    debtSettlement = null,
    idempotencyKey,
    acceptBackorder = false,
    fulfillmentPreference = 'PartialDelivery',
    pickupDate = null,
    pickupNote = null,
    pickupContactName = null,
    pickupContactPhone = null,
    depositAmount = null,
  }) => {
    const debtApplyAmount = resolveDebtApplyAmount(debtSettlement)
    const changeAfterDebt = resolveChangeAfterDebt(debtSettlement, debtApplyAmount)
    const backendDebtSettlementJson = debtApplyAmount > 0
      ? serializeCodDebtSettlement({ ...debtSettlement, paymentMethod: method })
      : null
    // Đơn đặt cọc chỉ thu trước phần cọc; phần còn lại thu khi khách tới nhận hàng.
    const collectedNow = depositAmount ?? recordedPaymentAmount
    const payload = buildOrderPayload(
      method,
      collectedNow,
      backendDebtSettlementJson,
    )
    payload.acceptBackorder = acceptBackorder
    payload.fulfillmentPreference = fulfillmentPreference
    payload.pickupDate = pickupDate
    payload.pickupNote = pickupNote
    payload.pickupContactName = pickupContactName
    payload.pickupContactPhone = pickupContactPhone
    payload.depositAmount = depositAmount
    const result = await createOrder(payload, { idempotencyKey })

    if (method === 'CASH' && collectedNow > 0) {
      await recordCashSale()
    }

        const stockNote = result.stockHandlingSummary?.message
            ? ` Â· ${result.stockHandlingSummary.message}`
            : "";

        if (depositAmount != null) {
            showSuccess(
                `Đã nhận cọc ${formatMoney(depositAmount)} đ cho đơn ${result.orderCode}. Còn lại ${formatMoney(Math.max(0, total - depositAmount))} đ thu khi khách nhận hàng.${stockNote}`,
            );
        } else if (recordedPaymentAmount >= total) {
            const debtNote =
                debtApplyAmount > 0 ? ` · Trừ nợ ${formatMoney(debtApplyAmount)} đ tại backend`
                : changeAfterDebt > 0 ? ` · Thừa ${formatMoney(changeAfterDebt)} đ`
                : "";
            showSuccess(
                result.invoiceCode ?
                    total === 0 ?
                        `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}${debtNote}${stockNote}`
                    :   `Thanh toán thành công. Đơn: ${result.orderCode} · Số HĐ: ${result.invoiceCode}${debtNote}${stockNote}`
                : total === 0 ? `Hoàn tất đơn 0 đ. Đơn: ${result.orderCode}${debtNote}${stockNote}`
                : `Thanh toán thành công. Đơn: ${result.orderCode}${debtNote}${stockNote}`,
            );
        } else if (isDebtSale) {
            showSuccess(`Ghi đơn ${result.orderCode} thành công. Dư nợ: ${formatMoney(debtAmount)} đ.${stockNote}`);
        } else {
            showSuccess(`Ghi đơn ${result.orderCode}. Đã thu ${formatMoney(recordedPaymentAmount)} đ, còn nợ ${formatMoney(debtAmount)} đ.${stockNote}`);
        }

        const receipts = [
            buildReceiptData({
                orderCode: result.orderCode,
                method,
                invoiceCode: result.invoiceCode,
                changeAmount: changeAfterDebt,
                backorderResult: result,
            }),
        ];

        resetCheckoutState();
        setCatalogReloadKey((key) => key + 1);
        await printReceiptSequence(receipts);
    };

    const resetCheckoutState = () => {
        setWorkspaceByMode((current) => {
            const modeWorkspace = current[salesMode];
            const remainingTabs = modeWorkspace.tabs.filter((tab) => tab.id !== activeTabId);
            const remainingSessions = { ...modeWorkspace.sessions };
            delete remainingSessions[activeTabId];
            const nextId = modeWorkspace.tabs.length
                ? Math.max(...modeWorkspace.tabs.map((tab) => tab.id)) + 1
                : 1;
            const cleanTab = { id: nextId, label: "Khách lẻ" };
            return {
                ...current,
                [salesMode]: {
                    tabs: [...remainingTabs, cleanTab],
                    sessions: {
                        ...remainingSessions,
                        [nextId]: createEmptySession(salesMode),
                    },
                    activeTabId: nextId,
                },
            };
        });
        setOpenDiscountSku(null);
        setIsPaymentSidebarOpen(false);
        setIsPaymentConfirmOpen(false);
    };

    const persistPendingQrCheckout = async (orderId) => {
        const sessionSnapshot = {
            ...session,
            pendingQrOrderId: orderId,
        };
        const nextWorkspaceByMode = {
            ...workspaceByMode,
            [salesMode]: {
                ...workspaceByMode[salesMode],
                sessions: {
                    ...workspaceByMode[salesMode].sessions,
                    [activeTabId]: sessionSnapshot,
                },
            },
        };
        setWorkspaceByMode(nextWorkspaceByMode);
        if (authUserId) {
            await persistPosWorkspace(authUserId, {
                workspaceByMode: nextWorkspaceByMode,
                salesMode,
                restoredOrderIds,
            });
        }
        return sessionSnapshot;
    };

    const openPaymentSidebar = () => {
        if (!hasCartItems) {
            showError("Giỏ hàng trống.");
            return;
        }
        setIsPaymentSidebarOpen(true);
    };

    const handleTakeawayPayment = async (debtSettlement = null, idempotencyKey) => {
        const address = shippingAddress?.trim();
        if (!isUsableShippingAddress(address) || !hasSavedShippingAddress) {
            showError("Vui lòng chọn địa chỉ giao hàng đã lưu cho đơn COD.");
            return;
        }
        const addressSaved = savedShippingAddresses.some(
            (row) => String(typeof row === 'string' ? row : row.address || '').trim() === address,
        );
        if (!addressSaved) {
            showError("Khách chưa có địa chỉ đã lưu. Vui lòng thêm địa chỉ trước khi tạo đơn COD.");
            return;
        }

        if (!validateDiscountsBeforePayment()) {
            return;
        }

        const manualDiscount = Math.round(itemDiscountTotal + orderDiscountAmount);
        const payload = buildTakeawayOrderPayload({
            storeId: resolvePosStoreId(),
            customerId: selectedCustomer.customerId,
            customerSnapshotName: formatCustomerOrderSnapshot(selectedCustomer),
            shippingAddress: address,
            note: orderNote,
            cartItems,
            customBundles,
            manualDiscount,
            promotionId: appliedPromotion?.id ?? null,
            promotionCode: appliedPromotion?.promoCode ?? null,
        });

        if (isTransferPayment) {
            const debtApplyAmount = resolveDebtApplyAmount(debtSettlement);
            const backendDebtSettlementJson = debtApplyAmount > 0
                ? serializeCodDebtSettlement({ ...debtSettlement, paymentMethod: "VietQR" })
                : null;
            const transferAppliedToOrder = Math.min(transferQrAmount, total);
            const actualQrAmount = transferAppliedToOrder + debtApplyAmount;
            const result = await createTakeawayVietQrOrder(payload, {
                qrAmount: actualQrAmount,
                paymentAmount: transferAppliedToOrder,
                debtSettlementJson: backendDebtSettlementJson,
                idempotencyKey,
            });
            const transferDebtSettlement = buildTransferDebtSettlement(debtSettlement, result.orderId);

            showSuccess(
                transferDebtSettlement ?
                    `Đã tạo đơn mang đi ${result.orderCode}. Quét QR ${formatMoney(actualQrAmount)} đ (gồm trừ nợ ${formatMoney(transferDebtSettlement.amount)} đ).`
                :   `Đã tạo đơn mang đi ${result.orderCode}. Quét QR ${formatMoney(actualQrAmount)} đ để thanh toán.`,
            );
            const receipt = buildReceiptData({
                orderCode: result.orderCode,
                method: "TRANSFER",
                backorderResult: result,
            });
            const sessionSnapshot = await persistPendingQrCheckout(result.orderId);
            navigate(`/pos/payment/qr?orderId=${encodeURIComponent(result.orderId)}`, {
                state: {
                    orderId: result.orderId,
                    orderCode: result.orderCode,
                    orderLabel: result.orderCode,
                    total: result.qrAmount || actualQrAmount,
                    qrPayload: result.qrPayload,
                    qrImageUrl: result.qrImageUrl,
                    transferContent: result.transferContent,
                    transferAccountNumber: result.transferAccountNumber,
                    paymentMode: result.paymentMode,
                    qrExpiresAtUtc: result.qrExpiresAtUtc,
                    customer: selectedCustomer?.fullName || "",
                    paymentMethod: "TRANSFER",
                    receipt,
                    debtSettlement: transferDebtSettlement,
                    workspaceMode: salesMode,
                    workspaceTabId: activeTabId,
                    sessionSnapshot,
                },
            });
            return;
        }

        if (paymentMethod === 'CASH') {
            if (!selectedCustomer?.customerId && (isDebtSale || isPartialPayment)) {
                showError('Ghi nợ / thiếu tiền yêu cầu chọn khách hàng đã đăng ký.');
                return;
            }
            const debtApplyAmount = resolveDebtApplyAmount(debtSettlement);
            const backendDebtSettlementJson = debtApplyAmount > 0
                ? serializeCodDebtSettlement({ ...debtSettlement, paymentMethod: 'CASH' })
                : null;
            const cashPayload = {
                ...payload,
                payments: [{
                    paymentMethod: 'CASH',
                    amount: recordedPaymentAmount,
                    debtSettlementJson: backendDebtSettlementJson,
                }],
            };
            const result = await createTakeawayCashOrder(cashPayload, { idempotencyKey });
            if (recordedPaymentAmount > 0) {
                await recordCashSale();
            }
            if (isDebtSale) {
                showSuccess(`Đã tạo đơn giao ${result.orderCode}. Ghi nợ ${formatMoney(debtAmount)} đ.`);
            } else if (isPartialPayment) {
                showSuccess(`Đã tạo đơn giao ${result.orderCode}. Thu ${formatMoney(recordedPaymentAmount)} đ, còn nợ ${formatMoney(debtAmount)} đ.`);
            } else {
                showSuccess(`Đã tạo đơn giao ${result.orderCode}. Thanh toán tiền mặt thành công.`);
            }
            const receipt = buildReceiptData({
                orderCode: result.orderCode,
                method: 'CASH',
                orderTotal: result.totalAmount,
                amountPaid: recordedPaymentAmount,
                customerPaid: amountPaid,
            });
            resetCheckoutState();
            printReceiptFromData(receipt);
            return;
        }

        if (amountPaid > 0 && amountPaid < total) {
            showError("Số tiền dự kiến thu COD phải bằng hoặc lớn hơn thành tiền. Muốn thu thiếu / ghi nợ hãy chọn Tiền mặt.");
            return;
        }

        const activeSettlement = debtSettlement ?? null;
        const codDebtSettlementJson = buildCodMetaJson({
            expectedCollectedAmount: codExpectedAmount,
            settlement: activeSettlement ? { ...activeSettlement, paymentMethod: "COD" } : null,
        });
        const result = await createTakeawayCodOrder(payload, codExpectedAmount, {
            paymentAmount: total,
            codDebtSettlementJson,
            idempotencyKey,
        });
        const debtNote =
            activeSettlement?.payDebtsEnabled && Number(activeSettlement.allocatedAmount || 0) > 0 ?
                ` · Dự kiến trừ nợ ${formatMoney(activeSettlement.allocatedAmount)} đ khi thu COD`
            :   "";
        const expectedNote =
            codExpectedAmount > total
                ? ` · Dự kiến thu ${formatMoney(codExpectedAmount)} đ khi giao`
                : "";
        showSuccess(`Đã tạo đơn COD ${result.orderCode}. Theo dõi tại Quản lý đơn COD.${debtNote}${expectedNote}`);
        const receipt = buildReceiptData({
            orderCode: result.orderCode,
            method: "COD",
            orderTotal: result.totalAmount,
            amountPaid: codExpectedAmount,
            customerPaid: codExpectedAmount,
        });
        resetCheckoutState();
        printReceiptFromData(receipt);
    };

    const executePayment = async (
        debtSettlement = null,
        idempotencyKey,
        acceptBackorder = false,
        fulfillmentPreference = 'PartialDelivery',
        pickupDate = null,
        pickupNote = null,
        pickupContactName = null,
        pickupContactPhone = null,
        depositAmount = null,
    ) => {
        if (isTakeaway) {
            await handleTakeawayPayment(debtSettlement, idempotencyKey);
            return;
        }

        if (isTransferPayment) {
            const debtApplyAmount = resolveDebtApplyAmount(debtSettlement);
            const backendDebtSettlementJson = debtApplyAmount > 0
                ? serializeCodDebtSettlement({ ...debtSettlement, paymentMethod: "VietQR" })
                : null;
            const transferAppliedToOrder = depositAmount ?? Math.min(transferQrAmount, total);
            const actualQrAmount = transferAppliedToOrder + debtApplyAmount;
            const payload = buildOrderPayload(
                "TRANSFER",
                transferAppliedToOrder,
                backendDebtSettlementJson,
            );
            payload.acceptBackorder = acceptBackorder;
            payload.fulfillmentPreference = fulfillmentPreference;
            payload.pickupDate = pickupDate;
            payload.pickupNote = pickupNote;
            payload.pickupContactName = pickupContactName;
            payload.pickupContactPhone = pickupContactPhone;
            payload.depositAmount = depositAmount;
            const result = await createPosOrderOnline(payload, {
                qrAmount: actualQrAmount,
                idempotencyKey,
            });
            const transferDebtSettlement = buildTransferDebtSettlement(debtSettlement, result.orderId);

            showSuccess(
                transferDebtSettlement ?
                    `Đã tạo đơn ${result.orderCode}. Quét QR ${formatMoney(actualQrAmount)} đ (gồm trừ nợ ${formatMoney(transferDebtSettlement.amount)} đ).`
                :   `Đã tạo đơn ${result.orderCode}. Quét mã QR ${formatMoney(actualQrAmount)} đ để thanh toán.`,
            );
            const receipt = buildReceiptData({
                orderCode: result.orderCode,
                method: "TRANSFER",
                backorderResult: result,
            });
            const sessionSnapshot = await persistPendingQrCheckout(result.orderId);
            navigate(`/pos/payment/qr?orderId=${encodeURIComponent(result.orderId)}`, {
                state: {
                    orderId: result.orderId,
                    orderCode: result.orderCode,
                    orderLabel: result.orderCode,
                    total: result.qrAmount || actualQrAmount,
                    qrPayload: result.qrPayload,
                    qrImageUrl: result.qrImageUrl,
                    transferContent: result.transferContent,
                    transferAccountNumber: result.transferAccountNumber,
                    paymentMode: result.paymentMode,
                    qrExpiresAtUtc: result.qrExpiresAtUtc,
                    customer: selectedCustomer?.fullName || "",
                    paymentMethod: "TRANSFER",
                    receipt,
                    debtSettlement: transferDebtSettlement,
                    workspaceMode: salesMode,
                    workspaceTabId: activeTabId,
                    sessionSnapshot,
                },
            });
            return;
        }

        await finalizeRecordedPayment({
            method: "CASH",
            createOrder: createPosOrderOffline,
            debtSettlement,
            idempotencyKey,
            acceptBackorder,
            fulfillmentPreference,
            pickupDate,
            pickupNote,
            pickupContactName,
            pickupContactPhone,
            depositAmount,
        });
    };

    const submitCheckoutAttempt = (
        activeDebtSettlement = null,
        acceptBackorder = false,
        fulfillmentPreference = 'PartialDelivery',
        pickupDate = null,
        pickupNote = null,
        pickupContactName = null,
        pickupContactPhone = null,
        depositAmount = null,
    ) =>
        checkoutAttemptRef.current.submit(
            {
                salesMode,
                activeTabId,
                cartItems,
                customBundles,
                selectedCustomerId: selectedCustomer?.customerId ?? null,
                orderDiscountPercent,
                orderDiscountAmountFixed,
                promotionId: appliedPromotion?.id ?? null,
                promotionCode: appliedPromotion?.promoCode ?? null,
                paymentMethod: sessionPaymentMethod,
                amountPaidInput,
                shippingAddress,
                orderNote,
                debtSettlement: activeDebtSettlement,
                acceptBackorder,
                fulfillmentPreference,
                pickupDate,
                pickupNote,
                pickupContactName,
                pickupContactPhone,
                depositAmount,
            },
            (idempotencyKey) => executePayment(
                activeDebtSettlement,
                idempotencyKey,
                acceptBackorder,
                fulfillmentPreference,
                pickupDate,
                pickupNote,
                pickupContactName,
                pickupContactPhone,
                depositAmount,
            ),
        );

    const handlePayment = async () => {
        if (isRestoredCatalogValidating) {
            showError("Đang xác thực lại sản phẩm trong giỏ đã lưu. Vui lòng chờ trong giây lát.");
            return;
        }
        if (hasPendingQrOrder) {
            showError("Giỏ này đang có đơn chuyển khoản chờ xử lý. Hãy hoàn tất hoặc hủy QR trước khi thanh toán lại.");
            return;
        }
        if (hasUnavailableItems) {
            showError("Giỏ có sản phẩm không còn bán. Vui lòng xóa sản phẩm được đánh dấu trước khi thanh toán.");
            return;
        }
        if (hasCorporateCustomer) {
            showError(CORPORATE_AT_POS_MESSAGE);
            return;
        }
        if (isTakeaway && !hasCustomerSelected) {
            showError("Vui lòng chọn hoặc thêm khách hàng trước khi tạo đơn COD/giao hàng.");
            return;
        }

        if (!hasCustomerSelected && (orderDiscountAmount > 0 || cartItems.some((item) => item.isGift || Number(item.lineDiscountValue) > 0))) {
            showError("Khách vãng lai không dùng chiết khấu/quà. Bỏ chiết khấu hoặc chọn khách VIP.");
            return;
        }

        const allocatedForOrder = isTransferPayment
            ? Math.min(transferQrAmount, total)
            : recordedPaymentAmount;
        if (!hasCustomerSelected && allocatedForOrder < total) {
            showError("Khách lẻ phải thanh toán đủ. Vui lòng đăng ký hoặc chọn khách hàng trước khi bán nợ/thanh toán một phần.");
            return;
        }

        if (isTakeaway) {
            if (!shelfOnDuty) {
                showError('Chưa được duyệt ca quầy hoặc đang ngoài giờ ca — không thể tạo đơn COD. Vào «Lịch làm việc» để đăng ký.');
                return;
            }
            if (!canPay) {
                if (!hasShippingAddress || !hasSavedShippingAddress) {
                    showError(
                        savedShippingAddresses.length === 0
                            ? "Khách chưa có địa chỉ đã lưu. Vui lòng thêm địa chỉ trước khi tạo đơn COD."
                            : "Vui lòng chọn địa chỉ giao hàng.",
                    );
                } else if (isTransferPayment && total <= 0) {
                    showError("Đơn 0 đ không dùng chuyển khoản — chọn COD.");
                }
                return;
            }
            if (!validateDiscountsBeforePayment()) {
                return;
            }
        } else {
            if (!validateDiscountsBeforePayment()) {
                return;
            }

            if (!shelfOnDuty) {
                showError('Chưa được duyệt ca quầy hoặc đang ngoài giờ ca — không thể bán tại quầy. Vào «Lịch làm việc» để đăng ký.');
                return;
            }

            if (shelfDayStatus.dayEndDone) {
                showError('Đã chốt kệ cuối ngày — không bán thêm hôm nay.')
                return;
            }

            if (!assertCashSessionOpenForPayment(shelfOnDuty)) {
                return;
            }

            if (!canPay) {
                if (!cashSessionOpen) {
                    showError('Chưa mở ca quỹ — không thể bán tại quầy.');
                    return;
                }
                if (isTransferPayment && isZeroAmountSale) {
                    showError("Đơn 0 đ vui lòng chọn thanh toán tiền mặt.");
                }
                return;
            }
        }

        if (needsDebtSettlementOnPay && !debtSettlement) {
            showError('Vui lòng bấm "Tính vào công nợ" để chọn hóa đơn cần trừ.');
            openDebtAllocationModal("configure");
            return;
        }

        setIsPaymentConfirmOpen(true);
    };

    const resumePendingQrPayment = () => {
        const pendingOrderId = session?.pendingQrOrderId;
        if (!pendingOrderId) {
            showError("Không tìm thấy mã đơn chuyển khoản đang chờ. Vui lòng tải lại POS.");
            return;
        }
        navigate(`/pos/payment/qr?orderId=${encodeURIComponent(pendingOrderId)}`, {
            state: {
                orderId: pendingOrderId,
                orderCode: "",
                orderLabel: activeTab.label,
                customer: selectedCustomer?.fullName || "Khách lẻ",
                total: transferQrAmount > 0 ? transferQrAmount : total,
                paymentMethod: "TRANSFER",
                workspaceMode: salesMode,
                workspaceTabId: activeTabId,
                sessionSnapshot: session,
            },
        });
    };

    const handleConfirmPayment = async () => {
        if (isSubmitting || checkoutAttemptRef.current.isProcessing()) return;
        if (!navigator.onLine) {
            showError(
                "Cần kết nối mạng để kiểm tra Kệ/Kho/BOM và xác nhận khách có đồng ý chờ hàng trước khi thu tiền.",
            );
            return;
        }
        setIsSubmitting(true);
        try {
            await submitCheckoutAttempt(debtSettlement);
            setIsPaymentConfirmOpen(false);
        } catch (error) {
            if (error?.body?.requiresBackorderConfirmation) {
                setIsPaymentConfirmOpen(false);
                setBackorderPrompt({
                    message: error.body.backorderMessage || "Sản phẩm tạm thời hết hàng.",
                    lines: error.body.lines || [],
                    availableQuantity: Number(error.body.availableQuantity || 0),
                    backorderQuantity: Number(error.body.backorderQuantity || 0),
                    estimatedReadyFrom: error.body.estimatedReadyFrom || null,
                });
                return;
            }
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackorderAccept = async ({
        fulfillmentPreference,
        pickupDate,
        pickupNote,
        pickupContactName,
        pickupContactPhone,
        depositAmount,
    }) => {
        if (isSubmitting || checkoutAttemptRef.current.isProcessing()) return;
        setIsSubmitting(true);
        try {
            await submitCheckoutAttempt(
                debtSettlement,
                true,
                fulfillmentPreference,
                pickupDate,
                pickupNote,
                pickupContactName,
                pickupContactPhone,
                depositAmount,
            );
            // Khách vãng lai đặt đơn chờ hàng sẽ quay lại lấy — lưu thành hồ sơ để lần sau tra được.
            // Thất bại (trùng SĐT, mất mạng) không được ảnh hưởng đơn vừa tạo.
            if (!selectedCustomer?.customerId && pickupContactName && pickupContactPhone) {
                try {
                    const existing = await fetchCustomerByPhone(pickupContactPhone).catch(() => null);
                    if (!existing?.customerId) {
                        await createCustomerForOrder({
                            fullName: pickupContactName,
                            phone: pickupContactPhone,
                        });
                        showSuccess(`Đã lưu khách hàng ${pickupContactName} vào hồ sơ.`);
                    }
                } catch (customerError) {
                    showInfo(`Đơn đã tạo nhưng chưa lưu được hồ sơ khách: ${customerError.message}`);
                }
            }
            setBackorderPrompt(null);
            setIsPaymentConfirmOpen(false);
        } catch (error) {
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackorderDecline = () => {
        setBackorderPrompt(null);
        setIsPaymentConfirmOpen(false);
    };

    const handleOverpaymentDebtConfirm = async (result) => {
        setOverpaymentDebtModalOpen(false);
        if (debtModalMode === "configure") {
            updateActiveSession({ overpaymentAction: "apply_to_debt", debtSettlement: result });
            return;
        }

        if (isSubmitting || checkoutAttemptRef.current.isProcessing()) return;
        setIsSubmitting(true);
        try {
            await submitCheckoutAttempt(result);
        } catch (error) {
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOverpaymentDebtSkip = async () => {
        setOverpaymentDebtModalOpen(false);
        if (debtModalMode === "configure") {
            handleOverpaymentActionChange("return_change");
            return;
        }

        if (isSubmitting || checkoutAttemptRef.current.isProcessing()) return;
        setIsSubmitting(true);
        try {
            await submitCheckoutAttempt({
                payDebtsEnabled: false,
                allocations: [],
                allocatedAmount: 0,
                creditToCustomer: change,
            });
        } catch (error) {
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasSearchQuery = searchValue.trim().length > 0;

    const filteredSearchProducts = useMemo(() => {
        let items = searchProducts;
        if (selectedCategoryIds.length > 0) {
            const allowedCategoryIds = expandCategoryFilterIds(selectedCategoryIds, posCategories);
            items = items.filter((item) => allowedCategoryIds.has(Number(item.categoryId)));
        }
        if (priceFilter === "under-50k") {
            items = items.filter((item) => Number(item.price) < 50000);
        } else if (priceFilter === "50k-200k") {
            items = items.filter((item) => {
                const price = Number(item.price);
                return price >= 50000 && price <= 200000;
            });
        } else if (priceFilter === "over-200k") {
            items = items.filter((item) => Number(item.price) > 200000);
        }
        if (priceFilter === "asc" || priceFilter === "desc") {
            items = [...items].sort((a, b) => {
                const diff = Number(a.price) - Number(b.price);
                return priceFilter === "asc" ? diff : -diff;
            });
        }
        return items;
    }, [searchProducts, selectedCategoryIds, posCategories, priceFilter]);

    const productTotalPages = Math.max(1, Math.ceil(filteredSearchProducts.length / POS_PRODUCT_PAGE_SIZE));

    const visibleProductPageItems = useMemo(() => {
        const safePage = Math.min(Math.max(1, productPage), productTotalPages);
        const start = (safePage - 1) * POS_PRODUCT_PAGE_SIZE;
        return filteredSearchProducts.slice(start, start + POS_PRODUCT_PAGE_SIZE);
    }, [filteredSearchProducts, productPage, productTotalPages]);

    useEffect(() => {
        setProductPage(1);
    }, [searchValue, selectedCategoryIds, priceFilter, activeTabId]);

    useEffect(() => {
        setProductPage((current) => Math.min(Math.max(1, current), productTotalPages));
    }, [productTotalPages]);

    const selectedCategorySummary = useMemo(() => formatCategoryFilterSummary(selectedCategoryIds, posCategories), [selectedCategoryIds, posCategories]);

    const selectedPriceFilterLabel = useMemo(() => PRICE_FILTER_OPTIONS.find((option) => option.id === priceFilter)?.label ?? null, [priceFilter]);

    const hasCustomerSearchQuery = customerSearchValue.trim().length > 0 || customerSearchType.length > 0;
    const customerSearchDisplayState = getCustomerSearchDisplayState({
        hasCriteria: !selectedCustomer && hasCustomerSearchQuery,
        isLoading: isCustomerSearchLoading,
        error: customerSearchError,
        resultCount: customerSearchResults.length,
    });
    const showCustomerDropdown = customerSearchDisplayState === "results";
    const showCustomerSearchEmpty = customerSearchDisplayState === "empty";

    const selectCustomer = (customer) => {
        if (isCorporateCustomerType(customer?.customerType)) {
            showError(CORPORATE_AT_POS_MESSAGE);
            return;
        }
        const keepVipAdjustments = isVipCustomerType(customer?.customerType);
        const removedVipAdjustments = !keepVipAdjustments && (
            orderDiscountPercent > 0
            || orderDiscountAmountFixed > 0
            || cartItems.some((item) => item.isGift || Number(item.lineDiscountValue || 0) > 0)
        );
        const label = String(customer?.fullName || '').trim()
        updateActiveSession((prev) => ({
            ...prev,
            selectedCustomer: customer,
            customerSearchValue: "",
            customerSearchType: "",
            shippingAddress: "",
            ...(keepVipAdjustments ? {} : {
                orderDiscountPercent: 0,
                orderDiscountAmountFixed: 0,
                cartItems: clampCartLineDiscounts(
                    prev.cartItems.map((item) => ({
                        ...item,
                        isGift: false,
                        lineDiscountType: "percent",
                        lineDiscountValue: 0,
                    })),
                ),
            }),
        }));
        if (label) {
            patchWorkspace((ws) => ({
                ...ws,
                tabs: ws.tabs.map((tab) =>
                    tab.id === ws.activeTabId
                        ? { ...tab, label: label.length > 20 ? `${label.slice(0, 18)}…` : label }
                        : tab,
                ),
            }));
        }
        setCustomerSearchResults([]);
        setCustomerSearchError("");
        setSavedShippingAddresses([]);
        setUseCustomShippingAddress(false);
        if (removedVipAdjustments) {
            showInfo("Đã xóa quà tặng/chiết khấu thủ công vì khách mới không phải khách đối ngoại (VIP).");
        }
    };

    const clearCustomerSelection = () => {
        const removedVipAdjustments = orderDiscountPercent > 0
            || orderDiscountAmountFixed > 0
            || cartItems.some((item) => item.isGift || Number(item.lineDiscountValue || 0) > 0);
        updateActiveSession((prev) => ({
            ...prev,
            selectedCustomer: null,
            customerSearchValue: "",
            customerSearchType: "",
            orderDiscountPercent: 0,
            orderDiscountAmountFixed: 0,
            cartItems: clampCartLineDiscounts(
                prev.cartItems.map((item) => ({
                    ...item,
                    isGift: false,
                    lineDiscountType: "percent",
                    lineDiscountValue: 0,
                })),
            ),
        }));
        patchWorkspace((ws) => ({
            ...ws,
            tabs: ws.tabs.map((tab) =>
                tab.id === ws.activeTabId ? { ...tab, label: "Khách lẻ" } : tab,
            ),
        }));
        if (removedVipAdjustments) {
            showInfo("Đã xóa quà tặng/chiết khấu thủ công vì khách lẻ không được áp dụng ưu đãi VIP.");
        }
    };

    const handleSavedShippingAddressChange = (value) => {
        if (value === "__custom__") {
            setUseCustomShippingAddress(true);
            updateActiveSession({ shippingAddress: "" });
            return;
        }
        setUseCustomShippingAddress(false);
        updateActiveSession({ shippingAddress: value });
    };

    if (authUserId && !isWorkspaceReady) {
        return <LoadingIndicator label="Đang khôi phục giỏ POS..." className="min-h-[60vh]" />;
    }

    return (
        <PosShiftDutyGate
            onDutyChange={setShelfOnDuty}
            cashSessionOpen={cashSessionOpen}
            onDayStatusChange={setShelfDayStatus}
            dayEndRequested={dayEndRequested}
            onDayEndRequestHandled={() => setDayEndRequested(false)}
            requireShelfDay={canUsePosCounterMode(authSession) && salesMode === 'counter'}
            onSwitchToCod={
                allowedSalesModes.some((m) => m.id === 'takeaway')
                    ? () => setSalesMode('takeaway')
                    : undefined
            }
        >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-[#fbf9f1] shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:rounded-[28px]">
            <header className="relative z-20 shrink-0 border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-3 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="relative w-[min(280px,28%)] shrink-0">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">search</Icon>
                        <input
                            className="w-full rounded-full border border-[#c1c9c0] bg-white py-1.5 pl-9 pr-9 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                            placeholder="Tìm SP, SKU, barcode..."
                            type="text"
                            value={searchValue}
                            onChange={(event) => updateActiveSession({ searchValue: event.target.value })}
                        />
                        <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">barcode_scanner</Icon>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const tabSession = sessions[tab.id];
                            const tabItemCount = tabSession?.cartItems?.length ?? 0;
                            const tabHasCustomer = Boolean(tabSession?.selectedCustomer?.customerId);

                            return (
                                <div
                                    key={tab.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => patchWorkspace({ activeTabId: tab.id })}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            patchWorkspace({ activeTabId: tab.id });
                                        }
                                    }}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                        activeTabId === tab.id ? "bg-[#356647] text-white shadow-sm" : "bg-[#eae8e0] text-[#414942] hover:bg-[#e4e3db]"
                                    }`}>
                                    <span>{tab.label}</span>
                                    {tabItemCount > 0 ?
                                        <span
                                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                                activeTabId === tab.id ? "bg-white/20 text-white" : "bg-[#356647]/15 text-[#356647]"
                                            }`}>
                                            {tabItemCount}
                                        </span>
                                    :   null}
                                    {tabHasCustomer ?
                                        <span
                                            className={`material-symbols-outlined text-[14px] ${activeTabId === tab.id ? "text-white/90" : "text-[#356647]"}`}
                                            title="Đã chọn khách">
                                            person
                                        </span>
                                    :   null}
                                    {tabs.length > 1 ?
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                requestCloseTab(tab.id);
                                            }}
                                            className="ml-1 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10"
                                            aria-label={`Đóng ${tab.label}`}>
                                            <Icon className="text-[16px] opacity-80">close</Icon>
                                        </button>
                                    :   null}
                                </div>
                            );
                        })}

                        <button type="button" onClick={addTab} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[#356647] transition-colors hover:bg-[#356647]/10">
                            <Icon>add</Icon>
                        </button>
                    </div>

                    <div className="ml-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowEndOfDayModal(true)}
                            className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#356647] transition-colors hover:bg-[#356647]/10"
                            title={isTakeaway ? 'Báo cáo chốt ca COD / mang đi' : 'Xem báo cáo chốt ca và in phiếu K80'}>
                            <Icon className="text-[16px]">summarize</Icon>
                            <span className="hidden sm:inline">{isTakeaway ? 'Báo cáo COD' : 'Báo cáo ca'}</span>
                        </button>
                    </div>
                </div>

                {showCashSessionUi ? (
                  <div className="mt-1.5 min-w-0">
                    <PosCashSessionBar
                      dayStartDone={Boolean(shelfDayStatus.dayStartDone)}
                      dayEndDone={Boolean(shelfDayStatus.dayEndDone)}
                      onCashOpened={() => setCashSessionOpen(true)}
                      sellerName={authSession?.username || ''}
                      sellerRole={(authSession?.roles || []).join(', ')}
                      shiftSlotId={shelfOnDuty?.slotId || null}
                      shiftLabel={shelfOnDuty?.bypassed ? null : undefined}
                      onRequestDayEnd={
                        canViewAllOrders(authSession)
                          ? undefined
                          : () => setDayEndRequested(true)
                      }
                    />
                  </div>
                ) : null}
            </header>

            <ResizableSplitPane
                storageKey="hvt-pos-panel-ratio"
                defaultRatio={0.38}
                minStartPx={380}
                minEndPx={520}
                fallbackMinStartPx={300}
                fallbackMinEndPx={400}
                className="grid-cols-1 lg:grid-rows-1"
                startClassName="flex min-h-0 flex-col border-t border-[#c1c9c0] bg-[#f6f4ec] lg:border-t-0 lg:shadow-[4px_0_20px_rgba(0,0,0,0.04)] max-lg:min-h-[36vh]"
                endClassName="flex min-h-0 flex-col bg-white text-base max-lg:min-h-[40vh]"
                startPanel={
                <div className="flex min-h-0 flex-1 flex-col bg-white">
                        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Giỏ hàng</p>
                            <span className="shrink-0 text-xs text-[#717971]">
                                {cartItems.length + customBundles.length} SP · {activeTab.label}
                            </span>
                        </div>

                        {hasPendingQrOrder ?
                            <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#7e5700]/35 bg-[#fec25b]/15 px-3 py-2.5">
                                <p className="text-xs font-medium text-[#604100]">
                                    Giỏ này đang có đơn chuyển khoản chờ xử lý.
                                </p>
                                <button
                                    type="button"
                                    onClick={resumePendingQrPayment}
                                    className="shrink-0 rounded-lg bg-[#7e5700] px-3 py-2 text-xs font-bold text-white hover:bg-[#604100]">
                                    Mở lại QR
                                </button>
                            </div>
                        :   null}

                        <CustomScrollArea className="min-h-[120px] flex-1" contentClassName="px-3 pb-3">
                            {!hasCartItems ?
                                <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c1c9c0]/80 bg-[#f6f4ec]/40 p-5 text-center">
                                    <Icon className="mb-2 text-[44px] text-[#717971]/50">shopping_cart</Icon>
                                    <p className="text-sm font-semibold text-[#414942]">Giỏ hàng trống</p>
                                    <p className="mt-1 text-xs text-[#717971]">Chọn sản phẩm bên phải để thêm.</p>
                                </div>
                            :   <div className="space-y-2">
                                    {customBundles.map((bundle, bundleIndex) => {
                                        const bundleTotal = (bundle.ingredients ?? []).reduce(
                                            (s, ing) => s + (Number(ing.subTotal) || Number(ing.unitPrice) * Number(ing.quantity) || 0),
                                            0,
                                        );
                                        return (
                                            <div
                                                key={`bundle-${bundleIndex}`}
                                                className="relative rounded-xl border border-[#356647]/30 bg-[#f0f5f1] px-3 py-2.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1b1c17]">
                                                            <Icon className="text-[18px] text-[#356647]">blender</Icon>
                                                            {bundle.label || "Gói trà tự chọn"}
                                                        </p>
                                                        <ul className="mt-1 space-y-0.5">
                                                            {(bundle.ingredients ?? []).map((ing, ingIndex) => (
                                                                <li key={`bundle-${bundleIndex}-ing-${ingIndex}`} className="truncate text-xs text-[#717971]">
                                                                    {ing.materialSnapshotName} × {ing.quantity} — {formatMoney(Number(ing.subTotal) || Number(ing.unitPrice) * Number(ing.quantity) || 0)} đ
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                                        <span className="text-sm font-bold text-[#356647]">{formatMoney(bundleTotal)} đ</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateActiveSession({ customBundles: customBundles.filter((_, i) => i !== bundleIndex) })}
                                                            className="p-1 text-[#ba1a1a] opacity-60 hover:opacity-100"
                                                            aria-label="Xóa gói">
                                                            <Icon className="text-[20px]">close</Icon>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {cartItems.map((item) => {
                                        const lineGross = getLineGross(item);
                                        const lineTotal = getLineTotal(item);
                                        const isPercent = item.lineDiscountType !== "amount";
                                        const isDiscountOpen = openDiscountSku === item.sku;
                                        const discountLabel = formatLineDiscountLabel(item);
                                        const lineDiscountCapHint =
                                            isPercent ? "Tối đa 100%"
                                            : lineGross > 0 ? `Tối đa ${formatMoney(lineGross)} đ`
                                            : "Thành tiền dòng: 0 đ";
                                        const titleName = String(item.productName || item.name || "").trim();
                                        const variantLabel = String(item.packagingType || "").trim();
                                        const showVariant =
                                            Boolean(variantLabel)
                                            && variantLabel.toLowerCase() !== titleName.toLowerCase();

                                        return (
                                            <div
                                                key={item.sku}
                                                className={`relative rounded-xl border bg-[#fbf9f1] px-2.5 py-2.5 sm:px-3 sm:py-3 ${
                                                    item.isUnavailable ? "border-[#ba1a1a]/60" : "border-[#c1c9c0]/50"
                                                }`}>
                                                <div className="flex items-start gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className="line-clamp-2 text-sm font-semibold leading-snug text-[#1b1c17] sm:text-base"
                                                            title={item.name}>
                                                            {titleName || item.name}
                                                            {item.isGift ?
                                                                <span className="ml-1.5 inline-block rounded-full bg-[#fff8e8] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-[#7e5700]">
                                                                    Quà
                                                                </span>
                                                            :   null}
                                                            {item.isUnavailable ?
                                                                <span className="ml-1.5 inline-block rounded-full bg-[#ba1a1a]/10 px-1.5 py-0.5 align-middle text-[10px] font-bold text-[#ba1a1a]">
                                                                    {item.availabilityIssue === "catalog_error" ? "Chưa xác thực" : "Ngừng bán"}
                                                                </span>
                                                            :   null}
                                                        </p>
                                                        {showVariant ?
                                                            <p className="mt-0.5 truncate text-xs text-[#717971]" title={variantLabel}>
                                                                {variantLabel}
                                                            </p>
                                                        :   null}
                                                        <p className="mt-0.5 text-xs leading-snug text-[#717971] sm:text-sm">
                                                            {item.isGift ?
                                                                <span className="line-through opacity-60">{formatMoney(item.price)} đ</span>
                                                            :   <span>
                                                                    {formatMoney(item.price)} đ/{item.unit}
                                                                </span>}
                                                            <span
                                                                className={`ml-1.5 text-[11px] sm:text-xs ${
                                                                    Number(item.stockQuantity) <= 0 ? "font-semibold text-[#7e5700]" : ""
                                                                }`}>
                                                                {formatCompactStock(item.stockQuantity)}
                                                            </span>
                                                            {discountLabel ?
                                                                <span className="ml-1.5 text-[11px] font-semibold text-[#7e5700] sm:text-xs">
                                                                    {discountLabel}
                                                                </span>
                                                            :   null}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.sku)}
                                                        className="shrink-0 p-1 text-[#ba1a1a] opacity-60 hover:opacity-100"
                                                        aria-label="Xóa">
                                                        <Icon className="text-[22px]">close</Icon>
                                                    </button>
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex w-[7.75rem] shrink-0 items-center overflow-hidden rounded-lg border border-[#c1c9c0] text-sm sm:text-base">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.sku, "dec")}
                                                            className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white">
                                                            -
                                                        </button>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            aria-label={`Số lượng ${item.name}`}
                                                            className="w-[2.75rem] border-x border-[#c1c9c0] bg-white px-0.5 py-1 text-center text-sm font-semibold tabular-nums outline-none focus:bg-[#f6f4ec] focus:ring-1 focus:ring-[#356647]/30 sm:w-[3.25rem] sm:px-1 sm:text-base"
                                                            value={item.qty}
                                                            onChange={(event) => setLineQuantity(item.sku, event.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.sku, "inc")}
                                                            className="px-2.5 py-1.5 text-lg font-bold text-[#356647] hover:bg-white">
                                                            +
                                                        </button>
                                                    </div>

                                                    <div className="relative flex shrink-0 items-center justify-end gap-1">
                                                        {canUseVipManualAdjustments ?
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleLineGift(item.sku)}
                                                                className={`rounded-lg px-1.5 py-1 text-[10px] font-bold uppercase ${
                                                                    item.isGift ? "bg-[#7e5700] text-white" : "border border-[#7e5700]/40 text-[#7e5700] hover:bg-[#fff8e8]"
                                                                }`}
                                                                title="Đánh dấu quà tặng VIP">
                                                                Quà
                                                            </button>
                                                        :   null}
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.stopPropagation()}
                                                            onClick={() => {
                                                                if (!canUseVipManualAdjustments || item.isGift) return;
                                                                setOpenDiscountSku(isDiscountOpen ? null : item.sku);
                                                            }}
                                                            className={`whitespace-nowrap rounded-lg px-1.5 py-1 text-right text-sm font-bold tabular-nums transition-colors sm:text-base ${
                                                                item.isGift ? "text-[#7e5700]"
                                                                : isDiscountOpen ? "bg-[#356647] text-white"
                                                                : "text-[#356647] hover:bg-[#356647]/10"
                                                            }`}
                                                            title={
                                                                item.isGift ? "Dòng quà tặng"
                                                                : canUseVipManualAdjustments ? "Bấm để chỉnh chiết khấu"
                                                                : "Chiết khấu chỉ dành khách VIP"
                                                            }>
                                                            {item.isGift ? "0" : formatMoney(lineTotal)} đ
                                                        </button>

                                                        {isDiscountOpen && canUseVipManualAdjustments && !item.isGift ?
                                                            <div
                                                                ref={discountPopoverRef}
                                                                onMouseDown={(event) => event.stopPropagation()}
                                                                className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-[#c1c9c0] bg-white p-3 shadow-xl">
                                                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#717971]">Chiết khấu dòng</p>
                                                                <div className="flex overflow-hidden rounded-lg border border-[#c1c9c0]">
                                                                    <div className="flex shrink-0 border-r border-[#c1c9c0]">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateLineDiscountType(item.sku, "percent")}
                                                                            className={`px-3 py-2 text-xs font-bold ${
                                                                                isPercent ? "bg-[#356647] text-white" : "text-[#717971] hover:bg-[#f6f4ec]"
                                                                            }`}>
                                                                            %
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateLineDiscountType(item.sku, "amount")}
                                                                            className={`px-3 py-2 text-xs font-bold ${
                                                                                !isPercent ? "bg-[#356647] text-white" : "text-[#717971] hover:bg-[#f6f4ec]"
                                                                            }`}>
                                                                            VNĐ
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type={isPercent ? "number" : "text"}
                                                                        inputMode="numeric"
                                                                        min={isPercent ? 0 : undefined}
                                                                        max={isPercent ? 100 : undefined}
                                                                        className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                                                                        placeholder={isPercent ? "Nhập %" : "Nhập VNĐ"}
                                                                        autoFocus
                                                                        value={
                                                                            isPercent ? item.lineDiscountValue || ""
                                                                            : item.lineDiscountValue ?
                                                                                formatMoney(item.lineDiscountValue)
                                                                            :   ""
                                                                        }
                                                                        onChange={(event) => updateLineDiscountValue(item.sku, event.target.value)}
                                                                    />
                                                                </div>
                                                                <p className="mt-2 text-[11px] text-[#717971]">{lineDiscountCapHint}</p>
                                                            </div>
                                                        :   null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            }
                        </CustomScrollArea>

                        <div className="shrink-0 border-t border-[#c1c9c0]/50 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#717971]" htmlFor="cart-order-note">
                                    <Icon className="shrink-0 text-[18px]">edit_note</Icon>
                                    <input
                                        id="cart-order-note"
                                        type="text"
                                        maxLength={500}
                                        aria-label="Ghi chú đơn hàng"
                                        placeholder="Lý do chiết khấu, ghi chú nội bộ, yêu cầu của khách..."
                                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1b1c17] outline-none placeholder:text-[#717971]"
                                        value={orderNote}
                                        onChange={(event) => updateActiveSession({ orderNote: event.target.value })}
                                    />
                                </label>
                                <div className="flex shrink-0 items-center gap-2 text-sm text-[#717971]">
                                    <span>Tổng tiền hàng</span>
                                    <span>{cartItemQuantity}</span>
                                    <span className="font-bold text-[#1b1c17]">{formatMoney(subtotalAfterItemDiscount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                }
                endPanel={
                <>
                    <div className="relative z-30 shrink-0 overflow-visible border-b border-[#c1c9c0]/60 bg-[#f6f4ec] px-4 py-3">
                        <div className="flex items-start gap-2">
                            {selectedCustomer ?
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setOpenModal("customer-detail")}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setOpenModal("customer-detail");
                                        }
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-3 py-2 text-left shadow-sm">
                                    <Icon className="shrink-0 text-[20px] text-[#356647]">person</Icon>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#1b1c17]">{selectedCustomer.fullName}</p>
                                        <p className="truncate text-xs text-[#717971]">
                                            {selectedCustomer.phone || "—"} · {selectedCustomer.customerCode}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            clearCustomerSelection();
                                        }}
                                        className="shrink-0 rounded-lg border border-[#c1c9c0] px-2 py-1 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec]">
                                        Đổi
                                    </button>
                                </div>
                            :   <div className="relative min-w-0 flex-1">
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
                                            onClick={() => setOpenModal("customer")}
                                            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#356647] text-white hover:bg-[#4e7f5e]"
                                            aria-label="Thêm khách hàng"
                                            title="Thêm khách hàng">
                                            <Icon className="text-[18px]">add</Icon>
                                        </button>
                                    </div>
                                    <select
                                        className="mt-1.5 w-full rounded-lg border border-[#c1c9c0] bg-white px-3 py-1.5 text-xs font-semibold text-[#414942] outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                                        value={customerSearchType}
                                        onChange={(event) => updateActiveSession({ customerSearchType: event.target.value })}
                                        aria-label="Loại khách hàng">
                                        {CUSTOMER_SEARCH_TYPES.map((option) => (
                                            <option key={option.id || "all"} value={option.id}>{option.label}</option>
                                        ))}
                                    </select>
                                    {customerSearchDisplayState === "loading" ?
                                        <p className="mt-1.5 text-xs text-[#717971]">Đang tìm khách hàng...</p>
                                    :   null}
                                    {customerSearchDisplayState === "error" ?
                                        <p className="mt-1.5 text-xs font-medium text-[#a63d2f]" role="alert">{customerSearchError}</p>
                                    :   null}
                                    {showCustomerDropdown ?
                                        <div className="custom-scrollbar absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-2xl">
                                            {customerSearchResults.map((customer) => (
                                                <button
                                                    key={customer.customerId}
                                                    type="button"
                                                    onClick={() => selectCustomer(customer)}
                                                    className="flex w-full flex-col border-b border-[#f0eee6] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f6f4ec]">
                                                    <span className="text-sm font-semibold text-[#1b1c17]">{customer.fullName}</span>
                                                    <span className="text-xs text-[#717971]">
                                                        {customer.phone || "—"} · {customer.customerCode}
                                                        {Number(customer.currentDebt) > 0 ? ` · Nợ ${formatMoney(customer.currentDebt)} đ` : ""}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    :   null}
                                    {showCustomerSearchEmpty ?
                                        <p className="mt-1.5 text-xs text-[#717971]">Không tìm thấy khách hàng.</p>
                                    :   null}
                                </div>
                            }

                            <div ref={priceFilterRef} className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsPriceFilterOpen((open) => !open)}
                                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                        priceFilter ?
                                            "border-[#356647] bg-[#356647]/10 text-[#356647]"
                                        :   "border-[#c1c9c0] bg-white text-[#717971] hover:border-[#356647]/40 hover:text-[#356647]"
                                    }`}
                                    title={selectedPriceFilterLabel ? `Giá: ${selectedPriceFilterLabel}` : "Lọc / sắp xếp theo giá"}
                                    aria-label="Lọc theo giá">
                                    <Icon className="text-[22px]">sell</Icon>
                                    {priceFilter ?
                                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#356647] ring-2 ring-[#f6f4ec]" />
                                    :   null}
                                </button>
                                {isPriceFilterOpen ?
                                    <div className="custom-scrollbar absolute right-0 top-full z-50 mt-1 w-56 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white p-2 shadow-2xl">
                                        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#717971]">Giá</p>
                                        {PRICE_FILTER_OPTIONS.map((option) => (
                                            <button
                                                key={option.id || "all"}
                                                type="button"
                                                onClick={() => {
                                                    setPriceFilter(option.id);
                                                    setIsPriceFilterOpen(false);
                                                }}
                                                className={`mb-0.5 flex w-full rounded-lg px-3 py-2 text-left text-sm font-semibold last:mb-0 ${
                                                    priceFilter === option.id ? "bg-[#356647] text-white" : "text-[#414942] hover:bg-[#f6f4ec]"
                                                }`}>
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                :   null}
                            </div>

                            {posCategories.length > 0 ?
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCategoryFilterSidebarOpen(true);
                                        setIsPriceFilterOpen(false);
                                    }}
                                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                        selectedCategoryIds.length > 0 ?
                                            "border-[#356647] bg-[#356647]/10 text-[#356647]"
                                        :   "border-[#c1c9c0] bg-white text-[#717971] hover:border-[#356647]/40 hover:text-[#356647]"
                                    }`}
                                    title={selectedCategorySummary ? `Lọc: ${selectedCategorySummary}` : "Lọc theo nhóm hàng"}
                                    aria-label="Lọc theo nhóm hàng">
                                    <Icon className="text-[22px]">filter_list</Icon>
                                    {selectedCategoryIds.length > 0 ?
                                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#356647] ring-2 ring-[#f6f4ec]" />
                                    :   null}
                                </button>
                            :   null}
                        </div>
                    </div>

                    {(selectedCategoryIds.length > 0 || priceFilter) ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#c1c9c0]/40 bg-[#f6f4ec] px-3 py-2">
                            {selectedCategoryIds.map((id) => {
                                const category = posCategories.find((item) => Number(item.id) === Number(id))
                                const name = category?.name || `DM ${id}`
                                return (
                                    <button
                                        key={`cat-${id}`}
                                        type="button"
                                        onClick={() => setSelectedCategoryIds((prev) => prev.filter((item) => Number(item) !== Number(id)))}
                                        className="inline-flex items-center gap-1 rounded-full border border-[#356647]/30 bg-white px-2.5 py-1 text-xs font-semibold text-[#356647]"
                                    >
                                        {name}
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                )
                            })}
                            {priceFilter ? (
                                <button
                                    type="button"
                                    onClick={() => setPriceFilter('')}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#356647]/30 bg-white px-2.5 py-1 text-xs font-semibold text-[#356647]"
                                >
                                    {selectedPriceFilterLabel || 'Giá'}
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategoryIds([])
                                    setPriceFilter('')
                                }}
                                className="ml-auto text-xs font-semibold text-[#717971] underline hover:text-[#356647]"
                            >
                                Xóa lọc
                            </button>
                        </div>
                    ) : null}

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="flex min-h-0 flex-1 flex-col bg-white">
                            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#c1c9c0]/40 px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPosTab('products')}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${posTab === 'products' ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'}`}>
                                        Thành phẩm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPosTab('bundles')}
                                        className={`relative rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${posTab === 'bundles' ? 'bg-[#356647] text-white' : 'text-[#717971] hover:bg-[#f6f4ec]'}`}>
                                        Nguyên liệu
                                        {customBundles.length > 0 ?
                                            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#7e5700] text-[9px] font-bold text-white">
                                                {customBundles.length}
                                            </span>
                                        :   null}
                                    </button>
                                </div>
                                {posTab === 'products' ?
                                    <div className="flex shrink-0 items-center gap-2">
                                        {filteredSearchProducts.length > 0 ?
                                            <div className="flex items-center overflow-hidden rounded-lg border border-[#c1c9c0] bg-white text-xs font-semibold text-[#414942]">
                                                <button
                                                    type="button"
                                                    onClick={() => setProductPage((page) => Math.max(1, page - 1))}
                                                    disabled={isSearchLoading || productPage <= 1}
                                                    className="flex size-7 items-center justify-center hover:bg-[#f6f4ec] disabled:cursor-not-allowed disabled:text-[#a4aaa3]"
                                                    aria-label="Trang sản phẩm trước">
                                                    <Icon className="text-[16px]">chevron_left</Icon>
                                                </button>
                                                <span className="min-w-[44px] border-x border-[#f0eee6] px-2 text-center tabular-nums">
                                                    {Math.min(productPage, productTotalPages)} / {productTotalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setProductPage((page) => Math.min(productTotalPages, page + 1))}
                                                    disabled={isSearchLoading || productPage >= productTotalPages}
                                                    className="flex size-7 items-center justify-center hover:bg-[#f6f4ec] disabled:cursor-not-allowed disabled:text-[#a4aaa3]"
                                                    aria-label="Trang sản phẩm sau">
                                                    <Icon className="text-[16px]">chevron_right</Icon>
                                                </button>
                                            </div>
                                        :   null}
                                        {canSyncCatalog ?
                                        <button
                                            type="button"
                                            onClick={handleRefreshCatalog}
                                            disabled={isSearchLoading || isCatalogSyncing}
                                            className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#356647] hover:bg-[#f0eee6] disabled:opacity-50"
                                            title="Tải DM/SP/SKU mới từ kho sang cửa hàng">
                                            <Icon className={`text-[16px] ${isCatalogSyncing ? "animate-spin" : ""}`}>sync</Icon>
                                            {isCatalogSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
                                            {pendingCatalogSync > 0 && !isCatalogSyncing ?
                                                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">{pendingCatalogSync}</span>
                                            :   null}
                                        </button>
                                        : null}
                                        <span className="text-xs text-[#717971]">{filteredSearchProducts.length} SP</span>
                                    </div>
                                :   null}
                            </div>

                            {posTab === 'bundles' ?
                                <CustomScrollArea className="flex-1" contentClassName="p-4">
                                    <CustomBundlePanel
                                        bundles={customBundles}
                                        onChange={(b) => updateActiveSession({ customBundles: b })}
                                    />
                                </CustomScrollArea>
                            :
                                <CustomScrollArea className="flex-1" contentClassName="px-2.5 py-2">
                                    {isSearchLoading ?
                                        <LoadingIndicator label="Đang tải sản phẩm..." className="min-h-[220px]" />
                                    : filteredSearchProducts.length === 0 ?
                                        <p className="px-1 py-3 text-sm text-[#717971]">
                                            {hasSearchQuery || selectedCategoryIds.length > 0 || priceFilter ?
                                                "Không tìm thấy sản phẩm phù hợp."
                                            :   "Chưa có sản phẩm để hiển thị."}
                                        </p>
                                    :   <div className="grid auto-rows-max grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                            {visibleProductPageItems.map((item) => {
                                                const outOfStock = Number(item.stockQuantity) <= 0;
                                                const lowStock = outOfStock || Number(item.stockQuantity) <= 5;
                                                const titleName = String(item.productName || item.name || "").trim();
                                                const variantLabel = String(item.packagingType || "").trim();
                                                const showVariant =
                                                    Boolean(variantLabel)
                                                    && variantLabel.toLowerCase() !== titleName.toLowerCase();
                                                return (
                                                    <button
                                                        key={`${item.productId}-${item.sku}`}
                                                        type="button"
                                                        onClick={() => addToCart(item)}
                                                        className="flex w-full items-start gap-2 rounded-xl border border-[#c1c9c0]/50 bg-[#fbf9f1] p-2 text-left transition-colors hover:border-[#356647]/35 hover:bg-[#f6f4ec]">
                                                        <ProductImage
                                                            src={item.imageUrl}
                                                            alt={item.name}
                                                            className="h-12 w-12 shrink-0 rounded-lg"
                                                            iconClassName="text-[22px]"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p
                                                                className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#1b1c17]"
                                                                title={item.name}>
                                                                {titleName || item.name}
                                                            </p>
                                                            {showVariant ?
                                                                <p className="mt-0.5 truncate text-[11px] leading-snug text-[#717971]" title={variantLabel}>
                                                                    {variantLabel}
                                                                </p>
                                                            :   null}
                                                            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                                <span className="text-[13px] font-bold tabular-nums text-[#356647]">
                                                                    {formatMoney(item.price)} đ
                                                                </span>
                                                                <span
                                                                    className={`text-[11px] leading-tight ${
                                                                        lowStock ? "font-semibold text-[#7e5700]" : "text-[#717971]"
                                                                    }`}>
                                                                    {formatCompactStock(item.stockQuantity)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    }
                                </CustomScrollArea>
                            }
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-[#c1c9c0] bg-[#f6f4ec] p-4">
                        <button
                            type="button"
                            disabled={!hasCartItems}
                            onClick={openPaymentSidebar}
                            className="flex w-full flex-col items-center justify-center rounded-xl bg-[#356647] py-3.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50">
                            <span className="text-[10px] opacity-70">F12</span>
                            Thanh toán
                        </button>
                    </div>
                </>
                }
            />

      <PosPaymentSidebar
        isOpen={isPaymentSidebarOpen}
        onClose={() => {
          setIsPaymentSidebarOpen(false)
          setIsPaymentConfirmOpen(false)
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
        onPaymentMethodChange={(id) =>
          updateActiveSession({
            paymentMethod: id,
            amountPaidInput: id === paymentMethod ? amountPaidInput : '',
            debtSettlement: null,
            overpaymentAction: 'return_change',
          })
        }
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
        confirmedDebtAllocationAmount={confirmedDebtAllocation}
        isDebtSale={isDebtSale}
        isPartialPayment={isPartialPayment}
        isTransferQrFlow={isTransferQrFlow}
        onQuickAmount={handleQuickAmount}
        onConfirm={handlePayment}
        isSubmitting={isSubmitting}
        canPay={canPay}
        onOpenCustomerDetail={() => setOpenModal('customer-detail')}
        onClearCustomer={clearCustomerSelection}
        shippingAddress={shippingAddress}
        onShippingAddressChange={(value) => updateActiveSession({ shippingAddress: value })}
        savedShippingAddresses={savedShippingAddresses}
        useCustomShippingAddress={useCustomShippingAddress}
        onSavedShippingAddressChange={handleSavedShippingAddressChange}
        isLoadingShippingAddresses={isLoadingShippingAddresses}
        onRefreshShippingAddresses={refreshShippingAddresses}
        onAddShippingAddress={
          canCreateCustomer(authSession)
            ? () => setOpenModal('customer-address')
            : undefined
        }
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
        cartItemLines={cartItemLines}
      />

      <PosPaymentConfirmModal
        isOpen={isPaymentConfirmOpen}
        onClose={() => setIsPaymentConfirmOpen(false)}
        onConfirm={handleConfirmPayment}
        isSubmitting={isSubmitting}
        formatMoney={formatMoney}
        cartItemLines={cartItemLines}
        grossSubtotal={grossSubtotal}
        itemDiscountTotal={itemDiscountTotal}
        orderDiscountAmount={orderDiscountAmount}
        orderDiscountPercent={orderDiscountPercent}
        usesFixedOrderDiscount={usesFixedOrderDiscount}
        couponDiscountAmount={couponDiscountAmount}
        membershipDiscountAmount={membershipDiscountAmount}
        totalDiscount={totalDiscount}
        total={total}
        selectedCustomer={selectedCustomer}
        paymentMethodLabel={selectedPaymentMethodLabel}
        appliedPromotion={appliedPromotion}
        appliedPromotionScopeText={appliedPromotionScopeText}
        orderNote={orderNote}
      />

      {backorderPrompt ? (
        <BackorderConfirmModal
          isOpen
          message={backorderPrompt.message}
          lines={backorderPrompt.lines || []}
          availableQuantity={backorderPrompt.availableQuantity || 0}
          backorderQuantity={backorderPrompt.backorderQuantity || 0}
          estimatedReadyFrom={backorderPrompt.estimatedReadyFrom || null}
          selectedCustomer={selectedCustomer}
          orderTotal={total}
          isSubmitting={isSubmitting}
          onAccept={handleBackorderAccept}
          onDecline={handleBackorderDecline}
        />
      ) : null}

      {showEndOfDayModal ? (
        <EndOfDayReportModal
          onClose={() => setShowEndOfDayModal(false)}
          sellerName={authSession?.username || ''}
          sellerRole={(authSession?.roles || []).join(', ') || '—'}
          channel={isTakeaway ? 'COD' : 'POS'}
          variant={isTakeaway ? 'cod' : 'shift'}
          onDutyShift={shelfOnDuty}
          cashSession={loadOpenCashSession()}
        />
      ) : null}

            <footer className="shrink-0 border-t border-[#d8d6ce] bg-white px-4">
                <div className="flex items-end justify-between gap-4">
                    <div className="flex items-end gap-8">
                        {allowedSalesModes.map((mode) => {
                            const isActive = salesMode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => {
                                        setSalesMode(mode.id);
                                        setOpenDiscountSku(null);
                                        setIsPaymentSidebarOpen(false);
                                        setIsPaymentConfirmOpen(false);
                                    }}
                                    className={`relative flex items-center gap-2 px-1 pb-3 pt-3.5 text-sm font-semibold transition-colors ${
                                        isActive ? "text-[#356647]" : "text-[#5c635c] hover:text-[#1b1c17]"
                                    }`}>
                                    <Icon className="text-[22px]" filled={isActive}>
                                        {mode.icon}
                                    </Icon>
                                    <span>{mode.label}</span>
                                    {isActive ?
                                        <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-[#356647]" aria-hidden />
                                    :   null}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpenModal("return-order")}
                        className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-4 py-2 text-sm font-semibold text-[#356647] transition hover:bg-[#356647]/10">
                        <Icon className="text-[20px]">assignment_return</Icon>
                        Trả hàng
                    </button>
                </div>
            </footer>

            <AddCustomerAddressModal
                isOpen={openModal === "customer-address"}
                onClose={() => setOpenModal(null)}
                customerId={selectedCustomer?.customerId}
                customerName={selectedCustomer?.fullName || ""}
                customerPhone={selectedCustomer?.phone || ""}
                makeDefault={savedShippingAddresses.length === 0}
                onSaved={(created) => {
                    const line = [
                        created?.addressLine,
                        created?.ward,
                        created?.district,
                        created?.province,
                    ]
                        .filter(Boolean)
                        .join(", ")
                        .trim();
                    setOpenModal(null);
                    refreshShippingAddresses(line || null);
                }}
            />
            <AddCustomerModal
                isOpen={openModal === "customer"}
                initialPhone={customerSearchValue}
                onClose={() => setOpenModal(null)}
                onSaved={(customer) => {
                    selectCustomer(customer);
                    setOpenModal(null);
                }}
            />
            <OrderOfferModal
                isOpen={openModal === "offer"}
                initialPercent={orderDiscountPercent}
                initialFixedAmount={orderDiscountAmountFixed}
                maxFixedAmount={subtotalAfterItemDiscount}
                onClose={() => setOpenModal(null)}
                onConfirm={({ percent, fixedAmount, warning }) => {
                    const result = normalizeOrderDiscountInput({
                        percent,
                        fixedAmount,
                        subtotalAfterItemDiscount,
                    });
                    if (!result.ok) {
                        showError(result.error);
                        return;
                    }
                    updateActiveSession({
                        orderDiscountPercent: result.orderDiscountPercent,
                        orderDiscountAmountFixed: result.orderDiscountAmountFixed,
                    });
                    if (warning || result.warning) {
                        showError(warning || result.warning);
                    }
                    setOpenModal(null);
                }}
            />
            <CustomerDetailModal
                isOpen={openModal === "customer-detail"}
                customer={selectedCustomer}
                onClose={() => setOpenModal(null)}
                onCustomerUpdated={(updated) => {
                    updateActiveSession({ selectedCustomer: updated });
                }}
            />
            <ConfirmDialog
                isOpen={Boolean(tabCloseConfirm)}
                title="Xóa tab hóa đơn?"
                message={tabCloseConfirm ? `Bạn có chắc muốn đóng "${tabCloseConfirm.label}"? Giỏ hàng và thông tin khách trên tab này sẽ bị xóa.` : ""}
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
                isOpen={openModal === "return-order"}
                onClose={() => setOpenModal(null)}
                onSelectOrder={(order) => {
                    setOpenModal(null);
                    navigate(`/pos/returns/${order.id}`);
                }}
                onQuickReturn={() => {
                    setOpenModal(null);
                    showError("Trả nhanh (không chọn hóa đơn) sẽ được bổ sung sau.");
                }}
            />
            <PosCategoryFilterSidebar
                isOpen={isCategoryFilterSidebarOpen}
                categories={posCategories}
                selectedIds={selectedCategoryIds}
                onClose={() => setIsCategoryFilterSidebarOpen(false)}
                onSkip={() => setIsCategoryFilterSidebarOpen(false)}
                onConfirm={(ids) => {
                    setSelectedCategoryIds(ids);
                    setIsCategoryFilterSidebarOpen(false);
                }}
            />
        </div>
        </PosShiftDutyGate>
    );
}

export default PosPage;
