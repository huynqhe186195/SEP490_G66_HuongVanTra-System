import { useLayoutEffect, useRef, useState } from 'react'
import { buildEndOfDayHtml, getPrintCss } from '../utils/printEndOfDayReport.js'

const PREVIEW_CLASS = 'eod-preview-shell'

/** Khổ giấy A4 quy ra pixel ở 96dpi, dùng để dựng khung giấy trên màn hình. */
const PAGE_SIZE_PX = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
}
/** Lề tương ứng `@page { margin: 12mm }` trong CSS bản in. */
const PAGE_PADDING_PX = 45

/**
 * Chia các khối nội dung thành từng trang theo chiều cao còn lại của khổ giấy.
 *
 * Đo bằng `offsetTop` thay vì cộng dồn `offsetHeight` vì các khối có margin dọc;
 * cộng `offsetHeight` sẽ bỏ sót phần margin và cho ra số trang ít hơn thực tế.
 * Khối nào tự nó đã cao hơn một trang thì được đứng riêng một trang — đúng như khi in
 * thật, trình duyệt sẽ tự tràn phần thừa sang trang sau.
 */
function paginate(nodes, contentHeight) {
  const pages = []
  let current = []
  let pageTop = nodes.length ? nodes[0].offsetTop : 0

  nodes.forEach((node) => {
    const bottom = node.offsetTop + node.offsetHeight
    if (current.length && bottom - pageTop > contentHeight) {
      pages.push(current)
      current = []
      pageTop = node.offsetTop
    }
    current.push(node.outerHTML)
  })

  if (current.length) pages.push(current)
  return pages.map((chunk) => chunk.join(''))
}

/**
 * Khung xem trước bản in, tách sẵn thành từng trang A4.
 *
 * Điểm mấu chốt: dùng lại đúng `buildEndOfDayHtml` và `getPrintCss` của luồng in/PDF
 * thay vì dựng lại bằng JSX. Nhờ vậy cái nhìn thấy ở đây luôn khớp với tờ giấy in ra,
 * và sửa nhãn ở một chỗ là cả ba đường (màn hình, PDF, máy in) cùng đổi.
 *
 * Đổi lại, phần này không phải React thuần nên nội dung được gắn bằng
 * `dangerouslySetInnerHTML`. An toàn vì mọi giá trị người dùng nhập đều đã đi qua
 * `escapeHtml` bên trong `buildEndOfDayHtml`.
 */
function ReportPrintPreview({ data, orientation, onChangeOrientation }) {
  const page = PAGE_SIZE_PX[orientation] || PAGE_SIZE_PX.portrait
  const contentHeight = page.height - PAGE_PADDING_PX * 2

  const measureRef = useRef(null)
  const scrollRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [pages, setPages] = useState([])

  const css = getPrintCss(orientation, `.${PREVIEW_CLASS}`)
  const body = buildEndOfDayHtml(data)

  // Đo trên khung ẩn có đúng bề rộng vùng in, rồi mới cắt trang. Phải đo trước khi
  // trình duyệt vẽ (useLayoutEffect) để người dùng không thấy bản chưa cắt nháy lên.
  useLayoutEffect(() => {
    const measure = measureRef.current
    if (!measure) return
    setPages(paginate(Array.from(measure.children), contentHeight))
  }, [body, contentHeight])

  // Thu nhỏ trang giấy cho vừa bề ngang khung chứa, không bao giờ phóng to quá 100%
  // vì phóng to sẽ làm chữ vỡ và sai tỉ lệ so với bản in thật.
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return undefined

    const recalc = () => {
      // Trừ padding hai bên của vùng cuộn để trang giấy không chạm mép.
      const available = container.clientWidth - 48
      setScale(available > 0 ? Math.min(1, available / page.width) : 1)
    }

    recalc()
    const observer = new ResizeObserver(recalc)
    observer.observe(container)
    return () => observer.disconnect()
  }, [page.width])

  const total = pages.length || 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-[#717971]">
          <span className="material-symbols-outlined text-[16px] text-[#356647]">visibility</span>
          Đây là bản sẽ in ra giấy, đã chia sẵn theo từng trang. Mọi thay đổi ở bộ lọc đều được áp dụng ngay.
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#f6f4ec] px-2.5 py-1.5 text-xs font-medium text-[#414942]">
            {total} trang · {Math.round(scale * 100)}%
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white p-0.5">
            {[
              { key: 'portrait', label: 'A4 dọc', icon: 'crop_portrait' },
              { key: 'landscape', label: 'A4 ngang', icon: 'crop_landscape' },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => onChangeOrientation(o.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  orientation === o.key ? 'bg-[#356647] text-white' : 'text-[#414942] hover:bg-[#f6f4ec]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* `relative` để hai khung đo bên dưới neo vào đây, không làm giãn trang. */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto rounded-2xl bg-[#e8e9e4] p-6">
        {/*
          Khung đo: đặt ngoài luồng nhìn thấy nhưng vẫn có kích thước thật, vì phần tử
          bị `display:none` không đo được chiều cao. Thẻ <style> nằm ở đây và áp dụng
          cho cả các trang bên dưới, do CSS đã được scope theo class chung.
        */}
        <div
          aria-hidden
          className={`report-shell ${PREVIEW_CLASS} pointer-events-none invisible absolute -z-10`}
          style={{ width: page.width - PAGE_PADDING_PX * 2 }}
        >
          <div dangerouslySetInnerHTML={{ __html: `<style>${css}</style>` }} />
        </div>
        <div
          ref={measureRef}
          aria-hidden
          className={`report-shell ${PREVIEW_CLASS} pointer-events-none invisible absolute -z-10`}
          style={{ width: page.width - PAGE_PADDING_PX * 2 }}
          dangerouslySetInnerHTML={{ __html: body }}
        />

        <div className="flex flex-col items-center gap-6">
          {pages.map((html, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              {/*
                Trang giấy giữ kích thước thật rồi mới thu nhỏ bằng transform, nên tỉ lệ
                chữ và bảng khớp bản in. Vì transform không chiếm chỗ trong luồng layout,
                phần tử bọc ngoài phải được gán lại kích thước sau khi thu nhỏ.
              */}
              <div style={{ width: page.width * scale, height: page.height * scale }}>
                <div
                  className={`report-shell ${PREVIEW_CLASS} bg-white shadow-[0_2px_12px_rgba(0,0,0,0.14)]`}
                  style={{
                    width: page.width,
                    height: page.height,
                    padding: PAGE_PADDING_PX,
                    overflow: 'hidden',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
              <span className="text-xs text-[#717971]">
                Trang {index + 1} / {total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ReportPrintPreview
