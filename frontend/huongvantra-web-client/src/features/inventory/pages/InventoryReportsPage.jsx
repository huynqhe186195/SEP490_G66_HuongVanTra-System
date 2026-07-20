import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchInventoryLedger } from '../services/inventoryLedgerApi.js'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { fetchStocktakeRequests } from '../services/stocktakeApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

const REPORT_TYPES = [
  { value: 'current', label: 'Tồn hiện tại' },
  { value: 'low', label: 'Tồn thấp' },
  { value: 'expiry', label: 'Lô sắp hết hạn' },
  { value: 'movement', label: 'Biến động tồn' },
  { value: 'stocktake', label: 'Lịch sử kiểm kê' },
]

const LOCATION_OPTIONS = [
  { value: '', label: 'Tất cả vị trí' },
  { value: 'Warehouse', label: 'Kho' },
  { value: 'Shelf', label: 'Kệ Hàng' },
]

const PRODUCT_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại hàng' },
  { value: 'THANH_PHAM', label: 'Thành phẩm' },
  { value: 'NGUYEN_LIEU', label: 'Nguyên liệu' },
  { value: 'BAO_BI', label: 'Bao bì' },
]

function getLocationLabel(location) {
  if (location === 'Warehouse') return 'Kho'
  if (location === 'Shelf') return 'Kệ Hàng'
  return location || '—'
}

function getProductTypeLabel(type) {
  return PRODUCT_TYPE_OPTIONS.find((item) => item.value === type)?.label || type || '—'
}

function toCsvValue(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().trim()
}

function buildStockRows({ stocks, skus, products }) {
  const productById = new Map(products.map((product) => [product.id, product]))
  const skuById = new Map(skus.map((sku) => [sku.id, sku]))
  return stocks.map((stock) => {
    const sku = skuById.get(stock.skuId)
    const product = productById.get(sku?.productId)
    return {
      id: stock.skuId,
      skuCode: stock.skuCode || sku?.skuCode || '',
      name: [product?.name || sku?.productName, sku?.variantName].filter(Boolean).join(' - ') || stock.skuCode,
      productType: product?.productType || '',
      inventoryUnit: product?.inventoryUnit || product?.baseUnit || '',
      warehouseQuantity: Number(stock.warehouseQuantityOnHand ?? 0),
      shelfQuantity: Number(stock.quantityOnHand ?? 0),
      warehouseThreshold: Number(stock.warehouseLowStockThreshold ?? 0),
      shelfThreshold: Number(stock.shelfLowStockThreshold ?? stock.lowStockThreshold ?? 0),
      updatedAt: stock.updatedAt,
    }
  })
}

function isNearExpiry(dateValue) {
  if (!dateValue) return false
  const expiresAt = new Date(dateValue)
  if (Number.isNaN(expiresAt.getTime())) return false
  const now = Date.now()
  const days30 = 30 * 24 * 60 * 60 * 1000
  return expiresAt.getTime() <= now + days30
}

function getBatchProductType(batch, skuProductTypeById) {
  const types = new Set((batch.items ?? []).map((item) => skuProductTypeById.get(item.skuId)).filter(Boolean))
  return types.size === 1 ? [...types][0] : ''
}

function buildReportRows(reportType, source, filters) {
  const keyword = normalizeText(filters.search)
  const location = filters.location
  const productType = filters.productType

  if (reportType === 'current' || reportType === 'low') {
    let rows = source.stockRows.flatMap((row) => {
      const locations = location ? [location] : ['Warehouse', 'Shelf']
      return locations.map((entryLocation) => {
        const quantity = entryLocation === 'Warehouse' ? row.warehouseQuantity : row.shelfQuantity
        const threshold = entryLocation === 'Warehouse' ? row.warehouseThreshold : row.shelfThreshold
        return {
          id: `${row.id}-${entryLocation}`,
          skuCode: row.skuCode,
          name: row.name,
          location: entryLocation,
          productType: row.productType,
          unit: row.inventoryUnit,
          quantity,
          threshold,
          updatedAt: row.updatedAt,
        }
      })
    })
    if (reportType === 'low') rows = rows.filter((row) => row.quantity <= row.threshold)
    return rows
      .filter((row) => (!productType || row.productType === productType))
      .filter((row) => !keyword || normalizeText(`${row.skuCode} ${row.name}`).includes(keyword))
  }

  if (reportType === 'expiry') {
    return source.batches
      .filter((batch) => isNearExpiry(batch.expiresAt))
      .map((batch) => ({
        id: batch.id,
        lotCode: batch.lotCode,
        location: batch.location,
        productType: getBatchProductType(batch, source.skuProductTypeById),
        skuSummary: (batch.items ?? []).map((item) => item.skuCode).join(', '),
        name: batch.items?.[0]?.productSnapshotName || `${batch.skuLineCount} SKU`,
        quantity: batch.totalQuantityOnHand,
        expiresAt: batch.expiresAt,
      }))
      .filter((row) => (!location || row.location === location))
      .filter((row) => (!productType || row.productType === productType))
      .filter((row) => !keyword || normalizeText(`${row.lotCode} ${row.skuSummary} ${row.name}`).includes(keyword))
  }

  if (reportType === 'movement') {
    return source.ledger
      .filter((row) => (!location || row.location === location))
      .filter((row) => (!productType || row.productTypeSnapshot === productType))
      .filter((row) => !keyword || normalizeText(`${row.skuCode} ${row.skuNameSnapshot} ${row.referenceCode} ${row.lotCode}`).includes(keyword))
  }

  return source.stocktakes
    .filter((row) => (!location || row.location === location))
    .filter((row) => !keyword || normalizeText(`${row.requestCode} ${row.reason} ${(row.items ?? []).map((item) => item.skuCode).join(' ')}`).includes(keyword))
}

