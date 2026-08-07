import { useState } from 'react'

/**
 * Nhóm dòng có thể mở rộng trong tài liệu báo cáo.
 *
 * Dùng cho các bảng có cấu trúc cha–con (ví dụ: một đơn hàng và các dòng hàng của nó).
 * Khi in, mọi nhóm đều được mở sẵn nhờ prop `forceOpen` do khung xem truyền xuống.
 */
function ExpandableReportGroup({ summaryRow, columnCount, children, forceOpen, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open

  return (
    <>
      <tr
        className="cursor-pointer bg-[#fbf9f1] hover:bg-[#f1efe7]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        {summaryRow(isOpen)}
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={columnCount} className="border border-[#c1c9c0] bg-white p-0">
            {children}
          </td>
        </tr>
      )}
    </>
  )
}

/** Mũi tên trạng thái mở/đóng, đặt ở ô đầu của dòng tổng hợp. */
export function ExpandCaret({ open }) {
  return (
    <span className="material-symbols-outlined align-middle text-[16px] text-[#717971]">
      {open ? 'expand_more' : 'chevron_right'}
    </span>
  )
}

export default ExpandableReportGroup
