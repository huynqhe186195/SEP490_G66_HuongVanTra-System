import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

const TIME_SORT_OPTIONS = [
  { value: 'desc', label: 'Mới → cũ', icon: 'arrow_downward' },
  { value: 'asc', label: 'Cũ → mới', icon: 'arrow_upward' },
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
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
  }, [searchInput, timeSort])

  const filteredBatches = useMemo(() => {
    const matched = batches.filter((batch) => batchMatchesSearch(batch, searchInput))
    const direction = timeSort === 'asc' ? 1 : -1
    return [...matched].sort((a, b) => (getBatchTime(a) - getBatchTime(b)) * direction)
  }, [batches, searchInput, timeSort])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize))
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
        title="Lô hàng nhập"
        titleInfo="Theo dõi tồn theo từng lô — mỗi lô có thể chứa nhiều mã hàng."
        searchPlaceholder="Tìm mã lô nội bộ, mã lô NCC, mã hàng, nhà cung cấp..."
        searchValue={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value)
          setPage(1)
        }}
        rightContent={<InventoryNavTabs />}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <span className="hidden items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:inline-flex">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Thời gian
          </span>
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5" role="group" aria-label="Sắp xếp theo thời gian">
            {TIME_SORT_OPTIONS.map((option) => {
              const active = timeSort === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTimeSort(option.value)
                    setPage(1)
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-white text-[#356647] shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  aria-pressed={active}
                >
                  <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-500">
            {filteredBatches.length} lô · tổng còn <strong>{formatStockQuantity(totalQty)}</strong> đơn vị
          </p>
          <Link
            to="/inventory/import/create"
            className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-4 py-2 text-sm font-bold text-white hover:bg-[#2a5238]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Tạo lô nhập
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã lô nội bộ</th>
                <th className="px-4 py-3">Mã lô NCC</th>
                <th className="px-4 py-3">Dòng SKU</th>
                <th className="px-4 py-3">Loại lô</th>
                <th className="px-4 py-3">Tổng còn</th>
                <th className="px-4 py-3">Ngày nhập</th>
                <th className="px-4 py-3">HSD</th>
                <th className="px-4 py-3">NCC</th>
                <th className="px-4 py-3">Trạng thái</th>
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
                    {searchInput.trim() ? (
                      <>Không tìm thấy lô khớp từ khóa.</>
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
                        <td className="px-4 py-4 font-mono text-slate-700">{batch.lotCode || '—'}</td>
                        <td className="px-4 py-4 text-slate-700">{batch.skuLineCount} SKU</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getBatchTypeClass(batch)}`}>
                            {getBatchTypeLabel(batch)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {formatStockQuantity(batch.totalQuantityOnHand)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {batch.createdAt ? formatVietnamDateTime(batch.createdAt) : '—'}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {batch.expiresAt ? formatVietnamDateTime(batch.expiresAt) : '—'}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{batch.supplier || '—'}</td>
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
                      </tr>
                      {isOpen ? (
                        <tr key={`${batch.id}-detail`}>
                          <td colSpan={9} className="bg-[#fbf9f1]/40 px-6 py-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs font-bold uppercase text-slate-500">
                                  <th className="pb-2 pr-4">SKU</th>
                                  <th className="pb-2 pr-4">Sản phẩm</th>
                                  <th className="pb-2 pr-4">Còn / Nhập</th>
                                  <th className="pb-2">Giá vốn</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100/80">
                                {batch.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="py-2 pr-4 font-mono text-[#356647]">{item.skuCode}</td>
                                    <td className="py-2 pr-4 text-slate-700">{item.productSnapshotName || '—'}</td>
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
          totalCount={filteredBatches.length}
          itemLabel="lô"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={isLoading}
        />
      </section>
    </PageShell>
  )
}

export default InventoryBatchesPage
