import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

const loginHistory = [
  { id: '1', channel: 'He thong POS 02', time: '14:20', date: 'Lan cuoi: Hom nay', icon: 'devices', active: true },
  { id: '2', channel: 'Mobile App', time: '08:15', date: 'Lan cuoi: Hom qua', icon: 'smartphone', active: false },
]

function StaffDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [form, setForm] = useState({
    fullName: 'Nguyen Hoang Minh',
    phone: '0901 234 567',
    email: 'minh.nh@huongvantra.vn',
    idCard: '031092000456',
    address: '45 Tran Hung Dao, Quan 1, TP. Ho Chi Minh',
    role: 'Chuyen vien ban hang',
    scope: 'co-ban',
    active: true,
  })

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSave = () => {
    navigate('/staff')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Chi tiết nhân viên"
        description="Xem và chỉnh sửa thông tin tài khoản, quyền truy cập và lịch sử đăng nhập"
        searchPlaceholder="Tim kiem he thong..."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#414942]">
            <span>He thong</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span>Nhan vien</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Chi tiet</span>
          </nav>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold text-[#356647]">Chi tiet &amp; Chinh sua nhan vien</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-[#356647] px-6 py-2 text-[#356647] transition-all hover:bg-[#356647]/5 active:scale-95"
                onClick={() => navigate('/staff')}
              >
                Huy bo
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#4a6242] px-6 py-2 text-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all hover:brightness-110 active:scale-95"
                onClick={handleSave}
              >
                Luu thay doi
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">person</span>
                <h3 className="text-xl font-semibold">Thong tin ca nhan</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Ho va ten</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">So dien thoai</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.phone}
                    onChange={handleChange('phone')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Email cong viec</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.email}
                    onChange={handleChange('email')}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">So CCCD/ID Card</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.idCard}
                    onChange={handleChange('idCard')}
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Dia chi thuong tru</span>
                  <input
                    className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                    value={form.address}
                    onChange={handleChange('address')}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <h3 className="text-xl font-semibold">Gan quyen</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Vai tro nhan vien</span>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30"
                      value={form.role}
                      onChange={handleChange('role')}
                    >
                      <option>Chuyen vien ban hang</option>
                      <option>Quan ly cua hang</option>
                      <option>Nhan vien kho</option>
                      <option>Ke toan</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3 text-[#414942]">expand_more</span>
                  </div>
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Pham vi du lieu</span>
                  <div className="flex w-fit gap-2 rounded-lg bg-[#f6f4ec] p-1">
                    <button
                      type="button"
                      className={`rounded-md px-6 py-2 text-sm transition-colors ${form.scope === 'co-ban' ? 'bg-[#4a6242] text-white shadow-sm' : 'text-[#414942] hover:bg-[#e4e3db]'}`}
                      onClick={() => setForm((current) => ({ ...current, scope: 'co-ban' }))}
                    >
                      Co ban
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-6 py-2 text-sm transition-colors ${form.scope === 'toan-quyen' ? 'bg-[#4a6242] text-white shadow-sm' : 'text-[#414942] hover:bg-[#e4e3db]'}`}
                      onClick={() => setForm((current) => ({ ...current, scope: 'toan-quyen' }))}
                    >
                      Toan quyen
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#356647]">
                  <span className="material-symbols-outlined">online_prediction</span>
                  <h3 className="text-xl font-semibold">Trang thai he thong</h3>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${form.active ? 'text-[#356647]' : 'text-[#414942]'}`}>{form.active ? 'Dang hoat dong' : 'Ngung hoat dong'}</span>
                  <button
                    type="button"
                    className={`relative h-6 w-12 rounded-full transition-colors ${form.active ? 'bg-[#356647]' : 'bg-[#dcdad2]'}`}
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    aria-label="Toggle status"
                  >
                    <span
                      className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-4">
            <section className="rounded-xl bg-white p-5 text-center shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="group relative mx-auto mb-4 w-fit">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-[#356647]/10">
                  <img
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXJZjMr3qnbmWyT6hu8nzPMkUs-O6i85LL0RuCU_KXm9eUz_QZG1o5mVXm7dZjv8mHKxgyNnwoNg4Yy9lygYF5N7XS5NviFKM_JtjZgrlgKxVjOMw4ddbVNdNw3PazQgiI3PUc3YbSo00UXJt0pL6-AQf5RO3c7bfNBijC-6j046vbmnJA7JuZmNJILpwYUSTXlJdzbjhLbIHHa2Gm6IPFJ7KaT5l4fY18-ajZLMO6Me4HOi4ao3Os3Nys344z-J2ZpHMq_LQ5X_V3"
                  />
                </div>
                <button type="button" className="absolute bottom-4 right-0 rounded-full bg-[#356647] p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  <span className="material-symbols-outlined">photo_camera</span>
                </button>
              </div>

              <h4 className="text-xl font-semibold text-[#356647]">{form.fullName}</h4>
              <p className="mb-4 text-sm text-[#414942]">Ma NV: {id || 'HV-0082'}</p>
              <button type="button" className="inline-flex items-center gap-2 text-sm text-[#356647] hover:underline">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Tai anh moi
              </button>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#414942]">Hieu suat thang nay</h4>

              <div className="mb-2 flex items-end justify-between">
                <span className="text-[48px] font-bold leading-none text-[#356647]">94.2%</span>
                <div className="flex flex-col items-end">
                  <span className="flex items-center font-bold text-[#356647]">
                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                    2.4%
                  </span>
                  <span className="text-xs text-[#414942]">So voi thang truoc</span>
                </div>
              </div>

              <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-[#f0eee6]">
                <div className="h-full bg-[#356647]" style={{ width: '94.2%' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#baefc8] p-3">
                  <p className="mb-1 text-xs text-[#1f5033]">Don hang</p>
                  <p className="font-bold text-[#356647]">128</p>
                </div>
                <div className="rounded-lg bg-[#ceebc1] p-3">
                  <p className="mb-1 text-xs text-[#354d2e]">Danh gia</p>
                  <p className="font-bold text-[#4a6242]">4.9/5.0</p>
                </div>
              </div>
            </section>

            <section className="flex-1 rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#414942]">Lich su dang nhap</h4>

              <div className="space-y-4">
                {loginHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-[#c1c9c0] pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.active ? 'bg-[#f0eee6] text-[#356647]' : 'bg-[#f0eee6] text-[#414942]'}`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1b1c17]">{item.channel}</p>
                        <p className="text-xs text-[#414942]">{item.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${item.active ? 'text-[#356647]' : 'text-[#414942]'}`}>{item.time}</span>
                  </div>
                ))}

                <button type="button" className="w-full rounded-lg py-2 text-sm text-[#356647] transition-colors hover:bg-[#356647]/5">
                  Xem tat ca lich su
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}

export default StaffDetailPage