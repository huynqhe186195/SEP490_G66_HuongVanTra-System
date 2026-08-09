import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ListFilterToolbar, { listFilterControlClass } from '../../../components/shared/ListFilterToolbar.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

const TIME_SORT_OPTIONS = [
  { value: 'desc', label: 'Mới → cũ', icon: 'arrow_downward' },
  { value: 'asc', label: 'Cũ → mới', icon: 'arrow_upward' },
]

const STOCK_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả tồn' },
  { value: 'in_stock', label: 'Còn hàng' },
  { value: 'depleted', label: 'Hết' },
]

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại' },
  { value: 'import', label: 'Nhập nguyên liệu' },
  { value: 'production', label: 'Sản xuất thành phẩm' },
]

function getBatchSourceLabel(sourceType) {
  if (sourceType === 'production_finished_goods') return 'Lô SX'
  return 'Nguồn'
}

function isProductionBatch(batch) {
  const sourceType = String(batch?.sourceType || '').toLowerCase()
  const sourceReferenceCode = String(batch?.sourceReferenceCode || '').toLowerCase()
  return sourceType.includes('production') || sourceReferenceCode.startsWith('sx-')
}

function getBatchTypeLabel(batch) {
  return isProductionBatch(batch) ? 'Sản xuất thành phẩm' : 'Nhập nguyên liệu'
}

