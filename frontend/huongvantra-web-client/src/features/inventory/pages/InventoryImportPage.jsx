import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { canCreateCatalog } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { createWarehouseBatch } from '../services/warehouseBatchApi.js'
import { fetchStockImportSlips, getImportTypeLabel } from '../services/stockImportSlipApi.js'
import { notifyInventoryStockChanged } from '../utils/inventoryStockEvents.js'
import {
  ImportSlipDocument,
  SlipActionButtons,
  SlipPrintStyles,
} from '../components/InventorySlipDocument.jsx'

const EMPTY_HEADER = {
  lotCode: '',
  supplier: '',
  expiresAt: '',
  note: '',
}

function emptyLine() {
  return { key: crypto.randomUUID(), skuId: '', quantity: '', unitCost: '' }
}

function getSlipContentLabel(slip) {
  if (slip.lines?.length > 1) return `${slip.lines.length} dòng thành phẩm`
  if (slip.lines?.length === 1) return slip.lines[0].productSnapshotName || slip.lines[0].skuCode
  return slip.productSnapshotName || slip.skuCode
}

function getSlipQuantity(slip) {
  if (slip.lines?.length) return slip.lines.reduce((sum, line) => sum + line.quantity, 0)
  return slip.quantity
}

function InventoryImportPage() {
  const canManage = canCreateCatalog(loadAuthSession())
  const [skus, setSkus] = useState([])
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [lines, setLines] = useState([emptyLine()])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [importSlips, setImportSlips] = useState([])
  const [isLoadingImportSlips, setIsLoadingImportSlips] = useState(true)
  const [selectedSlip, setSelectedSlip] = useState(null)

  const loadSkus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [skuItems, productsResult] = await Promise.all([
        fetchAllActiveSkus(),
        fetchProducts({ page: 1, pageSize: 100, isActive: true }),
      ])
      const productNameById = new Map(productsResult.items.map((product) => [product.id, product.name]))
      setSkus(
        skuItems.map((sku) => ({
          ...sku,
          productName: productNameById.get(sku.productId) || sku.productName || '',
        })),
      )
    } catch (error) {
      setSkus([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadImportSlips = useCallback(async () => {
    setIsLoadingImportSlips(true)
    try {
      const items = await fetchStockImportSlips()
      setImportSlips(items)
    } catch (error) {
      setImportSlips([])
      showError(error.message)
    } finally {
      setIsLoadingImportSlips(false)
    }
  }, [])

  useEffect(() => {
    loadSkus()
  }, [loadSkus])

  useEffect(() => {
    loadImportSlips()
  }, [loadImportSlips])

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canManage) {
      showError('Chỉ Thủ kho được nhập lô.')
      return
    }
    if (!header.lotCode.trim()) {
      showError('Nhập mã lô.')
      return
    }

    const payloadLines = []
    const usedSkuIds = new Set()
    for (const line of lines) {
      const quantity = Number(line.quantity)
      if (!line.skuId || !Number.isFinite(quantity) || quantity <= 0) continue
      if (usedSkuIds.has(line.skuId)) {
        showError('Mỗi SKU chỉ được xuất hiện một lần trong cùng lô.')
        return
      }
      usedSkuIds.add(line.skuId)
      const sku = skus.find((item) => item.id === line.skuId)
      payloadLines.push({
        skuId: line.skuId,
        skuCode: sku?.skuCode,
        productSnapshotName: sku?.productName,
        quantity,
        unitCost: line.unitCost,
      })
    }

    if (payloadLines.length === 0) {
      showError('Thêm ít nhất một dòng SKU với số lượng > 0.')
      return
    }

    setIsSaving(true)
    try {
      await createWarehouseBatch({
        lotCode: header.lotCode,
        supplier: header.supplier,
        expiresAt: header.expiresAt ? new Date(`${header.expiresAt}T00:00:00`).toISOString() : null,
        note: header.note,
        items: payloadLines,
      })
      const totalQty = payloadLines.reduce((sum, line) => sum + line.quantity, 0)
      showSuccess(
        `Đã nhập lô ${header.lotCode.trim().toUpperCase()} - ${payloadLines.length} SKU, tổng ${totalQty} đơn vị.`,
      )
      notifyInventoryStockChanged()
      await loadImportSlips()
      setHeader(EMPTY_HEADER)
      setLines([emptyLine()])
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <SlipPrintStyles />
      <PageHeader
        title="Nhập lô vào kho"
        description="Một mã lô có thể chứa nhiều SKU; phiếu nhập sản xuất hiển thị theo từng thành phẩm/lô."
        rightContent={<InventoryNavTabs />}
      />

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ tài khoản Thủ kho được nhập lô.
        </p>
      ) : null}

      <form className="grid grid-cols-1 gap-6 xl:grid-cols-3" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin lô</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Mã lô *</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm uppercase"
                placeholder="VD: LO-A05"
                value={header.lotCode}
                onChange={(event) => setHeader((prev) => ({ ...prev, lotCode: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Nhà cung cấp</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplier}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplier: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Hạn sử dụng</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.expiresAt}
                onChange={(event) => setHeader((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold text-[#717971]">Ghi chú</span>
              <textarea
                className="min-h-[60px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.note}
                onChange={(event) => setHeader((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Danh sách SKU trong lô</h2>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Thêm dòng
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 md:grid-cols-12"
              >
                <label className="space-y-1 md:col-span-5">
                  <span className="text-xs font-semibold text-[#717971]">SKU / SP *</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    value={line.skuId}
                    onChange={(event) => updateLine(line.key, { skuId: event.target.value })}
                    disabled={isLoading}
                  >
                    <option value="">Chọn SKU</option>
                    {skus.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {sku.skuCode} - {sku.productName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">SL *</span>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                </label>
                <label className="space-y-1 md:col-span-3">
                  <span className="text-xs font-semibold text-[#717971]">Giá vốn / đv</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    value={line.unitCost}
                    onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                  />
                </label>
                <div className="flex items-end md:col-span-2">
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Xóa dòng {index + 1}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={isSaving || !canManage}
              className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Nhập lô vào kho'}
            </button>
            <Link
              to="/inventory/batches"
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem danh sách lô
            </Link>
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Lưu ý</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Một mã lô có thể gồm nhiều SKU.</li>
            <li>Mỗi SKU chỉ xuất hiện một lần trong cùng lô.</li>
            <li>Hoàn thành ProductionOrder sẽ tự tạo phiếu nhập thành phẩm.</li>
            <li>Thành phẩm sau sản xuất nằm ở kho tổng, chưa vào POS/store stock.</li>
          </ul>
        </aside>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Phiếu nhập kho</h2>
          <p className="mt-1 text-sm text-slate-500">
            Phiếu nhập thành phẩm sau sản xuất có thể gồm nhiều dòng thành phẩm.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Loại nhập</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3 text-right">Số lượng</th>
                <th className="px-4 py-3">Lệnh SX</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingImportSlips ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : importSlips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">
                    Chưa có phiếu nhập thành phẩm sau sản xuất.
                  </td>
                </tr>
              ) : (
                importSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-mono font-semibold text-[#356647]">{slip.importCode}</td>
                    <td className="px-4 py-4 text-slate-700">{getImportTypeLabel(slip.importType)}</td>
                    <td className="px-4 py-4 text-slate-700">{getSlipContentLabel(slip)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">
                      {formatStockQuantity(getSlipQuantity(slip))}
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-700">{slip.productionCode || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {slip.createdAt ? formatVietnamDateTime(slip.createdAt) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(slip)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSlip ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSlip(null)}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="no-print mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">Chi tiết phiếu nhập</h2>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <SlipActionButtons />
            <ImportSlipDocument slip={selectedSlip} getTypeLabel={getImportTypeLabel} />
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default InventoryImportPage
