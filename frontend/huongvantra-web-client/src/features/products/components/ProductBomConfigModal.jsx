import { useEffect, useMemo, useState } from 'react'
import { getMaterials, getProductById } from '../../inventory/data/bomMockData.js'

function emptyLine(materials) {
  const first = materials[0]
  return { material_id: first?.id ?? '', quantity: 1 }
}

export default function ProductBomConfigModal({
  isOpen,
  onClose,
  variant,
  initialLines = [],
  onConfirm,
}) {
  const allMaterials = useMemo(() => getMaterials(), [])
  const [lines, setLines] = useState([])
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLines(initialLines.length > 0 ? initialLines.map((line) => ({ ...line })) : [emptyLine(allMaterials)])
    setSearchInput('')
  }, [isOpen, initialLines, allMaterials])

  const filteredMaterials = useMemo(() => {
    const term = searchInput.trim().toLowerCase()
    if (!term) return []
    return allMaterials.filter((material) => {
      const code = String(material.code || '').toLowerCase()
      const name = String(material.name || '').toLowerCase()
      return code.includes(term) || name.includes(term)
    })
  }, [allMaterials, searchInput])

  const usedMaterialIds = useMemo(() => new Set(lines.map((line) => Number(line.material_id))), [lines])

  function addMaterial(materialId) {
    if (usedMaterialIds.has(Number(materialId))) return
    setLines((current) => [...current, { material_id: Number(materialId), quantity: 1 }])
    setSearchInput('')
  }

  function updateQuantity(index, quantity) {
    setLines((current) => current.map((row, i) => (i === index ? { ...row, quantity } : row)))
  }

  function removeLine(index) {
    setLines((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)))
  }

  function handleConfirm() {
    onConfirm?.(
      lines
        .filter((line) => line.material_id)
        .map((line) => ({
          material_id: Number(line.material_id),
          quantity: Number(line.quantity) || 0,
        })),
    )
    onClose?.()
  }

  if (!isOpen || !variant) return null

  const title = `Cấu hình định mức nguyên liệu cho: ${variant.productName} — ${variant.attributeLabel} (${variant.sku})`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bom-modal-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id="bom-modal-title" className="text-base font-bold uppercase tracking-wide text-slate-800 sm:text-lg">
            {title}
          </h2>
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
          <label className="block text-xs font-semibold text-slate-500">Tìm nguyên liệu</label>
          <div className="relative mt-2">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-[#f0eee6] py-3 pl-10 pr-4 text-sm focus:border-[#356647] focus:outline-none focus:ring-2 focus:ring-[#356647]/15"
              placeholder="Gõ tên hoặc mã nguyên liệu..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput.trim() && filteredMaterials.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {filteredMaterials.map((material) => {
                  const isUsed = usedMaterialIds.has(material.id)
                  return (
                    <button
                      key={material.id}
                      type="button"
                      disabled={isUsed}
                      onClick={() => addMaterial(material.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>
                        <span className="font-mono text-xs text-[#356647]">{material.code || `NL-${material.id}`}</span>
                        <span className="ml-2 font-medium text-slate-800">{material.name}</span>
                      </span>
                      <span className="text-xs text-slate-500">{material.base_unit}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã NL</th>
                  <th className="px-4 py-3 font-semibold">Tên nguyên liệu</th>
                  <th className="px-4 py-3 font-semibold text-center">Số lượng tiêu hao</th>
                  <th className="px-4 py-3 font-semibold">Đơn vị kho</th>
                  <th className="px-4 py-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const material = getProductById(line.material_id)
                  return (
                    <tr key={`${line.material_id}-${index}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#356647]">
                        {material?.code || `NL-${line.material_id}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{material?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="mx-auto block w-24 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm focus:border-[#356647] focus:outline-none"
                          value={line.quantity}
                          onChange={(event) => updateQuantity(index, event.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{material?.base_unit || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-[#538463] px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#457053]"
          >
            Xác nhận
          </button>
        </footer>
      </div>
    </div>
  )
}
