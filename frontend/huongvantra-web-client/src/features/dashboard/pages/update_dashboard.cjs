const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'DashboardPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Promise.all
content = content.replace(
    'dashboardApi.getRevenueGrowth(paramsLastYear)',
    'dashboardApi.getRevenueGrowth(paramsLastYear),\n                      dashboardApi.getProfitGrowth(params)'
);

// 2. Add setting revenueProfitGrowthData
const setRevenueGrowthStr = 'setRevenueGrowthData(mergedRevenue);';
const setRevenueProfitStr = `setRevenueGrowthData(mergedRevenue);
                
                // Format profit growth
                const formattedProfit = (revenueProfitGrowth || []).map(r => ({
                    label: r.label,
                    "Doanh thu gộp": r.grossRevenue,
                    "Doanh thu thuần": r.netRevenue,
                    "Lợi nhuận gộp": r.grossProfit
                }));
                setRevenueProfitGrowthData(formattedProfit);`;
content = content.replace(setRevenueGrowthStr, setRevenueProfitStr);

// 3. Insert renderProfitGrowthChart
const renderSalesGrowthStart = 'const renderSalesGrowth = () => (';
const renderProfitGrowthMethod = `const renderProfitGrowthChart = () => {
        return (
            <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-6 text-lg font-bold text-gray-800">Biểu Đồ Doanh Thu & Lợi Nhuận</h3>
                    {revenueProfitGrowthData && revenueProfitGrowthData.length > 0 ? (
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueProfitGrowthData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={(val) => new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(val)} tick={{fontSize: 12, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="Doanh thu gộp" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="Doanh thu thuần" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="Lợi nhuận gộp" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 min-h-[400px] flex items-center justify-center">
                            Chưa có dữ liệu.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    `;
content = content.replace(renderSalesGrowthStart, renderProfitGrowthMethod + renderSalesGrowthStart);

// 4. Update renderSalesGrowth JSX to include renderProfitGrowthChart() before the old revenue chart
const oldRevenueChart = `<div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-gray-800">Doanh Thu Thuần Theo Thời Gian</h3>`;
content = content.replace(
    oldRevenueChart,
    `{renderProfitGrowthChart()}
                    <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mt-6">
                        <h3 className="mb-6 text-lg font-bold text-gray-800">Doanh Thu Thuần Theo Thời Gian</h3>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('DashboardPage.jsx updated successfully.');
