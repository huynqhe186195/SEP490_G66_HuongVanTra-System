import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function fmt(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

async function fetchMaterials(search = '') {
  const query = new URLSearchParams({ pageSize: '100', page: '1', isActive: 'true', productType: 'NGUYEN_LIEU' })
  if (search.trim()) query.set('search', search.trim())
  const data = await apiRequestAuth(`/api/v1/skus?${query.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return (paged.items ?? []).map((item) => ({
    skuId: item.id ?? item.Id ?? item.skuId ?? item.SkuId,
    skuCode: item.skuCode ?? item.SkuCode ?? item.code ?? item.Code ?? '',
    name: item.productName ?? item.ProductName ?? item.name ?? item.Name ?? '',
    unitPrice: Number(item.retailPrice ?? item.RetailPrice ?? item.price ?? item.Price ?? 0),
  }))
}

export default function CustomBundlePanel({ bundles, onChange }) {
  const [materials, setMaterials] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  // qty keyed by skuId
  const [qtyMap, setQtyMap] = useState({})
  // which rows are selected (in the current bundle being built)
  const [selected, setSelected] = useState({})
  const [label, setLabel] = useState('')
  const debounceRef = useRef(null)

  const loadMaterials = useCallback(async (q) => {
    setLoading(true)
    try {
      const result = await fetchMaterials(q)
      setMaterials(result)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMaterials('')
  }, [loadMaterials])

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadMaterials(val), 350)
  }

  const toggleRow = (skuId) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[skuId]) {
        delete next[skuId]
      } else {
        next[skuId] = true
        if (!qtyMap[skuId]) setQtyMap((q) => ({ ...q, [skuId]: 1 }))
      }
      return next
    })
  }

  const setQty = (skuId, val) => {
    const n = Math.max(1, Number(val) || 1)
    setQtyMap((prev) => ({ ...prev, [skuId]: n }))
  }

  const selectedMaterials = materials.filter((m) => selected[m.skuId])
  const bundleTotal = selectedMaterials.reduce(
    (s, m) => s + m.unitPrice * (qtyMap[m.skuId] ?? 1),
    0,
  )

  // 1 order = 1 bundle
  const currentBundle = (bundles ?? [])[0] ?? null

  const confirmBundle = () => {
    if (selectedMaterials.length === 0) return
    const newBundle = {
      label: label.trim() || null,
      note: null,
      ingredients: selectedMaterials.map((m) => {
        const quantity = qtyMap[m.skuId] ?? 1
        return {
          materialSkuId: m.skuId,
          materialSkuCode: m.skuCode,
          materialSnapshotName: m.name,
          quantity,
          unitPrice: m.unitPrice,
          subTotal: m.unitPrice * quantity,
        }
      }),
    }
    onChange([newBundle])
    setSelected({})
    setQtyMap({})
    setLabel('')
  }

  const clearBundle = () => {
    onChange([])
    setSelected({})
    setQtyMap({})
    setLabel('')
  }

  const filteredMaterials = materials

  return (
    <div className="flex flex-col gap-4">
      {/* Current bundle summary */}
      {currentBundle && (
        <div className="rounded-xl border border-[#356647]/40 bg-[#f3f8f3] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1b1c17]">
              Gói đã chọn{currentBundle.label ? ` — ${currentBundle.label}` : ''}
            </p>
            <button
              type="button"
              onClick={clearBundle}
              className="text-xs font-medium text-red-500 hover:text-red-700"
            >
              Xoá gói
            </button>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {currentBundle.ingredients.map((ing, idx) => (
                <tr key={idx} className="border-t border-[#e8f0e8] first:border-t-0">
                  <td className="py-1 pr-2 text-[#1b1c17]">{ing.materialSnapshotName}</td>
                  <td className="py-1 pr-2 text-[#717971]">{ing.materialSkuCode}</td>
                  <td className="py-1 pr-2 text-right text-[#717971]">×{ing.quantity}</td>
                  <td className="py-1 text-right font-semibold text-[#356647]">
                    {fmt(ing.unitPrice * ing.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#c1c9c0]">
                <td colSpan={3} className="pt-1.5 text-right text-xs font-bold text-[#1b1c17]">
                  Tổng gói
                </td>
                <td className="pt-1.5 text-right text-sm font-bold text-[#356647]">
                  {fmt(currentBundle.ingredients.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Ingredient selector */}
      <div className="rounded-xl border border-[#c1c9c0] bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1b1c17]">Chọn nguyên liệu</p>
          {selectedMaterials.length > 0 && (
            <span className="text-xs text-[#356647] font-medium">
              {selectedMaterials.length} đã chọn · {fmt(bundleTotal)}
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder="Tìm nguyên liệu..."
          value={search}
          onChange={handleSearchChange}
          className="mb-3 w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#356647]"
        />

        {loading ? (
          <p className="py-6 text-center text-xs text-[#717971]">Đang tải...</p>
        ) : filteredMaterials.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#717971]">Không tìm thấy nguyên liệu.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#c1c9c0]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c1c9c0] bg-[#f6f4ec]">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#717971]">Tên nguyên liệu</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#717971]">Mã SKU</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Giá/đv</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-[#717971]">Số lượng</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((m) => {
                  const isSelected = Boolean(selected[m.skuId])
                  const qty = qtyMap[m.skuId] ?? 1
                  return (
                    <tr
                      key={m.skuId}
                      onClick={() => toggleRow(m.skuId)}
                      className={`cursor-pointer border-b border-[#f0eee6] last:border-b-0 transition-colors ${
                        isSelected ? 'bg-[#f0f7f0]' : 'hover:bg-[#fafaf7]'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? 'border-[#356647] bg-[#356647] text-white'
                              : 'border-[#c1c9c0] bg-white'
                          }`}
                        >
                          {isSelected && (
                            <span className="material-symbols-outlined text-[12px]">check</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#1b1c17]">{m.name}</td>
                      <td className="px-3 py-2.5 text-[#717971]">{m.skuCode}</td>
                      <td className="px-3 py-2.5 text-right text-[#717971]">{fmt(m.unitPrice)}</td>
                      <td
                        className="px-3 py-2.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isSelected ? (
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => setQty(m.skuId, e.target.value)}
                            className="w-16 rounded border border-[#c1c9c0] px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#356647]"
                          />
                        ) : (
                          <span className="text-[#c1c9c0]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#356647]">
                        {isSelected ? fmt(m.unitPrice * qty) : <span className="text-[#c1c9c0]">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedMaterials.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="Tên gói (tuỳ chọn)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#356647]"
            />
            <button
              type="button"
              onClick={confirmBundle}
              className="shrink-0 rounded-lg bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a5238]"
            >
              {currentBundle ? 'Cập nhật gói' : 'Thêm vào đơn'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