function InventoryReportsPage() {
  const [reportType, setReportType] = useState('current')
  const [location, setLocation] = useState('')
  const [productType, setProductType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [source, setSource] = useState({
    stockRows: [],
    batches: [],
    ledger: [],
    stocktakes: [],
    skuProductTypeById: new Map(),
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadReports() {
      setIsLoading(true)
      try {
        const [stocks, skus, productsResult, batches, ledgerResult, stocktakeResult] = await Promise.all([
          fetchSkuStocks(),
          fetchAllActiveSkus(200),
          fetchProducts({ page: 1, pageSize: 500, isActive: true }),
          fetchWarehouseBatches({ availableOnly: true }),
          fetchInventoryLedger({ page: 1, pageSize: 500 }),
          fetchStocktakeRequests({ status: 'Completed', page: 1, pageSize: 500 }),
        ])
        if (!mounted) return
        const products = productsResult.items ?? []
        const productById = new Map(products.map((product) => [product.id, product]))
        const skuProductTypeById = new Map(skus.map((sku) => [sku.id, productById.get(sku.productId)?.productType || '']))
        setSource({
          stockRows: buildStockRows({ stocks, skus, products }),
          batches,
          ledger: ledgerResult.items ?? [],
          stocktakes: stocktakeResult.items ?? [],
          skuProductTypeById,
        })
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadReports()
    return () => { mounted = false }
  }, [])

  const rows = useMemo(
    () => buildReportRows(reportType, source, { location, productType, search }),
    [location, productType, reportType, search, source],
  )
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  function resetPageAndSet(setter, value) {
    setter(value)
    setPage(1)
  }

  function exportCurrentReport() {
    const headers = {
      current: ['SKU', 'Name', 'Location', 'ProductType', 'Unit', 'Quantity', 'Threshold', 'UpdatedAt'],
      low: ['SKU', 'Name', 'Location', 'ProductType', 'Unit', 'Quantity', 'Threshold', 'UpdatedAt'],
      expiry: ['LotCode', 'Location', 'ProductType', 'SKU', 'Name', 'Quantity', 'ExpiresAt'],
      movement: ['Time', 'SKU', 'Name', 'Location', 'Before', 'Delta', 'After', 'Type', 'Reference', 'Lot'],
      stocktake: ['RequestCode', 'Location', 'CreatedAt', 'ReviewedAt', 'Increase', 'Decrease', 'Reason'],
    }[reportType]
    const values = rows.map((row) => {
      if (reportType === 'expiry') return [row.lotCode, getLocationLabel(row.location), getProductTypeLabel(row.productType), row.skuSummary, row.name, row.quantity, row.expiresAt]
      if (reportType === 'movement') return [row.occurredAtUtc, row.skuCode, row.skuNameSnapshot, getLocationLabel(row.location), row.quantityBefore, row.quantityDelta, row.quantityAfter, row.transactionType, row.referenceCode, row.lotCode]
      if (reportType === 'stocktake') return [row.requestCode, getLocationLabel(row.location), row.createdAt, row.reviewedAt, row.totalPositiveVariance, row.totalNegativeVariance, row.reason]
      return [row.skuCode, row.name, getLocationLabel(row.location), getProductTypeLabel(row.productType), row.unit, row.quantity, row.threshold, row.updatedAt]
    })
    downloadCsv(`inventory-${reportType}-report.csv`, [headers, ...values])
  }

  return (
    <PageShell>
      <PageHeader
        title="Báo cáo kho"
        description="Báo cáo tồn hiện tại, cảnh báo tồn thấp, lô sắp hết hạn, biến động tồn và lịch sử kiểm kê."
        searchPlaceholder="Tìm SKU, tên hàng, mã lô, mã chứng từ..."
        searchValue={search}
        onSearchChange={(value) => resetPageAndSet(setSearch, value)}
        rightContent={(
          <div className="flex flex-wrap items-center gap-3">
            <InventoryNavTabs />
            <button type="button" onClick={exportCurrentReport} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Xuất CSV
            </button>
          </div>
        )}
      />

      <div className="mb-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={reportType} onChange={(event) => resetPageAndSet(setReportType, event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          {REPORT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={location} onChange={(event) => resetPageAndSet(setLocation, event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          {LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={productType} onChange={(event) => resetPageAndSet(setProductType, event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={reportType === 'stocktake'}>
          {PRODUCT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {reportType === 'movement' ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3">Thời gian</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3 text-right">Trước</th><th className="px-4 py-3 text-right">+/-</th><th className="px-4 py-3 text-right">Sau</th><th className="px-4 py-3">Tham chiếu</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={7} className="px-6 py-8 text-slate-500">Đang tải...</td></tr> : pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{formatVietnamDateTime(row.occurredAtUtc)}</td>
                    <td className="px-4 py-4"><p className="font-mono font-semibold text-[#356647]">{row.skuCode}</p><p className="text-xs text-slate-500">{row.skuNameSnapshot}</p></td>
                    <td className="px-4 py-4">{getLocationLabel(row.location)}</td>
                    <td className="px-4 py-4 text-right">{formatStockQuantity(row.quantityBefore)}</td>
                    <td className={`px-4 py-4 text-right font-semibold ${row.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{row.quantityDelta > 0 ? '+' : ''}{formatStockQuantity(row.quantityDelta)}</td>
                    <td className="px-4 py-4 text-right">{formatStockQuantity(row.quantityAfter)}</td>
                    <td className="px-4 py-4 font-mono text-xs">{row.referenceCode || row.lotCode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'expiry' ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3">Mã lô</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Tồn</th><th className="px-4 py-3">Hạn dùng</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={5} className="px-6 py-8 text-slate-500">Đang tải...</td></tr> : pageRows.map((row) => (
                  <tr key={row.id}><td className="px-6 py-4 font-mono font-semibold text-[#356647]">{row.lotCode}</td><td className="px-4 py-4">{getLocationLabel(row.location)}</td><td className="px-4 py-4">{row.skuSummary}</td><td className="px-4 py-4 text-right">{formatStockQuantity(row.quantity)}</td><td className="px-4 py-4">{formatVietnamDateTime(row.expiresAt)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'stocktake' ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3">Mã phiếu</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3 text-right">Tăng</th><th className="px-4 py-3 text-right">Giảm</th><th className="px-4 py-3">Hoàn tất</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={5} className="px-6 py-8 text-slate-500">Đang tải...</td></tr> : pageRows.map((row) => (
                  <tr key={row.id}><td className="px-6 py-4 font-mono font-semibold text-[#356647]">{row.requestCode}</td><td className="px-4 py-4">{getLocationLabel(row.location)}</td><td className="px-4 py-4 text-right text-emerald-700">+{formatStockQuantity(row.totalPositiveVariance)}</td><td className="px-4 py-4 text-right text-rose-700">-{formatStockQuantity(row.totalNegativeVariance)}</td><td className="px-4 py-4">{formatVietnamDateTime(row.reviewedAt)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3">SKU</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Tồn</th><th className="px-4 py-3 text-right">Ngưỡng</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={5} className="px-6 py-8 text-slate-500">Đang tải...</td></tr> : pageRows.map((row) => (
                  <tr key={row.id}><td className="px-6 py-4"><p className="font-mono font-semibold text-[#356647]">{row.skuCode}</p><p className="text-xs text-slate-500">{row.name}</p></td><td className="px-4 py-4">{getLocationLabel(row.location)}</td><td className="px-4 py-4">{getProductTypeLabel(row.productType)}</td><td className="px-4 py-4 text-right">{formatStockQuantity(row.quantity)}</td><td className="px-4 py-4 text-right">{formatStockQuantity(row.threshold)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!isLoading && rows.length === 0 ? <div className="border-t border-slate-100 px-6 py-8 text-sm text-slate-500">Không có dữ liệu phù hợp.</div> : null}
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="dòng báo cáo"
        />
      </section>
    </PageShell>
  )
}

export default InventoryReportsPage
