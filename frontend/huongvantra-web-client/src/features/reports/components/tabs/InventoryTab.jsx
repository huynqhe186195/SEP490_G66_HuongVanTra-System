import { useEffect, useMemo, useState } from 'react'
import { fetchInventoryLedger } from '../../../inventory/services/inventoryLedgerApi.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { Card, DataTable, EmptyState } from '../reportUi.jsx'

const PAGE_SIZE = 50
const MAX_PAGES = 6

const TRANSACTION_LABELS = {
  SUPPLIER_RECEIPT: 'Nhập hàng nhà cung cấp',
  SUPPLIER_RETURN: 'Trả hàng nhà cung cấp',
  SHELF_REPLENISHMENT_OUT: 'Xuất kho bù kệ',
  SHELF_REPLENISHMENT_IN: 'Nhập kệ từ kho',
  POS_WAREHOUSE_TRANSFER_OUT: 'Xuất kho phục vụ đơn POS',
  POS_WAREHOUSE_TRANSFER_IN: 'Nhập kệ phục vụ đơn POS',
  POS_BACKORDER_RELEASE: 'Giải phóng hàng đặt trước',
  PRODUCTION_MATERIAL_EXPORT: 'Xuất nguyên liệu sản xuất',
  PRODUCTION_FINISHED_RECEIPT: 'Nhập thành phẩm sản xuất',
  STOCKTAKE_ADJUSTMENT: 'Điều chỉnh sau kiểm kê',
  POS_SALE: 'Bán hàng tại quầy',
  SALES_DEDUCT_LATER: 'Trừ kho bù sau bán hàng',
  SALES_BOM_RECONCILIATION: 'Đối soát định mức sau bán',
  CUSTOM_BUNDLE_MATERIAL_EXPORT: 'Xuất nguyên liệu combo tự chọn',
  CUSTOMER_RETURN_RECEIPT: 'Nhập hàng khách trả',
  STOCK_TRANSFER_WAREHOUSE_OUT: 'Xuất điều chuyển từ kho',
  STOCK_TRANSFER_SHELF_IN: 'Nhập điều chuyển vào kệ',
}

function transactionLabel(type) {
  return TRANSACTION_LABELS[type] || type || '—'
}

function locationLabel(location) {
  if (location === 'Warehouse') return 'Kho'
  if (location === 'Shelf') return 'Kệ hàng'
  return location || '—'
}

function unitLabel(unit) {
  if (!unit) return ''
  if (unit === 'Gram') return 'g'
  if (unit === 'Piece') return 'cái'
  return unit
}

function formatQty(value, unit) {
  const text = new Intl.NumberFormat('vi-VN').format(value)
  const u = unitLabel(unit)
  return u ? `${text} ${u}` : text
}

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
      <p className="text-xs text-[#717971]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#1b1c17]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#717971]">{hint}</p>}
    </div>
  )
}

/**
 * Tab Kho/Kệ đọc thẳng sổ kho của InventoryService qua Gateway.
 * Số lượng luôn gộp theo từng đơn vị tính, không cộng gộp gram với cái.
 */
