import { useState } from 'react'
import { useNavigate } from 'react-router-dom'


function ProfilePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: 'Pham Thu Ha',
    staffCode: 'HVT-STAFF-082',
    username: 'ha.pham.pos',
    password: '',
    phone: '0987 654 321',
    role: 'staff',
    branch: 'q1',
    note: 'Nhan vien xuat sac thang 10. Chuyen trach tra xanh va qua tang cao cap.',
  })

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/staff')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <div className="mb-2 flex flex-col gap-1">
        <nav className="mb-2 flex items-center gap-2 text-[13px] text-[#707a72]">
          <span>Nhân sự</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span>Danh sách nhân viên</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-semibold text-[#356647]">Chỉnh sửa hồ sơ</span>
        </nav>

        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-[#1f241f] lg:text-[2rem]">
          Chỉnh sửa hồ sơ nhân viên
        </h1>
        <p className="max-w-3xl text-[0.95rem] leading-7 text-[#707a72]">
          Cập nhật thông tin chi tiết và phân quyền cho nhân viên của hệ thống Hương Vân Trà.
        </p>
      </div>

      <section className="rounded-[24px] border border-[#c1c9c0]/40 bg-white p-6 shadow-[0_10px_30px_rgba(27,28,23,0.04)] lg:p-8">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-6 w-full">
            <div className="rounded-[20px] border border-[#e4e3db] bg-[#ffffff] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              <div className="mb-8 flex items-center gap-2 text-[#356647]">
                <span className="material-symbols-outlined">person_edit</span>
                <h2 className="text-[20px] font-semibold">Thông tin chi tiết nhân viên</h2>
              </div>

              <form className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2" onSubmit={handleSubmit}>
                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Họ và tên</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <input
                      className="w-full border-none bg-transparent p-0 text-sm font-medium text-[#1b1c17] outline-none focus:ring-0"
                      type="text"
                      value={form.fullName}
                      onChange={handleChange('fullName')}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Mã nhân viên</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 opacity-70">
                    <input
                      className="w-full cursor-not-allowed border-none bg-transparent p-0 text-sm text-[#414942] outline-none focus:ring-0"
                      readOnly
                      type="text"
                      value={form.staffCode}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Tên đăng nhập</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <input
                      className="w-full border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      type="text"
                      value={form.username}
                      onChange={handleChange('username')}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Mật khẩu</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <input
                      className="w-full border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      placeholder="••••••••"
                      type="password"
                      value={form.password}
                      onChange={handleChange('password')}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Số điện thoại</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <input
                      className="w-full border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange('phone')}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Vai trò hệ thống</span>
                  <div className="flex items-center rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <select
                      className="w-full appearance-none border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      value={form.role}
                      onChange={handleChange('role')}
                    >
                      <option value="manager">Quản lý cửa hàng</option>
                      <option value="staff">Nhân viên bán hàng</option>
                      <option value="warehouse">Quản lý kho</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none text-[#414942]">arrow_drop_down</span>
                  </div>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Cửa hàng làm việc</span>
                  <div className="flex items-center rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <select
                      className="w-full appearance-none border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      value={form.branch}
                      onChange={handleChange('branch')}
                    >
                      <option value="q1">Chi nhánh Quận 1</option>
                      <option value="q3">Chi nhánh Quận 3</option>
                      <option value="td">Chi nhánh Thủ Đức</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none text-[#414942]">arrow_drop_down</span>
                  </div>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="px-1 text-xs font-semibold text-[#414942]">Ghi chú công việc</span>
                  <div className="rounded-xl border border-[#e4e3db] bg-[#f6f4ec] px-4 py-3 transition-all focus-within:border-[#356647] focus-within:shadow-[0_0_0_1px_#356647]">
                    <textarea
                      className="min-h-[110px] w-full resize-none border-none bg-transparent p-0 text-sm text-[#1b1c17] outline-none focus:ring-0"
                      rows="4"
                      value={form.note}
                      onChange={handleChange('note')}
                    />
                  </div>
                </label>

                <div className="md:col-span-2 mt-4 flex flex-col-reverse gap-3 border-t border-[#f0eee6] pt-8 sm:flex-row sm:justify-end sm:gap-6">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-full border border-[#717971] px-10 py-3.5 text-[16px] font-medium text-[#1b1c17] transition-all hover:bg-[#f6f4ec] active:scale-[0.98]"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#356647] px-14 py-3.5 text-[16px] font-medium text-white shadow-[0_10px_25px_rgba(53,102,71,0.2)] transition-all hover:bg-[#4e7f5e] active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* <div className="space-y-6 xl:col-span-4"> */}
            {/* <section className="rounded-[20px] border border-[#e4e3db] bg-white p-5 text-center shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              <div className="group relative mx-auto mb-4 w-fit">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-[#356647]/10">
                  <img
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXJZjMr3qnbmWyT6hu8nzPMkUs-O6i85LL0RuCU_KXm9eUz_QZG1o5mVXm7dZjv8mHKxgyNnwoNg4Yy9lygYF5N7XS5NviFKM_JtjZgrlgKxVjOMw4ddbVNdNw3PazQgiI3PUc3YbSo00UXJt0pL6-AQf5RO3c7bfNBijC-6j046vbmnJA7JuZmNJILpwYUSTXlJdzbjhLbIHHa2Gm6IPFJ7KaT5l4fY18-ajZLMO6Me4HOi4ao3Os3Nys344z-J2ZpHMq_LQ5X_V3"
                  />
                </div>

                <button
                  type="button"
                  className="absolute bottom-4 right-0 rounded-full bg-[#356647] p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined">photo_camera</span>
                </button>
              </div>

              <h4 className="text-xl font-semibold text-[#356647]">{form.fullName}</h4>
              <p className="mb-4 text-sm text-[#414942]">Mã NV: {form.staffCode}</p>

              <button type="button" className="inline-flex items-center gap-2 text-sm text-[#356647] hover:underline">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Tải ảnh mới
              </button>
            </section> */}

            {/* <section className="rounded-[20px] border border-[#e4e3db] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#414942]">
                Hiệu suất tháng này
              </h4>

              <div className="mb-2 flex items-end justify-between gap-4">
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
                <div className="h-full rounded-full bg-[#356647]" style={{ width: '94.2%' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#baefc8] p-3">
                  <p className="mb-1 text-xs text-[#1f5033]">Đơn hàng</p>
                  <p className="font-bold text-[#356647]">128</p>
                </div>

                <div className="rounded-lg bg-[#ceebc1] p-3">
                  <p className="mb-1 text-xs text-[#354d2e]">Đánh giá</p>
                  <p className="font-bold text-[#4a6242]">4.9/5.0</p>
                </div>
              </div>
            </section> */}

            {/* <section className="rounded-[20px] border border-[#e4e3db] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#414942]">
                Lịch sử đăng nhập
              </h4>

              <div className="space-y-4">
                {loginHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-[#c1c9c0]/40 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.active ? 'bg-[#f0eee6] text-[#356647]' : 'bg-[#f0eee6] text-[#414942]'}`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-[#1b1c17]">{item.channel}</p>
                        <p className="text-xs text-[#414942]">{item.date}</p>
                      </div>
                    </div>

                    <span className={`text-sm font-bold ${item.active ? 'text-[#356647]' : 'text-[#414942]'}`}>
                      {item.time}
                    </span>
                  </div>
                ))}

                <button type="button" className="w-full rounded-lg py-2 text-sm text-[#356647] transition-colors hover:bg-[#356647]/5">
                  Xem tất cả lịch sử
                </button>
              </div>
            </section> */}
          {/* </div> */}
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-[#414942]/60">
        © 2024 Huong Van Tra Management System. All Rights Reserved.
      </footer>
    </div>
  )
}

export default ProfilePage