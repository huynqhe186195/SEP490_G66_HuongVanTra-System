import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { formatProductPrice } from '../../products/utils/productDisplay.js'

async function fetchFinishedProductsForBom() {
  const pageSize = 100
  const products = []
  let page = 1
  let totalPages

  do {
    const result = await fetchProducts({
      isActive: true,
      productType: 'THANH_PHAM',
      page,
      pageSize,
    })
    products.push(...(result.items ?? []))
    totalPages = Number(result.totalPages ?? 1) || 1
    page += 1
  } while (page <= totalPages && page <= 20)

  return products
}

function buildBomRows(products) {
  return products.flatMap((product) =>
    (product.variants ?? [])
      .filter((variant) => variant.isActive !== false)
      .map((variant) => ({
        variantId: variant.id,
        skuCode: variant.skuCode,
        productName: product.name,
        categoryName: product.categoryName,
        variantName: variant.variantName,
        retailPrice: variant.retailPrice,
        bomLines: variant.bomLines ?? [],
        materialCount: (variant.bomLines ?? []).length,
      })),
  )
}

function getBomLineName(line) {
  const productName = line.materialName || ''
  const variantName = line.componentVariantName || ''
  if (productName && variantName && !variantName.toLowerCase().includes(productName.toLowerCase())) {
    return `${productName} · ${variantName}`
  }
  return productName || variantName || line.componentSkuCode || line.materialId || line.material_id || '—'
}

function getBomLineUnit(line) {
  return line.materialUnitName || line.baseUnit || line.materialUnit || ''
}

function BomDetailModal({ row, onClose }) {
  if (!row) return null

  return (
    <div
      className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bom-detail-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="bom-detail-title" className="text-base font-bold text-slate-800 sm:text-lg">
              Định mức BOM: <span className="font-mono text-[#356647]">{row.skuCode}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {[row.productName, row.variantName].filter(Boolean).join(' - ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {row.bomLines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
              SKU Sản phẩm kệ này chưa có BOM.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nguyên liệu / Bao bì</th>
                    <th className="px-4 py-3 text-center font-semibold">Định mức cho 1 đơn vị</th>
                    <th className="px-4 py-3 font-semibold">Đơn vị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {row.bomLines.map((line) => (
                    <tr
                      key={`${row.variantId}-${line.componentVariantId ?? line.materialId ?? line.material_id}`}
                      className={line.isRequiredBaseComponent ? 'bg-emerald-50/45' : ''}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {line.componentSkuCode ? (
                          <span className="mr-2 font-mono text-xs text-[#356647]">{line.componentSkuCode}</span>
                        ) : null}
                        <span>{getBomLineName(line)}</span>
                        {line.isRequiredBaseComponent ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Tự động theo quy đổi
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">{line.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{getBomLineUnit(line) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-500">{row.bomLines.length} component trong BOM</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </footer>
      </div>
    </div>
  )
}

function InventoryBomPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [handledOpenBomParam, setHandledOpenBomParam] = useState('')
  const [viewBomRow, setViewBomRow] = useState(null)

  const loadRows = useCallback(async () => {
    setIsLoading(true)
    try {
      const products = await fetchFinishedProductsForBom()
      setRows(buildBomRows(products))
    } catch (error) {
      setRows([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadRows(), 0)
    return () => window.clearTimeout(timer)
  }, [loadRows])

  const filteredRows = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => {
      const haystack = `${row.skuCode} ${row.productName} ${row.variantName}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [rows, searchInput])

  useEffect(() => {
    const variantId = searchParams.get('variantId')
    const openBom = searchParams.get('openBom')
    const shouldOpenBom = Boolean(variantId) && (openBom === 'true' || openBom === null)
    if (!shouldOpenBom) return

    const paramKey = `${variantId}:${openBom ?? ''}`
    if (handledOpenBomParam === paramKey || isLoading) return

    const timer = window.setTimeout(() => {
      setHandledOpenBomParam(paramKey)
      const row = rows.find((item) => String(item.variantId) === String(variantId))
      if (!row) {
        showError('Không tìm thấy SKU Sản phẩm kệ để cấu hình BOM.')
        setSearchParams({}, { replace: true })
        return
      }

      openBomModal(row)
      setSearchParams({}, { replace: true })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [searchParams, rows, isLoading, handledOpenBomParam, setSearchParams])

  function openBomModal(row) {
    setViewBomRow(row)
  }

  return (
    <PageShell>
      <PageHeader
        title="Định mức BOM"
        titleInfo="Cấu hình nguyên liệu / bao bì tiêu hao cho từng SKU Sản phẩm kệ."
        searchPlaceholder="Tìm theo SKU hoặc tên Sản phẩm kệ..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
      />

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 rounded-xl border border-[#538463]/15 bg-[#f3f7f4] px-4 py-3 text-sm text-[#356647]">
          <p className="font-semibold">BOM được lưu theo finished ProductVariant/SKU.</p>
          <p className="mt-1 text-xs text-[#4d6f58]">
            Khi tạo lệnh sản xuất, hệ thống đọc định mức của SKU Sản phẩm kệ để tính tổng nguyên liệu / bao bì cần xuất.
          </p>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800">Danh sách SKU Sản phẩm kệ & định mức BOM</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi dòng là một SKU Sản phẩm kệ. BOM hiện chỉ được cập nhật qua workflow phê duyệt Product Creation Request.
          </p>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Đang tải BOM...
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Không có finished SKU phù hợp.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: '31%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '29%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sản Phẩm</th>
                  <th className="px-4 py-3 font-semibold">Biến thể</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-3 text-center font-semibold">Số component</th>
                  <th className="px-4 py-3 font-semibold">Nguyên liệu / Bao bì</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.variantId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.productName}</div>
                      <div className="font-mono text-xs text-slate-500">{row.skuCode}</div>
                      <div className="text-xs text-slate-500">{row.categoryName || '-'}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{row.variantName || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-medium">{formatProductPrice(row.retailPrice)}</td>
                    <td className="px-4 py-3 text-center align-top font-semibold">{row.materialCount}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                      {row.bomLines.length > 0 ? (
                        <div className="flex w-full flex-wrap gap-1.5">
                          {row.bomLines.map((line) => (
                            <span
                              key={`${row.variantId}-${line.componentVariantId ?? line.materialId ?? line.material_id}`}
                              className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-1 leading-5 text-slate-700"
                            >
                              {line.componentSkuCode || line.materialName || line.materialId || line.material_id} x{line.quantity}
                              {line.materialUnitName || line.baseUnit ? ` ${line.materialUnitName || line.baseUnit}` : ''}
                              {line.isRequiredBaseComponent ? ' · Tự động theo quy đổi' : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-slate-400">
                          Chưa có BOM. Tạo Product Creation Request để bổ sung nguyên liệu / bao bì.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => openBomModal(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Xem BOM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BomDetailModal row={viewBomRow} onClose={() => setViewBomRow(null)} />
    </PageShell>
  )
}

export default InventoryBomPage
