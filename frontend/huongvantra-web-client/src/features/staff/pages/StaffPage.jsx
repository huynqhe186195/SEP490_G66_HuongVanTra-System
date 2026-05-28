import { Link } from 'react-router-dom'
import AppTopHeader from '../../../components/shared/AppTopHeader.jsx'

const staffRows = [
  {
    id: 'STF-001',
    name: 'Tran Minh Tam',
    role: 'Cua hang truong (Admin)',
    roleTone: 'text-[#356647]',
    account: 'tam.tm_admin',
    phone: '0901 234 567',
    status: 'Hoat dong',
    active: true,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBZl0xqSxjzek3rKfylwUIWuQG1Al_z0qMMVR6oagy_9sAimnXNIdXGIll_N8Lov6h7P7YnRCzFybNUL1nG7xF7GPgvo3E2XygdPBf0wXTscvIyGCv3gW9NYteskL9DWfeghVCdZevwRnyv3wlA2Vl2EbNtHGTiSRvqtS0fEDiiMHO6ybh0AVU7SN6wZ72UQ97_62P2P4Mj1Ebnqldcd80YmYH4p9q1nKYVhLJ1uzzbLy9tbex0N6O8jhso4B9pkD2d7ntYFwqVFxK-',
  },
  {
    id: 'STF-002',
    name: 'Le Thi Mai',
    role: 'Nhan vien ban hang (Sale)',
    roleTone: 'text-[#7e5700]',
    account: 'mai.lt_sale',
    phone: '0988 776 543',
    status: 'Hoat dong',
    active: true,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCDwyOde1WWcd2lhaIXjadFqsmlJDabwvwA4raQKqmSzmHXKE_b0TfDHuh_EZSuxwGp6evdSegAZ3enm5-PP2YRBP6YXU39G87TplzK_VkHiVnTjgID5uHV77COY3HsdLHG0QYMEFGeo35xgM8U9BTq3NIb0efP8_jRWIG00z6Y2V2BcdV6nAXZdGnvAfV1HTmJTwszCf6ioVTwMFcqp5uwEU-RKEzeqb5RiaotFEQIsq8Rba5Brk6BIavMcB0FyYmzxQ6xGUY-p_CE',
  },
  {
    id: 'STF-003',
    name: 'Nguyen Van Dung',
    role: 'Kho van (Inventory)',
    roleTone: 'text-[#414942]',
    account: 'dung.nv_inv',
    phone: '0912 333 444',
    status: 'Da khoa',
    active: false,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAlUGt_EarYKJWLaHtZcKgO7ewyKJBY4IoH5wZrI0UFn3xCNUBrtrr4lzOJKnkQhC2-rZKItTPR5qiVaq7fJ-VjyJIRFXZFNaMfIDq3lOngd5S4F89lrtI2SQXe-FFN-wiELyvNjPwnd8Aqf9YITR-Lhow4nphbilEPHyXyOLFiPNAWEaLJ4N561Y41JjucctCS0Q3BHR18OryZwA7XXCY568vHsN2eRpEqxNY2rcEgB8v152GMjnQWBQosZA3x4cvTB8IXKogedbsd',
  },
  {
    id: 'STF-004',
    name: 'Pham Thanh Van',
    role: 'Ke toan (Accountant)',
    roleTone: 'text-[#4a6242]',
    account: 'van.pt_acc',
    phone: '0944 555 666',
    status: 'Hoat dong',
    active: true,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBpgfodiL0bEet7kls7JZvAPrW1X_UbuULkzbAi-UuAcdhFTrUhM6saAfok54n7rf3xZbRj600ysO0Hx05yGU_lPG2sxCOAtOCKbsyX2f7c1lqTy18LBcbH_7nHG8w4OFoqdHRRmWXKXfRlfCGwI1_LKHm6g8HaHB2d53xVxeiZbHBSMMDQVHJEbQGRECdpZE4Ucn2WFz4ooxJYRjQ1_eo6xyEaaxcZsHQLN8YVQVI5mgG6sO8WPWBfsryx-zsfiGAYajjJkSKeuAEB',
  },
]

const stats = [
  { label: 'Tong nhan su', value: '48', icon: 'groups', tone: 'bg-[#4e7f5e]/20 text-[#356647]' },
  { label: 'Dang hoat dong', value: '42', icon: 'check_circle', tone: 'bg-[#627b59]/20 text-[#4a6242]' },
  { label: 'Tai khoan khoa', value: '6', icon: 'lock', tone: 'bg-[#ffdad6] text-[#ba1a1a]' },
]

function StaffPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <AppTopHeader searchPlaceholder="Tim kiem nhan vien..." />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-[#414942]">
              <span>He thong</span>
              <span>/</span>
              <span className="font-semibold text-[#356647]">Nhan vien</span>
            </div>
            <h1 className="text-3xl font-bold text-[#356647]">Quan ly nhan su</h1>
          </div>

          <Link
            to="/staff/create"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-[#356647] px-5 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            + Them tai khoan
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="flex items-center gap-4 rounded-xl border border-[#c1c9c0]/30 bg-[#fff] p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.tone}`}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {stat.icon}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#414942]">{stat.label}</p>
                <p className="text-2xl font-bold text-[#1b1c17]">{stat.value}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#c1c9c0]/30 shadow-[0px_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#c1c9c0]/30 bg-[#f6f4ec]/70 p-4">
            <div className="relative min-w-[260px] flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#414942] text-[20px]">search</span>
              <input
                className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#1b1c17] outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]"
                placeholder="Ten hoac so dien thoai..."
                type="text"
              />
            </div>

            <select className="rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647]">
              <option>Tat ca vai tro</option>
              <option>Quan tri vien</option>
              <option>Nhan vien ban hang</option>
              <option>Kho van</option>
              <option>Ke toan</option>
            </select>

            <select className="rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647]">
              <option>Trang thai</option>
              <option>Hoat dong</option>
              <option>Bi khoa</option>
            </select>

            <button type="button" className="rounded-lg p-2.5 text-[#414942] transition-colors hover:bg-[#eae8e0]">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f0eee6] text-xs uppercase tracking-wider text-[#414942]">
                  <th className="px-6 py-4 font-semibold">Nhan vien va vai tro</th>
                  <th className="px-6 py-4 font-semibold">Tai khoan</th>
                  <th className="px-6 py-4 font-semibold">So dien thoai</th>
                  <th className="px-6 py-4 text-center font-semibold">Trang thai</th>
                  <th className="px-6 py-4 text-right font-semibold">Thao tac</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#c1c9c0]/20">
                {staffRows.map((staff) => (
                  <tr key={staff.id} className="group transition-colors hover:bg-[#356647]/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          alt={staff.name}
                          className={`h-10 w-10 rounded-full object-cover ${staff.active ? 'ring-2 ring-[#4e7f5e]/20' : 'grayscale opacity-60'}`}
                          src={staff.avatar}
                        />
                        <div>
                          <p className={`text-sm font-semibold text-[#1b1c17] ${staff.active ? '' : 'opacity-60'}`}>{staff.name}</p>
                          <p className={`text-xs ${staff.roleTone} ${staff.active ? '' : 'opacity-70'}`}>{staff.role}</p>
                        </div>
                      </div>
                    </td>

                    <td className={`px-6 py-4 text-sm text-[#414942] ${staff.active ? '' : 'opacity-60'}`}>{staff.account}</td>
                    <td className={`px-6 py-4 text-sm text-[#414942] ${staff.active ? '' : 'opacity-60'}`}>{staff.phone}</td>

                    <td className="px-6 py-4 text-center">
                      {staff.active ? (
                        <span className="inline-flex items-center rounded-full bg-[#baefc8] px-3 py-1 text-xs font-semibold text-[#00210f]">
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#356647]" />
                          Hoat dong
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#ffdad6] px-3 py-1 text-xs font-semibold text-[#93000a]">
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
                          Da khoa
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link to={`/staff/${staff.id}`} className="rounded-full p-2 text-[#356647] transition-colors hover:bg-[#eae8e0]" title="Chinh sua">
                          <span className="material-symbols-outlined">edit</span>
                        </Link>
                        <button type="button" className="rounded-full p-2 text-[#414942] transition-colors hover:bg-[#eae8e0]" title="Lich su">
                          <span className="material-symbols-outlined">history</span>
                        </button>
                        <button
                          type="button"
                          className={`rounded-full p-2 transition-colors hover:bg-[#eae8e0] ${staff.active ? 'text-[#ba1a1a]' : 'text-[#356647]'}`}
                          title={staff.active ? 'Khoa' : 'Mo khoa'}
                        >
                          <span className="material-symbols-outlined">{staff.active ? 'lock_open' : 'lock'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#c1c9c0]/30 bg-[#f6f4ec]/50 px-6 py-4">
            <p className="text-sm text-[#414942]">Hien thi 1-10 cua 48 nhan vien</p>
            <div className="flex items-center gap-1">
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#414942] hover:bg-[#eae8e0]">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#356647] text-white">
                1
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eae8e0]">
                2
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eae8e0]">
                3
              </button>
              <span className="px-2 text-sm text-[#414942]">...</span>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#eae8e0]">
                5
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#414942] hover:bg-[#eae8e0]">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-[#414942]/60">© 2024 Huong Van Tra Management System. All Rights Reserved.</footer>
    </div>
  )
}

export default StaffPage