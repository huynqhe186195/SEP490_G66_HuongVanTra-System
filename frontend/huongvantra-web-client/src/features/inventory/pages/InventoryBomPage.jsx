import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showSuccess } from '../../../app/toast.js'
import ProductBomConfigModal from '../../products/components/ProductBomConfigModal.jsx'
import { formatProductPrice } from '../../products/utils/productDisplay.js'
import {
  buildBomListRows,
  getBomLinesForVariant,
  getCategoryName,
  mockBomConfigs,
} from '../data/bomMockData.js'

function InventoryBomPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [bomConfigs, setBomConfigs] = useState(() => ({ ...mockBomConfigs }))
  const [activeVariant, setActiveVariant] = useState(null)

  const allRows = useMemo(() => {
    return buildBomListRows().map((row) => ({
      ...row,
      lines: bomConfigs[row.variantId] ?? row.lines,
      materialCount: (bomConfigs[row.variantId] ?? row.lines).length,
    }))
  }, [bomConfigs])

  const filteredRows = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    if (!keyword) return allRows
    return allRows.filter((row) => {
      const sku = String(row.variant?.sku || '').toLowerCase()
      const name = String(row.product?.name || '').toLowerCase()
      return sku.includes(keyword) || name.includes(keyword)
    })
  }, [allRows, searchInput])

  useEffect(() => {
    const variantId = Number(searchParams.get('variantId'))
    if (!variantId) return
    const row = allRows.find((item) => item.variantId === variantId)
    if (!row) return
    setActiveVariant({
      sku: row.variant.sku,
      productName: row.product?.name ?? '',
      attributeLabel: row.attributeLabel,
      variantId: row.variantId,
    })
    setSearchParams({}, { replace: true })
  }, [searchParams, allRows, setSearchParams])

  function openBomModal(row) {
    setActiveVariant({
      sku: row.variant.sku,
      productName: row.product?.name ?? '',
      attributeLabel: row.attributeLabel,
      variantId: row.variantId,
    })
  }

  function handleBomConfirm(lines) {
    if (!activeVariant) return
    setBomConfigs((current) => ({ ...current, [activeVariant.variantId]: lines }))
    showSuccess(`Đã cập nhật định mức BOM cho ${activeVariant.sku} (giao diện mẫu).`)
  }

  const activeLines = activeVariant ? bomConfigs[activeVariant.variantId] ?? getBomLinesForVariant(activeVariant.variantId) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="BOM / Định mức nguyên liệu"
        description="Cấu hình tiêu hao nguyên liệu theo từng biến thể thành phẩm — mở popup từ nút Cấu hình BOM"
        searchPlaceholder="Tìm theo SKU hoặc tên sản phẩm..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            to="/products/item/create"
            className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo hàng hóa mới
          </Link>
        }
      />

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800">Danh sách biến thể &amp; định mức</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi dòng là một SKU thành phẩm. Bấm <strong>Cấu hình BOM</strong> để mở popup định mức nguyên liệu.
          </p>
        </div>

        {filteredRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Không có biến thể phù hợp.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã SKU</th>
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">Đơn vị</th>
                  <th className="px-4 py-3 font-semibold">Thuộc tính</th>
                  <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-3 text-center font-semibold">Số NVL</th>
                  <th className="px-4 py-3 text-center font-semibold">Âm kho</th>
                  <th className="px-4 py-3 text-center font-semibold">Định mức (BOM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.variantId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#356647]">{row.variant?.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.product?.name}</div>
                      <div className="text-xs text-slate-500">{getCategoryName(row.product?.category_id)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.unitName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.attributeLabel}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatProductPrice(row.retailPrice)}</td>
                    <td className="px-4 py-3 text-center font-semibold">{row.materialCount}</td>
                    <td className="px-4 py-3 text-center">
                      {row.variant?.allow_negative_stock ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Có
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
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
        initialLines={activeLines}
        onClose={() => setActiveVariant(null)}
        onConfirm={handleBomConfirm}
      />
    </div>
  )
}

export default InventoryBomPage
