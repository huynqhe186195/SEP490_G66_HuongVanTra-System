import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import { TitleInfoButton } from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { canCreateProductDeletionRequest, canDecideProductApprovals, isWarehouseRole } from '../../auth/utils/permissions.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'
import {
  approveProductDeletionRequest,
  cancelProductDeletionRequest,
  createProductDeletionRequest,
  fetchProductDeletionRequests,
  fetchProducts,
  fetchStoreProducts,
  rejectProductDeletionRequest,
  submitProductDeletionRequest,
  updateProductDeletionRequest,
} from '../services/productsApi.js'
import { getProductTypeLabel } from '../utils/productTypes.js'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'Draft', label: 'Nháp' },
  { value: 'PendingApproval', label: 'Chờ Admin duyệt' },
  { value: 'Rejected', label: 'Bị từ chối' },
  { value: 'Completed', label: 'Đã xóa mềm' },
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
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'PendingApproval') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (status === 'Cancelled') return 'bg-slate-100 text-slate-500 border-slate-200'
  return 'bg-sky-50 text-sky-700 border-sky-200'
}

function productSearchText(product) {
  const skuText = (product.variants ?? []).map((variant) => `${variant.skuCode} ${variant.variantName}`).join(' ')
  return `${product.name} ${product.categoryName} ${product.productType} ${skuText}`.toLowerCase()
}

function variantSummary(product) {
  const variants = product.variants ?? []
  if (!variants.length) return 'Chưa có SKU'
  return variants
    .slice(0, 3)
    .map((variant) => variant.skuCode || variant.variantName)
    .filter(Boolean)
    .join(', ')
}

function itemStatusClassName(status) {
  if (status === 'valid' || status === 'deleted') return 'text-emerald-700'
  if (status === 'blocked') return 'text-rose-700'
  return 'text-slate-500'
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase()
}

