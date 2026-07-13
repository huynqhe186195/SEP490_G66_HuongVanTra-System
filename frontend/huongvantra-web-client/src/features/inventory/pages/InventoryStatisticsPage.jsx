import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { apiRequestAuth } from '../../../lib/apiClient.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function InventoryStatisticsPage() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || 'overview'

  const [stats, setStats] = useState(null)
  const [skuStocks, setSkuStocks] = useState([])
  const [skus, setSkus] = useState([])
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)

  const [filterPeriod, setFilterPeriod] = useState('month')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterQuarter, setFilterQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        setIsLoading(true)
        // Pass filter parameters (Backend will use them if implemented)
        const params = new URLSearchParams()
        params.append('year', filterYear)
        if (filterPeriod === 'month') params.append('month', filterMonth)
        if (filterPeriod === 'quarter') params.append('quarter', filterQuarter)

        const [data, stocksData, skusData, productsData, batchesData] = await Promise.all([
          apiRequestAuth(`/api/v1/inventory/statistics?${params.toString()}`, { method: 'GET' }),
          apiRequestAuth('/api/v1/inventory/sku-stocks', { method: 'GET' }),
          fetchAllActiveSkus(),
          fetchProducts({ page: 1, pageSize: 100, isActive: true }),
          fetchWarehouseBatches({ availableOnly: true })
        ])

        if (isMounted) {
          setStats(data)
          setSkuStocks(Array.isArray(stocksData) ? stocksData : [])
          setSkus(skusData)
          setProducts(productsData.items || [])
          setBatches(batchesData || [])
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Lỗi tải thống kê kho')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadStats()
    return () => { isMounted = false }
  }, [filterPeriod, filterMonth, filterQuarter, filterYear])

  const topSkus = useMemo(() => {
    if (!skuStocks.length) return []
    return [...skuStocks]
      .sort((a, b) => (b.quantityOnHand + b.warehouseQuantityOnHand) - (a.quantityOnHand + a.warehouseQuantityOnHand))
      .slice(0, 5)
      .map(s => ({
        name: s.skuCode,
        'Tổng tồn': s.quantityOnHand + s.warehouseQuantityOnHand,
        'Tồn quầy': s.quantityOnHand,
        'Tồn kho': s.warehouseQuantityOnHand
      }))
  }, [skuStocks])

  const stockDistribution = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Tồn quầy', value: stats.totalStoreQuantity },
      { name: 'Tồn kho tổng', value: stats.totalWarehouseQuantity }
    ]
  }, [stats])

  const alerts = useMemo(() => {
    if (!skuStocks.length || !skus.length || !products.length) return []
    const productMap = new Map(products.map(p => [p.id, p.name]))
    const skuMap = new Map(skus.map(s => [s.id, { ...s, productName: productMap.get(s.productId) }]))
    
    const generatedAlerts = []

    // 1. Tồn quầy thấp / Hết hàng quầy
    skuStocks.forEach(s => {
      const skuInfo = skuMap.get(s.skuId)
      if (s.quantityOnHand <= s.lowStockThreshold) {
        generatedAlerts.push({
          id: `store_low_${s.skuId}`,
          refCode: s.skuCode,
          productName: skuInfo?.productName || 'Không xác định',
          lot: '—',
          importDate: '—',
          expiry: '—',
          storeQuantity: s.quantityOnHand,
          warehouseQuantity: s.warehouseQuantityOnHand,
          severity: s.quantityOnHand === 0 ? 'critical' : 'warning',
          message: s.quantityOnHand === 0 ? 'Hết hàng quầy' : 'Tồn quầy thấp',
        })
      }
      
      // 2. Hết hàng kho
      if (s.warehouseQuantityOnHand === 0) {
        generatedAlerts.push({
          id: `wh_empty_${s.skuId}`,
          refCode: s.skuCode,
          productName: skuInfo?.productName || 'Không xác định',
          lot: '—',
          importDate: '—',
          expiry: '—',
          storeQuantity: s.quantityOnHand,
          warehouseQuantity: 0,
          severity: 'critical',
          message: 'Hết hàng trong kho',
        })
      }
    })

    // Batch alerts
    const now = new Date()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    const HIGH_VALUE_THRESHOLD = 50000000 // 50M VND

    batches.forEach(b => {
      if (b.totalQuantityOnHand <= 0) return

      // 3. Lô sắp hết hạn
      if (b.expiresAt) {
        const expDate = new Date(b.expiresAt)
        if (expDate - now <= THIRTY_DAYS && expDate - now > 0) {
          generatedAlerts.push({
            id: `exp_${b.id}`,
            refCode: b.lotCode || 'N/A',
            productName: b.items?.length === 1 ? b.items[0].productSnapshotName : `Nhiều sản phẩm (${b.skuLineCount})`,
            lot: b.lotCode,
            importDate: b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '—',
            expiry: new Date(b.expiresAt).toLocaleDateString('vi-VN'),
            storeQuantity: '—',
            warehouseQuantity: b.totalQuantityOnHand,
            severity: 'warning',
            message: 'Sắp hết hạn',
          })
        } else if (expDate < now) {
          generatedAlerts.push({
            id: `exp_past_${b.id}`,
            refCode: b.lotCode || 'N/A',
            productName: b.items?.length === 1 ? b.items[0].productSnapshotName : `Nhiều sản phẩm (${b.skuLineCount})`,
            lot: b.lotCode,
            importDate: b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '—',
            expiry: new Date(b.expiresAt).toLocaleDateString('vi-VN'),
            storeQuantity: '—',
            warehouseQuantity: b.totalQuantityOnHand,
            severity: 'critical',
            message: 'Đã hết hạn',
          })
        }
      }

      // 4. Lô hàng giá trị cao
      const batchValue = (b.items || []).reduce((sum, item) => sum + (item.quantityOnHand * (item.unitCost || 0)), 0)
      if (batchValue >= HIGH_VALUE_THRESHOLD) {
        generatedAlerts.push({
          id: `high_val_${b.id}`,
          refCode: b.lotCode || 'N/A',
          productName: b.items?.length === 1 ? b.items[0].productSnapshotName : `Nhiều sản phẩm (${b.skuLineCount})`,
          lot: b.lotCode,
          importDate: b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '—',
          expiry: b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('vi-VN') : '—',
          storeQuantity: '—',
          warehouseQuantity: b.totalQuantityOnHand,
          severity: 'info',
          message: 'Lô giá trị cao',
        })
      }
    })

    // 5. Giá nhập tăng
    const batchItemsBySku = new Map()
    batches.forEach(b => {
      ;(b.items || []).forEach(item => {
        if (!item.unitCost) return
        if (!batchItemsBySku.has(item.skuId)) {
          batchItemsBySku.set(item.skuId, [])
        }
        batchItemsBySku.get(item.skuId).push({
          unitCost: item.unitCost,
          createdAt: b.createdAt ? new Date(b.createdAt) : new Date(0),
          batchId: b.id,
          lotCode: b.lotCode
        })
      })
    })

    batchItemsBySku.forEach((items, skuId) => {
      if (items.length < 2) return
      // Sort by newest first
      items.sort((a, b) => b.createdAt - a.createdAt)
      const newest = items[0]
      const olderItems = items.slice(1)
      const avgOlderCost = olderItems.reduce((sum, i) => sum + i.unitCost, 0) / olderItems.length
      
      // If newest cost is > 10% higher than older average
      if (avgOlderCost > 0 && newest.unitCost > avgOlderCost * 1.1) {
        const skuInfo = skuMap.get(skuId)
        generatedAlerts.push({
          id: `cost_inc_${newest.batchId}_${skuId}`,
          refCode: newest.lotCode || skuInfo?.skuCode || 'N/A',
          productName: skuInfo?.productName || 'Không xác định',
          lot: newest.lotCode || 'N/A',
          importDate: newest.createdAt ? new Date(newest.createdAt).toLocaleDateString('vi-VN') : '—',
          expiry: '—',
          storeQuantity: '—',
          warehouseQuantity: '—',
          severity: 'warning',
          message: 'Giá nhập tăng cao',
        })
      }
    })

    // Sort by severity (critical -> warning -> info)
    const severityWeight = { 'critical': 3, 'warning': 2, 'info': 1 }
    return generatedAlerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
  }, [skuStocks, skus, products, batches])

  useEffect(() => {
    setPage(1)
  }, [alerts])

  const paginatedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return alerts.slice(start, end)
  }, [alerts, page, pageSize])

  return (
    <PageShell className="flex-1">
      <PageHeader
        title="Thống kê trong kho"
        subtitle="Tổng quan số liệu hàng hóa hiện tại"
      />

      <div className="flex flex-col gap-6 px-4 pb-8 sm:px-6">
        <div className="flex w-full flex-col space-y-6">
          
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#717971]">Kỳ báo cáo</span>
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="rounded-lg border-gray-200 text-sm">
                <option value="month">Theo Tháng</option>
                <option value="quarter">Theo Quý</option>
                <option value="year">Theo Năm</option>
              </select>
            </label>

            {filterPeriod === 'month' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#717971]">Tháng</span>
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="rounded-lg border-gray-200 text-sm">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                </select>
              </label>
            )}

            {filterPeriod === 'quarter' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#717971]">Quý</span>
                <select value={filterQuarter} onChange={e => setFilterQuarter(Number(e.target.value))} className="rounded-lg border-gray-200 text-sm">
                  <option value={1}>Quý 1</option>
                  <option value={2}>Quý 2</option>
                  <option value={3}>Quý 3</option>
                  <option value={4}>Quý 4</option>
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#717971]">Năm</span>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="rounded-lg border-gray-200 text-sm">
                {Array.from({length: 5}).map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>
                })}
              </select>
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-white shadow-sm" />
              ))}
            </div>
          ) : section === 'alerts' ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <h3 className="text-lg font-bold text-gray-800">Trạng thái hàng hoá</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-[#fbf9f1] text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-6 py-4">Mã tham chiếu</th>
                      <th className="px-6 py-4">Sản phẩm / Lô</th>
                      <th className="px-6 py-4">Lô</th>
                      <th className="px-6 py-4">Ngày nhập lô</th>
                      <th className="px-6 py-4">Hạn dùng</th>
                      <th className="px-6 py-4 text-right">Tồn quầy</th>
                      <th className="px-6 py-4 text-right">Tồn kho</th>
                      <th className="px-6 py-4">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {paginatedAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          Tất cả chỉ số đều ổn định. Không có cảnh báo nào.
                        </td>
                      </tr>
                    ) : (
                      paginatedAlerts.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-gray-50/50">
                          <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                            {item.refCode}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-800">{item.productName}</td>
                          <td className="whitespace-nowrap px-6 py-4">{item.lot}</td>
                          <td className="whitespace-nowrap px-6 py-4">{item.importDate}</td>
                          <td className="whitespace-nowrap px-6 py-4">{item.expiry}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-gray-900">
                            {item.storeQuantity}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-gray-900">
                            {item.warehouseQuantity}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {item.severity === 'critical' && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                                {item.message}
                              </span>
                            )}
                            {item.severity === 'warning' && (
                              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/10">
                                {item.message}
                              </span>
                            )}
                            {item.severity === 'info' && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/10">
                                {item.message}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {alerts.length > 0 && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={alerts.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  title="Tổng số lượng SKU"
                  value={stats.totalSkus}
                  icon="view_list"
                  color="blue"
                />
                <StatCard
                  title="Tổng lượng Tồn Quầy"
                  value={stats.totalStoreQuantity}
                  icon="storefront"
                  color="green"
                />
                <StatCard
                  title="Tổng lượng Tồn Kho"
                  value={stats.totalWarehouseQuantity}
                  icon="warehouse"
                  color="indigo"
                />
                <StatCard
                  title="Số SKU sắp hết hàng"
                  value={stats.lowStockSkuCount}
                  icon="warning"
                  color="orange"
                />
                <StatCard
                  title="Lượt trừ kho đang chờ"
                  value={stats.pendingDeductQueueCount}
                  icon="pending_actions"
                  color="yellow"
                />
                <StatCard
                  title="Tổng giá trị hàng hóa"
                  value={new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.totalWarehouseValue)}
                  icon="payments"
                  color="emerald"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Top 5 SKU Chart */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="mb-6 text-lg font-bold text-gray-800">Top 5 SKU tồn kho cao nhất</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSkus} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickMargin={10} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: '#f3f4f6' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="Tồn quầy" stackId="a" fill="#00C49F" radius={[0, 0, 4, 4]} barSize={40} />
                        <Bar dataKey="Tồn kho" stackId="a" fill="#0088FE" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stock Distribution Pie Chart */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="mb-6 text-lg font-bold text-gray-800">Tỷ lệ phân bổ Tồn kho</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stockDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stockDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => new Intl.NumberFormat('vi-VN').format(value)}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}

function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${colorClasses[color]}`}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

export default InventoryStatisticsPage
