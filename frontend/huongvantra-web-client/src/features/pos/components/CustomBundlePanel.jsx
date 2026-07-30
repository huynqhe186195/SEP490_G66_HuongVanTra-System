import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { fetchStoreSkuStocks, buildWarehouseStockBySkuIdMap } from '../../inventory/services/inventoryStockApi.js'

function fmt(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

async function fetchMaterials(search = '') {
  const query = new URLSearchParams({ pageSize: '100', page: '1', isActive: 'true' })
  if (search.trim()) query.set('search', search.trim())
  const [data, stocks] = await Promise.all([
    apiRequestAuth(`/api/v1/store/skus?${query.toString()}`, { method: 'GET' }),
    fetchStoreSkuStocks().catch(() => []),
  ])
  const stockBySkuId = buildWarehouseStockBySkuIdMap(stocks)
  const paged = toPagedResult(data)
  return (paged.items ?? []).map((item) => {
    const skuId = item.id ?? item.Id ?? item.skuId ?? item.SkuId
    return {
      skuId,
      skuCode: item.skuCode ?? item.SkuCode ?? item.code ?? item.Code ?? '',
      name: item.productName ?? item.ProductName ?? item.name ?? item.Name ?? '',
      unitPrice: Number(item.retailPrice ?? item.RetailPrice ?? item.price ?? item.Price ?? 0),
      packagingType: item.packagingType ?? item.PackagingType ?? '',
      description: item.description ?? item.Description ?? '',
      productType: item.productType ?? item.ProductType ?? '',
      canUseInCustom: item.canUseInCustom ?? item.CanUseInCustom ?? false,
      stockOnHand: Number(stockBySkuId.get(skuId) ?? 0),
    }
  }).filter((item) => ['NGUYEN_LIEU', 'BAO_BI'].includes(String(item.productType).toUpperCase()) && item.canUseInCustom === true)
}

function DetailModal({ material, onClose }) {
  if (!material) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-bold text-[#1b1c17]">{material.name}</p>
            <p className="text-xs text-[#717971]">{material.skuCode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-[#717971] hover:text-[#1b1c17]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[#717971]">Mã SKU</span>
            <span className="font-medium text-[#1b1c17]">{material.skuCode || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#717971]">Giá bán lẻ</span>
            <span className="font-semibold text-[#356647]">{fmt(material.unitPrice)}</span>
          </div>
          {material.packagingType && (
            <div className="flex justify-between gap-2">
              <span className="text-[#717971]">Quy cách</span>
              <span className="font-medium text-[#1b1c17]">{material.packagingType}</span>
            </div>
          )}
          {material.description && (
            <div className="pt-1">
              <p className="mb-1 text-xs font-semibold text-[#717971]">Mô tả</p>
              <p className="text-xs text-[#1b1c17]">{material.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CustomBundlePanel({ bundles, onChange }) {
  const [materials, setMaterials] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [qtyMap, setQtyMap] = useState({})
  const [selected, setSelected] = useState({})
  const [label, setLabel] = useState('')
  const [detailMaterial, setDetailMaterial] = useState(null)
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

  const qtyOf = (skuId) => {
    const n = Math.floor(Number(qtyMap[skuId]))
    return Number.isFinite(n) && n >= 1 ? n : 1
  }

  const setQty = (skuId, val) => {
    if (val === '') {
      setQtyMap((prev) => ({ ...prev, [skuId]: '' }))
      return
    }
    if (!/^\d+$/.test(val)) return
    setQtyMap((prev) => ({ ...prev, [skuId]: Number(val) }))
  }

  const commitQty = (skuId) => {
    setQtyMap((prev) => {
      const n = Math.floor(Number(prev[skuId]))
      return { ...prev, [skuId]: Number.isFinite(n) && n >= 1 ? n : 1 }
    })
  }

  const selectedMaterials = materials.filter((m) => selected[m.skuId])
  const bundleTotal = selectedMaterials.reduce(
    (s, m) => s + m.unitPrice * qtyOf(m.skuId),
    0,
  )

  const currentBundle = (bundles ?? [])[0] ?? null

  const confirmBundle = () => {
    if (selectedMaterials.length === 0) return
    const newBundle = {
      label: label.trim() || null,
      note: null,
      ingredients: selectedMaterials.map((m) => {
        const quantity = qtyOf(m.skuId)
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

  return (
    <>
      <DetailModal material={detailMaterial} onClose={() => setDetailMaterial(null)} />

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

        {/* Ingredient table */}
        <div className="rounded-xl border border-[#c1c9c0] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1b1c17]">Chọn nguyên liệu</p>
            {selectedMaterials.length > 0 && (
              <span className="text-xs font-medium text-[#356647]">
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
          ) : materials.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#717971]">Không tìm thấy nguyên liệu.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#c1c9c0]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c1c9c0] bg-[#f6f4ec]">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#717971]">Tên nguyên liệu</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#717971]">Mã SKU</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Tồn đang có</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Giá/đv</th>
                    <th className="w-24 px-3 py-2 text-center text-xs font-semibold text-[#717971]">Số lượng</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Thành tiền</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const isSelected = Boolean(selected[m.skuId])
                    const qtyValue = qtyMap[m.skuId] ?? 1
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
                        <td className="px-3 py-2.5 text-right">
                          <span className={m.stockOnHand <= 0 ? 'font-semibold text-red-500' : 'text-[#1b1c17]'}>
                            {m.stockOnHand.toLocaleString('vi-VN')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#717971]">{fmt(m.unitPrice)}</td>
                        <td
                          className="w-24 px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={isSelected ? qtyValue : ''}
                            disabled={!isSelected}
                            placeholder="—"
                            onChange={(e) => setQty(m.skuId, e.target.value)}
                            onBlur={() => commitQty(m.skuId)}
                            className="w-16 rounded border border-[#c1c9c0] px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#356647] disabled:cursor-default disabled:bg-transparent disabled:text-[#c1c9c0] disabled:placeholder-[#c1c9c0]"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          {isSelected ? (
                            <span className="text-[#356647]">{fmt(m.unitPrice * qtyOf(m.skuId))}</span>
                          ) : (
                            <span className="text-[#c1c9c0]">—</span>
                          )}
                        </td>
                        <td
                          className="px-2 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Xem chi tiết"
                            onClick={() => setDetailMaterial(m)}
                            className="flex items-center justify-center rounded-full p-1 text-[#717971] hover:bg-[#f0eee6] hover:text-[#1b1c17]"
                          >
                            <span className="material-symbols-outlined text-[16px]">info</span>
                          </button>
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
    </>
  )
}
