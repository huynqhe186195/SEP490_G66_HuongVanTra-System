import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { requestForgotPasswordOtp } from '../services/authApi.js'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [devOtpHint, setDevOtpHint] = useState('')

  const digits = useMemo(() => phone.replace(/\D/g, ''), [phone])
  const hasPhoneFormatError = digits.length > 0 && digits.length !== 10 && !(digits.startsWith('02') && digits.length === 11)
  const showErrorState = touched && (digits.length === 0 || hasPhoneFormatError)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    setDevOtpHint('')

    if (digits.length !== 10 && !(digits.startsWith('02') && digits.length === 11)) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await requestForgotPasswordOtp(digits)
      const masked = result.maskedPhone ?? result.MaskedPhone ?? `${digits.slice(0, 2)}** *** ${digits.slice(-3)}`
      const otp = result.devOtp ?? result.DevOtp ?? ''
      if (otp) {
        setDevOtpHint(otp)
        showSuccess(`Mã OTP (dev): ${otp}`)
      } else {
        showSuccess(result.message ?? result.Message ?? 'Đã gửi mã OTP (nếu số tồn tại).')
      }

      navigate('/forgot-password/otp', {
        state: {
          phoneDigits: digits,
          maskedPhone: masked,
          devOtp: otp || undefined,
          resendAfterSeconds: result.resendAfterSeconds ?? result.ResendAfterSeconds ?? 60,
        },
      })
    } catch (error) {
      showError(error.message || 'Không gửi được mã OTP.')
    } finally {
      setIsSubmitting(false)
    }
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
              <p className="text-sm text-[#414942]">
                Nhập số điện thoại đã lưu trên hồ sơ nhân viên. Hệ thống sẽ gửi mã OTP để đặt lại mật khẩu.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="ml-1 block text-xs font-semibold text-[#414942]" htmlFor="identifier">
                  Số điện thoại
                </label>

                <div className="relative transition-transform focus-within:scale-[1.01]">
                  <input
                    id="identifier"
                    className={`h-14 w-full rounded-xl border-2 bg-white px-12 text-[#1b1c17] outline-none transition-all ${showErrorState ? 'border-[#ba1a1a]' : 'border-[#c1c9c0] focus:border-[#356647]'}`}
                    placeholder="09xx xxx xxx"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    name="forgot-phone"
                    value={phone}
                    onBlur={() => setTouched(true)}
                    onChange={(event) => setPhone(event.target.value)}
                  />

                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${showErrorState ? 'text-[#ba1a1a]' : 'text-[#717971]'}`}>
                    phone_iphone
                  </span>
                </div>

                {showErrorState ? (
                  <div className="ml-1 mt-2 flex items-center gap-1.5 text-[#ba1a1a]">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <p className="text-xs font-semibold">
                      {digits.length === 0
                        ? 'Vui lòng nhập số điện thoại.'
                        : 'Số điện thoại không hợp lệ. Vui lòng nhập đủ 10 số.'}
                    </p>
                  </div>
                ) : null}

                {devOtpHint ? (
                  <p className="ml-1 text-xs font-semibold text-[#1f5033]">OTP (dev): {devOtpHint}</p>
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
          </div>
        </section>
      </main>
    </div>
  )
}

export default ForgotPasswordPage
