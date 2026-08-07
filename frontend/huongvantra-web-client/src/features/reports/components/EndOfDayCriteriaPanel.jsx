import { useMemo, useState } from 'react'
import {
  CONCERNS,
  LAYOUTS,
  UNSUPPORTED_FILTERS,
  supportsFilter,
  todayInputValue,
} from '../utils/endOfDayFilters.js'

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
  { value: 'B2B', label: 'Khách sỉ B2B' },
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

const SELECT_CLASS =
  'w-full rounded-lg border-[#c1c9c0] bg-white px-2 py-1.5 text-sm text-[#414942] focus:border-[#356647] focus:ring-[#356647] disabled:cursor-not-allowed disabled:bg-[#f1efe7] disabled:text-[#a0a6a0]'

function Block({ title, children, hint }) {
  return (
    <section className="border-b border-[#c1c9c0]/50 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#717971]">{title}</h3>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-[#a0806b]">{hint}</p>}
    </section>
  )
}

/** Một dòng lựa chọn kiểu radio, dùng cho cả Kiểu hiển thị và Mối quan tâm. */
function ChoiceRow({ checked, onSelect, icon, label, name }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        checked ? 'bg-[#356647]/10 font-semibold text-[#356647]' : 'text-[#414942] hover:bg-[#f6f4ec]'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="h-3.5 w-3.5 border-[#c1c9c0] text-[#356647] focus:ring-[#356647]"
      />
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      <span>{label}</span>
    </label>
  )
}

/**
 * Ô chọn bị backend chặn: vẫn hiện để người dùng biết tiêu chí tồn tại.
 *
 * Lý do nằm sau biểu tượng thông tin thay vì in thành đoạn văn cạnh ô — panel tiêu chí là
 * chỗ làm việc, không phải chỗ đọc chú thích kỹ thuật.
 */
function DisabledField({ label, reason, placeholder = 'Chưa hỗ trợ' }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <label className="block text-xs text-[#717971]">{label}</label>
        <span
          title={reason}
          aria-label={reason}
          className="material-symbols-outlined cursor-help text-[14px] text-[#a0806b]"
        >
          info
        </span>
      </div>
      <input
        type="text"
        disabled
        value=""
        placeholder={placeholder}
        title={reason}
        className={SELECT_CLASS}
        readOnly
      />
    </div>
  )
}

/**
 * Panel tiêu chí báo cáo (cột trái của màn hình Báo cáo cuối ngày).
 *
 * Mỗi thay đổi được áp dụng ngay, không có nút "Áp dụng" lớn. Bộ lọc nào endpoint của
 * mối quan tâm hiện tại không nhận thì bị vô hiệu hóa kèm lý do, thay vì gửi lên rồi bị
 * backend bỏ qua trong im lặng — xem `CONCERN_FILTER_SUPPORT`.
 */