function getBatchTypeClass(batch) {
  return isProductionBatch(batch)
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    : 'bg-violet-50 text-violet-700 border border-violet-100'
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function fieldMatchesSearch(value, keyword) {
  return normalizeSearchText(value).includes(keyword)
}

function batchMatchesSearch(batch, searchValue) {
  const keyword = normalizeSearchText(searchValue)
  if (!keyword) return true

  const visibleBatchFields = [
    batch?.batchCode,
    batch?.lotCode,
    batch?.supplierName,
    batch?.supplier,
  ]

  if (visibleBatchFields.some((value) => fieldMatchesSearch(value, keyword))) {
    return true
  }

  return (batch?.items ?? []).some((item) => {
    const visibleItemFields = [
      item?.skuCode,
      item?.skuName,
      item?.productSnapshotName,
      item?.productName,
      item?.variantName,
      item?.packagingType,
    ]
    return visibleItemFields.some((value) => fieldMatchesSearch(value, keyword))
  })
}

function getBatchTime(batch) {
  const raw = batch?.createdAt || batch?.updatedAt || batch?.expiresAt
  const time = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function InventoryBatchesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [batches, setBatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeSort, setTimeSort] = useState('desc')
  const [stockFilter, setStockFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchWarehouseBatches({})
      setBatches(items)
    } catch (error) {
      setBatches([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadData, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [searchInput, timeSort, stockFilter, typeFilter])

  const filteredBatches = useMemo(() => {
    const matched = batches.filter((batch) => {
      if (!batchMatchesSearch(batch, searchInput)) return false
      const hasStock = Number(batch.totalQuantityOnHand || 0) > 0 && batch.status !== 'depleted'
      if (stockFilter === 'in_stock' && !hasStock) return false
      if (stockFilter === 'depleted' && hasStock) return false
      if (typeFilter === 'production' && !isProductionBatch(batch)) return false
      if (typeFilter === 'import' && isProductionBatch(batch)) return false
      return true
    })
    const direction = timeSort === 'asc' ? 1 : -1
    return [...matched].sort((a, b) => (getBatchTime(a) - getBatchTime(b)) * direction)
  }, [batches, searchInput, timeSort, stockFilter, typeFilter])

  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(filteredBatches.length)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((filteredBatches.length || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [filteredBatches.length, page, pageSize])

  const pagedBatches = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredBatches.slice(start, start + pageSize)
  }, [filteredBatches, page, pageSize])

  const totalQty = useMemo(
    () => filteredBatches.reduce((sum, b) => sum + (b.totalQuantityOnHand || 0), 0),
    [filteredBatches],
  )

  return (
    <PageShell>
      <PageHeader
        compact
        title="Lô hàng nhập"
        titleInfo="Theo dõi tồn theo từng lô — mỗi lô có thể chứa nhiều mã hàng."
        searchPlaceholder="Tìm mã lô nội bộ, mã lô NCC, mã hàng, nhà cung cấp..."
        searchValue={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value)
          setPage(1)
        }}
        rightContent={(
          <Link
            to="/inventory/import/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#356647] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#2a5238]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo lô nhập
          </Link>
        )}
      />

      <ListFilterToolbar
        meta={(
          <span>
            {filteredBatches.length} lô · còn <strong className="text-slate-700">{formatStockQuantity(totalQty)}</strong>
          </span>
        )}
      >
        <StatusFilterChips
          dense
          options={STOCK_FILTER_OPTIONS}
          value={stockFilter}
          onChange={(value) => {
            setStockFilter(value)
            setPage(1)
          }}
          ariaLabel="Lọc theo tồn lô"
        />
        <select
          aria-label="Lọc theo loại lô"
          className={listFilterControlClass}
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value)
            setPage(1)
          }}
        >
          {TYPE_FILTER_OPTIONS.map((option) => (
            <option key={option.value || 'all-type'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          aria-label="Sắp xếp theo thời gian"
          className={listFilterControlClass}
          value={timeSort}
          onChange={(event) => {
            setTimeSort(event.target.value)
            setPage(1)
          }}
        >
          {TIME_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </ListFilterToolbar>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã lô nội bộ</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">HSD</th>
                <th className="px-4 py-3">Loại lô</th>
                <th className="px-4 py-3">Tổng còn</th>
                <th className="px-4 py-3">Mã lô NCC</th>
                <th className="px-4 py-3">Dòng SKU</th>
                <th className="px-4 py-3">Ngày nhập</th>
                <th className="px-4 py-3">NCC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-slate-500">Đang tải...</td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-slate-500">
                    {searchInput.trim() || stockFilter || typeFilter ? (
                      <>Không tìm thấy lô khớp bộ lọc.</>
                    ) : (
                      <>
                        Chưa có lô —{' '}
                        <Link to="/inventory/import/create" className="font-semibold text-[#356647] hover:underline">
                          nhập nguyên liệu
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                pagedBatches.map((batch) => {
                  const isOpen = expandedId === batch.id
                  const hasStock = batch.totalQuantityOnHand > 0
                  return (
                    <Fragment key={batch.id}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50/80"
                        onClick={() => setExpandedId(isOpen ? null : batch.id)}
                      >
                        <td className="px-6 py-4 font-mono font-semibold text-[#356647]">
                          {batch.batchCode}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {isOpen ? '▾' : '▸'}
                          </span>
                          {batch.sourceReferenceCode ? (
                            <div className="mt-1 text-xs font-normal text-slate-500">
                              {getBatchSourceLabel(batch.sourceType)}:{' '}
                              <span className="font-mono">{batch.sourceReferenceCode}</span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              batch.status === 'active' && hasStock
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {batch.status === 'depleted' || !hasStock ? 'Hết' : 'Còn hàng'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {batch.expiresAt ? formatVietnamDateTime(batch.expiresAt) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getBatchTypeClass(batch)}`}>
                            {getBatchTypeLabel(batch)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {formatStockQuantity(batch.totalQuantityOnHand)}
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-700">{batch.lotCode || '—'}</td>
                        <td className="px-4 py-4 text-slate-700">{batch.skuLineCount} SKU</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {batch.createdAt ? formatVietnamDateTime(batch.createdAt) : '—'}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{batch.supplier || '—'}</td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${batch.id}-detail`}>
                          <td colSpan={9} className="bg-[#fbf9f1]/40 px-6 py-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs font-bold uppercase text-slate-500">
                                  <th className="pb-2 pr-4">Sản Phẩm</th>
                                  <th className="pb-2 pr-4">Còn / Nhập</th>
                                  <th className="pb-2">Giá vốn</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100/80">
                                {batch.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-2 pr-4 text-slate-700">
                                      <p className="font-mono font-semibold text-[#356647]">{item.skuCode}</p>
                                      <p className="text-xs text-slate-600">{item.productSnapshotName || '—'}</p>
                                    </td>
                                    <td className="py-2 pr-4 font-semibold">
                                      {formatStockQuantity(item.quantityOnHand)}
                                      <span className="text-xs font-normal text-slate-500">
                                        {' '}/ {formatStockQuantity(item.initialQuantity)}
                                      </span>
                                    </td>
                                    <td className="py-2 text-slate-600">
                                      {item.unitCost != null ? `${Number(item.unitCost).toLocaleString('vi-VN')} ₫` : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={filteredBatches.length}
          itemLabel="lô"
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
        />
      </section>
    </PageShell>
  )
}

export default InventoryBatchesPage
