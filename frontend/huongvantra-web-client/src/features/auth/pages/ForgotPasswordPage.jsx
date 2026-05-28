import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('0912345678')
  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const hasPhoneFormatError = useMemo(() => {
    const digits = phone.replace(/\D/g, '')
    return digits.length > 0 && digits.length !== 10
  }, [phone])

  const hasNotFoundError = attempted && !isSuccess
  const showError = (touched && hasPhoneFormatError) || hasNotFoundError

  const handleSubmit = (event) => {
    event.preventDefault()
    setTouched(true)
    setAttempted(false)
    setIsSuccess(false)

    const digits = phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      return
    }

    setIsSubmitting(true)

    setTimeout(() => {
      setIsSubmitting(false)

      if (digits !== '0912345678') {
        setAttempted(true)
        setIsSuccess(false)
        return
      }

      setAttempted(true)
      setIsSuccess(true)

      setTimeout(() => {
        navigate('/forgot-password/otp', {
          state: {
            phone: `${digits.slice(0, 2)}** *** ${digits.slice(-3)}`,
          },
        })
      }, 600)
    }, 1100)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f1] p-4 [font-family:'Manrope',sans-serif]">
      <main className="flex min-h-[700px] w-full max-w-[1200px] flex-col overflow-hidden rounded-[32px] border border-white/30 bg-white/80 shadow-[0px_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-md md:flex-row">
        <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#4e7f5e] p-12 md:flex">
          <div className="relative z-10">
            <h1 className="mb-4 text-4xl font-bold text-[#f6fff5]">Hương Vân Trà</h1>
            <p className="max-w-[320px] text-base text-[#f6fff5]/85">Bringing the essence of premium Vietnamese tea to your daily workspace.</p>
          </div>

          <div className="pointer-events-none absolute -bottom-[10%] -right-[10%] rotate-12 opacity-20">
            <span className="material-symbols-outlined text-[400px] text-[#f6fff5]">eco</span>
          </div>

          <div className="relative z-10 flex items-center gap-4">
            <div className="h-1 w-12 rounded-full bg-[#fec25b]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#f6fff5]">Premium Quality</span>
          </div>

          <img
            alt="Tea leaves"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB01an7T4oTDf4LZhoVv1RiTIHv4ym75_YGdww7vP0ZgYVppXClhgjXgUWHQKX5_Js24ttsL25OJ7IXWPeKKJsKwQWyRHdpJtWQh5D9A0g4VfYZONi0XhsC8KBXYqGlx9qXne0nCCtluFGCxcuJLO1H-vsbwHyILOL3WQtksWEX33QLfeFwDBdMYS1MHFNQOv6iTNc3G1SlCDpJ_go2ziHi9JS5eU1oqP_dRTnF8RCX7AlWzZjtnuIVfiE6LAAIMiY-5ZTHhnjyS9Sn"
          />
        </section>

        <section className="relative flex flex-1 flex-col justify-center bg-[#fbf9f1] px-8 py-12 md:px-20">
          <Link className="group absolute left-8 top-8 flex items-center gap-2 text-[#414942] transition-colors hover:text-[#356647] md:left-20" to="/login">
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
            <span className="text-xs font-semibold">Quay lại đăng nhập</span>
          </Link>

          <div className="mx-auto w-full max-w-[400px]">
            <header className="mb-10">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ceebc1] shadow-sm">
                <span className="material-symbols-outlined text-[32px] text-[#356647]">lock_reset</span>
              </div>
              <h2 className="mb-2 text-3xl font-bold text-[#1b1c17]">Quên mật khẩu?</h2>
              <p className="text-sm text-[#414942]">Nhập số điện thoại liên kết với tài khoản. Chúng tôi sẽ gửi mã xác minh để đặt lại mật khẩu.</p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="ml-1 block text-xs font-semibold text-[#414942]" htmlFor="identifier">
                  Số điện thoại
                </label>

                <div className="relative transition-transform focus-within:scale-[1.01]">
                  <input
                    id="identifier"
                    className={`h-14 w-full rounded-xl border-2 bg-white px-12 text-[#1b1c17] outline-none transition-all ${showError ? 'border-[#ba1a1a]' : 'border-[#c1c9c0] focus:border-[#356647]'}`}
                    placeholder="09xx xxx xxx"
                    type="text"
                    value={phone}
                    onBlur={() => setTouched(true)}
                    onChange={(event) => {
                      setPhone(event.target.value)
                      setAttempted(false)
                      setIsSuccess(false)
                    }}
                  />

                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${showError ? 'text-[#ba1a1a]' : 'text-[#717971]'}`}>
                    phone_iphone
                  </span>

                  {showError ? <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#ba1a1a]">error</span> : null}
                </div>

                {showError ? (
                  <div className="ml-1 mt-2 flex items-center gap-1.5 text-[#ba1a1a]">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <p className="text-xs font-semibold">
                      {hasPhoneFormatError ? 'Số điện thoại không hợp lệ. Vui lòng nhập đủ 10 số.' : 'Số điện thoại không tồn tại trong hệ thống'}
                    </p>
                  </div>
                ) : null}

                {attempted && isSuccess ? (
                  <div className="ml-1 mt-2 flex items-center gap-1.5 text-[#1f5033]">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <p className="text-xs font-semibold">Đã gửi mã OTP thành công đến số điện thoại của bạn.</p>
                  </div>
                ) : null}
              </div>

              <button
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4a6242] font-bold text-white shadow-md shadow-[#4a6242]/10 transition-all hover:bg-[#627b59] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">sync</span>
                    Đang gửi...
                  </>
                ) : (
                  <>
                    Gửi mã xác minh
                    <span className="material-symbols-outlined">send</span>
                  </>
                )}
              </button>
            </form>

            <footer className="mt-12 border-t border-[#c1c9c0]/40 pt-8 text-center">
       
            </footer>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ForgotPasswordPage