function InventoryTab({ fromUtc, toUtc }) {
  const [entries, setEntries] = useState([])
  const [totalItems, setTotalItems] = useState(0)
  const [isTruncated, setIsTruncated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isForbidden, setIsForbidden] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      setIsForbidden(false)
      try {
        const collected = []
        let page = 1
        let total = 0
        let truncated = false
        // Sổ kho bị chặn pageSize tối đa 50 nên phải gom nhiều trang.
        for (; page <= MAX_PAGES; page += 1) {
          const res = await fetchInventoryLedger({
            fromUtc,
            toUtc,
            page,
            pageSize: PAGE_SIZE,
            silentAuthErrors: true,
          })
          if (cancelled) return
          total = res.totalItems
          collected.push(...res.items)
          if (page >= res.totalPages) break
          if (page === MAX_PAGES) truncated = true
        }
        setEntries(collected)
        setTotalItems(total)
        setIsTruncated(truncated)
      } catch (err) {
        if (cancelled) return
        if (err?.statusCode === 403) {
          setIsForbidden(true)
        } else {
          setError('Không tải được sổ kho: ' + err.message)
        }
        setEntries([])
        setTotalItems(0)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fromUtc, toUtc])

  const byType = useMemo(() => {
    const map = new Map()
    entries.forEach((e) => {
      const key = `${e.transactionType}|${e.inventoryUnitSnapshot}`
      const current = map.get(key) || {
        key,
        transactionType: e.transactionType,
        unit: e.inventoryUnitSnapshot,
        count: 0,
        qtyIn: 0,
        qtyOut: 0,
        skus: new Set(),
      }
      current.count += 1
      if (e.quantityDelta >= 0) current.qtyIn += e.quantityDelta
      else current.qtyOut += -e.quantityDelta
      current.skus.add(e.skuId)
      map.set(key, current)
    })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [entries])

  const byLocation = useMemo(() => {
    const map = new Map()
    entries.forEach((e) => {
      const key = `${e.location}|${e.inventoryUnitSnapshot}`
      const current = map.get(key) || {
        key,
        location: e.location,
        unit: e.inventoryUnitSnapshot,
        count: 0,
        qtyIn: 0,
        qtyOut: 0,
      }
      current.count += 1
      if (e.quantityDelta >= 0) current.qtyIn += e.quantityDelta
      else current.qtyOut += -e.quantityDelta
      map.set(key, current)
    })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [entries])

  const distinctSkus = useMemo(() => new Set(entries.map((e) => e.skuId)).size, [entries])
  const distinctReferences = useMemo(
    () => new Set(entries.map((e) => e.referenceCode).filter(Boolean)).size,
    [entries],
  )

  if (isForbidden) {
    return (
      <EmptyState
        text="Bạn không có quyền xem sổ kho."
        hint="Tab Kho/Kệ hàng cần quyền xem tồn kho. Các tab còn lại của báo cáo vẫn hoạt động bình thường."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#f6f4ec]" />
        ))}
      </div>
    )
  }

  if (error) {
    return <EmptyState text={error} hint="Thử áp dụng lại bộ lọc để tải lại sổ kho." />
  }

  if (entries.length === 0) {
    return <EmptyState text="Không có biến động kho hoặc kệ hàng trong kỳ đã chọn." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Bút toán kho" value={totalItems} hint={isTruncated ? `Đang hiển thị ${entries.length} bút toán gần nhất` : undefined} />
        <Tile label="SKU biến động" value={distinctSkus} />
        <Tile label="Chứng từ liên quan" value={distinctReferences} />
        <Tile label="Loại nghiệp vụ" value={new Set(entries.map((e) => e.transactionType)).size} />
      </div>

      {isTruncated && (
        <p className="rounded-xl border border-[#fec25b] bg-[#fec25b]/10 px-3 py-2 text-xs text-[#7e5700]">
          Kỳ này có {totalItems} bút toán, báo cáo chỉ tổng hợp {entries.length} bút toán đầu tiên. Thu hẹp khoảng
          ngày hoặc xem đầy đủ ở màn hình Sổ kho.
        </p>
      )}

      <Card title="Biến động theo loại nghiệp vụ" subtitle="Số lượng tách riêng theo đơn vị tính" icon="swap_horiz">
        <DataTable
          columns={[
            { key: 'type', label: 'Nghiệp vụ' },
            { key: 'unit', label: 'Đơn vị' },
            { key: 'count', label: 'Bút toán', align: 'center' },
            { key: 'skus', label: 'SKU', align: 'center' },
            { key: 'in', label: 'Nhập', align: 'right' },
            { key: 'out', label: 'Xuất', align: 'right' },
          ]}
          rows={byType}
          renderRow={(r) => (
            <tr key={r.key}>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{transactionLabel(r.transactionType)}</td>
              <td className="px-3 py-2 text-xs text-[#717971]">{unitLabel(r.unit) || '—'}</td>
              <td className="px-3 py-2 text-center">{r.count}</td>
              <td className="px-3 py-2 text-center">{r.skus.size}</td>
              <td className="px-3 py-2 text-right text-[#356647]">{r.qtyIn ? formatQty(r.qtyIn, r.unit) : '—'}</td>
              <td className="px-3 py-2 text-right text-[#b42318]">{r.qtyOut ? formatQty(r.qtyOut, r.unit) : '—'}</td>
            </tr>
          )}
        />
      </Card>

      <Card title="Biến động theo vị trí" subtitle="Kho và Kệ hàng" icon="warehouse">
        <DataTable
          columns={[
            { key: 'loc', label: 'Vị trí' },
            { key: 'unit', label: 'Đơn vị' },
            { key: 'count', label: 'Bút toán', align: 'center' },
            { key: 'in', label: 'Nhập', align: 'right' },
            { key: 'out', label: 'Xuất', align: 'right' },
          ]}
          rows={byLocation}
          renderRow={(r) => (
            <tr key={r.key}>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{locationLabel(r.location)}</td>
              <td className="px-3 py-2 text-xs text-[#717971]">{unitLabel(r.unit) || '—'}</td>
              <td className="px-3 py-2 text-center">{r.count}</td>
              <td className="px-3 py-2 text-right text-[#356647]">{r.qtyIn ? formatQty(r.qtyIn, r.unit) : '—'}</td>
              <td className="px-3 py-2 text-right text-[#b42318]">{r.qtyOut ? formatQty(r.qtyOut, r.unit) : '—'}</td>
            </tr>
          )}
        />
      </Card>

      <Card title="Chi tiết bút toán" subtitle={`${entries.length} dòng`} icon="receipt_long">
        <DataTable
          columns={[
            { key: 'time', label: 'Thời gian' },
            { key: 'sku', label: 'SKU' },
            { key: 'loc', label: 'Vị trí' },
            { key: 'type', label: 'Nghiệp vụ' },
            { key: 'delta', label: 'Biến động', align: 'right' },
            { key: 'after', label: 'Tồn sau', align: 'right' },
            { key: 'ref', label: 'Chứng từ' },
            { key: 'actor', label: 'Người thực hiện' },
          ]}
          rows={entries}
          renderRow={(e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatVietnamDateTimeMinute(e.occurredAtUtc)}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-[#1b1c17]">{e.skuNameSnapshot}</p>
                <p className="font-mono text-[11px] text-[#717971]">{e.skuCode}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{locationLabel(e.location)}</td>
              <td className="px-3 py-2 text-xs">{transactionLabel(e.transactionType)}</td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
                  e.quantityDelta >= 0 ? 'text-[#356647]' : 'text-[#b42318]'
                }`}
              >
                {e.quantityDelta >= 0 ? '+' : '−'}
                {formatQty(Math.abs(e.quantityDelta), e.inventoryUnitSnapshot)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {formatQty(e.quantityAfter, e.inventoryUnitSnapshot)}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-[#414942]">{e.referenceCode || '—'}</td>
              <td className="px-3 py-2 text-xs">{e.actorName || '—'}</td>
            </tr>
          )}
        />
      </Card>
    </div>
  )
}

export default InventoryTab
