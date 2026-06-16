import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../../components/shared/PageHeader.jsx";
import EndOfDayReportModal from "../components/EndOfDayReportModal.jsx";
import { dashboardApi } from "../services/dashboardApi.js";
import { loadAuthSession } from '../../auth/services/authSession.js'
import { getDashboardSectionFromSearch, getDashboardSectionLabel } from '../../../app/dashboardSections.js'

const VALID_SECTIONS = new Set(['overview', 'top-products', 'by-category']);

function DashboardPage() {
    const [searchParams] = useSearchParams();
    const activeSection = useMemo(() => {
        const section = getDashboardSectionFromSearch(`?${searchParams.toString()}`);
        return VALID_SECTIONS.has(section) ? section : 'overview';
    }, [searchParams]);
    const sectionLabel = getDashboardSectionLabel(activeSection);

    const session = loadAuthSession();
    const roles = (session?.roles || []).map(r => String(r || '').toLowerCase().trim());
    const isAdmin = roles.includes('admin') || roles.includes('agencymanager') || roles.includes('agency manager');
    const isAccountant = roles.includes('accountant');
    const isSalesStaff = roles.includes('salesstaff') || roles.includes('sale') || roles.includes('sales staff');
    
    const canViewRevenue = isAdmin || isAccountant || isSalesStaff;
    const canViewCustomerGrowth = isAdmin || isAccountant || isSalesStaff;

    const [stats, setStats] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [categorySales, setCategorySales] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterPeriod, setFilterPeriod] = useState('month'); // 'month', 'quarter', 'year'
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterQuarter, setFilterQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const params = { year: filterYear };
                if (filterPeriod === 'month') params.month = filterMonth;
                if (filterPeriod === 'quarter') params.quarter = filterQuarter;

                const [statsData, topProductsData, categorySalesData] = await Promise.all([
                    dashboardApi.getSalesStatistics(params), 
                    dashboardApi.getTopProducts({ topCount: 5, ...params }),
                    dashboardApi.getSalesByCategory(params)
                ]);
                setStats(statsData);
                setTopProducts(topProductsData);
                setCategorySales(categorySalesData);
            } catch (err) {
                setError("Không thể tải dữ liệu thống kê");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [filterPeriod, filterMonth, filterQuarter, filterYear]);

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

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
            <PageHeader
                title="Thống kê bán hàng"
                description={`${sectionLabel} — tổng quan hoạt động cửa hàng, doanh thu và chỉ số vận hành.`}
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
                    {activeSection === 'overview' ? (
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        {/* line 1 */}
                        <MetricCard title="Số đơn bán ra" value={stats?.totalCompletedOrders || 0} icon="receipt_long" colorClass="text-purple-600" bgClass="bg-purple-50" />
                        
                        {canViewRevenue && (
                            <>
                                <MetricCard title="Doanh thu gộp (Gross Revenue)" value={formatCurrency(stats?.grossRevenue)} icon="payments" colorClass="text-blue-600" bgClass="bg-blue-50" />
                                <MetricCard
                                    title="Doanh thu thuần (Net Revenue)"
                                    value={formatCurrency(stats?.netRevenue)}
                                    icon="account_balance_wallet"
                                    colorClass="text-[#356647]"
                                    bgClass="bg-[#eaf4eb]"
                                />
                                <MetricCard
                                    title="Lợi nhuận gộp (Gross Profit)"
                                    value={formatCurrency(stats?.grossProfit)}
                                    icon="savings"
                                    colorClass="text-yellow-600"
                                    bgClass="bg-yellow-50"
                                />
                            </>
                        )}
                        
                        {canViewCustomerGrowth && <MetricCard title="Khách hàng mua sắm" value={stats?.customerCount || 0} icon="group" colorClass="text-teal-600" bgClass="bg-teal-50" />}

                        {/* line 2 */}
                        <MetricCard
                            title="Số đơn trả hàng"
                            value={(stats?.partiallyReturnedOrders || 0) + (stats?.fullyReturnedOrders || 0)}
                            icon="remove_shopping_cart"
                            colorClass="text-orange-600"
                            bgClass="bg-orange-50"
                        />
                        
                        {canViewRevenue && (
                            <>
                                <MetricCard
                                    title="Tổng tiền hoàn trả"
                                    value={formatCurrency(stats?.refundAmount)}
                                    icon="assignment_return"
                                    colorClass="text-red-600"
                                    bgClass="bg-red-50"
                                />
                                <MetricCard title="Tỷ lệ trả hàng" value={formatPercent(stats?.returnRate)} icon="percent" colorClass="text-slate-600" bgClass="bg-slate-50" />
                            </>
                        )}

                        {canViewCustomerGrowth && (
                            <MetricCard
                                title="Tăng trưởng khách hàng"
                                value={formatPercent(stats?.customerGrowthRate)}
                                icon="trending_up"
                                colorClass="text-emerald-600"
                                bgClass="bg-emerald-50"
                            />
                        )}
                    </div>
                    ) : null}

                    {activeSection === 'top-products' ? (
                        topProducts && topProducts.length > 0 ? (
                            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                                <h3 className="mb-4 text-lg font-bold text-gray-800">Top 5 sản phẩm bán chạy</h3>
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
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">
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
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                                Chưa có dữ liệu top sản phẩm trong kỳ đã chọn.
                            </div>
                        )
                    ) : null}

                    {activeSection === 'by-category' ? (
                        categorySales && categorySales.length > 0 ? (
                            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                                <h3 className="mb-4 text-lg font-bold text-gray-800">Báo cáo theo danh mục</h3>
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
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                                Chưa có dữ liệu theo danh mục trong kỳ đã chọn.
                            </div>
                        )
                    ) : null}
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
