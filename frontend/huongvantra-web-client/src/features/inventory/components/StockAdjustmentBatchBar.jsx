import { useEffect, useMemo, useState } from 'react'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canAdjustStoreStock } from '../../auth/utils/permissions.js'
import BatchStockAdjustmentModal from '../../products/components/BatchStockAdjustmentModal.jsx'
import { buildStockBySkuIdMap, fetchSkuStocks } from '../services/inventoryStockApi.js'
import { batchLinesToModalInput } from '../utils/stockAdjustmentBatchStore.js'
import { useStockAdjustmentBatch } from '../hooks/useStockAdjustmentBatch.js'

export default function StockAdjustmentBatchBar() {
  const session = loadAuthSession()
  const canAdjust = canAdjustStoreStock(session)
  const { lines, count, clear } = useStockAdjustmentBatch()
  const [showModal, setShowModal] = useState(false)
  const [stockBySkuId, setStockBySkuId] = useState(() => new Map())

  useEffect(() => {
    if (!canAdjust || count === 0) return undefined
    let mounted = true
    fetchSkuStocks()
      .then((stocks) => {
        if (mounted) setStockBySkuId(buildStockBySkuIdMap(stocks))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [canAdjust, count, showModal])

  const modalLines = useMemo(
    () =>
      batchLinesToModalInput(
        lines.map((line) => ({
          ...line,
          quantityOnHand: stockBySkuId.has(line.skuId)
            ? Number(stockBySkuId.get(line.skuId) ?? line.quantityOnHand)
            : line.quantityOnHand,
        })),
      ),
    [lines, stockBySkuId],
  )

  if (!canAdjust || count === 0) return null

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#356647]/25 bg-white px-4 py-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Yêu cầu bổ sung tồn quầy đang soạn: <span className="text-[#356647]">{count} SKU</span>
            </p>
            <p className="text-xs text-slate-500">
              Kho tổng cấp sang Tồn quầy POS mặc định — giữ cùng một yêu cầu cho đến khi gửi hoặc xóa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={clear}
            >
              Xóa lô
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
              onClick={() => setShowModal(true)}
            >
              Gửi yêu cầu
            </button>
          </div>
        </div>
      </div>

      {showModal ? (
        <BatchStockAdjustmentModal
          lines={modalLines}
          onClose={() => setShowModal(false)}
          onSubmitted={() => {
            clear()
            setShowModal(false)
          }}
        />
      ) : null}
    </>
  )
}
