import { useState } from 'react'

const OUTPUTS = [
  { key: 'print', label: 'In trực tiếp', hint: 'Mở hộp thoại in của trình duyệt', icon: 'print' },
  { key: 'pdf', label: 'Tải file PDF', hint: 'Lưu bản PDF về máy', icon: 'picture_as_pdf' },
  { key: 'k80', label: 'In K80', hint: 'Bản rút gọn cho máy in nhiệt 80 mm', icon: 'receipt_long' },
]

const ORIENTATIONS = [
  { key: 'portrait', label: 'A4 dọc', hint: 'Phù hợp bản tóm tắt và lưu hồ sơ', icon: 'crop_portrait' },
  { key: 'landscape', label: 'A4 ngang', hint: 'Phù hợp bảng nhiều cột như chi tiết đơn', icon: 'crop_landscape' },
]

function OptionButton({ active, icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
        active
          ? 'border-[#356647] bg-[#356647]/5 ring-1 ring-[#356647]'
          : 'border-[#c1c9c0] hover:border-[#356647]/60 hover:bg-[#f6f4ec]'
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-[#1b1c17]">
        <span className="material-symbols-outlined text-[18px] text-[#356647]">{icon}</span>
        {label}
      </span>
      <span className="text-xs text-[#717971]">{hint}</span>
    </button>
  )
}

/**
 * Hộp thoại chọn khổ giấy và định dạng trước khi in hoặc xuất PDF báo cáo cuối ngày.
 * `defaultOrientation` nhận khổ giấy người dùng đang xem ở khung xem trước, để không
 * phải chọn lại lần nữa.
 */
function ExportReportDialog({ periodLabel, defaultOrientation = 'portrait', onClose, onConfirm }) {
  const [output, setOutput] = useState('print')
  const [orientation, setOrientation] = useState(defaultOrientation)
  const [isBusy, setIsBusy] = useState(false)

  const handleConfirm = async () => {
    setIsBusy(true)
    try {
      await onConfirm({ output, orientation })
      onClose()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 [font-family:'Manrope',sans-serif]">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <header className="mb-4">
          <h2 className="text-lg font-bold text-[#1b1c17]">Xuất PDF / In báo cáo</h2>
          <p className="mt-0.5 text-xs text-[#717971]">Kỳ báo cáo: {periodLabel}</p>
        </header>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#717971]">Đầu ra</p>
            <div className="flex gap-2">
              {OUTPUTS.map((o) => (
                <OptionButton
                  key={o.key}
                  active={output === o.key}
                  icon={o.icon}
                  label={o.label}
                  hint={o.hint}
                  onClick={() => setOutput(o.key)}
                />
              ))}
            </div>
          </div>

          {/* K80 dùng layout một cột riêng nên không có khái niệm dọc/ngang. */}
          {output !== 'k80' && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#717971]">Khổ giấy</p>
              <div className="flex gap-2">
                {ORIENTATIONS.map((o) => (
                  <OptionButton
                    key={o.key}
                    active={orientation === o.key}
                    icon={o.icon}
                    label={o.label}
                    hint={o.hint}
                    onClick={() => setOrientation(o.key)}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="rounded-xl bg-[#f6f4ec] px-3 py-2 text-xs text-[#717971]">
            {output === 'k80'
              ? 'Bản K80 là bản rút gọn dùng để bàn giao ca: ba chỉ số doanh thu — tiền thu — tiền két, tổng hợp bán hàng, cơ cấu phương thức thanh toán và số ngoại lệ. Không in bảng chi tiết đơn hàng.'
              : 'Bản in gồm 7 phần: Tổng quan, Doanh thu ghi nhận, Tiền thu chi, Tổng hợp dòng tiền, Cầu nối doanh thu và dòng tiền, Hàng hóa đã bán, Chi tiết khoản thu và ngoại lệ. Dữ liệu lấy đúng theo bộ lọc đang áp dụng.'}
          </p>
        </div>

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a5238] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">
              {output === 'pdf' ? 'download' : output === 'k80' ? 'receipt_long' : 'print'}
            </span>
            {isBusy ? 'Đang xử lý…' : output === 'pdf' ? 'Tải PDF' : output === 'k80' ? 'In K80' : 'In'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ExportReportDialog
