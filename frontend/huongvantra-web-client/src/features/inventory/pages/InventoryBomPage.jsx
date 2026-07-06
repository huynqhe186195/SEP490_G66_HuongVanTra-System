import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import ProductBomConfigModal from '../../products/components/ProductBomConfigModal.jsx'
import { fetchProducts } from '../../products/services/productsApi.js'
import { updateVariantBom } from '../../products/services/bomApi.js'
import { formatProductPrice } from '../../products/utils/productDisplay.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'

async function fetchFinishedProductsForBom() {
  const pageSize = 100
  const products = []
  let page = 1
  let totalPages = 1

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

function InventoryBomPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeVariant, setActiveVariant] = useState(null)
  const [handledOpenBomParam, setHandledOpenBomParam] = useState('')

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
    loadRows()
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

    setHandledOpenBomParam(paramKey)
    const row = rows.find((item) => String(item.variantId) === String(variantId))
    if (!row) {
      showError('Không tìm thấy SKU thành phẩm để cấu hình BOM.')
      setSearchParams({}, { replace: true })
      return
    }

    openBomModal(row)
    setSearchParams({}, { replace: true })
  }, [searchParams, rows, isLoading, handledOpenBomParam, setSearchParams])

  function openBomModal(row) {
    setActiveVariant({
      ...row,
      sku: row.skuCode,
      productName: row.productName,
      attributeLabel: row.variantName || row.skuCode,
      initialLines: row.bomLines,
    })
  }

  async function handleBomConfirm(lines) {
    if (!activeVariant) return
    try {
      const updatedLines = await updateVariantBom(activeVariant.variantId, lines)
      setRows((current) =>
        current.map((row) =>
          String(row.variantId) === String(activeVariant.variantId)
            ? { ...row, bomLines: updatedLines, materialCount: updatedLines.length }
            : row,
        ),
      )
      showSuccess(`Đã cập nhật định mức BOM cho ${activeVariant.skuCode}.`)
    } catch (error) {
      showError(error.message)
      throw error
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Định mức BOM"
        description="Cấu hình nguyên liệu tiêu hao cho từng SKU thành phẩm."
        searchPlaceholder="Tìm theo SKU hoặc tên thành phẩm..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <div className="flex items-center gap-3">
            <InventoryNavTabs />
            <Link
              to="/inventory/products/create"
              className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo hàng hóa
            </Link>
          </div>
        }
      />

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 rounded-xl border border-[#538463]/15 bg-[#f3f7f4] px-4 py-3 text-sm text-[#356647]">
          <p className="font-semibold">BOM được lưu theo finished ProductVariant/SKU.</p>
          <p className="mt-1 text-xs text-[#4d6f58]">
            Khi tạo lệnh sản xuất, hệ thống đọc định mức của SKU thành phẩm để tính tổng nguyên liệu cần xuất.
          </p>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800">Danh sách SKU thành phẩm & định mức BOM</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi dòng là một SKU thành phẩm. Bấm <strong>Cấu hình BOM</strong> để thêm, sửa hoặc xóa nguyên liệu.
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
                <col style={{ width: '13%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '29%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">SKU thành phẩm</th>
                  <th className="px-4 py-3 font-semibold">Thành phẩm</th>
                  <th className="px-4 py-3 font-semibold">Biến thể</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-3 text-center font-semibold">Số nguyên liệu</th>
                  <th className="px-4 py-3 font-semibold">Nguyên liệu</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.variantId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 align-top">
                      <span className="font-mono text-xs font-bold text-[#356647]">{row.skuCode}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.productName}</div>
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
                              key={`${row.variantId}-${line.materialId ?? line.material_id}`}
                              className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-1 leading-5 text-slate-700"
                            >
                              {line.materialName || line.materialId || line.material_id} x{line.quantity}
                              {line.materialUnitName || line.baseUnit ? ` ${line.materialUnitName || line.baseUnit}` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-slate-400">
                          Chưa có BOM. Bấm Cấu hình BOM để thêm nguyên liệu.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => openBomModal(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
                      >
                        <span className="material-symbols-outlined text-[16px]">settings</span>
                        Cấu hình BOM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProductBomConfigModal
        isOpen={Boolean(activeVariant)}
        variant={activeVariant}
        initialLines={activeVariant?.initialLines ?? []}
        onClose={() => setActiveVariant(null)}
        onConfirm={handleBomConfirm}
      />
    </PageShell>
  )
}

export default InventoryBomPage
