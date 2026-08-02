import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showInfo, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCreateStockReplenishmentRequest,
  isWarehouseRole,
} from '../../auth/utils/permissions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { buildSkuSnapshotName } from '../../products/components/BatchStockAdjustmentModal.jsx'
import { fetchSkus, fetchStoreSkus } from '../../products/services/productSkusApi.js'
import { fetchSkuStocks, fetchStoreSkuStocks } from '../services/inventoryStockApi.js'
import { createStockAdjustmentRequest } from '../services/stockAdjustmentRequestApi.js'
import { getStockFlowErrorMessage, STOCK_FLOW_TERMS } from '../utils/stockFlowLabels.js'

const CATALOG_PAGE_SIZE = 30
const FIELD_CLASS =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]'
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'

/**
 * Khả năng tồn trên Kệ Hàng không có cột riêng trong dữ liệu SKU. Điều kiện dưới đây
 * bám đúng ValidateShelfReplenishmentCatalogAsync ở backend: chỉ Thành phẩm đang hoạt động
 * và được phép bán mới được đưa lên Kệ. Nguyên liệu và Bao bì luôn bị loại.
 */
function isShelfEligibleSku(sku) {
  return (
    Boolean(sku?.isActive)
    && Boolean(sku?.isSellable)
    && String(sku?.productType ?? '').toUpperCase() === 'THANH_PHAM'
  )
}

function normalizeSearchTerm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function buildSearchTerms(search) {
  const raw = String(search ?? '').trim()
  if (!raw) return [undefined]
  const normalized = normalizeSearchTerm(raw)
  return [...new Set([raw, normalized, normalized.replace(/\s+/g, '-')].filter(Boolean))]
}

function toCatalogOption(sku, stockBySkuId) {
  const stock = stockBySkuId.get(sku.id)
  return {
    skuId: sku.id,
    skuCode: sku.skuCode ?? '',
    productName: sku.productName ?? '',
    skuSnapshotName: buildSkuSnapshotName(sku, sku.productName ?? ''),
    categoryName: sku.categoryName ?? '',
    unitName: sku.inventoryUnit || sku.unitName || '',
    warehouseQuantityOnHand: Number(stock?.warehouseQuantityOnHand ?? 0),
    shelfQuantityOnHand: Number(stock?.quantityOnHand ?? 0),
  }
}

