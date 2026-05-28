import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const OTP_LENGTH = 6
const RESEND_WAIT_SECONDS = 30

function OtpVerificationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const phone = state?.phone || '09** *** 888'

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [errorMessage, setErrorMessage] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showGatewayAlert, setShowGatewayAlert] = useState(true)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  const inputRefs = useRef([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (!resendCountdown) {
      return
    }

    const interval = setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [resendCountdown])

  const otpValue = useMemo(() => otp.join(''), [otp])
  const canVerify = otpValue.length === OTP_LENGTH && !otp.includes('') && !isVerifying
  const isResendLocked = resendCountdown > 0 || isResending

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '')
    if (!clean && value) {
      return
    }

    setErrorMessage('')

    const nextOtp = [...otp]
    nextOtp[index] = clean.slice(-1)
    setOtp(nextOtp)

    if (clean && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = () => {
    if (!canVerify) {
      return
    }

    setIsVerifying(true)
    setErrorMessage('')

    setTimeout(() => {
      setIsVerifying(false)

      if (otpValue !== '123456') {
        setErrorMessage('Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại.')
        return
      }

      navigate('/login')
    }, 1000)
  }

  const handleResendOtp = () => {
    if (isResendLocked) {
      return
    }

    setIsResending(true)
    setErrorMessage('')

    setTimeout(() => {
      setIsResending(false)
      setShowGatewayAlert(true)
      setResendCountdown(RESEND_WAIT_SECONDS)
    }, 1200)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f1] p-4 text-[#1b1c17] [font-family:'Manrope',sans-serif]">
      <main className="w-full max-w-[480px] space-y-6">
        {showGatewayAlert ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#ba1a1a]/20 bg-[#ffdad6] p-5 text-[#93000a] shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
            <span className="material-symbols-outlined mt-0.5">error_outline</span>
            <div className="flex-1">
              <p className="mb-1 text-lg font-semibold">Hệ thống gián đoạn</p>
              <p className="text-sm">OTP gửi thất bại (lỗi Gateway). Vui lòng kiểm tra kết nối mạng hoặc thử lại sau vài phút.</p>
            </div>
            <button className="rounded-full p-1 transition-colors hover:bg-[#93000a]/10" type="button" onClick={() => setShowGatewayAlert(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-white p-6 text-center shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
          <div className="mb-4">
            <h1 className="mb-2 text-2xl font-bold text-[#356647]">Hương Vân Trà</h1>
            <div className="mx-auto h-1 w-12 rounded-full bg-[#627b59]" />
          </div>

          <h2 className="mb-2 text-xl font-semibold">Xác thực OTP</h2>
          <p className="mb-6 text-sm text-[#414942]">
            Mã xác thực đã được gửi tới số điện thoại <br />
            <span className="font-bold text-[#1b1c17]">{phone}</span>
          </p>

          <div className="mb-6 flex justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={`otp-${index}`}
                ref={(element) => {
                  inputRefs.current[index] = element
                }}
                className="h-16 w-12 rounded-lg border border-[#c1c9c0] bg-[#f0eee6] text-center text-2xl font-bold outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#356647]"
                inputMode="numeric"
                maxLength={1}
                type="text"
                value={digit}
                onChange={(event) => handleOtpChange(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event)}
              />
            ))}
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-sm text-[#93000a]">{errorMessage}</div>
          ) : null}

          <div className="space-y-2">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4a6242] py-4 text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={!canVerify}
              onClick={handleVerify}
            >
              {isVerifying ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Đang xác thực...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">verified_user</span>
                  Xác thực OTP
                </>
              )}
            </button>

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c1c9c0] bg-[#f6f4ec] py-3.5 text-[#414942] transition-all hover:bg-[#eae8e0] disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              disabled={isResendLocked}
              onClick={handleResendOtp}
            >
              {isResending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Đang gửi lại...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">refresh</span>
                  Gửi lại mã OTP
                </>
              )}
            </button>

            <p className="text-xs text-[#414942]">
              Bạn chưa nhận được mã? Thử lại sau <span className="font-bold text-[#356647]">{formatTimer(resendCountdown)}</span>
            </p>
          </div>

          <div className="mt-6 border-t border-[#c1c9c0]/30 pt-6">
            <Link className="inline-flex items-center gap-1 text-sm text-[#356647] hover:underline" to="/login">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Quay lại trang đăng nhập
            </Link>
          </div>
        </div>

        <p className="px-6 text-center text-xs text-[#717971]">
          Gặp sự cố kỹ thuật? Liên hệ bộ phận hỗ trợ qua <span className="font-bold underline">hotro@huongvantra.vn</span>
        </p>
      </main>
    </div>
  )
}

export default OtpVerificationPage