/**
 * Khung "tờ giấy" của một tài liệu báo cáo.
 *
 * Mọi báo cáo cuối ngày đều dùng chung khung này để phần đầu trang (tên cửa hàng, tiêu đề,
 * kỳ báo cáo, điều kiện lọc) luôn giống nhau giữa bản xem trên web và bản in.
 *
 * `layout`:
 * - 'report'  — khổ A4 dọc.
 * - 'wide'    — khổ A4 ngang, cho báo cáo nhiều cột.
 * - 'receipt' — giấy in nhiệt K80 (72mm), dùng ở POS để bản xem đúng bằng bản in.
 */

const STORE_NAME = 'HƯƠNG VÂN TRÀ'

// 72mm nội dung trên giấy 80mm, quy đổi ra px ở 96dpi cho khớp `.k80-shell` bên bản in.
const RECEIPT_WIDTH_PX = 272

function ReportDocumentPage({
  title,
  periodLabel,
  criteriaLines = [],
  layout = 'report',
  printedAtLabel,
  children,
}) {
  const isWide = layout === 'wide'
  const isReceipt = layout === 'receipt'
  return (
    <article
      style={isReceipt ? { maxWidth: `${RECEIPT_WIDTH_PX}px` } : undefined}
      className={`mx-auto w-full bg-white text-[#1b1c17] shadow-sm ring-1 ring-[#c1c9c0]/50 ${
        isReceipt ? 'px-3 py-4 text-[11px] leading-tight' : 'px-8 py-8'
      } ${isWide ? 'max-w-[1400px]' : isReceipt ? '' : 'max-w-[860px]'}`}
    >
      <header
        className={`text-center ${isReceipt ? 'border-b border-dashed border-[#1b1c17] pb-2' : 'border-b-2 border-[#1b1c17] pb-3'}`}
      >
        <p
          className={`font-semibold uppercase tracking-[0.2em] text-[#717971] ${isReceipt ? 'text-[10px]' : 'text-xs'}`}
        >
          {STORE_NAME}
        </p>
        <h1 className={`mt-1 font-bold uppercase tracking-wide ${isReceipt ? 'text-[12px]' : 'text-lg'}`}>{title}</h1>
        {periodLabel && (
          <p className={`mt-1 text-[#414942] ${isReceipt ? 'text-[10px]' : 'text-sm'}`}>Kỳ báo cáo: {periodLabel}</p>
        )}
      </header>

      {criteriaLines.length > 0 && (
        <dl
          className={`mt-3 grid gap-x-8 gap-y-1 text-[#414942] ${
            isReceipt ? 'grid-cols-1 text-[10px]' : 'grid-cols-1 text-xs sm:grid-cols-2'
          }`}
        >
          {criteriaLines.map((line) => (
            <div key={line.label} className="flex gap-1.5">
              <dt className="shrink-0 text-[#717971]">{line.label}:</dt>
              <dd className="font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className={isReceipt ? 'mt-3 space-y-3' : 'mt-5 space-y-6'}>{children}</div>

      <footer
        className={`border-t border-[#c1c9c0] pt-2 text-[#717971] ${isReceipt ? 'mt-4 text-[10px]' : 'mt-8 text-[11px]'}`}
      >
        {printedAtLabel && <p>Kết xuất lúc: {printedAtLabel}</p>}
      </footer>
    </article>
  )
}

/** Một mục trong tài liệu: tiêu đề gạch chân, không viền bo như thẻ dashboard. */
export function DocumentSection({ title, note, children, right }) {
  return (
    <section className="break-inside-avoid">
      {title && (
        <header className="mb-2 flex items-end justify-between gap-3 border-b border-[#c1c9c0] pb-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#1b1c17]">{title}</h2>
            {note && <p className="mt-0.5 text-[11px] font-normal text-[#717971]">{note}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

/**
 * Bảng dạng tài liệu: viền mảnh, không bo góc, in ra giống bảng trên giấy.
 * `columns` dùng chung định dạng với DataTable của dashboard để tái sử dụng cột sẵn có.
 */
export function DocumentTable({ columns, rows, renderRow, emptyText = 'Không có phát sinh', footer, dense }) {
  const pad = dense ? 'px-2 py-1' : 'px-2 py-1.5'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-[#f1efe7]">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`border border-[#c1c9c0] ${pad} text-[11px] font-bold uppercase tracking-wide text-[#414942] ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[#1b1c17]">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={`border border-[#c1c9c0] ${pad} text-center italic text-[#717971]`}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map(renderRow)
          )}
        </tbody>
        {footer && <tfoot className="bg-[#f1efe7] font-bold">{footer}</tfoot>}
      </table>
    </div>
  )
}

/** Ô dữ liệu trong DocumentTable — gom class viền để các tài liệu không lặp lại. */
export function Td({ align, mono, muted, className = '', children, ...rest }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
  return (
    <td
      className={`border border-[#c1c9c0] px-2 py-1.5 ${alignClass} ${mono ? 'font-mono text-[11px]' : ''} ${
        muted ? 'text-[#717971]' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </td>
  )
}

/** Dòng "Tên chỉ tiêu … giá trị" dùng cho các bảng tổng hợp một cột số. */
export function KeyValueRows({ items }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <tbody>
        {items.map((it) => (
          <tr key={it.label} className={it.strong ? 'font-bold' : ''}>
            <td className="border border-[#c1c9c0] px-2 py-1.5">
              {it.label}
              {it.hint && <span className="ml-1 text-[11px] font-normal text-[#717971]">({it.hint})</span>}
            </td>
            <td className="w-48 border border-[#c1c9c0] px-2 py-1.5 text-right">{it.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Cảnh báo giới hạn dữ liệu ngay trong tài liệu, để bản in cũng nêu rõ phần còn thiếu. */
export function DocumentNotice({ title = 'Giới hạn dữ liệu', items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="border border-[#fec25b] bg-[#fec25b]/10 px-3 py-2 text-[11px] text-[#7e5700]">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  )
}

export default ReportDocumentPage
