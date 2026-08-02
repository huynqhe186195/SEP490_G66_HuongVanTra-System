import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend,
    LineChart, Line, CartesianGrid
} from 'recharts';
import PageHeader from "../../../components/shared/PageHeader.jsx";
import EndOfDayReportModal from "../components/EndOfDayReportModal.jsx";
import { dashboardApi } from "../services/dashboardApi.js";
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  hasPermission,
  isAccountantRole,
  isBranchManager,
  isSystemAdmin,
} from '../../auth/utils/permissions.js'
import { getDashboardSectionFromSearch, getDashboardSectionLabel } from '../../../app/dashboardSections.js'

const VALID_SECTIONS = new Set(['overview', 'sales-growth', 'customer-growth']);
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function normalizeRoleToken(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function DashboardPage() {
    const [searchParams] = useSearchParams();
    const activeSection = useMemo(() => {
        const section = getDashboardSectionFromSearch(`?${searchParams.toString()}`);
        return VALID_SECTIONS.has(section) ? section : 'overview';
    }, [searchParams]);
    const sectionLabel = getDashboardSectionLabel(activeSection);

    const session = loadAuthSession();
    const roles = (session?.roles || []).map(normalizeRoleToken);
    const isSalesStaff = roles.some((role) =>
      ['sale', 'sales staff', 'salepos', 'sale pos', 'salecod', 'sale cod', 'salesstaff'].includes(role),
    );
    // Khớp backend ReportsController.CanViewRevenue + role vận hành trên HieuTH/HoangNL.
    const canViewRevenue =
      isSystemAdmin(session) ||
      isBranchManager(session) ||
      isAccountantRole(session) ||
      hasPermission(session, 'VIEW_ALL_CUSTOMERS') ||
      hasPermission(session, 'MANAGE_BUSINESS_POLICY') ||
      hasPermission(session, 'MANAGE_EMPLOYEE') ||
      roles.includes('admin') ||
      roles.includes('manager') ||
      roles.includes('agency manager') ||
      isSalesStaff;
    const canViewCustomerGrowth = canViewRevenue;

    const [stats, setStats] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [categorySales, setCategorySales] = useState([]);
    const [customerGrowthData, setCustomerGrowthData] = useState([]);
    const [revenueProfitGrowthData, setRevenueProfitGrowthData] = useState([]);
    const [salesByChannelData, setSalesByChannelData] = useState([]);
    const [orderGrowthData, setOrderGrowthData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showCustomerLine, setShowCustomerLine] = useState(true);
    const [showOrderLine, setShowOrderLine] = useState(true);

    const [filterPeriod, setFilterPeriod] = useState('month'); // 'month', 'quarter', 'year'
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterQuarter, setFilterQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    const [topCount, setTopCount] = useState(5); // Default top 5
    const [topProductsSortBy, setTopProductsSortBy] = useState('revenue'); // 'revenue' | 'quantity'

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const params = { year: filterYear };
                if (filterPeriod === 'month') params.month = filterMonth;
                if (filterPeriod === 'quarter') params.quarter = filterQuarter;

                const settled = await Promise.allSettled([
                    dashboardApi.getSalesStatistics(params),
                    dashboardApi.getTopProducts({ topCount, sortBy: topProductsSortBy, ...params }),
                    dashboardApi.getSalesByCategory(params),
                    dashboardApi.getCustomerGrowth(params),
                    dashboardApi.getSalesByChannel(params),
                    dashboardApi.getOrderGrowth(params),
                    dashboardApi.getRevenueProfitGrowth(params),
                ]);

                const valueOr = (index, fallback) =>
                    settled[index].status === 'fulfilled' ? settled[index].value : fallback;

                const statsData = valueOr(0, null);
                const topProductsData = valueOr(1, []);
                const categorySalesData = valueOr(2, []);
                const customerGrowth = valueOr(3, []);
                const salesByChannel = valueOr(4, []);
                const orderGrowth = valueOr(5, []);
                const revenueProfitGrowth = valueOr(6, []);

                const failed = settled.filter((item) => item.status === 'rejected');
                if (failed.length === settled.length) {
                    const firstError = failed[0].reason;
                    throw firstError instanceof Error ? firstError : new Error('Không thể tải dữ liệu thống kê');
                }

                setStats(statsData);
                setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
                setCategorySales(Array.isArray(categorySalesData) ? categorySalesData : []);

                const customerRows = Array.isArray(customerGrowth) ? customerGrowth : [];
                const orderRows = Array.isArray(orderGrowth) ? orderGrowth : [];
                const mergedCustomerOrder = customerRows.map((c) => {
                    const o = orderRows.find((x) => x.label === c.label);
                    return {
                        label: c.label,
                        "Khách hàng mới": c.value,
                        "Số lượng đơn": o ? o.value : 0,
                    };
                });
                setCustomerGrowthData(mergedCustomerOrder);

                setRevenueProfitGrowthData(Array.isArray(revenueProfitGrowth) ? revenueProfitGrowth : []);
                setSalesByChannelData(Array.isArray(salesByChannel) ? salesByChannel : []);
                setOrderGrowthData(orderRows);

                if (failed.length > 0) {
                    console.warn('Một số API thống kê lỗi:', failed.map((item) => item.reason));
                }
            } catch (err) {
                setError(err?.message || "Không thể tải dữ liệu thống kê");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [filterPeriod, filterMonth, filterQuarter, filterYear, topCount, topProductsSortBy]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(value || 0);
    };

    const formatPercent = (value) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "percent",
            minimumFractionDigits: 1,
        }).format(value || 0);
    };

    const renderPieTooltip = (totalValue, isCurrency = true) => ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const percent = totalValue > 0 ? (data.value / totalValue * 100).toFixed(1) : 0;
            const formattedValue = isCurrency ? formatCurrency(data.value) : new Intl.NumberFormat('vi-VN').format(data.value);
            return (
                <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-xl text-sm min-w-[150px]">
                    <p className="font-bold text-gray-800 mb-1">{data.name}</p>
                    <p className="text-gray-600 font-medium">
                        {formattedValue} 
                        <span className="text-gray-400 font-bold ml-2">({percent}%)</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    const renderOverview = () => {
        const ordersRatioData = [
            { name: 'Đơn thành công', value: stats?.totalCompletedOrders || 0 },
            { name: 'Đơn trả hàng', value: (stats?.partiallyReturnedOrders || 0) + (stats?.fullyReturnedOrders || 0) }
        ].filter(d => d.value > 0);
        const totalOrdersRatio = ordersRatioData.reduce((sum, d) => sum + d.value, 0);

        return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Số đơn bán ra" value={stats?.totalCompletedOrders || 0} icon="receipt_long" colorClass="text-purple-600" bgClass="bg-purple-50" />
                
                {canViewRevenue ? (
                    <>
                        <MetricCard title="Doanh thu gộp" value={formatCurrency(stats?.grossRevenue)} icon="payments" colorClass="text-blue-600" bgClass="bg-blue-50" />
                        <MetricCard title="Doanh thu thuần" value={formatCurrency(stats?.netRevenue)} icon="account_balance_wallet" colorClass="text-[#356647]" bgClass="bg-[#eaf4eb]" />
                        <MetricCard title="Lợi nhuận gộp" value={formatCurrency(stats?.grossProfit)} icon="savings" colorClass="text-yellow-600" bgClass="bg-yellow-50" />
                    </>
                ) : null}

                <MetricCard title="Số đơn trả hàng" value={(stats?.partiallyReturnedOrders || 0) + (stats?.fullyReturnedOrders || 0)} icon="remove_shopping_cart" colorClass="text-orange-600" bgClass="bg-orange-50" />
                
                {canViewRevenue ? (
                    <>
                        <MetricCard title="Tổng tiền hoàn trả" value={formatCurrency(stats?.refundAmount)} icon="assignment_return" colorClass="text-red-600" bgClass="bg-red-50" />
                        <MetricCard title="Tổng chiết khấu" value={formatCurrency(stats?.totalDiscountAmount)} icon="local_offer" colorClass="text-teal-600" bgClass="bg-teal-50" />
                        <MetricCard title="Tổng giá vốn" value={formatCurrency(stats?.totalCostOfGoods)} icon="sell" colorClass="text-slate-700" bgClass="bg-slate-100" />
                    </>
                ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {canViewRevenue ? (
                    <div className="lg:col-span-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-gray-800">Biểu Đồ Doanh Thu & Lợi Nhuận</h3>
                        {revenueProfitGrowthData && revenueProfitGrowthData.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={revenueProfitGrowthData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="label" tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(val) => new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(val)} tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                        <Tooltip formatter={(value) => formatCurrency(value)} />
                                        <Legend verticalAlign="top" height={36} />
                                        <Line type="monotone" dataKey="grossRevenue" stroke="#3b82f6" strokeWidth={3} name="Doanh thu gộp" />
                                        <Line type="monotone" dataKey="netRevenue" stroke="#10b981" strokeWidth={3} name="Doanh thu thuần" />
                                        <Line type="monotone" dataKey="grossProfit" stroke="#f59e0b" strokeWidth={3} name="Lợi nhuận gộp" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 min-h-[300px] flex items-center justify-center">
                                Chưa có dữ liệu doanh thu.
                            </div>
                        )}
                    </div>
                    ) : null}

                    {/* Orders Ratio Chart — luôn hiện */}
                    <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${canViewRevenue ? '' : 'lg:col-span-3'}`}>
                        <h3 className="mb-6 text-lg font-bold text-gray-800">Tỷ Lệ Đơn Hàng</h3>
                        {ordersRatioData && ordersRatioData.length > 0 ? (
                            <div className="h-[300px] w-full flex flex-col items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={ordersRatioData}
                                            cx="50%" cy="50%"
                                            innerRadius={40} outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            nameKey="name"
                                            label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                                        >
                                            {ordersRatioData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f43f5e'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={renderPieTooltip(totalOrdersRatio, false)} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 min-h-[300px] flex items-center justify-center">
                                Chưa có dữ liệu đơn hàng.
                            </div>
                        )}
                    </div>


                    {canViewRevenue ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-gray-800">Doanh Số Theo Kênh Bán</h3>
                        {salesByChannelData && salesByChannelData.length > 0 ? (
                            <div className="h-[300px] w-full flex flex-col items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={salesByChannelData}
                                            cx="50%" cy="50%"
                                            innerRadius={40} outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="totalRevenue"
                                            nameKey="categoryName"
                                            label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {salesByChannelData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={renderPieTooltip(salesByChannelData.reduce((acc, d) => acc + d.totalRevenue, 0), true)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 min-h-[300px] flex items-center justify-center">
                                Chưa có dữ liệu kênh bán.
                            </div>
                        )}
                    </div>
                    ) : null}
            </div>
        </div>
    );
    };

    const renderSalesGrowth = () => (
        <div className="flex flex-col gap-8">
            {/* Top Products Section */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Top Sản Phẩm Bán Chạy</h3>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setTopProductsSortBy('revenue')}
                                className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${topProductsSortBy === 'revenue' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Theo doanh thu
                            </button>
                            <button 
                                onClick={() => setTopProductsSortBy('quantity')}
                                className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${topProductsSortBy === 'quantity' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Theo số lượng
                            </button>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setTopCount(5)}
                                className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${topCount === 5 ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Top 5
                            </button>
                            <button 
                                onClick={() => setTopCount(10)}
                                className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${topCount === 10 ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Top 10
                            </button>
                        </div>
                    </div>
                </div>

                {topProducts && topProducts.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="w-full" style={{ height: `${Math.max(300, topProducts.length * 40)}px` }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                    <XAxis type="number" tickFormatter={(val) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(val)} />
                                    <YAxis dataKey="skuSnapshotName" type="category" width={150} tick={{fontSize: 12}} interval={0} />
                                    <Tooltip formatter={(value) => topProductsSortBy === 'revenue' ? formatCurrency(value) : new Intl.NumberFormat('vi-VN').format(value)} />
                                    {topProductsSortBy === 'revenue' ? (
                                        <Bar dataKey="totalRevenue" fill="#3b82f6" name="Doanh thu" radius={[0, 4, 4, 0]} />
                                    ) : (
                                        <Bar dataKey="totalQuantitySold" fill="#10b981" name="Số lượng bán" radius={[0, 4, 4, 0]} />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Sản phẩm</th>
                                        <th className="px-4 py-3 font-medium text-right">Đã bán</th>
                                        <th className="px-4 py-3 font-medium text-right">Doanh thu</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {topProducts.map((p, i) => (
                                        <tr key={p.skuId} className="transition-colors hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                                                        #{i + 1}
                                                    </div>
                                                    <span className="font-medium text-gray-900 line-clamp-1">{p.skuSnapshotName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{p.totalQuantitySold}</td>
                                            <td className="px-4 py-3 text-right font-medium text-[#356647]">{formatCurrency(p.totalRevenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                        Chưa có dữ liệu sản phẩm trong kỳ đã chọn.
                    </div>
                )}
            </div>

            {/* Categories Section */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-lg font-bold text-gray-800">Doanh Số Theo Danh Mục</h3>
                
                {categorySales && categorySales.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categorySales}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="totalRevenue"
                                        nameKey="categoryName"
                                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {categorySales.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={renderPieTooltip(categorySales.reduce((acc, c) => acc + c.totalRevenue, 0), true)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Danh mục</th>
                                        <th className="px-4 py-3 font-medium text-right">Số lượng</th>
                                        <th className="px-4 py-3 font-medium text-right">Doanh thu</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {categorySales.map((c, i) => (
                                        <tr key={i} className="transition-colors hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined text-gray-400">category</span>
                                                    <span className="font-medium text-gray-900">{c.categoryName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{c.totalQuantitySold}</td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-600">{formatCurrency(c.totalRevenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                        Chưa có dữ liệu danh mục trong kỳ đã chọn.
                    </div>
                )}
            </div>
        </div>
    );

    const renderCustomerGrowth = () => (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <MetricCard 
                    title="Khách hàng mua sắm" 
                    value={stats?.customerCount || 0} 
                    icon="group" 
                    colorClass="text-teal-600" 
                    bgClass="bg-teal-50" 
                />
                <MetricCard
                    title="Tăng trưởng khách hàng (So với kỳ trước)"
                    value={formatPercent(stats?.customerGrowthRate)}
                    icon="trending_up"
                    colorClass={stats?.customerGrowthRate >= 0 ? "text-emerald-600" : "text-red-600"}
                    bgClass={stats?.customerGrowthRate >= 0 ? "bg-emerald-50" : "bg-red-50"}
                />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Biểu đồ Tăng trưởng khách hàng & Đơn hàng</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowCustomerLine(!showCustomerLine)}
                            className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${showCustomerLine ? 'bg-teal-50 text-teal-700 border-teal-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                        >
                            Khách hàng
                        </button>
                        <button 
                            onClick={() => setShowOrderLine(!showOrderLine)}
                            className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${showOrderLine ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                        >
                            Đơn hàng
                        </button>
                    </div>
                </div>
                {customerGrowthData && customerGrowthData.length > 0 ? (
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={customerGrowthData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                <YAxis tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                {showCustomerLine && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="Khách hàng mới" 
                                        stroke="#0d9488" 
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#0d9488' }}
                                    />
                                )}
                                {showOrderLine && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="Số lượng đơn" 
                                        stroke="#8b5cf6" 
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 min-h-[300px] flex items-center justify-center">
                        Chưa có dữ liệu.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
            <PageHeader
                title="Thống kê bán hàng"
                titleInfo={`${sectionLabel} — tổng quan hoạt động cửa hàng, doanh thu và chỉ số vận hành.`}
                searchPlaceholder="Tìm kiếm..."
            />

            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
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
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                    </select>
                </label>

                <div className="ml-auto">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 border border-blue-200"
                    >
                        <span className="material-symbols-outlined text-[20px]">assignment</span>
                        Báo cáo doanh thu cuối ngày
                    </button>
                </div>
            </div>

            <EndOfDayReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />

            {isLoading ?
                <div className="flex justify-center p-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#356647] border-t-transparent"></div>
                </div>
            : error ?
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>
            :   <div className="flex flex-col gap-6">
                    {activeSection === 'overview' && renderOverview()}
                    {activeSection === 'sales-growth' && renderSalesGrowth()}
                    {activeSection === 'customer-growth' && canViewCustomerGrowth && renderCustomerGrowth()}
                </div>
            }
        </div>
    );
}

function MetricCard({ title, value, icon, colorClass, bgClass }) {
    return (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#c1c9c0]/50 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass} ${colorClass}`}>
                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </div>
                <p className="font-medium text-[#424941]">{title}</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#1b1c17]">{value}</p>
        </div>
    );
}

export default DashboardPage;
