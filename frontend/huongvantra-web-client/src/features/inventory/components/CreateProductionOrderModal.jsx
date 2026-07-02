import { useEffect, useRef, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { fetchProductById, fetchProducts } from '../../products/services/productsApi.js'
import { fetchSkusByProductId, fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { createProductionOrder } from '../services/productionOrderApi.js'

const STEPS = ['Thành phẩm đầu ra', 'Nguyên liệu (BOM)', 'Xác nhận']

function sameId(left, right) {
  return String(left ?? '') === String(right ?? '')
}

function createOutputRow() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    skuId: '',
    quantity: '',
  }
}

function resolveSelectedVariant(product, sku) {
  if (!product || !sku) return null

  const variants = product.variants ?? []
  const variantIdCandidates = [
    sku.variantId,
    sku.productVariantId,
    sku.productVariantID,
    sku.skuId,
    sku.id,
  ].filter(Boolean)

  const byId = variants.find((variant) =>
    variantIdCandidates.some((candidate) => sameId(candidate, variant.id)),
  )
  if (byId) return byId

  if (sku.skuCode) {
    return variants.find((variant) => variant.skuCode === sku.skuCode) ?? null
  }

  return null
}

async function fetchFinishedProductsForProduction() {
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

function formatQuantity(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

function getSkuDisplayName(sku) {
  if (!sku) return ''
  return [sku.skuCode, sku.productName].filter(Boolean).join(' - ')
}

function CreateProductionOrderModal({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState(0)

  // Step 0
  const [tpSkus, setTpSkus] = useState([])
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [outputRows, setOutputRows] = useState([createOutputRow()])

  // Step 1 - aggregated BOM lines:
  // { materialId, materialName, requiredQuantity, skuId, skuCode, snapshotName, skuOptions }
  const [bomLines, setBomLines] = useState([])
  const [loadingBom, setLoadingBom] = useState(false)
  const [bomError, setBomError] = useState('')

  // Step 2
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  const prevIsOpen = useRef(false)

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setStep(0)
      setOutputRows([createOutputRow()])
      setBomLines([])
      setBomError('')
      setNote('')
      setLoadingSkus(true)
      Promise.all([fetchAllActiveSkus(), fetchFinishedProductsForProduction()])
        .then(([items, finishedProducts]) => {
          const finishedProductIds = new Set(
            finishedProducts.map((product) => String(product.id)),
          )
          const tp = items.filter(
            (sku) => finishedProductIds.has(String(sku.productId)) && sku.isSellable !== false,
          )
          setTpSkus(tp)
        })
        .catch((err) => showError(err.message))
        .finally(() => setLoadingSkus(false))
    }
    prevIsOpen.current = isOpen
  }, [isOpen])

  if (!isOpen) return null

  const selectedOutputs = outputRows
    .map((row) => ({
      ...row,
      sku: tpSkus.find((sku) => sameId(sku.id, row.skuId)) ?? null,
      quantityNumber: Number(row.quantity),
    }))
    .filter((row) => row.skuId)

  function updateOutputRow(key, changes) {
    setOutputRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    )
    setBomLines([])
    setBomError('')
  }

  function addOutputRow() {
    setOutputRows((prev) => [...prev, createOutputRow()])
    setBomLines([])
    setBomError('')
  }

  function removeOutputRow(key) {
    setOutputRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)))
    setBomLines([])
    setBomError('')
  }

  function validateOutputRows() {
    const rows = outputRows.map((row) => ({
      ...row,
      sku: tpSkus.find((sku) => sameId(sku.id, row.skuId)) ?? null,
      quantityNumber: Number(row.quantity),
    }))

    if (rows.length === 0) {
      showError('Cần có ít nhất một thành phẩm đầu ra.')
      return null
    }

    for (const row of rows) {
      if (!row.skuId) {
      showError('Vui lòng chọn SKU thành phẩm cho tất cả dòng đầu ra.')
      return null
    }
      if (!row.sku) {
        showError('SKU thành phẩm không hợp lệ.')
        return null
      }
      if (!Number.isFinite(row.quantityNumber) || row.quantityNumber <= 0) {
        showError('Số lượng sản xuất phải lớn hơn 0.')
        return null
      }
    }

    const duplicate = rows.find(
      (row, index) => rows.findIndex((candidate) => sameId(candidate.skuId, row.skuId)) !== index,
    )
    if (duplicate) {
      showError(`Không chọn trùng SKU thành phẩm: ${duplicate.sku?.skuCode ?? duplicate.skuId}.`)
      return null
    }

    return rows
  }

  async function handleNextStep0() {
    const rows = validateOutputRows()
    if (!rows) return

    setLoadingBom(true)
    setBomError('')
    setBomLines([])
    setStep(1)

    try {
      const materialSkuOptionsCache = new Map()
      const aggregated = new Map()

      for (const output of rows) {
        const product = output.sku?.productId ? await fetchProductById(output.sku.productId) : null
        const selectedVariant = resolveSelectedVariant(product, output.sku)

        if (!selectedVariant) {
          throw new Error(
            `Không xác định được biến thể của SKU ${output.sku?.skuCode ?? ''}. Vui lòng kiểm tra dữ liệu SKU/ProductVariant trước khi tạo lệnh.`,
          )
        }

        const bomLinesDef = selectedVariant.bomLines ?? []
        if (bomLinesDef.length === 0) {
          throw new Error(`SKU ${output.sku?.skuCode ?? ''} chưa có BOM, không thể tạo lệnh sản xuất.`)
        }

        for (const bomLine of bomLinesDef) {
          const materialId = bomLine.materialId
          const bomQty = Number(bomLine.quantity)
          if (!materialId || !Number.isFinite(bomQty) || bomQty <= 0) {
            throw new Error(`BOM của SKU ${output.sku?.skuCode ?? ''} có dòng nguyên liệu không hợp lệ.`)
          }

          const key = String(materialId)
          const current = aggregated.get(key) ?? {
            materialId,
            materialName: bomLine.materialName,
            requiredQuantity: 0,
            skuId: '',
            skuCode: '',
            snapshotName: '',
            skuOptions: [],
          }
          current.requiredQuantity += bomQty * output.quantityNumber
          aggregated.set(key, current)
        }
      }

      const enriched = await Promise.all(
        Array.from(aggregated.values()).map(async (line) => {
          const key = String(line.materialId)
          let skuOptions = materialSkuOptionsCache.get(key)
          if (!skuOptions) {
            try {
              skuOptions = await fetchSkusByProductId(line.materialId)
            } catch {
              skuOptions = []
            }
            materialSkuOptionsCache.set(key, skuOptions)
          }

          return {
            ...line,
            skuId: skuOptions.length === 1 ? skuOptions[0].id : '',
            skuCode: skuOptions.length === 1 ? skuOptions[0].skuCode : '',
            snapshotName: skuOptions.length === 1 ? skuOptions[0].productName : '',
            skuOptions,
          }
        }),
      )

      setBomLines(enriched)
    } catch (err) {
      setBomLines([])
      setBomError(err.message)
      showError(err.message)
    } finally {
      setLoadingBom(false)
    }
  }

  function updateBomLineSku(materialId, skuId) {
    setBomLines((prev) =>
      prev.map((line) => {
        if (!sameId(line.materialId, materialId)) return line
        const sku = line.skuOptions.find((item) => sameId(item.id, skuId))
        return {
          ...line,
          skuId,
          skuCode: sku?.skuCode ?? '',
          snapshotName: sku?.productName ?? '',
        }
      }),
    )
  }

  function validateBomLines() {
    if (bomLines.length === 0) {
      showError(bomError || 'SKU thành phẩm chưa có BOM, không thể tạo lệnh sản xuất.')
      return false
    }
    const withoutSkuOptions = bomLines.find((line) => line.skuOptions.length === 0)
    if (withoutSkuOptions) {
      showError(`Nguyên liệu "${withoutSkuOptions.materialName}" chưa có SKU để xuất kho.`)
      return false
    }
    const missing = bomLines.find((line) => !line.skuId)
    if (missing) {
      showError(`Chọn SKU cho nguyên liệu "${missing.materialName}".`)
      return false
    }
    return true
  }

  function handleNextStep1() {
    if (!validateBomLines()) return
    setStep(2)
  }

  async function handleSubmit() {
    const rows = validateOutputRows()
    if (!rows || !validateBomLines()) return

    const firstOutput = rows[0]
    setSaving(true)
    try {
      const order = await createProductionOrder({
        finishedSkuId: firstOutput.skuId,
        finishedSkuCode: firstOutput.sku?.skuCode ?? '',
        finishedSkuSnapshotName: firstOutput.sku?.productName ?? '',
        quantity: firstOutput.quantityNumber,
        note,
        outputs: rows.map((row) => ({
          finishedSkuId: row.skuId,
          finishedSkuCode: row.sku?.skuCode ?? '',
          finishedSkuSnapshotName: row.sku?.productName ?? '',
          quantity: row.quantityNumber,
        })),
        lines: bomLines.map((line) => ({
          materialSkuId: line.skuId,
          materialSkuCode: line.skuCode,
          materialSnapshotName: line.snapshotName,
          plannedQuantity: line.requiredQuantity,
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
        className="flex h-[min(760px,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Tạo lệnh sản xuất</h2>
            <p className="mt-0.5 text-xs text-[#717971]">
              Bước {step + 1} / {STEPS.length} - {STEPS[step]}
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

        <div className="flex gap-1 px-6 py-3">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors ${index <= step ? 'bg-[#538463]' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {outputRows.map((row, index) => (
                  <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Thành phẩm đầu ra {index + 1}</p>
                      {outputRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOutputRow(row.key)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600"
                          aria-label="Xóa thành phẩm"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[#717971]">SKU thành phẩm *</span>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                          value={row.skuId}
                          onChange={(event) => updateOutputRow(row.key, { skuId: event.target.value })}
                          disabled={loadingSkus}
                        >
                          <option value="">{loadingSkus ? 'Đang tải...' : 'Chọn SKU thành phẩm'}</option>
                          {tpSkus.map((sku) => (
                            <option key={sku.id} value={sku.id}>
                              {sku.skuCode} - {sku.productName}
                              {sku.variantName ? ` (${sku.variantName})` : ''}
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
                          value={row.quantity}
                          onChange={(event) => updateOutputRow(row.key, { quantity: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOutputRow}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#538463]/30 px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#f3f7f4]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Thêm thành phẩm
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              {loadingBom ? (
                <p className="py-8 text-center text-sm text-slate-500">Đang tải BOM...</p>
              ) : bomLines.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {bomError || 'SKU thành phẩm chưa có BOM, không thể tạo lệnh sản xuất.'}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-100 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Thành phẩm đầu ra</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[#717971]">
                          <tr>
                            <th className="px-4 py-2 font-semibold">SKU thành phẩm</th>
                            <th className="px-4 py-2 text-right font-semibold">Số lượng sản xuất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOutputs.map((output) => (
                            <tr key={output.key}>
                              <td className="px-4 py-2 font-medium text-slate-800">{getSkuDisplayName(output.sku)}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                {formatQuantity(output.quantityNumber)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Tổng nguyên liệu theo BOM</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Nguyên liệu được cộng dồn từ BOM của tất cả thành phẩm đầu ra.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[#717971]">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Nguyên liệu</th>
                            <th className="px-4 py-2 font-semibold">SKU xuất kho</th>
                            <th className="px-4 py-2 text-right font-semibold">Số lượng cần xuất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bomLines.map((line) => (
                            <tr key={line.materialId}>
                              <td className="px-4 py-2 font-medium text-slate-800">{line.materialName}</td>
                              <td className="px-4 py-2">
                                {line.skuOptions.length === 0 ? (
                                  <span className="text-red-600">Nguyên liệu chưa có SKU nào.</span>
                                ) : line.skuOptions.length === 1 ? (
                                  <span className="font-mono font-semibold text-[#356647]">{line.skuCode}</span>
                                ) : (
                                  <select
                                    className="w-full min-w-44 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                                    value={line.skuId}
                                    onChange={(event) => updateBomLineSku(line.materialId, event.target.value)}
                                  >
                                    <option value="">- Chọn SKU -</option>
                                    {line.skuOptions.map((sku) => (
                                      <option key={sku.id} value={sku.id}>
                                        {sku.skuCode}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                {formatQuantity(line.requiredQuantity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Thành phẩm đầu ra</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[#717971]">
                      <tr>
                        <th className="px-4 py-2 font-semibold">SKU thành phẩm</th>
                        <th className="px-4 py-2 text-right font-semibold">Số lượng sản xuất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOutputs.map((output) => (
                        <tr key={output.key}>
                          <td className="px-4 py-2 font-medium text-slate-800">{getSkuDisplayName(output.sku)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">
                            {formatQuantity(output.quantityNumber)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {bomLines.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Nguyên liệu cần xuất</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[#717971]">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Nguyên liệu</th>
                          <th className="px-4 py-2 font-semibold">SKU xuất kho</th>
                          <th className="px-4 py-2 text-right font-semibold">Số lượng cần xuất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bomLines.map((line) => (
                          <tr key={line.materialId}>
                            <td className="px-4 py-2 font-medium text-slate-800">{line.materialName}</td>
                            <td className="px-4 py-2 font-mono font-semibold text-[#356647]">{line.skuCode}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-800">
                              {formatQuantity(line.requiredQuantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#717971]">Ghi chú (tuỳ chọn)</span>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ghi chú thêm về lệnh sản xuất..."
                />
              </label>
            </div>
          )}
        </main>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {step === 0 ? 'Huỷ' : 'Quay lại'}
          </button>

          {step === 0 && (
            <button
              type="button"
              onClick={handleNextStep0}
              disabled={loadingSkus}
              className="rounded-xl bg-[#538463] px-5 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              Tiếp theo
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={handleNextStep1}
              disabled={loadingBom}
              className="rounded-xl bg-[#538463] px-5 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              Tiếp theo
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
