import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const bomRows = [
  {
    code: 'BOM-001',
    product: 'Premium Jasmine Green Tea',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDKkjn5ofJfmfOIkt_CC-Yn27TkpAeYbut_Y103lMkeWsRSmQTm6gppmXXSRDuhv9x9FwDfZZ4X4u_kWUGel85FlY-IAV2dDEMne-2BvzV6eAiXLphC7vM0l3Ia83pvo0MMP4w57hukbtyAa-dBD6WOksKUV03etI-TvFDUivC9tdJfTJUwfCCEM7I_OrzFTnHRecrfARhRPTkWsT60mMX2IJ-pWK83_ez4J4e5Bv57kgpPEBDXE8lhzd8qQHNWe8GOAFbFFwOt-W86',
    category: 'Tra Xanh',
    updatedAt: 'Oct 24, 2023',
    status: 'Active',
  },
  {
    code: 'BOM-042',
    product: 'Ancient Mountain Oolong',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCKneetNNk82E-ZFzgg4gqN9quGNJysVBMs_47gmlqimeq22nu6ovAAHlvIKeSObie188ONezK6703sO8Gx4obyr_HYdpqNa6f4O1d78Tm1_zyAMRAkk7132QK5_JO9TZzulffyzlz_NEGCkun5ruINIO3MhQ568rANiRtdjbt3KVyf8ZOI8gfQBm86oB54xHnUCNSjUmfGUx3kNB2OVvhHiiI2UQxd9h45fv_wOMBsbomaHf-8fdpQ2ikxzZA48p0zPQAx9QP7Gpq0',
    category: 'Oolong',
    updatedAt: 'Nov 02, 2023',
    status: 'Pending',
  },
  {
    code: 'BOM-015',
    product: 'Sunset Hibiscus Blend',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCMSgi9GIJgCezEpvfRKa04XkCk2F03JxTONUeh0xfDdNDkeMhwQMRfihyStiBQRBnyfpUgyjLtKw_Yt6esjxFk1xbWIL3lNpWI7lOqSB59JyHWHSBkqY282mfIN9ZUEBp8tW7z1Cx7_GmMJmNI3Sa2qWjXQ5LH0yJ2ufHayPY7ceNxnGJq-EEoVQD4-DSRAGJsnPzSUbMBFrfiGp6YYcUSaR-cVCOeE76BKbjDR_2yE1ED9JnDLzK4hv6dKHIlBstiOhh4Z0k4cWe9',
    category: 'Herbal Blends',
    updatedAt: 'Oct 12, 2023',
    status: 'Draft',
  },
  {
    code: 'BOM-088',
    product: 'Golden Tip Black Tea',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAQv2e7mmYlbvsCWx2VvI0uMeyHP8riMAaW9JACTPduXXZBBcUb2_9q5t_iV8juc-rcslUHEooTMWy7xkU8fpVTVGn--VjnuPkDXEm-Bbj7A8l4eT69S8dsGLpB7G-cbr2OMM7krHD-dTZxwCqYoA7VGcssApIoX0-CVUAFi0QaF83KFkc4LMFYRGbqyTXMpA9LByd1zmwZPSFu-XViJjB94VnLBHPQ49zF8KBnCRYOoV7pFuX1VUSfdyIoh-Vj--nRoct5S5gFZQsZ',
    category: 'Tra Den',
    updatedAt: 'Nov 15, 2023',
    status: 'Active',
  },
]

function InventoryBomPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="BOM / Công thức"
        description="Quản lý công thức sản phẩm, trạng thái và lần cập nhật gần nhất"
        searchPlaceholder="Search BOM by code or product name..."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="mb-1 text-3xl font-bold text-[#356647]">Bill of Materials</h2>
            <p className="text-sm text-[#414942]">Manage your tea recipes and production components.</p>
          </div>
          <Link
            to="/inventory/bom/create"
            className="inline-flex items-center gap-2 rounded-xl bg-[#627b59] px-6 py-3 font-bold text-[#f8ffef] shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create New BOM</span>
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="flex cursor-pointer items-center justify-between rounded-xl border border-[#c1c9c0] bg-[#f6f4ec] p-4 transition-colors hover:border-[#356647]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#717971]">Total Recipes</p>
              <p className="text-2xl font-bold text-[#356647]">124</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#baefc8]">
              <span className="material-symbols-outlined text-[#356647]">menu_book</span>
            </div>
          </article>

          <article className="rounded-xl border border-[#c1c9c0] bg-[#f6f4ec] p-4">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#717971]">Filter Category</label>
            <select className="w-full cursor-pointer border-none bg-transparent p-0 text-sm text-[#1b1c17] focus:ring-0">
              <option>All Categories</option>
              <option>Tra Xanh</option>
              <option>Tra Den</option>
              <option>Oolong</option>
              <option>Herbal Blends</option>
            </select>
          </article>

          <article className="rounded-xl border border-[#c1c9c0] bg-[#f6f4ec] p-4">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#717971]">Filter Status</label>
            <div className="flex gap-2">
              <span className="rounded-full bg-[#4a6242] px-3 py-1 text-[10px] font-bold text-white">Active</span>
              <span className="cursor-pointer rounded-full bg-[#e4e3db] px-3 py-1 text-[10px] font-bold text-[#414942] transition-colors hover:bg-[#b3cea7]">Draft</span>
              <span className="cursor-pointer rounded-full bg-[#e4e3db] px-3 py-1 text-[10px] font-bold text-[#414942] transition-colors hover:bg-[#b3cea7]">Pending</span>
            </div>
          </article>

          <article className="flex items-center justify-between rounded-xl border border-[#356647] bg-[#4e7f5e] p-4 text-[#f6fff5]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Inventory Health</p>
              <p className="text-2xl font-bold">98%</p>
            </div>
            <span className="material-symbols-outlined text-4xl opacity-50">analytics</span>
          </article>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#c1c9c0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#eae8e0] text-xs uppercase tracking-wider text-[#414942]">
                  <th className="border-b border-[#c1c9c0] px-6 py-4 font-semibold">BOM Code</th>
                  <th className="border-b border-[#c1c9c0] px-6 py-4 font-semibold">Product Name</th>
                  <th className="border-b border-[#c1c9c0] px-6 py-4 font-semibold">Category</th>
                  <th className="border-b border-[#c1c9c0] px-6 py-4 text-center font-semibold">Last Updated</th>
                  <th className="border-b border-[#c1c9c0] px-6 py-4 text-center font-semibold">Status</th>
                  <th className="border-b border-[#c1c9c0] px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c1c9c0]">
                {bomRows.map((row) => (
                  <tr key={row.code} className="transition-colors hover:bg-[#fbf9f1]">
                    <td className="px-6 py-5 font-bold text-[#356647]">{row.code}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#f0eee6]">
                          <img alt={row.product} className="h-full w-full object-cover" src={row.image} />
                        </div>
                        <span className="font-medium text-[#1b1c17]">{row.product}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="rounded-lg bg-[#ceebc1] px-3 py-1 text-xs font-bold text-[#354d2e]">{row.category}</span>
                    </td>
                    <td className="px-6 py-5 text-center text-[#414942]">{row.updatedAt}</td>
                    <td className="px-6 py-5 text-center">
                      {row.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#356647]/10 px-3 py-1 text-xs font-bold text-[#356647]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#356647]" />
                          Active
                        </span>
                      ) : row.status === 'Pending' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fec25b]/20 px-3 py-1 text-xs font-bold text-[#7e5700]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#7e5700]" />
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4e3db] px-3 py-1 text-xs font-bold text-[#414942]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#717971]" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-lg p-2 transition-colors hover:bg-[#eae8e0]" title="View Details">
                          <span className="material-symbols-outlined text-[#414942]">visibility</span>
                        </button>
                        <Link to={`/inventory/bom/${row.code}/edit`} className="rounded-lg p-2 transition-colors hover:bg-[#eae8e0]" title="Edit BOM">
                          <span className="material-symbols-outlined text-[#414942]">edit</span>
                        </Link>
                        <button type="button" className="rounded-lg p-2 text-[#ba1a1a] transition-colors hover:bg-[#ffdad6]" title="Delete">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f4ec] px-6 py-4">
            <p className="text-xs text-[#414942]">Showing 1 to 4 of 124 recipes</p>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-lg p-2 text-[#717971] opacity-30" disabled>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#356647] text-xs font-bold text-white">
                1
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-[#414942] transition-colors hover:bg-[#eae8e0]">
                2
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-[#414942] transition-colors hover:bg-[#eae8e0]">
                3
              </button>
              <span className="mx-1">...</span>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-[#414942] transition-colors hover:bg-[#eae8e0]">
                31
              </button>
              <button type="button" className="rounded-lg p-2 text-[#717971] transition-colors hover:bg-[#eae8e0]">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      </section>

      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/natural-paper.png')" }}
      />
    </div>
  )
}

export default InventoryBomPage