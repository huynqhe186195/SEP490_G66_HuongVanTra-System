import { useState } from 'react'
import InventoryDeductionModal from '../components/InventoryDeductionModal.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const rows = [
  {
    order: '#ORD-7742',
    date: '24 Th10, 2023',
    time: '14:32',
    product: 'Bộ Trà Đạo Matcha',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBWCstPOHgKBdr_evFeZfNI5kz7NBq-hq20ABh5LMY57fDWxJhM1YEFD0A4Mw0wra8kyuLYwMqzOoD5SDDE6-LK8pNNwrH08dIWRUYUytTWafZpDE6mukIq_T_Xs8USvQx_tGOoy1VP3ui9XxD7o2sEWLQPm_IReJSXuHi1FO5lsQ3Ivjg4-2bkMrYrfezK4LHVN4gCNCjtoM_ntZMTbq4J5WSlcfew-tKtSRfUl_oNh4gpu2JF26q670dy5tThS6Qih-MVAq0HBoVF',
    bom: ['50g Matcha Thượng Hạng', 'Chổi tre (Chasen)'],
    materials: [
      { name: 'Matcha Thượng Hạng', required: '50g', stock: '1000g', status: 'ok', statusLabel: 'Hợp lệ' },
      { name: 'Chổi tre (Chasen)', required: '1', stock: '0', status: 'missing', statusLabel: 'Không đủ' },
    ],
    status: 'action',
  },
  {
    order: '#ORD-7741',
    date: '24 Th10, 2023',
    time: '11:15',
    product: 'Sencha Vụ Xuân',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuABO_YUlUBGP8jrFjLTWglz_a7bCoZj_WY4NIwzQ4VVE3ehOWKpN_v8BYsCemcqFKZwCiis2PUWzp41cbXXGC2p_hizfa0sNzuPmBbCrlcbsijjknXWoUSpz0out5ANm5KAl_ga6zM9izvKqMaPAh_pum8uCXSS2XI3asKGPDYD0SCSpw8zIO-YnVH5__ZgZ2CFvtUR5_uJvgOVekr0Xj8AXDjHsjqxqyEIgf67K2e7PKDtdxxYxWYyPGeGVPsYrsQlFn6u4_S_uWM5',
    bom: ['Túi 100g'],
    status: 'done',
  },
  {
    order: '#ORD-7740',
    date: '23 Th10, 2023',
    time: '16:45',
    product: 'Hộp Quà Thảo Mộc',
    bom: ['50g Earl Grey', '50g Chamomile', 'Hộp Thắt nơ Tùy chỉnh'],
    status: 'action',
  },
]

function InventoryPage() {
  const [selectedRow, setSelectedRow] = useState(null)

  return (
    <>
      <PageHeader compact title="Quản lý Kho hàng" searchPlaceholder="Tìm kiếm..." />

      <section className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="max-w-lg">
          <h2 className="mb-2 text-3xl font-bold text-gray-800">Khấu trừ Kho hàng</h2>
          <p className="text-sm leading-relaxed text-gray-500">Xem lại các đơn hàng gần đây và xác nhận khấu trừ kho cho các sản phẩm kết hợp.</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <div className="relative">
              <select className="appearance-none rounded-lg border border-gray-200 bg-[#F5F8F4] py-2 pl-4 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#538463]">
                <option>7 ngày qua</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>

            <button type="button" className="rounded-lg border border-gray-200 bg-[#F5F8F4] px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              + Thêm mặt hàng
            </button>
          </div>

          <button type="button" className="flex items-center gap-2 rounded-lg bg-[#629474] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#538463]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            Xuất bản CSV
          </button>
        </div>
      </section>

      <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAF8] text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4">Mã đơn hàng</th>
                <th className="px-6 py-4">Ngày</th>
                <th className="px-6 py-4">Tên sản phẩm</th>
                <th className="px-6 py-4">Chi tiết BOM</th>
                <th className="px-6 py-4">TRẠNG THÁI</th>
                <th className="px-6 py-4 text-center">Hành động</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.order} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-6 py-6 text-sm font-semibold text-gray-700">{row.order}</td>

                  <td className="px-6 py-6 text-[13px] text-gray-500">
                    {row.date}
                    <br />
                    <span className="text-[11px] opacity-70">{row.time}</span>
                  </td>

                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      {row.image ? (
                        <img alt={row.product} className="h-12 w-12 rounded-lg bg-gray-100 object-cover" src={row.image} />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-800">{row.product}</span>
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <ul className="space-y-1">
                      {row.bom.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[12px] text-gray-600">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </td>

                  <td className="px-6 py-6">
                    <span
                      className={`inline-block rounded-full px-3.5 py-1.5 text-xs font-medium ${
                        row.status === 'action'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[#C1D2E0] text-[#5A7A94]'
                      }`}
                    >
                      {row.status === 'action' ? 'Chờ khấu trừ' : 'Đã trừ kho'}
                    </span>
                  </td>

                  <td className="px-6 py-6 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 p-2 text-gray-400 transition-colors hover:text-[#538463]"
                      aria-label={`Xem chi tiết ${row.order}`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500">Hiển thị 1-3 trong số 124 đơn hàng</p>
          <div className="flex gap-2">
            <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <button type="button" className="flex items-center gap-2 rounded-xl bg-[#629474] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#538463] hover:shadow-xl active:scale-95">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Nhập hàng nhanh
        </button>
      </div>

      <InventoryDeductionModal
        date={selectedRow?.date}
        isOpen={Boolean(selectedRow)}
        materials={selectedRow?.materials ?? []}
        onClose={() => setSelectedRow(null)}
        order={selectedRow?.order}
        product={selectedRow?.product}
      />
    </>
  )
}

export default InventoryPage