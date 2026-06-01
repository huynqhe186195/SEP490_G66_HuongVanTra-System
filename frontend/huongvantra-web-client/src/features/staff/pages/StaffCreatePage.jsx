import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'

function StaffCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    idCard: '',
    address: '',
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
        title="Tạo nhân viên"
        description="Thêm tài khoản nhân sự mới, gán vai trò và phạm vi sử dụng"
        searchPlaceholder="Tim kiem he thong..."
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#414942]">
            <span>He thong</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span>Nhan vien</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Them moi</span>
          </nav>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold text-[#356647]">Them tai khoan nhan su</h1>
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
                Tao tai khoan
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
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.fullName} onChange={handleChange('fullName')} />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">So dien thoai</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.phone} onChange={handleChange('phone')} />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">Email cong viec</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.email} onChange={handleChange('email')} />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-[#414942]">So CCCD/ID Card</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.idCard} onChange={handleChange('idCard')} />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#414942]">Dia chi thuong tru</span>
                  <input className="rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.address} onChange={handleChange('address')} />
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
                    <select className="w-full appearance-none rounded-lg border-none bg-[#f6f4ec] p-3 text-sm shadow-inner outline-none focus:ring-2 focus:ring-[#356647]/30" value={form.role} onChange={handleChange('role')}>
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
                    <button type="button" className={`rounded-md px-6 py-2 text-sm transition-colors ${form.scope === 'co-ban' ? 'bg-[#4a6242] text-white shadow-sm' : 'text-[#414942] hover:bg-[#e4e3db]'}`} onClick={() => setForm((current) => ({ ...current, scope: 'co-ban' }))}>
                      Co ban
                    </button>
                    <button type="button" className={`rounded-md px-6 py-2 text-sm transition-colors ${form.scope === 'toan-quyen' ? 'bg-[#4a6242] text-white shadow-sm' : 'text-[#414942] hover:bg-[#e4e3db]'}`} onClick={() => setForm((current) => ({ ...current, scope: 'toan-quyen' }))}>
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
                  <button type="button" className={`relative h-6 w-12 rounded-full transition-colors ${form.active ? 'bg-[#356647]' : 'bg-[#dcdad2]'}`} onClick={() => setForm((current) => ({ ...current, active: !current.active }))} aria-label="Toggle status">
                    <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-4">
            <section className="rounded-xl bg-white p-5 text-center shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="group relative mx-auto mb-4 w-fit">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#356647]/10 bg-[#f0eee6] text-[#717971]">
                  <span className="material-symbols-outlined text-5xl">person</span>
                </div>
                <button type="button" className="absolute bottom-4 right-0 rounded-full bg-[#356647] p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  <span className="material-symbols-outlined">photo_camera</span>
                </button>
              </div>

              <h4 className="text-xl font-semibold text-[#356647]">{form.fullName || 'Nhan su moi'}</h4>
              <p className="mb-4 text-sm text-[#414942]">Ma NV: Tu dong tao sau khi luu</p>
              <button type="button" className="inline-flex items-center gap-2 text-sm text-[#356647] hover:underline">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Tai anh dai dien
              </button>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#414942]">Ghi chu he thong</h4>
              <ul className="space-y-2 text-sm text-[#414942]">
                <li className="rounded-lg bg-[#f6f4ec] px-3 py-2">Mat khau tam thoi se gui qua email cong viec.</li>
                <li className="rounded-lg bg-[#f6f4ec] px-3 py-2">Nhan vien can doi mat khau sau lan dang nhap dau tien.</li>
                <li className="rounded-lg bg-[#f6f4ec] px-3 py-2">Role va pham vi du lieu co the cap nhat sau khi tao.</li>
              </ul>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}

export default StaffCreatePage