import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'

/**
 * Chặn toàn bộ màn POS nếu user chưa được duyệt ca quầy / ngoài giờ ca.
 */
export default function PosShiftDutyGate({ onDutyChange }) {
  const [onDuty, setOnDuty] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setChecking(true)
    setError('')
    fetchOnDutyShift('Shelf')
      .then((duty) => {
        setOnDuty(duty)
        onDutyChange?.(duty)
      })
      .catch((err) => {
        setOnDuty(null)
        onDutyChange?.(null)
        setError(err?.message || 'Không kiểm tra được ca làm việc.')
      })
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking && !onDuty) {
    return (
      <div className="absolute inset-0 z-[75] flex items-center justify-center bg-[#1b1c17]/55 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/40 bg-white px-6 py-8 text-center shadow-2xl">
          <p className="text-sm font-semibold text-slate-600">Đang kiểm tra ca làm việc…</p>
        </div>
      </div>
    )
  }

  if (onDuty) return null

  return (
    <div className="absolute inset-0 z-[75] flex items-center justify-center bg-[#1b1c17]/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-[#c1c9c0]/40 bg-white shadow-2xl">
        <div className="border-b border-[#e7e8e0] px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Chưa đủ điều kiện dùng POS</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Cần đăng ký & được duyệt ca quầy</h2>
          <p className="mt-2 text-sm text-slate-600">
            {error
              || 'Bạn chưa có ca quầy đã duyệt trong giờ hiện tại (±30 phút). POS (quầy và COD trên màn này) bị khóa cho đến khi Manager duyệt ca của bạn.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 px-6 py-5">
          <Link
            to="/my-shifts"
            className="flex w-full items-center justify-center rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d553b]"
          >
            Tới «Ca của tôi»
          </Link>
          <button
            type="button"
            onClick={load}
            className="w-full rounded-xl border border-[#c1c9c0] py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Kiểm tra lại
          </button>
        </div>
      </div>
    </div>
  )
}
