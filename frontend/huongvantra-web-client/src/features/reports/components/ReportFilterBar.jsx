import { useEffect, useRef, useState } from 'react'
import { B2B_CONTRACTS_ENABLED } from '../../../app/featureFlags.js'
import {
  QUICK_RANGES,
  detectQuickRange,
  quickRangeToDates,
  countAdvancedFilters,
} from '../utils/endOfDayFilters.js'

const SELECT_CLASS =
  'w-full rounded-lg border-[#c1c9c0] bg-white text-sm text-[#414942] focus:border-[#356647] focus:ring-[#356647]'

const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Tiền mặt' },
  { value: 'BankTransfer', label: 'Chuyển khoản (gồm VietQR)' },
  { value: 'COD', label: 'Thu hộ COD' },
  { value: 'Debt', label: 'Ghi nợ' },
]

const SALES_MODE_OPTIONS = [
  { value: 'Counter', label: 'Tại quầy' },
  { value: 'Delivery', label: 'Giao hàng' },
  { value: 'Scheduled', label: 'Hẹn giao' },
]

const CHANNEL_OPTIONS = [
  { value: 'POS', label: 'Tại quầy (POS)' },
  { value: 'Website', label: 'Website' },
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Phone', label: 'Điện thoại' },
  { value: 'COD', label: 'Giao hàng COD' },
  ...(B2B_CONTRACTS_ENABLED ? [{ value: 'B2B', label: 'Khách sỉ B2B' }] : []),
]

const ORDER_STATUS_OPTIONS = [
  { value: 'Completed', label: 'Hoàn tất' },
  { value: 'Processing', label: 'Đang xử lý' },
  { value: 'Shipping', label: 'Đang giao' },
  { value: 'WaitingTransfer', label: 'Chờ điều chuyển' },
  { value: 'WaitingProduction', label: 'Chờ sản xuất' },
  { value: 'WaitingMaterials', label: 'Chờ nguyên liệu' },
  { value: 'ReadyToDeliver', label: 'Sẵn sàng giao' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#717971]">{label}</label>
      {children}
    </div>
  )
}

/**
 * Thanh lọc ngang nằm trên các thẻ KPI. Chỉnh filter chỉ đổi bản nháp;
 * dữ liệu chỉ được tải lại khi bấm "Áp dụng".
 */
function ReportFilterBar({
  draft,
  onChange,
  onApply,
  onReset,
  isDirty,
  isLoading,
  users,
  customers,
  canFilterByEmployee,
  agencyName,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedRef = useRef(null)
  const quickRange = detectQuickRange(draft)
  const advancedCount = countAdvancedFilters(draft)

  useEffect(() => {
    if (!advancedOpen) return undefined
    const onClickOutside = (e) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target)) setAdvancedOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [advancedOpen])

  const set = (patch) => onChange({ ...draft, ...patch })

  return (
    <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        {/* Lựa chọn nhanh khoảng ngày */}
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#717971]">Khoảng ngày</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#c1c9c0]">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => set(quickRangeToDates(r.key, draft))}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  quickRange === r.key
                    ? 'bg-[#356647] text-white'
                    : 'bg-white text-[#414942] hover:bg-[#f6f4ec]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Từ ngày">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            className={SELECT_CLASS}
          />
        </Field>

        <Field label="Đến ngày">
          <input
            type="date"
            value={draft.dateTo}
            min={draft.date}
            onChange={(e) => set({ dateTo: e.target.value })}
            className={SELECT_CLASS}
            placeholder="Cùng ngày"
          />
        </Field>

        <Field label="Chi nhánh">
          <input
            type="text"
            value={agencyName}
            readOnly
            disabled
            className="w-40 cursor-not-allowed rounded-lg border-[#c1c9c0] bg-[#f6f4ec] text-sm text-[#717971]"
          />
        </Field>

        {/* Chế độ hiển thị thay cho kiểu giấy Dọc/Ngang cũ. */}
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#717971]">
            Chế độ hiển thị
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#c1c9c0]">
            {[
              { value: 'summary', label: 'Tóm tắt' },
              { value: 'detail', label: 'Chi tiết' },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set({ mode: m.value })}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  draft.mode === m.value
                    ? 'bg-[#356647] text-white'
                    : 'bg-white text-[#414942] hover:bg-[#f6f4ec]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative" ref={advancedRef}>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec]"
          >
            <span className="material-symbols-outlined text-[18px] text-[#356647]">tune</span>
            Bộ lọc nâng cao
            {advancedCount > 0 && (
              <span className="rounded-full bg-[#356647] px-2 py-0.5 text-[11px] font-bold text-white">
                {advancedCount}
              </span>
            )}
          </button>

          {advancedOpen && (
            <div className="absolute left-0 z-20 mt-2 w-80 space-y-3 rounded-xl border border-[#c1c9c0] bg-white p-4 shadow-lg">
              {canFilterByEmployee && (
                <Field label="Nhân viên">
                  <select
                    value={draft.employeeId}
                    onChange={(e) => set({ employeeId: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Tất cả nhân viên</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} - {u.employee?.fullName || 'Chưa cập nhật'}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Khách hàng">
                <select
                  value={draft.customerId}
                  onChange={(e) => set({ customerId: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Tất cả khách hàng</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName || 'Chưa có tên'}
                      {c.phone ? ` - ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kênh bán">
                <select
                  value={draft.channel}
                  onChange={(e) => set({ channel: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Tất cả kênh</option>
                  {CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Trạng thái đơn">
                <select
                  value={draft.orderStatus}
                  onChange={(e) => set({ orderStatus: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Chỉ đơn hoàn tất (mặc định)</option>
                  {ORDER_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phương thức thanh toán">
                <select
                  value={draft.paymentMethod}
                  onChange={(e) => set({ paymentMethod: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Tất cả phương thức</option>
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phương thức bán hàng">
                <select
                  value={draft.salesMode}
                  onChange={(e) => set({ salesMode: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Tất cả</option>
                  {SALES_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-[#c1c9c0] bg-white px-4 py-2 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec]"
          >
            Đặt lại
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-[#356647] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a5238] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Áp dụng
          </button>
        </div>
      </div>

      {isDirty && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#7e5700]">
          <span className="material-symbols-outlined text-[16px]">info</span>
          Bộ lọc đã thay đổi. Bấm “Áp dụng” để tải lại số liệu.
        </p>
      )}
    </div>
  )
}

export default ReportFilterBar