export default function ProductDeletionRequestsPage() {
  const session = useAuthSession()
  const canAdmin = canDecideProductApprovals(session)
  const canWarehouse = canCreateProductDeletionRequest(session)
  const formRef = useRef(null)
  const [products, setProducts] = useState([])
  const [requests, setRequests] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [productSearchInput, setProductSearchInput] = useState('')
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [itemReasons, setItemReasons] = useState({})
  const [activeRequestId, setActiveRequestId] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [productLoadError, setProductLoadError] = useState('')

  const loadRequests = useCallback(async () => {
    const result = await fetchProductDeletionRequests({
      status: statusFilter,
      search: searchInput,
      page: 1,
      pageSize: 50,
    })
    setRequests(result.items ?? [])
  }, [searchInput, statusFilter])

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    setProductLoadError('')
    try {
      const fetchProductsFn = isWarehouseRole(session) ? fetchProducts : fetchStoreProducts
      const productPromise = fetchProductsFn({ isActive: true, page: 1, pageSize: 100 })
        .catch((error) => {
          setProductLoadError(error.message)
          showError(`Không thể tải danh sách Product: ${error.message}`)
          return { items: [] }
        })
      const [productResult] = await Promise.all([productPromise, loadRequests()])
      setProducts(productResult.items ?? [])
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

  const productById = useMemo(() => {
    const map = new Map()
    products.forEach((product) => map.set(String(product.id), product))
    return map
  }, [products])

  const filteredProducts = useMemo(() => {
    const keyword = productSearchInput.trim().toLowerCase()
    if (!keyword) return products
    return products.filter((product) => productSearchText(product).includes(keyword))
  }, [productSearchInput, products])

  const selectedProducts = useMemo(
    () => selectedProductIds.map((id) => productById.get(String(id))).filter(Boolean),
    [productById, selectedProductIds],
  )
  const hasDeletionReason = useMemo(
    () =>
      Boolean(normalizeText(reason)) ||
      selectedProductIds.some((productId) => Boolean(normalizeText(itemReasons[String(productId)]))),
    [itemReasons, reason, selectedProductIds],
  )
  const isDeletionFormReady = Boolean(normalizeText(title)) && selectedProductIds.length > 0 && hasDeletionReason

  function isOwnRequest(request) {
    const actorId = normalizeId(session?.userId ?? session?.id)
    const createdBy = normalizeId(request?.createdBy)
    return Boolean(actorId && createdBy && actorId === createdBy)
  }

  function canEditRequest(request) {
    return canWarehouse && ['Draft', 'Rejected'].includes(request?.status) && isOwnRequest(request)
  }

  function scrollFormIntoView() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function resetForm() {
    setActiveRequestId('')
    setTitle('')
    setReason('')
    setSelectedProductIds([])
    setItemReasons({})
  }

  function openNewRequestForm() {
    resetForm()
    setIsFormOpen(true)
    setSelectedRequest(null)
    scrollFormIntoView()
  }

  function closeForm() {
    resetForm()
    setIsFormOpen(false)
  }

  function toggleProduct(productId) {
    setSelectedProductIds((current) => {
      const id = String(productId)
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    })
  }

  function buildPayload() {
    const items = selectedProductIds.map((productId) => ({
      productId,
      reason: itemReasons[productId] || reason,
    }))
    return { title, reason, items }
  }

  function validateDeletionForm() {
    if (!normalizeText(title)) {
      showError('Vui lòng nhập tiêu đề yêu cầu.')
      return false
    }
    if (selectedProductIds.length === 0) {
      showError('Vui lòng chọn ít nhất một Product.')
      return false
    }
    if (!hasDeletionReason) {
      showError('Vui lòng nhập lý do chung hoặc lý do riêng cho Product.')
      return false
    }
    return true
  }

  async function saveDraft() {
    if (!canWarehouse) return
    if (!validateDeletionForm()) return
    setIsSaving(true)
    try {
      const payload = buildPayload()
      const saved = activeRequestId
        ? await updateProductDeletionRequest(activeRequestId, payload)
        : await createProductDeletionRequest(payload)
      setActiveRequestId(saved.id)
      showSuccess('Đã lưu draft yêu cầu xóa hàng hóa.')
      await loadRequests()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function submitRequest() {
    if (!canWarehouse) return
    if (!validateDeletionForm()) return
    setIsSaving(true)
    try {
      const payload = buildPayload()
      const saved = activeRequestId
        ? await updateProductDeletionRequest(activeRequestId, payload)
        : await createProductDeletionRequest(payload)
      await submitProductDeletionRequest(saved.id, reason)
      showSuccess('Đã gửi yêu cầu xóa hàng hóa cho Admin duyệt.')
      closeForm()
      await loadRequests()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function editRequest(request) {
    if (!canEditRequest(request)) return
    setActiveRequestId(request.id)
    setTitle(request.title || '')
    setReason(request.reason || '')
    setSelectedProductIds((request.items ?? []).map((item) => String(item.productId)).filter(Boolean))
    setItemReasons(
      Object.fromEntries((request.items ?? []).map((item) => [String(item.productId), item.reason || ''])),
    )
    setIsFormOpen(true)
    scrollFormIntoView()
  }

  async function handleAdminAction(request, action) {
    if (!canAdmin) return
    const reasonPrompt = action === 'reject' ? 'Nhập lý do từ chối:' : 'Nhập lý do hủy:'
    const reasonText = action === 'approve' ? '' : window.prompt(reasonPrompt)
    if (action !== 'approve' && !normalizeText(reasonText)) return
    if (action === 'approve' && !window.confirm(`Duyệt xóa mềm ${request.items.length} Product trong ${request.requestCode}?`)) return

    setIsSaving(true)
    try {
      if (action === 'approve') await approveProductDeletionRequest(request.id, '')
      if (action === 'reject') await rejectProductDeletionRequest(request.id, reasonText, '')
      if (action === 'cancel') await cancelProductDeletionRequest(request.id, reasonText, '')
      showSuccess('Đã cập nhật yêu cầu xóa hàng hóa.')
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
              <h1 className="text-2xl font-extrabold text-slate-900">Yêu cầu xóa hàng hóa</h1>
              <TitleInfoButton text="Product/SKU/BOM không được xóa trực tiếp. Warehouse gửi yêu cầu, Admin duyệt xóa mềm sau khi kiểm tra tồn kho và ràng buộc BOM." />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWarehouse ? (
              <button
                type="button"
                onClick={openNewRequestForm}
                className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo yêu cầu xóa
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

        {canWarehouse && isFormOpen ? (
          <section ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{activeRequestId ? 'Sửa yêu cầu xóa' : 'Tạo yêu cầu xóa'}</h2>
                <p className="mt-1 text-sm text-slate-500">Chọn một hoặc nhiều Product. Hệ thống sẽ chặn nếu còn tồn kho hoặc còn ràng buộc nghiệp vụ.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeRequestId ? (
                  <button type="button" onClick={openNewRequestForm} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                    Tạo yêu cầu mới
                  </button>
                ) : null}
                <button type="button" onClick={closeForm} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                  {activeRequestId ? 'Hủy thao tác' : 'Đóng'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Tiêu đề yêu cầu
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                    placeholder="VD: Xóa hàng hóa ngừng kinh doanh"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Lý do chung
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-1 h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                    placeholder="Nêu lý do xóa mềm Product..."
                  />
                </label>
                <input
                  value={productSearchInput}
                  onChange={(event) => setProductSearchInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                  placeholder="Tìm Product/SKU để chọn..."
                />
                {productLoadError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Không thể tải danh sách Product: {productLoadError}
                  </div>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                  {filteredProducts.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      {products.length === 0 ? 'Không có Product đang hoạt động để chọn.' : 'Không có Product phù hợp.'}
                    </p>
                  ) : (
                    filteredProducts.map((product) => {
                      const checked = selectedProductIds.includes(String(product.id))
                      return (
                        <label key={product.id} className="flex cursor-pointer gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProduct(product.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#538463]"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">{product.name}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {getProductTypeLabel(product.productType)} · {product.categoryName || 'Chưa phân loại'} · {variantSummary(product)}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">Product đã chọn ({selectedProducts.length})</p>
                </div>
                {selectedProducts.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">Chưa chọn Product nào.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{product.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{variantSummary(product)}</p>
                          </div>
                          <button type="button" onClick={() => toggleProduct(product.id)} className="text-xs font-bold text-rose-600">
                            Bỏ chọn
                          </button>
                        </div>
                        <input
                          value={itemReasons[String(product.id)] ?? ''}
                          onChange={(event) =>
                            setItemReasons((current) => ({ ...current, [String(product.id)]: event.target.value }))
                          }
                          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                          placeholder="Lý do riêng cho Product này..."
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={isSaving || !isDeletionFormReady}
                className="rounded-xl border border-[#538463]/30 px-4 py-2 text-sm font-bold text-[#356647] hover:bg-[#f3f7f4] disabled:opacity-60"
              >
                Lưu draft
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={isSaving || !isDeletionFormReady}
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
                placeholder="Tìm mã, tiêu đề, Product..."
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã yêu cầu</th>
                  <th className="px-4 py-3 font-semibold">Nội dung</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Người tạo</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Đang tải yêu cầu...</td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Chưa có yêu cầu xóa hàng hóa.</td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#356647]">{request.requestCode}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{request.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{request.reason || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassName(request.status)}`}>
                          {statusLabel(request.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">{request.items.length} Product</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {request.items.map((item) => item.productName).join(', ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p className="font-semibold">{request.createdByName || 'Chưa xác định'}</p>
                        <p>{request.createdByRoleName || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeVN(request.updatedAt || request.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Chi tiết
                          </button>
                          {canEditRequest(request) ? (
                            <button
                              type="button"
                              onClick={() => editRequest(request)}
                              className="rounded-lg border border-[#538463]/30 px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#f3f7f4]"
                            >
                              Sửa / gửi
                            </button>
                          ) : null}
                          {canAdmin && request.status === 'PendingApproval' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAdminAction(request, 'approve')}
                                disabled={isSaving}
                                className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-60"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminAction(request, 'reject')}
                                disabled={isSaving}
                                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                              >
                                Từ chối
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminAction(request, 'cancel')}
                                disabled={isSaving}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Hủy
                              </button>
                            </>
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

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <p className="font-mono text-xs font-bold text-[#356647]">{selectedRequest.requestCode}</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedRequest.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{statusLabel(selectedRequest.status)}</p>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Người tạo</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedRequest.createdByName || 'Chưa xác định'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Người duyệt</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedRequest.reviewedByName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Thời gian gửi</p>
                  <p className="mt-1 font-semibold text-slate-800">{formatDateTimeVN(selectedRequest.submittedAt) || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Lý do chung</p>
                <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{selectedRequest.reason || '—'}</p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Loại</th>
                      <th className="px-4 py-3 font-semibold">Biến thể</th>
                      <th className="px-4 py-3 font-semibold">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequest.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.reason || '—'}</p>
                        </td>
                        <td className="px-4 py-3">{getProductTypeLabel(item.productType)}</td>
                        <td className="px-4 py-3">{item.variantCount}</td>
                        <td className={`px-4 py-3 text-xs font-semibold ${itemStatusClassName(item.validationStatus)}`}>
                          {item.validationMessage || item.validationStatus || 'Chưa kiểm tra'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedRequest.rejectReason || selectedRequest.cancelReason || selectedRequest.adminNote ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p><span className="font-semibold">Lý do từ chối:</span> {selectedRequest.rejectReason || '—'}</p>
                  <p className="mt-1"><span className="font-semibold">Lý do hủy:</span> {selectedRequest.cancelReason || '—'}</p>
                  <p className="mt-1"><span className="font-semibold">Ghi chú Admin:</span> {selectedRequest.adminNote || '—'}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
