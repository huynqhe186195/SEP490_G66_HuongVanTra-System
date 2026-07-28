import PageHeader from '../../../components/shared/PageHeader.jsx'

const reportRows = [
  {
    code: 'NVL-001',
    name: 'Tra Xanh Thai Nguyen Premium',
    note: 'Lo: TX-2023-11A',
    unit: 'Kg',
    stock: '4.5',
    min: '10.0',
    status: 'Sap het',
  },
  {
    code: 'NVL-042',
    name: 'Tra Oolong Tu Quy',
    note: 'Lo: OL-2023-10B',
    unit: 'Kg',
    stock: '25.0',
    min: '15.0',
    status: 'On dinh',
  },
  {
    code: 'SP-012',
    name: 'Binh tra tu sa nap xoay',
    note: 'Hang nhap khau',
    unit: 'Bo',
    stock: '1',
    min: '5',
    status: 'Can nhap',
  },
  {
    code: 'NVL-089',
    name: 'Bach Tra Co Thu',
    note: 'Lo: BT-2023-09C',
    unit: 'Kg',
    stock: '8.2',
    min: '5.0',
    status: 'On dinh',
  },
  {
    code: 'DG-004',
    name: 'Hop thiec Premium (Lon)',
    note: 'Vat tu dong goi',
    unit: 'Cai',
    stock: '120',
    min: '200',
    status: 'Sap het',
  },
  {
    code: 'NVL-156',
    name: 'Mat ong rung Tay Bac',
    note: 'Nguyen lieu pha che',
    unit: 'Lit',
    stock: '2.0',
    min: '5.0',
    status: 'Can han',
  },
]

const bomUsageRows = [
  {
    icon: 'coffee',
    title: 'Tra Xanh Thai Nguyen',
    progressClass: 'w-4/5 bg-[#ba1a1a]',
    noteClass: 'text-[#ba1a1a]',
    note: 'Da dung: 8.2kg / Ke hoach: 10kg',
  },
  {
    icon: 'ice_skating',
    title: 'Sua tuoi thanh trung',
    progressClass: 'w-1/2 bg-[#356647]',
    noteClass: 'text-[#356647]',
    note: 'Da dung: 12L / Ke hoach: 24L',
  },
  {
    icon: 'local_drink',
    title: 'Duong nuoc tinh luyen',
    progressClass: 'w-2/3 bg-[#7e5700]',
    noteClass: 'text-[#7e5700]',
    note: 'Da dung: 4.5L / Ke hoach: 7L',
  },
]

function statusBadge(status) {
  if (status === 'On dinh') {
    return <span className="inline-flex rounded-full bg-[#4e7f5e]/20 px-3 py-1 text-[11px] font-bold text-[#1f5033]">Ổn định</span>
  }

  if (status === 'Can nhap') {
    return <span className="inline-flex rounded-full bg-[#fec25b]/30 px-3 py-1 text-[11px] font-bold text-[#744f00]">Cần nhập</span>
  }

  if (status === 'Can han') {
    return <span className="inline-flex rounded-full bg-[#ffdead] px-3 py-1 text-[11px] font-bold text-[#7e5700]">Cận hạn</span>
  }

  return <span className="inline-flex rounded-full bg-[#ffdad6] px-3 py-1 text-[11px] font-bold text-[#93000a]">Sắp hết</span>
}

function ReportsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader title="Báo cáo kho hàng" titleInfo="Theo dõi tồn kho, định mức nguyên vật liệu và biến động hàng hóa" searchPlaceholder="Tìm kiếm báo cáo..." />

      <div className="rounded-2xl border border-[#c1c9c0]/30 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[#4a6242] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined">download</span>
            Xuất báo cáo (Excel)
          </button>
        </div>
      </div>

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-[#c1c9c0] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-lg bg-[#ffdad6] p-3 text-[#93000a]">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <span className="text-xs font-bold text-[#ba1a1a]">Cần nhập gấp</span>
            </div>
            <p className="text-2xl font-bold text-[#1b1c17]">12 Mat hang</p>
            <p className="text-sm text-[#414942]">Duoi muc ton toi thieu</p>
          </article>

          <article className="rounded-xl border border-[#c1c9c0] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-lg bg-[#fec25b]/25 p-3 text-[#744f00]">
                <span className="material-symbols-outlined">history_toggle_off</span>
              </div>
              <span className="text-xs font-bold text-[#7e5700]">Cận hạn</span>
            </div>
            <p className="text-2xl font-bold text-[#1b1c17]">05 Lo hang</p>
            <p className="text-sm text-[#414942]">Het han trong 7 ngay toi</p>
          </article>

          <article className="rounded-xl border border-[#c1c9c0] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-lg bg-[#4e7f5e] p-3 text-[#f6fff5]">
                <span className="material-symbols-outlined">inventory</span>
              </div>
              <span className="text-xs font-bold text-[#356647]">Tổng giá trị</span>
            </div>
            <p className="text-2xl font-bold text-[#1b1c17]">1.240.000.000d</p>
            <p className="text-sm text-[#414942]">Tổng vốn tồn kho hiện tại</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-4">
            <section className="rounded-xl border border-[#c1c9c0] bg-[#f0eee6] p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-[#356647]">
                <span className="material-symbols-outlined">filter_alt</span>
                Cau hinh bao cao
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#414942]">Loai bao cao</label>
                  <select className="w-full rounded-lg border border-[#c1c9c0] bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#356647]/30">
                    <option>Bao cao Ton kho hien tai</option>
                    <option>Bao cao Tieu hao Nguyen vat lieu (BOM)</option>
                    <option>Sổ nhật ký biến động kho</option>
                    <option>Phan tich hang cham luan chuyen</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#414942]">Danh mục sản phẩm</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-full bg-[#627b59] px-4 py-1.5 text-xs font-semibold text-white">Tất cả</button>
                    <button type="button" className="rounded-full border border-[#c1c9c0] px-4 py-1.5 text-xs font-semibold text-[#414942] transition-colors hover:bg-[#e4e3db]">Tra xanh</button>
                    <button type="button" className="rounded-full border border-[#c1c9c0] px-4 py-1.5 text-xs font-semibold text-[#414942] transition-colors hover:bg-[#e4e3db]">Tra den</button>
                    <button type="button" className="rounded-full border border-[#c1c9c0] px-4 py-1.5 text-xs font-semibold text-[#414942] transition-colors hover:bg-[#e4e3db]">Dung cu pha tra</button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#414942]">Trang thai kho</label>
                  <div className="space-y-2 text-sm text-[#1b1c17]">
                    <label className="flex items-center gap-3">
                      <input checked className="h-4 w-4 rounded border-[#717971] text-[#356647] focus:ring-[#356647]" readOnly type="checkbox" />
                      Hang sap het (Duoi dinh muc)
                    </label>
                    <label className="flex items-center gap-3">
                      <input className="h-4 w-4 rounded border-[#717971] text-[#356647] focus:ring-[#356647]" type="checkbox" />
                      Hàng cận hạn / hết hạn
                    </label>
                    <label className="flex items-center gap-3">
                      <input className="h-4 w-4 rounded border-[#717971] text-[#356647] focus:ring-[#356647]" type="checkbox" />
                      Kho không biến động (&gt;30 ngày)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#414942]">Thoi gian</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#356647]/30" type="date" />
                    <input className="rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#356647]/30" type="date" />
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-2 w-full rounded-lg bg-[#356647] px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-95"
                >
                  Cập nhật kết quả
                </button>
              </div>
            </section>

            <section className="relative overflow-hidden rounded-xl border border-[#c1c9c0]">
              <img
                alt="Tea Warehouse"
                className="h-full w-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYEFClF9xpPb2s4Gjh2zl_mktrX-uj8hg-9zf_636BZbSFOkIs3X43uS4fov57QI_W2FVc3msa_gjVNX4jGUKxlqP6yLogmOrnbgLwatOCZNJezCtOfzFHOkzXNFVsPz2YIFEMVvOl-JkyHXj6y0kBU1EJKr_pwobj28wwkestbFnWvMZ8OFmGHVYo-lhOHP91OnnQUBuIkzieyKJbhxY4NebeR_EXev69Hq3FKIu7hUH9Ab3GErhoUiqNDT_aZK8UDquZuFjLzXh-"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#356647]/70 to-transparent" />
              <p className="absolute bottom-0 left-0 right-0 p-5 text-sm font-medium text-white">
                "Su thinh lang cua tra bat dau tu su ngan nap cua kho tang."
              </p>
            </section>
          </div>

          <div className="space-y-6 xl:col-span-8">
            <section className="overflow-hidden rounded-xl border border-[#c1c9c0] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#c1c9c0] bg-[#f6f4ec] px-5 py-4">
                <h3 className="text-xl font-semibold text-[#356647]">Xem trước dữ liệu</h3>
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg p-2 transition-colors hover:bg-[#e4e3db]" title="In">
                    <span className="material-symbols-outlined text-[#414942]">print</span>
                  </button>
                  <button type="button" className="rounded-lg p-2 transition-colors hover:bg-[#e4e3db]" title="Toàn màn hình">
                    <span className="material-symbols-outlined text-[#414942]">fullscreen</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#eae8e0]/60 text-xs uppercase tracking-wide text-[#414942]">
                      <th className="p-4 font-semibold">Ma hang</th>
                      <th className="p-4 font-semibold">Tên sản phẩm / NVL</th>
                      <th className="p-4 font-semibold">DVT</th>
                      <th className="p-4 text-right font-semibold">Ton hien tai</th>
                      <th className="p-4 text-right font-semibold">Dinh muc toi thieu</th>
                      <th className="p-4 text-center font-semibold">Trang thai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c1c9c0] text-sm">
                    {reportRows.map((row) => (
                      <tr key={row.code} className="transition-colors hover:bg-[#f6f4ec]">
                        <td className="p-4 font-medium text-[#1b1c17]">{row.code}</td>
                        <td className="p-4">
                          <p className="font-semibold text-[#356647]">{row.name}</p>
                          <p className="text-xs text-[#717971]">{row.note}</p>
                        </td>
                        <td className="p-4 text-[#414942]">{row.unit}</td>
                        <td className="p-4 text-right font-bold text-[#1b1c17]">{row.stock}</td>
                        <td className="p-4 text-right text-[#414942]">{row.min}</td>
                        <td className="p-4 text-center">{statusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#c1c9c0] bg-[#f6f4ec] px-4 py-3">
                <span className="text-sm text-[#414942]">Hien thi 6 / 154 mat hang</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#e4e3db]">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#356647] text-sm font-bold text-white">
                    1
                  </button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-[#414942] transition-colors hover:bg-[#e4e3db]">
                    2
                  </button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-[#414942] transition-colors hover:bg-[#e4e3db]">
                    3
                  </button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#e4e3db]">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#c1c9c0] bg-[#f0eee6] p-5">
              <div className="mb-5 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <h3 className="text-xl font-semibold text-[#356647]">Phan tich tieu hao dinh muc (BOM)</h3>
                  <p className="text-sm text-[#414942]">Lien ket tieu hao nguyen lieu dua tren thuc don da ban</p>
                </div>
                <button type="button" className="text-sm font-semibold text-[#356647] transition-colors hover:underline">
                  Chi tiet dinh muc
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {bomUsageRows.map((row) => (
                  <article key={row.title} className="flex items-center gap-4 rounded-lg border border-[#c1c9c0] bg-white p-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#4a6242]/10 text-[#4a6242]">
                      <span className="material-symbols-outlined text-[30px]">{row.icon}</span>
                    </div>

                    <div className="flex-1">
                      <p className="text-sm text-[#414942]">{row.title}</p>
                      <div className="my-1 h-2 w-full overflow-hidden rounded-full bg-[#e4e3db]">
                        <div className={`h-full ${row.progressClass}`} />
                      </div>
                      <p className={`text-[11px] font-bold ${row.noteClass}`}>{row.note}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-[#717971] opacity-70">
        Copyright 2024 Hương Vân Trà — Hệ thống quản lý kho thông minh.
      </footer>
    </div>
  )
}

export default ReportsPage