export default function StockAdjustmentRequestCreatePage() {
  const navigate = useNavigate()
  const session = loadAuthSession()
  const canCreate = canCreateStockReplenishmentRequest(session)

  const [search, setSearch] = useState('')
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogOptions, setCatalogOptions] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [lines, setLines] = useState([])
  const [reason, setReason] = useState('Bổ sung hàng thành phẩm từ Kho sang Kệ Hàng')
  const [isSaving, setIsSaving] = useState(false)

  const searchTerm = search.trim()

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(async () => {
      if (catalogPage === 1) setIsLoadingCatalog(true)
      else setIsLoadingMore(true)
      try {
        const isWarehouse = isWarehouseRole(session)
        const fetchStockFn = isWarehouse ? fetchSkuStocks : fetchStoreSkuStocks
        const fetchSkuFn = isWarehouse ? fetchSkus : fetchStoreSkus
        const terms = buildSearchTerms(searchTerm)
        const [stocks, ...responses] = await Promise.all([
          fetchStockFn(),
          ...terms.map((term) =>
            fetchSkuFn({ search: term, page: catalogPage, pageSize: CATALOG_PAGE_SIZE, isActive: true }),
          ),
        ])
        if (!mounted) return
        const stockBySkuId = new Map(stocks.map((stock) => [stock.skuId, stock]))
        const byId = new Map()
        responses.forEach((response) => {
          ;(response.items ?? []).forEach((sku) => {
            if (!isShelfEligibleSku(sku)) return
            byId.set(sku.id, toCatalogOption(sku, stockBySkuId))
          })
        })
        const nextOptions = [...byId.values()]
        setCatalogOptions((current) => {
          if (catalogPage === 1) return nextOptions
          const merged = new Map(current.map((option) => [option.skuId, option]))
          nextOptions.forEach((option) => merged.set(option.skuId, option))
          return [...merged.values()]
        })
        setHasMore(
          responses.some((response) => Number(response.page ?? catalogPage) < Number(response.totalPages ?? 1)),
        )
      } catch (error) {
        if (!mounted) return
        if (catalogPage === 1) setCatalogOptions([])
        setHasMore(false)
        showError(getStockFlowErrorMessage(error, 'Không tải được danh mục sản phẩm.'))
      } finally {
        if (mounted) {
          setIsLoadingCatalog(false)
          setIsLoadingMore(false)
        }
      }
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
    // session là snapshot đồng bộ từ localStorage nên không đưa vào dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, catalogPage])

  const selectedIds = useMemo(() => new Set(lines.map((line) => line.skuId)), [lines])

  const addLine = useCallback((option) => {
    setLines((current) => {
      if (current.some((line) => line.skuId === option.skuId)) return current
      return [...current, { ...option, quantity: '' }]
    })
  }, [])

  function removeLine(skuId) {
    setLines((current) => current.filter((line) => line.skuId !== skuId))
  }

  function updateQuantity(skuId, value) {
    setLines((current) =>
      current.map((line) => (line.skuId === skuId ? { ...line, quantity: value } : line)),
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return

    if (lines.length === 0) {
      showError('Vui lòng chọn ít nhất một sản phẩm cần bổ sung cho Kệ Hàng.')
      return
    }

    for (const line of lines) {
      const quantity = Number(line.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        showError(`Số lượng yêu cầu của ${line.skuCode} phải lớn hơn 0.`)
        return
      }
      if (!Number.isInteger(quantity)) {
        showError(`Số lượng yêu cầu của ${line.skuCode} phải là số nguyên.`)
        return
      }
    }

    setIsSaving(true)
    try {
      const created = await createStockAdjustmentRequest({
        reason: reason.trim() || null,
        items: lines.map((line) => ({
          skuId: line.skuId,
          skuCode: line.skuCode,
          skuSnapshotName: line.skuSnapshotName,
          quantityDelta: Number(line.quantity),
        })),
      })
      showSuccess(
        `Đã gửi ${STOCK_FLOW_TERMS.request} ${created.requestCode}. Yêu cầu chưa làm thay đổi tồn kho.`,
      )
      navigate('/inventory/stock-requests', { state: { search: created.requestCode } })
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không gửi được yêu cầu bổ sung.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!canCreate) {
    return (
      <PageShell>
        <PageHeader
          title={`Tạo ${STOCK_FLOW_TERMS.request}`}
          description="Bạn không có quyền tạo yêu cầu bổ sung Kệ Hàng."
        />
        <section className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Chỉ Nhân viên bán hàng và Quản lý được tạo yêu cầu bổ sung Kệ Hàng.
          <button
            type="button"
            onClick={() => navigate('/inventory/stock-requests')}
            className="ml-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Quay lại danh sách
          </button>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title={`Tạo ${STOCK_FLOW_TERMS.request}`}
        titleInfo={`${STOCK_FLOW_TERMS.warehouse} cấp hàng thành phẩm cho ${STOCK_FLOW_TERMS.shelf}. Yêu cầu này chưa làm thay đổi tồn kho.`}
        description="Chọn nhiều sản phẩm thành phẩm cần bổ sung lên Kệ Hàng, nhập số lượng cho từng sản phẩm rồi gửi yêu cầu."
      />

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-800">Danh mục sản phẩm</h2>
            <p className="mt-1 text-xs text-slate-500">
              Chỉ hiển thị SKU Thành phẩm đang hoạt động và được phép tồn trên {STOCK_FLOW_TERMS.shelf}.
              Nguyên liệu và Bao bì không được bổ sung lên Kệ.
            </p>
          </div>

          <div className="px-5 py-4">
            <label className="block">
              <span className={LABEL_CLASS}>Tìm mã SKU / tên sản phẩm</span>
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setCatalogPage(1)
                }}
                placeholder="VD: FG-TRA-NHAI-50G hoặc tên sản phẩm"
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar border-t border-slate-100">
            {isLoadingCatalog ? (
              <p className="px-5 py-8 text-sm text-slate-500">Đang tải danh mục...</p>
            ) : catalogOptions.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">
                Không tìm thấy sản phẩm thành phẩm phù hợp.
              </p>
            ) : (
              <>
                {catalogOptions.map((option) => {
                  const selected = selectedIds.has(option.skuId)
                  return (
                    <button
                      key={option.skuId}
                      type="button"
                      disabled={selected}
                      onClick={() => addLine(option)}
                      className={`flex w-full items-start justify-between gap-3 border-b border-slate-50 px-5 py-3 text-left text-sm hover:bg-[#fbf9f1] disabled:cursor-not-allowed ${
                        selected ? 'bg-[#e8f1eb] text-[#356647]' : 'text-slate-800'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-bold">{option.skuCode}</span>
                        <span className="mt-0.5 block truncate font-semibold">{option.skuSnapshotName}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{option.productName}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-[#e8f1eb] px-2 py-0.5 font-semibold text-[#356647]">
                            Thành phẩm
                          </span>
                          {option.categoryName ? (
                            <span className="truncate text-slate-500">Danh mục: {option.categoryName}</span>
                          ) : null}
                        </span>
                        {selected ? (
                          <span className="mt-1 inline-flex rounded-full bg-[#356647] px-2 py-0.5 text-[10px] font-bold text-white">
                            Đã chọn
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right text-xs text-slate-600">
                        {STOCK_FLOW_TERMS.warehouse}:{' '}
                        <strong>{formatStockQuantity(option.warehouseQuantityOnHand)}</strong>
                        <br />
                        {STOCK_FLOW_TERMS.shelf}:{' '}
                        <strong>{formatStockQuantity(option.shelfQuantityOnHand)}</strong>
                      </span>
                    </button>
                  )
                })}
                {hasMore ? (
                  <div className="px-5 py-3 text-center">
                    <button
                      type="button"
                      disabled={isLoadingMore}
                      onClick={() => setCatalogPage((current) => current + 1)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isLoadingMore ? 'Đang tải thêm...' : 'Xem thêm sản phẩm'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-7">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-800">Sản phẩm đã chọn</h2>
            <p className="mt-1 text-xs text-slate-500">
              Mỗi sản phẩm chỉ được chọn một lần. Số lượng yêu cầu là số nguyên dương theo đơn vị tồn của sản phẩm.
            </p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Mã SKU</th>
                  <th className="whitespace-nowrap px-4 py-3">Tên sản phẩm</th>
                  <th className="whitespace-nowrap px-4 py-3">Đơn vị</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.warehouse}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.shelf}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">{STOCK_FLOW_TERMS.requestedQuantity}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      Chưa chọn sản phẩm nào. Hãy chọn sản phẩm ở danh mục bên trái.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => {
                    const quantity = Number(line.quantity)
                    const isShortStock =
                      Number.isFinite(quantity)
                      && quantity > 0
                      && quantity > line.warehouseQuantityOnHand
                    return (
                      <tr key={line.skuId} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[#356647]">
                          {line.skuCode}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          <span className="block font-semibold">{line.skuSnapshotName}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{line.productName}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{line.unitName || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {formatStockQuantity(line.warehouseQuantityOnHand)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {formatStockQuantity(line.shelfQuantityOnHand)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(event) => updateQuantity(line.skuId, event.target.value)}
                            onBlur={() => {
                              if (isShortStock) {
                                showInfo(
                                  'Tồn Kho hiện tại chưa đủ số lượng yêu cầu. Thủ kho có thể xử lý một phần hoặc chờ bổ sung tồn Kho.',
                                )
                              }
                            }}
                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#538463]"
                            placeholder="VD: 10"
                          />
                          {isShortStock ? (
                            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
                              Tồn Kho hiện tại chưa đủ số lượng yêu cầu. Thủ kho có thể xử lý một phần hoặc chờ bổ sung tồn Kho.
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(line.skuId)}
                            title="Xóa sản phẩm khỏi yêu cầu"
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <label className="block">
              <span className={LABEL_CLASS}>Lý do / Ghi chú</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]"
                placeholder="VD: Bổ sung hàng bán chạy cho ca chiều"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-requests')}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || lines.length === 0}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </section>
      </form>
    </PageShell>
  )
}
