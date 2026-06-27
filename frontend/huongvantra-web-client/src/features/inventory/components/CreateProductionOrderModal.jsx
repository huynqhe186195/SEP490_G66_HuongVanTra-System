import { useEffect, useRef, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { fetchProductById } from '../../products/services/productsApi.js'
import { fetchSkusByProductId, fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { createProductionOrder } from '../services/productionOrderApi.js'

const STEPS = ['Chọn thành phẩm', 'Nguyên liệu (BOM)', 'Xác nhận']

function CreateProductionOrderModal({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState(0)

  // Step 0
  const [tpSkus, setTpSkus] = useState([])
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [selectedSkuId, setSelectedSkuId] = useState('')
  const [quantity, setQuantity] = useState('')

  // Step 1 — BOM lines: { materialId, materialName, bomQty, skuId, skuCode, snapshotName, skuOptions }
  const [bomLines, setBomLines] = useState([])
  const [loadingBom, setLoadingBom] = useState(false)

  // Step 2
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  const prevIsOpen = useRef(false)

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setStep(0)
      setSelectedSkuId('')
      setQuantity('')
      setBomLines([])
      setNote('')
      setLoadingSkus(true)
      fetchAllActiveSkus()
        .then((items) => {
          const tp = items.filter(
            (s) => !s.productType || s.productType === 'THANH_PHAM',
          )
          setTpSkus(tp)
        })
        .catch((err) => showError(err.message))
        .finally(() => setLoadingSkus(false))
    }
    prevIsOpen.current = isOpen
  }, [isOpen])

  if (!isOpen) return null

  const selectedSku = tpSkus.find((s) => s.id === selectedSkuId)

  async function handleNextStep0() {
    const qty = Number(quantity)
    if (!selectedSkuId) return showError('Chọn thành phẩm.')
    if (!qty || qty <= 0) return showError('Số lượng phải lớn hơn 0.')

    setLoadingBom(true)
    setStep(1)
    try {
      const product = selectedSku?.productId ? await fetchProductById(selectedSku.productId) : null
      const bomLinesDef = product?.variants?.[0]?.bomLines ?? []

      if (bomLinesDef.length === 0) {
        setBomLines([])
        setLoadingBom(false)
        return
      }

      const enriched = await Promise.all(
        bomLinesDef.map(async (bl) => {
          let skuOptions = []
          try {
            skuOptions = await fetchSkusByProductId(bl.materialId)
          } catch {
            skuOptions = []
          }
          return {
            materialId: bl.materialId,
            materialName: bl.materialName,
            bomQty: bl.quantity,
            skuId: skuOptions.length === 1 ? skuOptions[0].id : '',
            skuCode: skuOptions.length === 1 ? skuOptions[0].skuCode : '',
            snapshotName: skuOptions.length === 1 ? skuOptions[0].productName : '',
            skuOptions,
          }
        }),
      )
      setBomLines(enriched)
    } catch (err) {
      showError(err.message)
    } finally {
      setLoadingBom(false)
    }
  }

  function updateBomLineSku(materialId, skuId) {
    setBomLines((prev) =>
      prev.map((l) => {
        if (l.materialId !== materialId) return l
        const sku = l.skuOptions.find((s) => s.id === skuId)
        return {
          ...l,
          skuId,
          skuCode: sku?.skuCode ?? '',
          snapshotName: sku?.productName ?? '',
        }
      }),
    )
  }

  function handleNextStep1() {
    if (bomLines.length === 0)
      return showError('Thành phẩm này chưa có BOM. Vui lòng cấu hình BOM trước khi tạo lệnh.')
    const missing = bomLines.find((l) => !l.skuId)
    if (missing) return showError(`Chọn SKU cho nguyên liệu "${missing.materialName}".`)
    setStep(2)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const qty = Number(quantity)
      const order = await createProductionOrder({
        finishedSkuId: selectedSkuId,
        finishedSkuCode: selectedSku?.skuCode ?? '',
        finishedSkuSnapshotName: selectedSku?.productName ?? '',
        quantity: qty,
        note,
        lines: bomLines.map((l) => ({
          materialSkuId: l.skuId,
          materialSkuCode: l.skuCode,
          materialSnapshotName: l.snapshotName,
          plannedQuantity: l.bomQty * qty,
        })),
      })
      onCreated?.(order)
      onClose()
    } catch (err) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[min(680px,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Tạo lệnh sản xuất</h2>
            <p className="mt-0.5 text-xs text-[#717971]">
              Bước {step + 1} / {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 py-3">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#538463]' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── Step 0: Chọn thành phẩm ── */}
          {step === 0 && (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#717971]">Thành phẩm (SKU) *</span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  value={selectedSkuId}
                  onChange={(e) => setSelectedSkuId(e.target.value)}
                  disabled={loadingSkus}
                >
                  <option value="">{loadingSkus ? 'Đang tải...' : 'Chọn SKU thành phẩm'}</option>
                  {tpSkus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.skuCode} — {s.productName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#717971]">Số lượng sản xuất *</span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  placeholder="VD: 100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* ── Step 1: BOM & SKU nguyên liệu ── */}
          {step === 1 && (
            <div>
              {loadingBom ? (
                <p className="py-8 text-center text-sm text-slate-500">Đang tải BOM...</p>
              ) : bomLines.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Thành phẩm này chưa có BOM. Lệnh sẽ được tạo không có nguyên liệu.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#717971]">
                    Số lượng nguyên liệu tính theo BOM × <strong>{quantity}</strong> đơn vị TP.
                  </p>
                  {bomLines.map((l) => (
                    <div
                      key={l.materialId}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                    >
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-slate-800">{l.materialName}</span>
                        <span className="text-xs font-medium text-[#538463]">
                          {l.bomQty} × {quantity} = <strong>{l.bomQty * Number(quantity)}</strong>
                        </span>
                      </div>
                      {l.skuOptions.length === 0 ? (
                        <p className="text-xs text-red-600">Nguyên liệu chưa có SKU nào.</p>
                      ) : l.skuOptions.length === 1 ? (
                        <p className="text-xs text-slate-500">
                          SKU: <span className="font-medium text-slate-700">{l.skuCode}</span>
                        </p>
                      ) : (
                        <label className="block space-y-1">
                          <span className="text-xs text-[#717971]">Chọn SKU *</span>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                            value={l.skuId}
                            onChange={(e) => updateBomLineSku(l.materialId, e.target.value)}
                          >
                            <option value="">— Chọn SKU —</option>
                            {l.skuOptions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.skuCode}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Xác nhận ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-[#717971]">
                  <span>Thành phẩm</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSku?.skuCode} — {selectedSku?.productName}
                  </span>
                  <span>Số lượng</span>
                  <span className="font-semibold text-slate-800">{quantity}</span>
                </div>
                {bomLines.length > 0 && (
                  <>
                    <p className="mb-2 text-xs font-semibold text-[#717971]">Nguyên liệu cần xuất:</p>
                    <ul className="space-y-1">
                      {bomLines.map((l) => (
                        <li key={l.materialId} className="flex justify-between text-xs">
                          <span className="text-slate-600">
                            {l.materialName} ({l.skuCode})
                          </span>
                          <span className="font-semibold text-slate-800">
                            {l.bomQty * Number(quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#717971]">Ghi chú (tuỳ chọn)</span>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm về lệnh sản xuất..."
                />
              </label>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {step === 0 ? 'Huỷ' : '← Quay lại'}
          </button>

          {step === 0 && (
            <button
              type="button"
              onClick={handleNextStep0}
              disabled={loadingSkus}
              className="rounded-xl bg-[#538463] px-5 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              Tiếp theo →
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={handleNextStep1}
              disabled={loadingBom}
              className="rounded-xl bg-[#538463] px-5 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              Tiếp theo →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-[#538463] px-5 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {saving ? 'Đang tạo...' : 'Tạo lệnh sản xuất'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default CreateProductionOrderModal
