import { useEffect, useState } from "react";
import PageHeader from "../../../components/shared/PageHeader.jsx";
import { dashboardApi } from "../services/dashboardApi.js";

function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [categorySales, setCategorySales] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const [statsData, topProductsData, categorySalesData] = await Promise.all([
                    dashboardApi.getSalesStatistics(), 
                    dashboardApi.getTopProducts({ topCount: 5 }),
                    dashboardApi.getSalesByCategory()
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
    }, []);

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
            <PageHeader title="Thống kê bán hàng" description="Tổng quan hoạt động cửa hàng, doanh thu và chỉ số vận hành quan trọng." searchPlaceholder="Tìm kiếm..." />

            {isLoading ?
                <div className="flex justify-center p-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#356647] border-t-transparent"></div>
                </div>
            : error ?
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>
            :   <div className="flex flex-col gap-6">
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        {/* line 1 */}
                        <MetricCard title="Số đơn bán ra" value={stats?.totalCompletedOrders || 0} icon="receipt_long" colorClass="text-purple-600" bgClass="bg-purple-50" />
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
                        <MetricCard title="Khách hàng mua sắm" value={stats?.customerCount || 0} icon="group" colorClass="text-teal-600" bgClass="bg-teal-50" />

                        {/* line 2 */}
                        <MetricCard
                            title="Số đơn trả hàng"
                            value={(stats?.partiallyReturnedOrders || 0) + (stats?.fullyReturnedOrders || 0)}
                            icon="remove_shopping_cart"
                            colorClass="text-orange-600"
                            bgClass="bg-orange-50"
                        />
                        <MetricCard
                            title="Tổng tiền hoàn trả"
                            value={formatCurrency(stats?.refundAmount)}
                            icon="assignment_return"
                            colorClass="text-red-600"
                            bgClass="bg-red-50"
                        />
                        <MetricCard title="Tỷ lệ trả hàng" value={formatPercent(stats?.returnRate)} icon="percent" colorClass="text-slate-600" bgClass="bg-slate-50" />
                        <MetricCard
                            title="Tăng trưởng khách hàng"
                            value={formatPercent(stats?.customerGrowthRate)}
                            icon="trending_up"
                            colorClass="text-emerald-600"
                            bgClass="bg-emerald-50"
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Top 5 Sản phẩm */}
                        {topProducts && topProducts.length > 0 && (
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
                        )}

                        {/* Doanh thu theo Danh mục */}
                        {categorySales && categorySales.length > 0 && (
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
                        )}
                    </div>
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
