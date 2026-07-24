import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchOnDutyShift } from '../../shifts/services/shiftsApi.js'
import { shiftDisplayName } from '../utils/shiftDisplayName.js'
import {
  closeCashSession,
  expectedCash,
  formatVnd,
  loadOpenCashSession,
  openCashSession,
  refreshCashSession,
  subscribeCashSession,
} from '../utils/posCashSessionStore.js'
import PosShelfStockCheckList from './PosShelfStockCheckList.jsx'

function parseMoney(raw) {
  const cleaned = String(raw || '').replace(/[^\d]/g, '')
  return cleaned ? Number(cleaned) : 0
}

function formatMoneyInput(value) {
  const n = Math.round(Number(value) || 0)
  return n ? n.toLocaleString('vi-VN') : ''
}

function ModalShell({ title, subtitle, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full rounded-2xl border border-[#c1c9c0]/50 bg-white shadow-xl ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#e7e8e0] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Ca làm việc POS</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#e7e8e0] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

function SectionCard({ step, title, children }) {
  return (
    <div className="rounded-xl border border-[#e7e8e0] bg-[#fbf9f1] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#538463]">
        {step ? `${step}. ` : ''}
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export default function PosCashSessionBar() {
  const [session, setSession] = useState(() => loadOpenCashSession())
  const [onDuty, setOnDuty] = useState(null)
  const [modal, setModal] = useState(null)
  const [openingCashInput, setOpeningCashInput] = useState('500.000')
  const [openNote, setOpenNote] = useState('')
  const [shelfChecked, setShelfChecked] = useState(false)
  const [shelfNote, setShelfNote] = useState('')
  const [shelfCountSummary, setShelfCountSummary] = useState('')
  const [countedInput, setCountedInput] = useState('')
  const [varianceNote, setVarianceNote] = useState('')
  const [busy, setBusy] = useState(false)

  const auth = loadAuthSession()
  const sellerName = auth?.username || 'Nhân viên POS'
  const sellerRole = (auth?.roles || []).join(', ')

  useEffect(() => {
    refreshCashSession().then((s) => setSession(s))
    fetchOnDutyShift('Shelf')
      .then(setOnDuty)
      .catch(() => setOnDuty(null))
    return subscribeCashSession(() => setSession(loadOpenCashSession()))
  }, [])

  const expected = useMemo(() => expectedCash(session), [session])

  const openModal = (type) => {
    if (type === 'open') {
      if (!onDuty) {
        showError(
          'Chỉ mở ca khi đã được duyệt ca quầy và đang trong giờ làm. Vào «Lịch làm việc» để đăng ký/kiểm tra.',
        )
        return
      }
      setOpeningCashInput('500.000')
      setOpenNote('')
      setShelfChecked(false)
      setShelfNote('')
      setShelfCountSummary('')
    }
    if (type === 'close') {
      setCountedInput(formatMoneyInput(expectedCash(loadOpenCashSession())))
      setVarianceNote('')
    }
    setModal(type)
  }

  const handleOpen = async () => {
    if (!shelfChecked) {
      showError('Vui lòng xác nhận đã kiểm hàng hóa trên kệ đầu ca.')
      return
    }
    setBusy(true)
    try {
      const name = shiftDisplayName(onDuty)
      const shelfPart = [
        'Kiểm kệ đầu ca: đã xác nhận.',
        shelfCountSummary.trim(),
        shelfNote.trim(),
      ]
        .filter(Boolean)
        .join(' ')
      const noteParts = [shelfPart, openNote.trim()].filter(Boolean)
      await openCashSession({
        openingCash: parseMoney(openingCashInput),
        note: noteParts.join(' | '),
        openedByName: sellerName,
        openedByRole: sellerRole,
        shiftSlotId: onDuty?.slotId || null,
        shiftLabel: name || null,
      })
      setModal(null)
      showSuccess(name ? `Đã mở ca · ${name}` : 'Đã mở ca POS.')
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClose = async () => {
    setBusy(true)
    try {
      const counted = parseMoney(countedInput)
      const exp = expectedCash(loadOpenCashSession())
      const variance = counted - exp
      if (Math.abs(variance) >= 1000 && !varianceNote.trim()) {
        showError('Có chênh lệch quỹ — vui lòng nhập lý do.')
        return
      }
      const closed = await closeCashSession({
        countedCash: counted,
        varianceNote,
      })
      setModal(null)
      showSuccess(
        Number(closed?.variance || 0) === 0
          ? 'Đã chốt tiền cuối ca. Quỹ khớp.'
          : `Đã chốt tiền. Chênh lệch ${formatVnd(closed.variance)}.`,
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const variancePreview = parseMoney(countedInput) - expected

  return (
    <>
      <div className="relative z-30 flex flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            session
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {session ? 'point_of_sale' : 'lock_clock'}
          </span>
          {session ? <span>Ca đang mở</span> : <span>Chưa mở ca</span>}
        </div>

        {!session ? (
          <button
            type="button"
            onClick={() => openModal('open')}
            className="rounded-full bg-[#356647] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2d553b]"
          >
            Mở ca
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openModal('check')}
              className="rounded-full border border-[#c1c9c0] bg-white px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#f6f4ec]"
            >
              Kiểm tiền
            </button>
            <button
              type="button"
              onClick={() => openModal('close')}
              className="rounded-full border border-[#356647] bg-white px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
            >
              Chốt tiền cuối ca
            </button>
          </>
        )}
      </div>

      {modal === 'open' ? (
        <ModalShell
          wide
          title="Mở ca làm việc"
          subtitle="Kiểm tiền và đối chiếu hàng kệ với số trên hệ thống trước khi vào bán."
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !shelfChecked}
                onClick={handleOpen}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Đang mở…' : 'Xác nhận mở ca'}
              </button>
            </>
          }
        >
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-0.5">
            <SectionCard step="1" title="Kiểm tiền">
              <label className="block text-xs font-semibold text-slate-600">Tiền mặt đầu két</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                inputMode="numeric"
                placeholder="500.000"
              />
              <label className="mt-3 block text-xs font-semibold text-slate-600">Ghi chú tiền (tuỳ chọn)</label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="VD: đổi tiền lẻ…"
              />
            </SectionCard>

            <SectionCard step="2" title="Hàng hóa trên kệ đầu ca">
              <PosShelfStockCheckList
                onCountsChange={({ summaryText }) => setShelfCountSummary(summaryText || '')}
              />
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#356647]"
                  checked={shelfChecked}
                  onChange={(e) => setShelfChecked(e.target.checked)}
                />
                <span>Đã đối chiếu hàng trên kệ với số lượng hệ thống ở trên.</span>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">
                Ghi chú lệch / thiếu (tuỳ chọn)
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
                value={shelfNote}
                onChange={(e) => setShelfNote(e.target.value)}
                placeholder="VD: thiếu 2 hộp trà X…"
              />
            </SectionCard>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'check' ? (
        <ModalShell
          title="Kiểm tiền"
          subtitle="Ca đang mở"
          onClose={() => setModal(null)}
          footer={
            <button
              type="button"
              onClick={() => setModal(null)}
              className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white"
            >
              Đóng
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Đầu ca</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.openingCash)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Thu tiền mặt</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.cashSalesTotal)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Hoàn tiền mặt</p>
              <p className="mt-1 font-bold text-slate-900">{formatVnd(session?.cashRefundTotal)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="text-xs text-emerald-800">Trong két (ước tính)</p>
              <p className="mt-1 font-bold text-emerald-950">{formatVnd(expected)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Đây là kiểm tra giữa ca. Để kết thúc ca, dùng «Chốt tiền cuối ca».
          </p>
        </ModalShell>
      ) : null}

      {modal === 'close' ? (
        <ModalShell
          title="Chốt tiền cuối ca"
          subtitle={`Tiền trong két (ước tính): ${formatVnd(expected)}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleClose}
                className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Đang chốt…' : 'Chốt & đóng ca'}
              </button>
            </>
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Đầu ca</p>
              <p className="font-bold text-slate-900">{formatVnd(session?.openingCash)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Thu tiền mặt</p>
              <p className="font-bold text-slate-900">{formatVnd(session?.cashSalesTotal)}</p>
            </div>
          </div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Tiền đếm thực tế</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={countedInput}
            onChange={(e) => setCountedInput(e.target.value)}
            inputMode="numeric"
          />
          <p
            className={`mt-2 text-sm font-semibold ${
              variancePreview === 0 ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            Chênh lệch: {formatVnd(variancePreview)}
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase text-slate-500">
            Lý do lệch (nếu có)
          </label>
          <input
            className="mt-1 w-full rounded-xl border border-[#c1c9c0] px-3 py-2.5 text-sm outline-none focus:border-[#356647]"
            value={varianceNote}
            onChange={(e) => setVarianceNote(e.target.value)}
            placeholder="Bắt buộc khi lệch ≥ 1.000 đ"
          />
        </ModalShell>
      ) : null}
    </>
  )
}

export function assertCashSessionOpenForPayment(shelfOnDuty) {
  if (!shelfOnDuty) {
    showError(
      'Chưa được duyệt ca quầy hoặc đang ngoài giờ ca — không thể bán tại quầy. Vào «Lịch làm việc» để đăng ký.',
    )
    return false
  }
  const session = loadOpenCashSession()
  if (!session) {
    showError('Chưa mở ca — không thể bán tại quầy. Hãy mở ca trên thanh POS trước.')
    return false
  }
  return true
}
