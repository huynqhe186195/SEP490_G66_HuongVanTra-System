import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import PageHeader from '../../../components/shared/PageHeader.jsx'

import PageShell from '../../../components/shared/PageShell.jsx'

import { showError } from '../../../app/toast.js'

import { formatStockQuantity } from '../../products/utils/productDisplay.js'

import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'

import InventoryNavTabs from '../components/InventoryNavTabs.jsx'

import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'



function getBatchSourceLabel(sourceType) {
  if (sourceType === 'production_finished_goods') return 'Lô SX'
  return 'Nguồn'
}



function InventoryBatchesPage() {

  const [searchInput, setSearchInput] = useState('')

  const [batches, setBatches] = useState([])

  const [isLoading, setIsLoading] = useState(true)

  const [availableOnly, setAvailableOnly] = useState(false)

  const [expandedId, setExpandedId] = useState(null)



  const loadData = useCallback(async () => {

    setIsLoading(true)

    try {

      const items = await fetchWarehouseBatches({

        search: searchInput.trim() || undefined,

        availableOnly,

      })

      setBatches(items)

    } catch (error) {

      setBatches([])

      showError(error.message)

    } finally {

      setIsLoading(false)

    }

  }, [searchInput, availableOnly])



  useEffect(() => {

    const timer = setTimeout(loadData, 250)

    return () => clearTimeout(timer)

  }, [loadData])



  const totalQty = useMemo(

    () => batches.reduce((sum, b) => sum + (b.totalQuantityOnHand || 0), 0),

    [batches],

  )



  return (

    <PageShell>

      <PageHeader

        title="Tồn theo lô"

        description="Mỗi lô có thể chứa nhiều SKU — xuất sang cửa hàng trừ theo FIFO từng SKU"

        searchPlaceholder="Tìm mã lô, SKU, NCC..."

        searchValue={searchInput}

        onSearchChange={setSearchInput}

        rightContent={<InventoryNavTabs />}

      />



      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <label className="inline-flex items-center gap-2 text-sm text-slate-600">

          <input

            type="checkbox"

            checked={availableOnly}

            onChange={(e) => setAvailableOnly(e.target.checked)}

            className="rounded border-slate-300"

          />

          Chỉ lô còn tồn

        </label>

        <p className="text-sm text-slate-500">

          {batches.length} lô · tổng còn <strong>{formatStockQuantity(totalQty)}</strong> đơn vị

        </p>

      </div>



      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="min-w-full text-left text-sm">

            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">

              <tr>

                <th className="px-6 py-3">Mã lô</th>

                <th className="px-4 py-3">Dòng SKU</th>

                <th className="px-4 py-3">Tổng còn</th>

                <th className="px-4 py-3">HSD</th>

                <th className="px-4 py-3">NCC</th>

                <th className="px-4 py-3">Trạng thái</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {isLoading ? (

                <tr>

                  <td colSpan={6} className="px-6 py-8 text-slate-500">

                    Đang tải...

                  </td>

                </tr>

              ) : batches.length === 0 ? (

                <tr>

                  <td colSpan={6} className="px-6 py-8 text-slate-500">

                    Chưa có lô —{' '}

                    <Link to="/inventory/import" className="font-semibold text-[#356647] hover:underline">

                      nhập lô mới

                    </Link>

                  </td>

                </tr>

              ) : (

                batches.map((batch) => {

                  const isOpen = expandedId === batch.id

                  const hasStock = batch.totalQuantityOnHand > 0

                  return (

                    <Fragment key={batch.id}>

                      <tr

                        className="cursor-pointer hover:bg-slate-50/80"

                        onClick={() => setExpandedId(isOpen ? null : batch.id)}

                      >

                        <td className="px-6 py-4 font-mono font-semibold text-[#356647]">

                          {batch.lotCode}

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

                        <td className="px-4 py-4 text-slate-700">{batch.skuLineCount} SKU</td>

                        <td className="px-4 py-4 font-semibold text-slate-800">

                          {formatStockQuantity(batch.totalQuantityOnHand)}

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

                          <td colSpan={6} className="bg-[#fbf9f1]/40 px-6 py-4">

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

      </section>

    </PageShell>

  )

}



export default InventoryBatchesPage


