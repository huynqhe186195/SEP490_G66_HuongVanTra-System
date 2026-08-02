import { useEffect, useMemo, useRef, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { searchMaterials } from '../services/bomApi.js'
import { getBomQuantityValidationMessage } from '../utils/bomUnitRules.js'
import { getInventoryUnitShortLabel } from '../utils/productTypes.js'

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function getMaterialUnit(material) {
  const inventoryUnit = getInventoryUnitShortLabel(material?.inventoryUnit)
  if (inventoryUnit) return inventoryUnit

  const baseUnit = material?.units?.find((u) => u.isBaseUnit) || material?.units?.[0]
  return (
    material?.materialUnitName ||
    material?.materialUnit ||
    baseUnit?.unitName ||
    material?.baseUnit ||
    material?.base_unit ||
    ''
  )
}

function getComponentSkuOptions(products) {
  return products.flatMap((product) => {
    const variants = product.variants?.length ? product.variants : product.skus ?? []
    return variants
      .filter((variant) => variant.canBeBomComponent === true && variant.isActive !== false)
      .map((variant) => ({
        id: variant.id,
        material_id: product.id,
        materialName: product.name,
        materialUnitName: getMaterialUnit(product),
        componentVariantId: variant.id,
        componentSkuCode: variant.skuCode,
        componentVariantName: variant.variantName || variant.packagingType || variant.unitName || product.name,
        unitName: variant.unitName || '',
      }))
  })
}

function normalizeInitialLine(line) {
  const materialId = line.material_id ?? line.materialId
  const componentVariantId = line.componentVariantId ?? line.ComponentVariantId ?? null
  const materialUnitName =
    line.materialUnitName ??
    line.MaterialUnitName ??
    line.materialUnit ??
    line.MaterialUnit ??
    line.baseUnit ??
    line.BaseUnit ??
    line.base_unit ??
    ''
  return {
    material_id: materialId,
    materialName: line.materialName ?? line.MaterialName ?? line.name ?? '',
    materialUnitName,
    baseUnit: materialUnitName,
    quantity: line.quantity,
    componentVariantId,
    componentSkuCode: line.componentSkuCode ?? line.ComponentSkuCode ?? '',
    componentVariantName: line.componentVariantName ?? line.ComponentVariantName ?? '',
    isRequiredBaseComponent: Boolean(line.isRequiredBaseComponent ?? line.IsRequiredBaseComponent ?? false),
  }
}

export default function ProductBomConfigModal({
  isOpen,
  onClose,
  variant,
  initialLines = [],
  onConfirm,
}) {
  const [lines, setLines] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [materialCache, setMaterialCache] = useState({})
  const dropdownRef = useRef(null)

  const debouncedSearch = useDebounce(searchInput, 300)

  useEffect(() => {
    if (!isOpen) return undefined
    const normalizedLines = initialLines.length > 0 ? initialLines.map(normalizeInitialLine) : []
    const timer = window.setTimeout(() => {
      const next = {}
      for (const line of normalizedLines) {
        if ((!line.material_id && !line.componentVariantId) || !line.materialName) continue
        const cached = {
          id: line.material_id,
          componentVariantId: line.componentVariantId,
          componentSkuCode: line.componentSkuCode,
          componentVariantName: line.componentVariantName,
          name: line.materialName,
          materialName: line.materialName,
          materialUnitName: line.materialUnitName,
          baseUnit: line.baseUnit,
        }
        if (line.material_id) next[line.material_id] = cached
        if (line.componentVariantId) next[line.componentVariantId] = cached
      }
      setLines(normalizedLines)
      setSearchInput('')
      setSearchResults([])
      setIsSaving(false)
      setMaterialCache(next)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isOpen, initialLines])

  useEffect(() => {
    if (!isOpen) return undefined
    const term = debouncedSearch.trim()
    if (!term) {
      const timer = window.setTimeout(() => setSearchResults([]), 0)
      return () => window.clearTimeout(timer)
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      setIsSearching(true)
      searchMaterials(term, 20)
        .then((items) => {
          if (cancelled) return
          const options = getComponentSkuOptions(items)
          setSearchResults(options)
          setMaterialCache((prev) => {
            const next = { ...prev }
            for (const item of items) next[item.id] = item
            for (const option of options) next[option.componentVariantId] = option
            return next
          })
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [debouncedSearch, isOpen])

  const usedIds = useMemo(
    () => new Set(lines.map((line) => String(line.componentVariantId || line.material_id))),
    [lines],
  )

  function addMaterial(option) {
    if (usedIds.has(String(option.componentVariantId || option.material_id))) return
    setMaterialCache((prev) => ({ ...prev, [option.componentVariantId]: option, [option.material_id]: option }))
    setLines((prev) => [...prev, {
      material_id: option.material_id,
      materialName: option.materialName,
      materialUnitName: option.materialUnitName,
      quantity: 1,
      componentVariantId: option.componentVariantId,
      componentSkuCode: option.componentSkuCode,
      componentVariantName: option.componentVariantName,
      isRequiredBaseComponent: false,
    }])
    setSearchInput('')
    setSearchResults([])
  }

  function updateQuantity(index, value) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: value } : row)))
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleConfirm() {
    const validLines = lines.filter((line) => line.material_id || line.componentVariantId || line.componentSkuCode)
    const duplicate = validLines.find(
      (line, index) => validLines.findIndex((candidate) =>
        String(candidate.componentVariantId || candidate.componentSkuCode || candidate.material_id)
        === String(line.componentVariantId || line.componentSkuCode || line.material_id)) !== index,
    )
    if (duplicate) {
      showError('Không được chọn trùng nguyên liệu trong một BOM.')
      return
    }

    for (const line of validLines) {
      const material = materialCache[line.componentVariantId] ?? materialCache[line.material_id] ?? line
      const unit = getMaterialUnit(material) || line.materialUnitName || line.baseUnit
      const validationMessage = getBomQuantityValidationMessage(line.quantity, unit)
      if (validationMessage) {
        showError(validationMessage)
        return
      }
    }

    setIsSaving(true)
    try {
      await onConfirm?.(
        validLines.map((line) => ({
          material_id: line.material_id,
          materialId: line.material_id,
          quantity: Number(line.quantity),
          componentVariantId: line.componentVariantId ?? null,
          componentSkuCode: line.componentSkuCode || null,
          isRequiredBaseComponent: Boolean(line.isRequiredBaseComponent),
        })),
      )
      onClose?.()
    } catch {
      // Caller shows the API error toast; keep the modal open for correction.
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !variant) return null

  const title = `Định mức BOM: ${variant.sku || variant.skuCode || variant.attributeLabel || ''}`
  const subtitle = [variant.productName, variant.attributeLabel].filter(Boolean).join(' - ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bom-modal-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="bom-modal-title" className="text-base font-bold text-slate-800 sm:text-lg">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
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

        <div className="border-b border-slate-100 px-6 py-4">
          <label className="block text-xs font-semibold text-slate-500">Thành phần BOM</label>
          <div className="relative mt-2" ref={dropdownRef}>
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            {isSearching ? (
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[18px] text-slate-400">
                progress_activity
              </span>
            ) : null}
            <input
              className="w-full rounded-xl border border-slate-200 bg-[#f0eee6] py-3 pl-10 pr-10 text-sm focus:border-[#356647] focus:outline-none focus:ring-2 focus:ring-[#356647]/15"
              placeholder="Tìm tên hoặc mã SKU thành phần..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput.trim() && (searchResults.length > 0 || isSearching) ? (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {isSearching && searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">Đang tìm...</p>
                ) : null}
                {searchResults.map((option) => {
                  const isUsed = usedIds.has(String(option.componentVariantId || option.material_id))
                  const unitName = option.unitName || option.materialUnitName
                  return (
                    <button
                      key={option.componentVariantId}
                      type="button"
                      disabled={isUsed}
                      onClick={() => addMaterial(option)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>
                        <span className="font-mono text-xs text-[#356647]">{option.componentSkuCode}</span>
                        <span className="ml-2 font-medium text-slate-800">{option.materialName}</span>
                        {isUsed ? <span className="ml-2 text-xs text-slate-400">(đã có)</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{unitName || '—'}</span>
                    </button>
                  )
                })}
                {!isSearching && searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">Không tìm thấy nguyên liệu / bao bì.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
              SKU Sản phẩm kệ này chưa có BOM. Dùng ô tìm kiếm phía trên để thêm nguyên liệu / bao bì.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Thành phần BOM</th>
                    <th className="px-4 py-3 text-center font-semibold">Định mức cho 1 đơn vị Sản phẩm kệ</th>
                    <th className="px-4 py-3 font-semibold">Đơn vị</th>
                    <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, index) => {
                    const material = materialCache[line.componentVariantId] ?? materialCache[line.material_id]
                    const unitName = getMaterialUnit(material) || line.materialUnitName || line.baseUnit
                    return (
                      <tr key={`${line.componentVariantId || line.material_id}-${index}`} className={line.isRequiredBaseComponent ? 'bg-emerald-50/45' : 'hover:bg-slate-50/60'}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <span className="font-mono text-xs text-[#356647]">{line.componentSkuCode || line.material_id}</span>
                          <span className="ml-2">{line.componentVariantName || material?.materialName || material?.name || `#${line.material_id}`}</span>
                          {line.isRequiredBaseComponent ? (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              <span className="material-symbols-outlined text-[14px]">lock</span>
                              Tự động theo quy đổi
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={line.isRequiredBaseComponent}
                            className="mx-auto block w-24 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm focus:border-[#356647] focus:outline-none disabled:border-emerald-100 disabled:bg-emerald-50 disabled:font-semibold disabled:text-emerald-800"
                            value={line.quantity}
                            onChange={(e) => updateQuantity(index, e.target.value)}
                            onKeyDown={(event) => {
                              if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
                                event.preventDefault()
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {unitName || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.isRequiredBaseComponent ? (
                            <span className="text-xs font-semibold text-slate-400">Bắt buộc</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                              Xóa
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-500">{lines.length} component trong BOM</span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className="rounded-xl bg-[#538463] px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#457053]"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu BOM'}
          </button>
        </footer>
      </div>
    </div>
  )
}