function EndOfDayCriteriaPanel({
  filters,
  onFiltersChange,
  concern,
  onConcernChange,
  layout,
  onLayoutChange,
  users = [],
  customers = [],
  canFilterByEmployee,
  onReset,
  isLoading,
}) {
  // "Lựa chọn khác" mở khối Từ ngày/Đến ngày. URL có dateTo thì luôn mở; ngoài ra người dùng
  // có thể tự mở để nhập khoảng. Bấm Đặt lại phải đóng lại, nên override được xóa ở đó.
  const usesRange = Boolean(filters.dateTo)
  const [rangeOverride, setRangeOverride] = useState(false)
  const rangeMode = usesRange || rangeOverride
  const [customerQuery, setCustomerQuery] = useState('')

  const set = (patch) => onFiltersChange({ ...filters, ...patch })

  const visibleCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    const list = customers || []
    if (!q) return list.slice(0, 100)
    return list
      .filter((c) => `${c.fullName || ''} ${c.phone || ''} ${c.customerCode || ''}`.toLowerCase().includes(q))
      .slice(0, 100)
  }, [customers, customerQuery])

  const can = (key) => supportsFilter(concern, key)

  const chooseSingleDay = () => {
    setRangeOverride(false)
    set({ dateTo: '' })
  }

  const handleReset = () => {
    setRangeOverride(false)
    setCustomerQuery('')
    onReset()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-[#c1c9c0]/50 px-4 py-3">
        <h2 className="text-sm font-bold text-[#1b1c17]">Tiêu chí báo cáo</h2>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full px-2 py-1 text-xs font-medium text-[#356647] hover:bg-[#356647]/10"
        >
          Đặt lại
        </button>
      </div>

      <Block title="Kiểu hiển thị">
        <div className="space-y-0.5">
          {LAYOUTS.map((l) => (
            <ChoiceRow
              key={l.key}
              name="eod-layout"
              checked={layout === l.key}
              onSelect={() => onLayoutChange(l.key)}
              icon={l.icon}
              label={l.label}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#717971]">
          &quot;Ngang&quot; nới rộng khổ tài liệu cho báo cáo nhiều cột và cũng là khổ giấy khi in.
        </p>
      </Block>

      <Block title="Mối quan tâm">
        <div className="space-y-0.5">
          {CONCERNS.map((c) => (
            <ChoiceRow
              key={c.key}
              name="eod-concern"
              checked={concern === c.key}
              onSelect={() => onConcernChange(c.key)}
              icon={c.icon}
              label={c.label}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#717971]">
          Số liệu ngoại lệ nằm trong báo cáo Tổng hợp và Kho/Kệ.
        </p>
      </Block>

      <Block title="Thời gian">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
            <input
              type="radio"
              name="eod-period"
              checked={!rangeMode}
              onChange={chooseSingleDay}
              className="h-3.5 w-3.5 border-[#c1c9c0] text-[#356647] focus:ring-[#356647]"
            />
            Chọn ngày
          </label>
          {!rangeMode && (
            <input
              type="date"
              value={filters.date || todayInputValue()}
              onChange={(e) => set({ date: e.target.value, dateTo: '' })}
              className={SELECT_CLASS}
            />
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
            <input
              type="radio"
              name="eod-period"
              checked={rangeMode}
              onChange={() => {
                setRangeOverride(true)
                set({ dateTo: filters.dateTo || filters.date || todayInputValue() })
              }}
              className="h-3.5 w-3.5 border-[#c1c9c0] text-[#356647] focus:ring-[#356647]"
            />
            Lựa chọn khác
          </label>
          {rangeMode && (
            <div className="space-y-2 rounded-lg bg-[#f6f4ec] p-2">
              <div>
                <label className="mb-1 block text-xs text-[#717971]">Từ ngày</label>
                <input
                  type="date"
                  value={filters.date || todayInputValue()}
                  onChange={(e) => set({ date: e.target.value })}
                  className={SELECT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#717971]">Đến ngày</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => set({ dateTo: e.target.value })}
                  className={SELECT_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DisabledField label="Từ giờ" reason={UNSUPPORTED_FILTERS.timeFrom} placeholder="00:00" />
                <DisabledField label="Đến giờ" reason={UNSUPPORTED_FILTERS.timeTo} placeholder="23:59" />
              </div>
            </div>
          )}
        </div>
      </Block>

      <Block title="Khách hàng">
        {can('customerId') ? (
          <div className="space-y-2">
            <input
              type="search"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc số điện thoại"
              className={SELECT_CLASS}
            />
            <select
              value={filters.customerId || ''}
              onChange={(e) => set({ customerId: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Tất cả khách hàng</option>
              {visibleCustomers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.fullName || 'Chưa có tên'}
                  {c.phone ? ` - ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-[11px] leading-snug text-[#a0806b]">
            Báo cáo Kho/Kệ lấy dữ liệu từ sổ kho nên không lọc theo khách hàng.
          </p>
        )}
      </Block>

      <Block title="Nhân viên">
        {!can('employeeId') ? (
          <p className="text-[11px] leading-snug text-[#a0806b]">
            Báo cáo Kho/Kệ không gắn với nhân viên bán hàng.
          </p>
        ) : canFilterByEmployee ? (
          <select
            value={filters.employeeId || ''}
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
        ) : (
          <p className="text-[11px] leading-snug text-[#717971]">
            Tài khoản của bạn chỉ xem được số liệu do chính mình bán, nên tiêu chí này cố định.
          </p>
        )}
      </Block>

      <Block title="Người tạo">
        <DisabledField label="Người tạo phiếu" reason={UNSUPPORTED_FILTERS.creatorId} />
      </Block>

      <Block title="Phương thức thanh toán">
        {can('paymentMethod') ? (
          <select
            value={filters.paymentMethod || ''}
            onChange={(e) => set({ paymentMethod: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Tất cả</option>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <select disabled value="" className={SELECT_CLASS}>
            <option value="">Không áp dụng cho báo cáo này</option>
          </select>
        )}
      </Block>

      <Block title="Kênh bán">
        {can('channel') ? (
          <div className="space-y-2">
            <select
              value={filters.channel || ''}
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
            <select
              value={filters.salesMode || ''}
              onChange={(e) => set({ salesMode: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Mọi phương thức bán</option>
              {SALES_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {can('orderStatus') && (
              <select
                value={filters.orderStatus || ''}
                onChange={(e) => set({ orderStatus: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="">Mọi trạng thái đơn</option>
                {ORDER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <select disabled value="" className={SELECT_CLASS}>
            <option value="">Không áp dụng cho báo cáo này</option>
          </select>
        )}
      </Block>

      {isLoading && (
        <p className="px-4 py-3 text-xs text-[#717971]">Đang tải số liệu theo tiêu chí mới…</p>
      )}
    </div>
  )
}

export default EndOfDayCriteriaPanel
