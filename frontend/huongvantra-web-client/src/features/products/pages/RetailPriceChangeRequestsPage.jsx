import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import { TitleInfoButton } from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { isAccountantRole, isSystemAdmin } from '../../auth/utils/permissions.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'
import { formatVnd } from '../../../utils/vietnamCurrency.js'
import { fetchStoreProducts } from '../services/productsApi.js'
import {
  approveRetailPriceChangeRequest,
  cancelRetailPriceChangeRequest,
  createRetailPriceChangeRequest,
  fetchRetailPriceChangeRequests,
  rejectRetailPriceChangeRequest,
} from '../services/retailPriceChangeApi.js'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PendingApproval', label: 'Chờ Admin duyệt' },
  { value: 'Approved', label: 'Đã duyệt' },
  { value: 'Rejected', label: 'Bị từ chối' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]))

function normalizeText(value) {
  return String(value ?? '').trim()
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '—'
}

function statusClassName(status) {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'PendingApproval') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (status === 'Cancelled') return 'bg-slate-100 text-slate-500 border-slate-200'
  return 'bg-sky-50 text-sky-700 border-sky-200'
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase()
}

function flattenSellableVariants(products) {
  const rows = []
  products.forEach((product) => {
    ;(product.variants ?? []).forEach((variant) => {
      if (variant.isActive === false) return
      rows.push({
        id: String(variant.id),
        skuCode: variant.skuCode || '',
        productName: product.name || '',
        variantName: variant.variantName || '',
        retailPrice: Number(variant.retailPrice ?? 0),
        searchText: `${product.name} ${variant.skuCode} ${variant.variantName}`.toLowerCase(),
      })
    })
  })
  return rows
}

