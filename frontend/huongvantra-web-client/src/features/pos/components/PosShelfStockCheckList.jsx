import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchStoreSkuStocks } from '../../inventory/services/inventoryStockApi.js'
import { fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'

function parseQty(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d]/g, '')
  if (cleaned === '') return null
  return Number(cleaned)
}

function buildCountsPayload(nextActual, nextRows) {
  const items = []
  const variances = []
  for (const row of nextRows) {
    const actual = parseQty(nextActual[row.skuId])
    if (actual === null) continue
    const system = Number(row.quantityOnHand) || 0
    const entry = {
      skuId: row.skuId,
      skuCode: row.skuCode,
      productName: row.productName,
      system,
      actual,
      diff: actual - system,
    }
    items.push(entry)
    if (actual !== system) variances.push(entry)
  }
  const filledCount = items.length
  const summaryText =
    variances.length === 0
      ? filledCount > 0
        ? `Đã điền ${filledCount}/${nextRows.length} SKU, khớp hệ thống.`
        : ''
      : `Lệch ${variances.length} SKU: ${variances
          .slice(0, 8)
          .map(
            (v) =>
              `${v.skuCode || v.productName} hệ thống=${v.system}/thực tế=${v.actual}(${v.diff > 0 ? '+' : ''}${v.diff})`,
          )
          .join('; ')}${variances.length > 8 ? '…' : ''}`
  return {
    variances,
    filledCount,
    totalCount: nextRows.length,
    summaryText,
    items,
  }
}

/**
 * Danh sách tồn kệ — cột Hệ thống + ô nhập Thực tế để Sale đối chiếu đầu ca.
 * onCountsChange({ variances, filledCount, totalCount, summaryText, items })
 */
export default function PosShelfStockCheckList({ compact = false, onCountsChange }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  /** skuId → chuỗi nhập (để giữ ô trống) */
  const [actualBySkuId, setActualBySkuId] = useState({})
  const onCountsChangeRef = useRef(onCountsChange)
  onCountsChangeRef.current = onCountsChange

  // Báo parent sau render — tránh setState parent trong lúc render / trong updater.
  useEffect(() => {
    onCountsChangeRef.current?.(buildCountsPayload(actualBySkuId, rows))
  }, [actualBySkuId, rows])

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      fetchStoreSkuStocks(),
      fetchAllActiveStoreSkus(100).catch(() => []),
    ])
      .then(([stocks, skus]) => {
        const nameBySkuId = new Map(
          (skus || []).map((sku) => [
            sku.id,
            sku.productName || sku.name || sku.skuCode || '',
          ]),
        )
        const unitBySkuId = new Map(
          (skus || []).map((sku) => [sku.id, sku.inventoryUnit || sku.packagingType || '']),
        )
        const list = (stocks || [])
          .map((s) => ({
            skuId: s.skuId,
            skuCode: s.skuCode || '—',
            productName: nameBySkuId.get(s.skuId) || s.skuCode || 'SKU',
            unit: unitBySkuId.get(s.skuId) || '',
            quantityOnHand: Number(s.quantityOnHand) || 0,
            low: Number(s.quantityOnHand) <= Number(s.shelfLowStockThreshold || 0),
          }))
          .sort((a, b) => {
            const byName = String(a.productName).localeCompare(String(b.productName), 'vi')
            if (byName !== 0) return byName
            return String(a.skuCode).localeCompare(String(b.skuCode), 'vi')
          })
        setRows(list)
        setActualBySkuId((prev) => {
          const next = {}
          for (const row of list) {
            if (prev[row.skuId] !== undefined) next[row.skuId] = prev[row.skuId]
          }
          return next
        })
      })
      .catch((err) => {
        setRows([])
        setActualBySkuId({})
        setError(err?.message || 'Không tải được tồn kệ trên hệ thống.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActual = (skuId, value) => {
    const cleaned = String(value ?? '').replace(/[^\d]/g, '')
    setActualBySkuId((prev) => ({ ...prev, [skuId]: cleaned }))
  }

  const fillSystemAsActual = () => {
    const next = {}
    for (const row of rows) {
      next[row.skuId] = String(row.quantityOnHand)
    }
    setActualBySkuId(next)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q)
        || r.skuCode.toLowerCase().includes(q),
    )
  }, [rows, search])

  const listMaxH = compact ? 'max-h-44' : 'max-h-60'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm SP / SKU…"
          className="min-w-0 flex-1 rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
        />
        <button
          type="button"
          onClick={fillSystemAsActual}
          disabled={loading || rows.length === 0}
          className="rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-60"
          title="Điền sẵn số hệ thống vào cột Thực tế (rồi sửa dòng lệch)"
        >
          Điền = Hệ thống
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-semibold text-[#356647] hover:bg-white disabled:opacity-60"
        >
          Làm mới
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        Đối chiếu: cột «Hệ thống» là số trên phần mềm — nhập «Thực tế» theo hàng đếm được trên kệ.
      </p>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Đang tải tồn kệ…</p>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Không có hàng trên kệ / không khớp tìm kiếm.</p>
      ) : (
        <div className={`overflow-auto rounded-lg border border-[#e7e8e0] bg-white ${listMaxH}`}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-[1] bg-[#f6f4ec] text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Sản phẩm</th>
                <th className="hidden px-2 py-1.5 font-semibold sm:table-cell">SKU</th>
                <th className="w-20 px-1 py-1.5 text-right font-semibold">Hệ thống</th>
                <th className="w-[4.5rem] px-1 py-1.5 text-right font-semibold">Thực tế</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const actualRaw = actualBySkuId[row.skuId] ?? ''
                const actual = parseQty(actualRaw)
                const hasActual = actual !== null
                const mismatch = hasActual && actual !== row.quantityOnHand
                return (
                  <tr
                    key={row.skuId}
                    className={`border-t border-[#e7e8e0] ${mismatch ? 'bg-amber-50/80' : ''}`}
                  >
                    <td className="px-2 py-1 font-medium text-slate-800">
                      <span className="line-clamp-2">{row.productName}</span>
                    </td>
                    <td className="hidden px-2 py-1 text-slate-500 sm:table-cell">{row.skuCode}</td>
                    <td
                      className={`px-1 py-1 text-right font-bold tabular-nums ${
                        row.low ? 'text-amber-800' : 'text-slate-900'
                      }`}
                    >
                      {row.quantityOnHand.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={actualRaw}
                        onChange={(e) => setActual(row.skuId, e.target.value)}
                        placeholder="—"
                        className={`w-14 rounded-md border px-1.5 py-1 text-right text-xs font-semibold tabular-nums outline-none focus:border-[#356647] ${
                          mismatch
                            ? 'border-amber-400 bg-white text-amber-950'
                            : 'border-[#c1c9c0] bg-white text-slate-900'
                        }`}
                        aria-label={`Thực tế ${row.skuCode}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length > 0 ? (
        <p className="text-[11px] text-slate-400">
          {filtered.length}/{rows.length} SKU · hàng vàng = thực tế khác hệ thống
        </p>
      ) : null}
    </div>
  )
}
