import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'
import { showError } from '../../../app/toast.js'
import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'
import { fetchStoreSkuStocks, buildWarehouseStockBySkuIdMap } from '../../inventory/services/inventoryStockApi.js'
import { PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'

function fmt(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

/** Tem chống giả luôn kèm gói custom — không cho bỏ chọn trong bảng. */
const DEFAULT_CUSTOM_STICKER_SKU_CODE = 'BB-TEM-HVT'

function isDefaultStickerSku(materialOrCode) {
  const code = String(
    typeof materialOrCode === 'string'
      ? materialOrCode
      : materialOrCode?.skuCode || '',
  ).toUpperCase()
  return code === DEFAULT_CUSTOM_STICKER_SKU_CODE
}

/** Sửa unitName bị hỏng encoding (C??i ← Cái) từ seed/import charset sai. */
function normalizeUnitName(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^C\?\?i$/i.test(text) || /^C\uFFFD\uFFFDi$/i.test(text)) return 'Cái'
  return text
}

function parseMoneyInput(val) {
  const cleaned = String(val ?? '').replace(/[^\d]/g, '')
  if (cleaned === '') return ''
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : ''
}

async function fetchMaterials(search = '') {
  const stockPromise = fetchStoreSkuStocks().catch(() => [])
  const types = ['NGUYEN_LIEU', 'BAO_BI']
  const [stocks, ...pages] = await Promise.all([
    stockPromise,
    ...types.map((productType) => {
      const query = new URLSearchParams({
        pageSize: '100',
        page: '1',
        isActive: 'true',
        productType,
      })
      if (search.trim()) query.set('search', search.trim())
      return apiRequestAuth(`/api/v1/store/skus?${query.toString()}`, { method: 'GET' })
    }),
  ])
  const stockBySkuId = buildWarehouseStockBySkuIdMap(stocks)
  const byId = new Map()
  for (const data of pages) {
    const paged = toPagedResult(data)
    for (const item of paged.items ?? []) {
      const skuId = item.id ?? item.Id ?? item.skuId ?? item.SkuId
      if (!skuId || byId.has(skuId)) continue
      const productType = String(item.productType ?? item.ProductType ?? '').toUpperCase()
      const canUseInCustom = Boolean(item.canUseInCustom ?? item.CanUseInCustom)
      if (!['NGUYEN_LIEU', 'BAO_BI'].includes(productType) || !canUseInCustom) continue
      byId.set(skuId, {
        skuId,
        skuCode: item.skuCode ?? item.SkuCode ?? item.code ?? item.Code ?? '',
        name: item.productName ?? item.ProductName ?? item.name ?? item.Name ?? '',
        unitPrice: Number(item.retailPrice ?? item.RetailPrice ?? item.price ?? item.Price ?? 0),
        unitName: normalizeUnitName(item.unitName ?? item.UnitName ?? item.baseUnit ?? item.BaseUnit),
        packagingType: item.packagingType ?? item.PackagingType ?? '',
        description: item.description ?? item.Description ?? '',
        productType,
        canUseInCustom,
        stockOnHand: Number(stockBySkuId.get(skuId) ?? 0),
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
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
          {material.unitName ? (
            <div className="flex justify-between gap-2">
              <span className="text-[#717971]">Đơn vị</span>
              <span className="font-medium text-[#1b1c17]">{material.unitName}</span>
            </div>
          ) : null}
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
  const [priceMap, setPriceMap] = useState({})
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

  const lockedSticker = useMemo(
    () => materials.find((m) => isDefaultStickerSku(m)) ?? null,
    [materials],
  )

  const selectableMaterials = useMemo(
    () => materials.filter((m) => !isDefaultStickerSku(m)),
    [materials],
  )

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadMaterials(val), 350)
  }

  const priceOf = (material) => {
    const override = priceMap[material.skuId]
    if (override === '' || override === undefined || override === null) {
      return Number(material.unitPrice) || 0
    }
    return Number(override) || 0
  }

  const ensureSelected = (skuId, material) => {
    setSelected((prev) => {
      if (prev[skuId]) return prev
      const next = { ...prev, [skuId]: true }
      if (!qtyMap[skuId]) setQtyMap((q) => ({ ...q, [skuId]: 1 }))
      if (material && priceMap[skuId] === undefined) {
        setPriceMap((p) => ({ ...p, [skuId]: Number(material.unitPrice) || 0 }))
      }
      return next
    })
  }

  const adjustQty = (skuId, delta) => {
    const material = materials.find((m) => m.skuId === skuId)
    if (material) ensureSelected(skuId, material)
    setQtyMap((prev) => {
      const current = Math.floor(Number(prev[skuId]))
      const base = Number.isFinite(current) && current >= 1 ? current : 1
      return { ...prev, [skuId]: Math.max(1, base + delta) }
    })
  }

  const toggleRow = (skuId) => {
    const material = materials.find((m) => m.skuId === skuId)
    if (material && isDefaultStickerSku(material)) return

    setSelected((prev) => {
      const next = { ...prev }
      if (next[skuId]) {
        delete next[skuId]
      } else {
        next[skuId] = true
        if (!qtyMap[skuId]) setQtyMap((q) => ({ ...q, [skuId]: 1 }))
        if (material && priceMap[skuId] === undefined) {
          setPriceMap((p) => ({ ...p, [skuId]: Number(material.unitPrice) || 0 }))
        }
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

  const setPrice = (skuId, val) => {
    const parsed = parseMoneyInput(val)
    setPriceMap((prev) => ({ ...prev, [skuId]: parsed }))
  }

  const commitQty = (skuId) => {
    setQtyMap((prev) => {
      const requested = Math.floor(Number(prev[skuId]))
      const validated = Number.isFinite(requested) && requested >= 1 ? requested : 1
      // Sell-first: cho vượt tồn Kho; thiếu NL → backorder lúc thanh toán (giống thành phẩm).
      return { ...prev, [skuId]: validated }
    })
  }

  const selectedMaterials = selectableMaterials.filter((m) => selected[m.skuId])
  const stickerUnitPrice = lockedSticker ? priceOf(lockedSticker) : 0
  const stickerLineTotal = lockedSticker ? stickerUnitPrice * 1 : 0
  const bundleTotal = selectedMaterials.reduce(
    (s, m) => s + priceOf(m) * qtyOf(m.skuId),
    0,
  ) + stickerLineTotal

  const currentBundle = (bundles ?? [])[0] ?? null

  const confirmBundle = () => {
    if (selectedMaterials.length === 0) {
      showError('Chọn ít nhất một nguyên liệu / bao bì (ngoài tem mặc định).')
      return
    }

    if (!lockedSticker) {
      showError('Không tìm thấy tem chống giả (BB-TEM-HVT). Kiểm tra SKU «Dùng trong custom».')
      return
    }

    const zeroPriceItems = selectedMaterials.filter((m) => priceOf(m) <= 0)
    if (zeroPriceItems.length > 0 || stickerUnitPrice <= 0) {
      const names = [
        ...zeroPriceItems.map((m) => m.name),
        stickerUnitPrice <= 0 ? lockedSticker.name : null,
      ].filter(Boolean)
      showError(
        `Nguyên liệu phải có giá bán > 0: ${names.join(', ')}. Nhập giá trên POS hoặc cập nhật giá bán SKU.`,
      )
      return
    }

    const ingredients = selectedMaterials.map((m) => {
      const quantity = qtyOf(m.skuId)
      const unitPrice = priceOf(m)
      return {
        materialSkuId: m.skuId,
        materialSkuCode: m.skuCode,
        materialSnapshotName: m.name,
        unitName: m.unitName || null,
        quantity,
        unitPrice,
        subTotal: unitPrice * quantity,
      }
    })

    ingredients.push({
      materialSkuId: lockedSticker.skuId,
      materialSkuCode: lockedSticker.skuCode,
      materialSnapshotName: lockedSticker.name,
      unitName: lockedSticker.unitName || null,
      quantity: 1,
      unitPrice: stickerUnitPrice,
      subTotal: stickerUnitPrice,
    })

    const newBundle = {
      label: label.trim() || null,
      note: null,
      bundleQuantity: 1,
      ingredients,
    }
    onChange([newBundle])
    setSelected({})
    setQtyMap({})
    setPriceMap({})
    setLabel('')
  }

  const clearBundle = () => {
    onChange([])
    setSelected({})
    setQtyMap({})
    setPriceMap({})
    setLabel('')
  }

  const canConfirm = selectedMaterials.length > 0

  return (
    <>
      <DetailModal material={detailMaterial} onClose={() => setDetailMaterial(null)} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-[#c1c9c0]/40 bg-white px-4 py-2.5">
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
            disabled={!canConfirm}
            className="shrink-0 rounded-lg bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a5238] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {currentBundle ? 'Cập nhật gói' : 'Thêm vào đơn'}
          </button>
        </div>

        <CustomScrollArea className="flex-1" contentClassName="flex flex-col gap-4 p-4">
        {/* Current bundle summary */}
        {currentBundle && (
          <div className="rounded-xl border border-[#356647]/40 bg-[#f3f8f3] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#1b1c17]">
                {PERSONAL_PRODUCT_LABEL} đã chọn{currentBundle.label ? ` — ${currentBundle.label}` : ''}
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
                    <td className="py-1 pr-2 text-right text-[#717971]">
                      ×{ing.quantity}
                      {ing.unitName ? ` ${ing.unitName}` : ''}
                    </td>
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
            {(selectedMaterials.length > 0 || lockedSticker) && (
              <span className="text-xs font-medium text-[#356647]">
                {selectedMaterials.length} đã chọn
                {lockedSticker ? ' + tem' : ''} · {fmt(bundleTotal)}
              </span>
            )}
          </div>

          {lockedSticker ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#356647]/30 bg-[#f3f8f3] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#356647]">Kèm mặc định</p>
                <p className="text-sm font-semibold text-[#1b1c17]">
                  {lockedSticker.name}
                  <span className="ml-2 font-mono text-xs font-normal text-[#717971]">
                    {lockedSticker.skuCode}
                  </span>
                </p>
                <p className="text-xs text-[#717971]">
                  Luôn kèm 1 tem · tồn {lockedSticker.stockOnHand.toLocaleString('vi-VN')}
                  {lockedSticker.unitName ? ` ${lockedSticker.unitName}` : ''}
                  {lockedSticker.stockOnHand < 1 ? ' · bán trước, trừ sau' : ''}
                  {' · '}{fmt(stickerUnitPrice)}
                </p>
              </div>
              <span className="rounded-full bg-[#356647] px-2.5 py-1 text-xs font-bold text-white">
                ×1 cố định
              </span>
            </div>
          ) : !loading && !search.trim() ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chưa có tem chống giả (BB-TEM-HVT) trong danh mục custom — kiểm tra SKU «Dùng trong custom».
            </p>
          ) : null}

          <input
            type="text"
            placeholder="Tìm nguyên liệu..."
            value={search}
            onChange={handleSearchChange}
            className="mb-3 w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#356647]"
          />

          {loading ? (
            <p className="py-6 text-center text-xs text-[#717971]">Đang tải...</p>
          ) : selectableMaterials.length === 0 ? (
            <div className="space-y-1 py-6 text-center text-xs text-[#717971]">
              <p>{search.trim() ? 'Không tìm thấy nguyên liệu khớp từ khóa.' : `Chưa có nguyên liệu được phép dùng cho ${PERSONAL_PRODUCT_LABEL.toLowerCase()}.`}</p>
              {!search.trim() ? (
                <p className="text-[11px] text-[#9aa39a]">
                  Trên SKU loại Nguyên liệu / Bao bì, bật «Dùng trong custom» rồi đồng bộ cửa hàng.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#c1c9c0]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c1c9c0] bg-[#f6f4ec]">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#717971]">Sản Phẩm</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Tồn đang có</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Giá/đv</th>
                    <th className="w-28 px-3 py-2 text-center text-xs font-semibold text-[#717971]">Số lượng</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#717971]">Thành tiền</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {selectableMaterials.map((m) => {
                    const isSelected = Boolean(selected[m.skuId])
                    const qtyValue = qtyMap[m.skuId] ?? 1
                    const unitPrice = priceOf(m)
                    const priceInputValue =
                      priceMap[m.skuId] === ''
                        ? ''
                        : priceMap[m.skuId] !== undefined
                          ? priceMap[m.skuId]
                          : m.unitPrice
                    const missingCatalogPrice = Number(m.unitPrice) <= 0
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
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-[#1b1c17]">{m.name}</p>
                          <p className="font-mono text-[11px] text-[#717971]">{m.skuCode}</p>
                          {missingCatalogPrice ? (
                            <p className="text-[11px] text-amber-700">SKU chưa có giá bán — nhập giá khi chọn</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className={m.stockOnHand <= 0 || (isSelected && qtyOf(m.skuId) > m.stockOnHand) ? 'font-semibold text-red-500' : 'text-[#1b1c17]'}>
                            <span>
                              {m.stockOnHand.toLocaleString('vi-VN')}
                              {m.unitName ? (
                                <span className="ml-1 text-xs font-normal text-[#717971]">{m.unitName}</span>
                              ) : null}
                            </span>
                            {isSelected && qtyOf(m.skuId) > m.stockOnHand ? (
                              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-amber-700">
                                bán trước, trừ sau
                              </p>
                            ) : m.stockOnHand <= 0 ? (
                              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-amber-700">
                                bán trước, trừ sau
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className="px-3 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isSelected ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={priceInputValue}
                              onChange={(e) => setPrice(m.skuId, e.target.value)}
                              className={`w-24 rounded border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#356647] ${
                                unitPrice <= 0
                                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                                  : 'border-[#c1c9c0] text-[#1b1c17]'
                              }`}
                              title="Đơn giá bán (đ)"
                            />
                          ) : (
                            <span className={missingCatalogPrice ? 'text-amber-700' : 'text-[#717971]'}>
                              {fmt(m.unitPrice)}
                            </span>
                          )}
                        </td>
                        <td
                          className="w-28 px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => adjustQty(m.skuId, -1)}
                              className="flex size-7 items-center justify-center rounded-md border border-[#c1c9c0] text-[#356647] hover:bg-[#f0f5f1] disabled:opacity-40"
                              disabled={!isSelected || qtyOf(m.skuId) <= 1}
                              aria-label="Giảm số lượng"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={isSelected ? qtyValue : ''}
                              placeholder="—"
                              onFocus={() => ensureSelected(m.skuId, m)}
                              onChange={(e) => {
                                ensureSelected(m.skuId, m)
                                setQty(m.skuId, e.target.value)
                              }}
                              onBlur={() => commitQty(m.skuId)}
                              className="w-12 rounded border border-[#c1c9c0] px-1 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#356647]"
                            />
                            <button
                              type="button"
                              onClick={() => adjustQty(m.skuId, 1)}
                              className="flex size-7 items-center justify-center rounded-md border border-[#c1c9c0] text-[#356647] hover:bg-[#f0f5f1]"
                              aria-label="Tăng số lượng"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                            {m.unitName ? (
                              <span className="min-w-[1.5rem] text-left text-xs font-medium text-[#717971]">
                                {m.unitName}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          {isSelected ? (
                            <span className={unitPrice <= 0 ? 'text-amber-700' : 'text-[#356647]'}>
                              {fmt(unitPrice * qtyOf(m.skuId))}
                            </span>
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

        </div>
        </CustomScrollArea>
      </div>
    </>
  )
}
