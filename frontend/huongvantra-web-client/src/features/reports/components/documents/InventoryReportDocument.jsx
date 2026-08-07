import { useCallback, useEffect, useState } from 'react'
import { endOfDayInventoryApi } from '../../services/endOfDayApi.js'
import { formatVietnamDateTimeMinute } from '../../../../utils/vietnamDateTime.js'
import { DocumentSection, DocumentTable, Td, KeyValueRows, DocumentNotice } from '../ReportDocumentPage.jsx'
import { EmptyState } from '../reportUi.jsx'

const QUEUE_PAGE_SIZE = 20

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

const numberFormat = new Intl.NumberFormat('vi-VN')

function formatNumber(value) {
  return numberFormat.format(value ?? 0)
}

function formatMoney(value) {
  return `${numberFormat.format(Math.round(value ?? 0))} ₫`
}

/**
 * Nhóm đơn vị mà sổ kho chưa ghi nhận đơn vị tính. Nhãn do backend trả về là "Không xác định";
 * đây là tình trạng dữ liệu chứ không phải cảnh báo, nên hiển thị trung tính.
 */
const UNKNOWN_UNIT_LABEL = 'Không xác định'

function isUnknownUnit(unitLabel) {
  return String(unitLabel || '').trim().toLowerCase() === UNKNOWN_UNIT_LABEL.toLowerCase()
}

/** Số lượng luôn đi kèm nhãn đơn vị do backend trả về; không tự suy diễn ở frontend. */
function formatQty(value, unitLabel) {
  const text = numberFormat.format(value ?? 0)
  if (!unitLabel) return text
  return isUnknownUnit(unitLabel) ? `${text} (chưa rõ ĐVT)` : `${text} ${unitLabel}`
}

/** Các dòng số lượng theo đơn vị, hiển thị nối nhau. Gram và Piece không bao giờ cộng chung. */
function UnitFlowCell({ items, field, tone }) {
  const rows = (items || []).filter((u) => (u?.[field] ?? 0) !== 0)
  if (rows.length === 0) return <span className="text-[#717971]">—</span>
  return (
    <div className="flex flex-col items-end gap-0.5">
      {rows.map((u) => (
        // Dòng thiếu đơn vị tính dùng màu xám để không bị đọc nhầm là số liệu bất thường.
        <span key={u.unit} className={isUnknownUnit(u.unitLabel) ? 'text-[#717971]' : tone}>
          {formatQty(u[field], u.unitLabel)}
        </span>
      ))}
    </div>
  )
}

/**
 * Tài liệu "Báo cáo cuối ngày về Kho/Kệ".
 *
 * Dữ liệu tổng hợp do InventoryService tính sẵn; frontend không gom nhiều trang sổ kho rồi
 * tự cộng. Nhóm endpoint này chỉ nhận khoảng ngày, nên panel tiêu chí đã vô hiệu hóa các
 * bộ lọc nghiệp vụ khác khi đang xem báo cáo này.
 */
