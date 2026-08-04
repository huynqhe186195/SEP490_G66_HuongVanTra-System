import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { requestForgotPasswordOtp, verifyForgotPasswordOtp } from '../services/authApi.js'

const OTP_LENGTH = 6

function OtpVerificationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const phoneDigits = state?.phoneDigits || ''
  const maskedPhone = state?.maskedPhone || '09** *** ***'
  const initialResend = Number(state?.resendAfterSeconds) || 60

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [errorMessage, setErrorMessage] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(initialResend)
  const [isResending, setIsResending] = useState(false)
  const [devOtp, setDevOtp] = useState(state?.devOtp || '')

  const inputRefs = useRef([])

  useEffect(() => {
    if (!phoneDigits) {
      navigate('/forgot-password', { replace: true })
    }
  }, [phoneDigits, navigate])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (!resendCountdown) return undefined
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
    if (!clean && value) return

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

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((digit, i) => {
      next[i] = digit
    })
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus()
  }

  const handleVerify = async () => {
    if (!canVerify) return
    setIsVerifying(true)
    setErrorMessage('')
    try {
      const result = await verifyForgotPasswordOtp(phoneDigits, otpValue)
      const resetToken = result.resetToken ?? result.ResetToken
      if (!resetToken) throw new Error('Không nhận được mã đặt lại mật khẩu.')
      navigate('/forgot-password/reset', {
        replace: true,
        state: {
          resetToken,
          expiresAtUtc: result.expiresAtUtc ?? result.ExpiresAtUtc,
          maskedPhone,
        },
      })
    } catch (error) {
      setErrorMessage(error.message || 'Mã OTP không chính xác hoặc đã hết hạn.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendOtp = async () => {
    if (isResendLocked) return
    setIsResending(true)
    setErrorMessage('')
    try {
      const result = await requestForgotPasswordOtp(phoneDigits)
      const otpHint = result.devOtp ?? result.DevOtp ?? ''
      setDevOtp(otpHint)
      setResendCountdown(result.resendAfterSeconds ?? result.ResendAfterSeconds ?? 60)
      setOtp(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      if (otpHint) showSuccess(`Mã OTP mới (dev): ${otpHint}`)
      else showSuccess('Đã gửi lại mã OTP (nếu số tồn tại).')
    } catch (error) {
      showError(error.message || 'Không gửi lại được OTP.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f1] p-4 text-[#1b1c17] [font-family:'Manrope',sans-serif]">
      <main className="w-full max-w-[480px] space-y-6">
        {devOtp ? (
          <div className="rounded-xl border border-[#356647]/20 bg-[#e8f5e9] p-4 text-sm text-[#1f5033]">
            <p className="font-semibold">Chế độ demo — OTP hiện tại: {devOtp}</p>
            <p className="mt-1 text-xs opacity-80">Production sẽ tắt ExposeOtpInResponse; mã cũng được ghi trong log UserService.</p>
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-xl border border-[#c1c9c0]/40 bg-white p-6 text-center shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
          <div className="mb-4">
            <h1 className="mb-2 text-2xl font-bold text-[#356647]">Hương Vân Trà</h1>
            <div className="mx-auto h-1 w-12 rounded-full bg-[#627b59]" />
          </div>

          <h2 className="mb-2 text-xl font-semibold">Xác thực OTP</h2>
          <p className="mb-6 text-sm text-[#414942]">
            Nhập mã xác thực đã gửi tới số điện thoại <br />
            <span className="font-bold text-[#1b1c17]">{maskedPhone}</span>
          </p>

          <div className="mb-6 flex justify-center gap-2" onPaste={handleOtpPaste}>
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
              Gửi lại sau <span className="font-bold text-[#356647]">{formatTimer(resendCountdown)}</span>
            </p>
          </div>

          <div className="mt-6 border-t border-[#c1c9c0]/30 pt-6">
            <Link className="inline-flex items-center gap-1 text-sm text-[#356647] hover:underline" to="/forgot-password">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Đổi số điện thoại
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OtpVerificationPage