export default function RetailPriceChangeRequestsPage() {
  const session = useAuthSession()
  const canAdmin = isSystemAdmin(session)
  const canCreate = isAccountantRole(session)
  const formRef = useRef(null)
  const [variants, setVariants] = useState([])
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [variantSearchInput, setVariantSearchInput] = useState('')
  const [selectedSkuId, setSelectedSkuId] = useState('')
  const [requestedPrice, setRequestedPrice] = useState('')
  const [reason, setReason] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [variantLoadError, setVariantLoadError] = useState('')

  const loadRequests = useCallback(async () => {
    const result = await fetchRetailPriceChangeRequests({
      status: statusFilter,
      search: searchInput,
      page: 1,
      pageSize: 50,
    })
    setRequests(result.items ?? [])
  }, [searchInput, statusFilter])

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    setVariantLoadError('')
    try {
      const productPromise = fetchStoreProducts({ isActive: true, page: 1, pageSize: 100 }).catch((error) => {
        setVariantLoadError(error.message)
        return { items: [] }
      })
      const [productResult] = await Promise.all([productPromise, loadRequests()])
      setVariants(flattenSellableVariants(productResult.items ?? []))
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [loadRequests])

  useEffect(() => {
    const timer = window.setTimeout(() => loadInitialData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadInitialData])

  const filteredVariants = useMemo(() => {
    const keyword = variantSearchInput.trim().toLowerCase()
    if (!keyword) return variants
    return variants.filter((variant) => variant.searchText.includes(keyword))
  }, [variantSearchInput, variants])

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedSkuId) ?? null,
    [selectedSkuId, variants],
  )

  const parsedRequestedPrice = Number(requestedPrice)
  const isFormReady =
    Boolean(selectedSkuId) &&
    Number.isFinite(parsedRequestedPrice) &&
    parsedRequestedPrice > 0 &&
    Boolean(normalizeText(reason))

  function isOwnRequest(request) {
    const actorId = normalizeId(session?.userId ?? session?.id)
    const createdBy = normalizeId(request?.createdBy)
    return Boolean(actorId && createdBy && actorId === createdBy)
  }

  function canCancelRequest(request) {
    if (request?.status !== 'PendingApproval') return false
    return canAdmin || (canCreate && isOwnRequest(request))
  }

  function resetForm() {
    setSelectedSkuId('')
    setRequestedPrice('')
    setReason('')
    setVariantSearchInput('')
  }

  function openNewRequestForm() {
    resetForm()
    setIsFormOpen(true)
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function closeForm() {
    resetForm()
    setIsFormOpen(false)
  }

  async function submitRequest() {
    if (!canCreate || !isFormReady) return
    setIsSaving(true)
    try {
      await createRetailPriceChangeRequest({
        skuId: selectedSkuId,
        requestedRetailPrice: parsedRequestedPrice,
        reason,
      })
      showSuccess('Đã gửi yêu cầu đổi giá bán cho Admin duyệt.')
      closeForm()
      await loadRequests()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAction(request, action) {
    if (action === 'approve' || action === 'reject') {
      if (!canAdmin) return
    } else if (!canCancelRequest(request)) {
      return
    }

    let reasonText = ''
    if (action === 'reject' || action === 'cancel') {
      reasonText = window.prompt(action === 'reject' ? 'Nhập lý do từ chối:' : 'Nhập lý do hủy:') ?? ''
      if (!normalizeText(reasonText)) return
    } else if (
      !window.confirm(
        `Duyệt đổi giá bán ${request.skuCode} từ ${formatVnd(request.currentRetailPrice)} thành ${formatVnd(request.requestedRetailPrice)}?`,
      )
    ) {
      return
    }

    setIsSaving(true)
    try {
      if (action === 'approve') await approveRetailPriceChangeRequest(request.id, '')
      if (action === 'reject') await rejectRetailPriceChangeRequest(request.id, reasonText, '')
      if (action === 'cancel') await cancelRetailPriceChangeRequest(request.id, reasonText)
      showSuccess('Đã cập nhật yêu cầu đổi giá bán.')
      await loadRequests()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#538463]">Product master data</p>
            <div className="mt-2 flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">Yêu cầu đổi giá bán</h1>
              <TitleInfoButton text="Kế toán đề xuất giá bán mới, giá chưa đổi ngay. Admin duyệt thì giá bán mới được áp dụng vào SKU. Giá chào từ nhà cung cấp không ảnh hưởng tới giá bán." />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={openNewRequestForm}
                className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo yêu cầu đổi giá
              </button>
            ) : null}
            <button
              type="button"
              onClick={loadInitialData}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Làm mới
            </button>
          </div>
        </div>

        {canCreate && isFormOpen ? (
          <section ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tạo yêu cầu đổi giá bán</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn SKU, nhập giá bán đề xuất và lý do. Giá chỉ thay đổi sau khi Admin duyệt.
                </p>
              </div>
              <button type="button" onClick={closeForm} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                Đóng
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <input
                  value={variantSearchInput}
                  onChange={(event) => setVariantSearchInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                  placeholder="Tìm SKU theo mã hoặc tên hàng hóa..."
                />
                {variantLoadError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Không thể tải danh sách SKU: {variantLoadError}
                  </div>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                  {filteredVariants.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      {variants.length === 0 ? 'Không có SKU đang hoạt động để chọn.' : 'Không có SKU phù hợp.'}
                    </p>
                  ) : (
                    filteredVariants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedSkuId(variant.id)}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 ${
                          selectedSkuId === variant.id ? 'bg-[#e8f0e9]/60' : ''
                        }`}
                      >
                        <span className="block truncate text-sm font-bold text-slate-800">
                          {variant.skuCode} · {variant.productName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {variant.variantName || 'Mặc định'} · Giá hiện tại {formatVnd(variant.retailPrice)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {selectedVariant ? (
                    <>
                      <p className="font-bold text-slate-900">
                        {selectedVariant.skuCode} · {selectedVariant.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{selectedVariant.variantName || 'Mặc định'}</p>
                      <p className="mt-2 text-slate-700">
                        Giá bán hiện tại: <span className="font-bold">{formatVnd(selectedVariant.retailPrice)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500">Chưa chọn SKU nào.</p>
                  )}
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Giá bán đề xuất (VNĐ)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={requestedPrice}
                    onChange={(event) => setRequestedPrice(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                    placeholder="VD: 150000"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Lý do đổi giá
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-1 h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                    placeholder="VD: Giá nguyên liệu tăng, cần điều chỉnh giá bán..."
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={submitRequest}
                disabled={isSaving || !isFormReady}
                className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-60"
              >
                {isSaving ? 'Đang xử lý...' : 'Gửi Admin duyệt'}
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-bold text-slate-900">Danh sách yêu cầu</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                placeholder="Tìm mã yêu cầu, SKU, hàng hóa..."
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã yêu cầu</th>
                  <th className="px-4 py-3 font-semibold">Hàng hóa</th>
                  <th className="px-4 py-3 font-semibold">Giá hiện tại</th>
                  <th className="px-4 py-3 font-semibold">Giá đề xuất</th>
                  <th className="px-4 py-3 font-semibold">Giá vốn TB</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Người tạo</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Chưa có yêu cầu đổi giá bán nào.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{request.requestCode || '—'}</p>
                        {request.reason ? <p className="mt-0.5 text-xs text-slate-500">{request.reason}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{request.skuCode || '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {request.productName}
                          {request.variantName ? ` · ${request.variantName}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatVnd(request.currentRetailPrice)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatVnd(request.requestedRetailPrice)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatVnd(request.averageCostPriceAtRequest)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${statusClassName(request.status)}`}
                        >
                          {statusLabel(request.status)}
                        </span>
                        {request.rejectReason ? (
                          <p className="mt-1 text-xs text-rose-600">{request.rejectReason}</p>
                        ) : null}
                        {request.appliedAt ? (
                          <p className="mt-1 text-xs text-emerald-700">
                            Áp dụng {formatVnd(request.appliedRetailPrice)} lúc {formatDateTimeVN(request.appliedAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{request.createdByName || '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{request.createdByRoleName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTimeVN(request.updatedAt ?? request.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {canAdmin && request.status === 'PendingApproval' ? (
                            <>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleAction(request, 'approve')}
                                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-60"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleAction(request, 'reject')}
                                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                Từ chối
                              </button>
                            </>
                          ) : null}
                          {canCancelRequest(request) ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleAction(request, 'cancel')}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Hủy
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