function InventoryReportDocument({ params }) {
  const [summary, setSummary] = useState(null)
  const [queues, setQueues] = useState(null)
  const [queuePage, setQueuePage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isQueueLoading, setIsQueueLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isForbidden, setIsForbidden] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const paramKey = JSON.stringify(params || {})

  useEffect(() => {
    setQueuePage(1)
  }, [paramKey])

  useEffect(() => {
    const controller = new AbortController()
    const filters = JSON.parse(paramKey)

    const load = async () => {
      setIsLoading(true)
      setError(null)
      setIsForbidden(false)
      try {
        const res = await endOfDayInventoryApi.getSummary(filters, { signal: controller.signal })
        setSummary(res)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err?.statusCode === 403) setIsForbidden(true)
        else setError('Không tải được số liệu Kho/Kệ: ' + err.message)
        setSummary(null)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [paramKey, reloadNonce])

  useEffect(() => {
    const controller = new AbortController()
    const filters = JSON.parse(paramKey)

    const load = async () => {
      setIsQueueLoading(true)
      try {
        const res = await endOfDayInventoryApi.getQueues(
          { ...filters, page: queuePage, pageSize: QUEUE_PAGE_SIZE },
          { signal: controller.signal },
        )
        setQueues(res)
      } catch {
        if (controller.signal.aborted) return
        setQueues(null)
      } finally {
        if (!controller.signal.aborted) setIsQueueLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [paramKey, queuePage, reloadNonce])

  const retry = useCallback(() => setReloadNonce((n) => n + 1), [])

  if (isForbidden) {
    return (
      <EmptyState
        text="Bạn không có quyền xem số liệu Kho/Kệ."
        hint="Báo cáo này cần quyền xem tồn kho. Các mối quan tâm còn lại vẫn hoạt động bình thường."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-[#f6f4ec]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        text={error}
        hint="Kiểm tra kết nối rồi thử lại."
        action={
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-[#356647] px-4 py-1.5 text-xs font-semibold text-white"
          >
            Thử lại
          </button>
        }
      />
    )
  }

  if (!summary) return <EmptyState text="Không có số liệu Kho/Kệ trong kỳ đã chọn." />

  const ledgerRows = summary.ledgerByLocationAndType || []
  const locationRows = summary.ledgerTotalsByLocation || []
  const stock = summary.endingStock || {}
  const queueCounts = summary.queues || {}
  const totalEntries = locationRows.reduce((sum, r) => sum + (r.entryCount || 0), 0)
  const queueItems = queues?.items || []
  const queueTotalPages = queues?.totalPages || 1

  return (
    <>
      <DocumentSection title="I. Chỉ tiêu chung">
        <KeyValueRows
          items={[
            { label: 'Bút toán kho', hint: 'Kho và Kệ hàng', value: formatNumber(totalEntries) },
            {
              label: 'Phiếu điều chuyển hoàn tất',
              hint: 'Kho → Kệ',
              value: formatNumber(summary.transfersCompleted),
            },
            { label: 'Lệnh sản xuất hoàn tất', value: formatNumber(summary.productionOrdersCompleted) },
            { label: 'Phiếu nhập nhà cung cấp hoàn tất', value: formatNumber(summary.supplierReceiptsCompleted) },
            { label: 'Phiếu kiểm kê hoàn tất', value: formatNumber(summary.stocktakesCompleted) },
          ]}
        />
      </DocumentSection>

      <DocumentSection title="II. Biến động theo vị trí" note="Kho và Kệ hàng, tách theo đơn vị tính">
        <DocumentTable
          columns={[
            { key: 'loc', label: 'Vị trí' },
            { key: 'count', label: 'Bút toán', align: 'center' },
            { key: 'in', label: 'Nhập', align: 'right' },
            { key: 'out', label: 'Xuất', align: 'right' },
            { key: 'net', label: 'Ròng', align: 'right' },
          ]}
          rows={locationRows}
          renderRow={(r) => (
            <tr key={r.location}>
              <Td>{r.locationLabel || locationLabel(r.location)}</Td>
              <Td align="center">{formatNumber(r.entryCount)}</Td>
              <Td align="right">
                <UnitFlowCell items={r.byUnit} field="quantityIn" tone="text-[#356647]" />
              </Td>
              <Td align="right">
                <UnitFlowCell items={r.byUnit} field="quantityOut" tone="text-[#b42318]" />
              </Td>
              <Td align="right">
                <UnitFlowCell items={r.byUnit} field="netQuantity" tone="font-semibold" />
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      <DocumentSection title="III. Biến động theo loại nghiệp vụ" note="Số lượng tách riêng theo đơn vị tính">
        <DocumentTable
          dense
          columns={[
            { key: 'loc', label: 'Vị trí' },
            { key: 'type', label: 'Nghiệp vụ' },
            { key: 'count', label: 'Bút toán', align: 'center' },
            { key: 'in', label: 'Nhập', align: 'right' },
            { key: 'out', label: 'Xuất', align: 'right' },
          ]}
          rows={ledgerRows}
          renderRow={(r) => (
            <tr key={`${r.location}|${r.transactionType}`}>
              <Td className="whitespace-nowrap text-[11px]">{r.locationLabel || locationLabel(r.location)}</Td>
              <Td>{transactionLabel(r.transactionType)}</Td>
              <Td align="center">{formatNumber(r.entryCount)}</Td>
              <Td align="right">
                <UnitFlowCell items={r.byUnit} field="quantityIn" tone="text-[#356647]" />
              </Td>
              <Td align="right">
                <UnitFlowCell items={r.byUnit} field="quantityOut" tone="text-[#b42318]" />
              </Td>
            </tr>
          )}
        />
      </DocumentSection>

      {(summary.transferQuantityByUnit?.length ?? 0) > 0 && (
        <DocumentSection title="IV. Sản lượng điều chuyển Kho → Kệ" note="Tổng theo từng đơn vị tính">
          <DocumentTable
            columns={[
              { key: 'unit', label: 'Đơn vị' },
              { key: 'qty', label: 'Số lượng', align: 'right' },
              { key: 'lines', label: 'Số dòng hàng', align: 'right' },
            ]}
            rows={summary.transferQuantityByUnit}
            renderRow={(u) => (
              <tr key={u.unit}>
                <Td>{u.unitLabel || u.unit}</Td>
                <Td align="right">{formatQty(u.quantity, u.unitLabel)}</Td>
                <Td align="right">{formatNumber(u.lineCount)}</Td>
              </tr>
            )}
          />
        </DocumentSection>
      )}

      <DocumentSection title="V. Tồn cuối kỳ" note="Trạng thái hiện tại của tồn kho theo SKU">
        <KeyValueRows
          items={[
            { label: 'SKU đang theo dõi', value: formatNumber(stock.skuCount) },
            { label: 'Tồn Kệ hàng', value: formatNumber(stock.shelfQuantityTotal) },
            { label: 'Trong đó đã giữ chỗ', value: formatNumber(stock.shelfReservedTotal) },
            { label: 'Kệ hàng còn bán được', value: formatNumber(stock.shelfAvailableTotal), strong: true },
            { label: 'Tồn Kho', value: formatNumber(stock.warehouseQuantityTotal) },
            { label: 'SKU dưới định mức tại Kệ', value: formatNumber(stock.shelfLowStockSkuCount) },
            { label: 'SKU dưới định mức tại Kho', value: formatNumber(stock.warehouseLowStockSkuCount) },
          ]}
        />
      </DocumentSection>

      <DocumentSection
        title="VI. Hàng đợi trừ kho"
        note={`Tạo trong kỳ ${formatNumber(queueCounts.createdInPeriod)} · Chờ ${formatNumber(
          queueCounts.waiting,
        )} · Thiếu hàng ${formatNumber(queueCounts.insufficient)} · Đã xác nhận ${formatNumber(
          queueCounts.confirmed,
        )} · Đã hủy ${formatNumber(queueCounts.cancelled)}`}
      >
        {isQueueLoading ? (
          <div className="h-24 animate-pulse bg-[#f6f4ec]" />
        ) : (
          <>
            <DocumentTable
              dense
              columns={[
                { key: 'time', label: 'Thời gian tạo' },
                { key: 'order', label: 'Đơn hàng' },
                { key: 'customer', label: 'Khách hàng' },
                { key: 'status', label: 'Trạng thái' },
                { key: 'items', label: 'Dòng hàng', align: 'center' },
                { key: 'amount', label: 'Giá trị', align: 'right' },
                { key: 'note', label: 'Ghi chú xử lý' },
              ]}
              rows={queueItems}
              emptyText="Không có hàng đợi trừ kho phát sinh trong kỳ."
              renderRow={(q) => (
                <tr key={q.queueId}>
                  <Td className="whitespace-nowrap text-[11px]">{formatVietnamDateTimeMinute(q.createdAt)}</Td>
                  <Td mono>{q.orderCode || '—'}</Td>
                  <Td className="text-[11px]">{q.customerName || 'Khách lẻ'}</Td>
                  <Td className="whitespace-nowrap text-[11px]">{q.queueStatusLabel || q.queueStatus}</Td>
                  <Td align="center">{formatNumber(q.itemCount)}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    {formatMoney(q.totalAmount)}
                  </Td>
                  <Td muted className="text-[11px]">
                    {q.cancelReason || q.lastShortageReason || q.confirmedByName || '—'}
                  </Td>
                </tr>
              )}
            />
            {queueTotalPages > 1 && (
              <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={queuePage <= 1}
                  onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-[#c1c9c0] px-3 py-1 disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="text-[#717971]">
                  Trang {queues?.page ?? queuePage} / {queueTotalPages} · {formatNumber(queues?.totalCount)} hàng đợi
                </span>
                <button
                  type="button"
                  disabled={queuePage >= queueTotalPages}
                  onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                  className="rounded-full border border-[#c1c9c0] px-3 py-1 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </DocumentSection>

      {/* Ghi chú phạm vi số liệu đặt cuối tài liệu, không chen vào giữa các mục chỉ tiêu. */}
      <DocumentNotice
        title="Ghi chú về phạm vi số liệu"
        items={[...(summary.dataGaps || []), ...(queues?.dataGaps || [])]}
      />
    </>
  )
}

export default InventoryReportDocument
