import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from './cashReportLabels.js'
import { getOrderStatusLabel } from '../../orders/utils/orderDisplay.js'

function money(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function timeOnly(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * CSS bản in. Khi `scope` rỗng thì áp thẳng lên document (dùng cho iframe in).
 * Khi có `scope`, mọi luật được giới hạn trong phần tử đó để không rò ra giao diện
 * ứng dụng trong lúc html2canvas chụp ảnh.
 */
function getPrintCss(orientation, scope = '') {
  const isLandscape = orientation === 'landscape'
  const p = scope ? `${scope} ` : ''
  const root = scope || 'html, body'
  // Ở chế độ scope, chính phần tử nguồn mang cả class scope và class report-shell,
  // nên selector phải dán liền nhau thay vì cách nhau một dấu trắng.
  const shell = scope ? `${scope}.report-shell` : '.report-shell'
  return `
    ${p}* { box-sizing: border-box; }
    ${root} {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px; line-height: 1.45; color: #000; background: #fff;
    }
    @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 12mm; }
    ${shell} { width: 100%; max-width: ${isLandscape ? '265mm' : '180mm'}; margin: 0 auto; }

    ${p}.text-center { text-align: center; }
    ${p}.text-right { text-align: right; }
    ${p}.text-left { text-align: left; }
    ${p}.font-bold { font-weight: bold; }

    ${p}h1.report-title { font-size: ${isLandscape ? '20px' : '18px'}; margin: 0 0 6px; text-transform: uppercase; }
    ${p}.meta-table { width: 100%; margin-top: 10px; font-size: 11px; }
    ${p}.meta-table td { border: none; padding: 2px 4px; text-align: left; }

    ${p}table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    ${p}th, ${p}td { border: 1px solid #ddd; padding: 5px 6px; text-align: right; font-size: 11px; }
    ${p}th:first-child, ${p}td:first-child { text-align: left; }
    ${p}th { background: #f1f3f0; font-weight: bold; text-align: center; }
    ${p}tfoot tr { background: #f9f9f9; font-weight: bold; }

    ${p}.section { page-break-inside: avoid; }
    ${p}.section-title {
      margin-top: 16px; font-weight: bold; font-size: 12px; text-transform: uppercase;
      border-bottom: 2px solid #333; padding-bottom: 3px;
    }
    ${p}.note { margin-top: 5px; font-size: 10px; color: #666; font-style: italic; }
    ${p}.kpi-grid { display: flex; gap: 8px; margin-top: 8px; }
    ${p}.kpi {
      flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px;
    }
    ${p}.kpi .kpi-label { font-size: 10px; color: #555; }
    ${p}.kpi .kpi-value { font-size: ${isLandscape ? '17px' : '15px'}; font-weight: bold; margin-top: 2px; }
    ${p}.kpi .kpi-hint { font-size: 9px; color: #777; margin-top: 3px; }
    ${p}.negative { color: #b42318; }
    ${p}.page-break { page-break-before: always; }
  `
}

function tableSection({ title, head, rows, foot, note, emptyText = 'Không có phát sinh' }) {
  const body = rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="text-center">${emptyText}</td></tr>`
  return `
    <div class="section">
      <div class="section-title">${title}</div>
      <table>
        <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
        ${foot ? `<tfoot>${foot}</tfoot>` : ''}
      </table>
      ${note ? `<div class="note">${note}</div>` : ''}
    </div>
  `
}

/** Dựng HTML báo cáo cuối ngày gồm 7 phần theo đặc tả. */
export function buildEndOfDayHtml({
  periodLabel,
  employeeName,
  report,
  creatorName = '—',
  agencyName = 'Chi nhánh chính',
  periodStartUtc,
  isMultiDay = false,
}) {
  const r = report || {}
  const b = r.bridge || {}
  const byMethod = r.byPaymentMethod || []
  const receipts = r.receipts || []
  const orders = r.orders || []
  const tillCash = byMethod.filter((m) => m.isCash).reduce((s, m) => s + (m.net || 0), 0)

  const underpaid = orders.filter((o) => (o.paidAmount || 0) < (o.finalAmount || 0))
  const periodStart = periodStartUtc ? new Date(periodStartUtc).getTime() : null
  const priorPeriod = periodStart
    ? receipts.filter((x) => x.orderCreatedAt && new Date(x.orderCreatedAt).getTime() < periodStart)
    : []

  const header = `
    <div class="text-center">
      <h1 class="report-title font-bold">${isMultiDay ? 'BÁO CÁO BÁN HÀNG THEO KỲ' : 'BÁO CÁO CUỐI NGÀY'}</h1>
      <div class="font-bold">Hệ thống Quản lý Hương Vân Trà</div>
      <div class="font-bold">Kỳ báo cáo: ${escapeHtml(periodLabel)}</div>
    </div>
    <table class="meta-table">
      <tr>
        <td><strong>Thời gian tạo:</strong> ${formatVietnamDateTime(new Date().toISOString())}</td>
        <td><strong>Người tạo:</strong> ${escapeHtml(creatorName)}</td>
      </tr>
      <tr>
        <td><strong>Chi nhánh:</strong> ${escapeHtml(agencyName)}</td>
        <td><strong>Nhân viên:</strong> ${escapeHtml(employeeName)}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Múi giờ:</strong> GMT+7</td>
      </tr>
    </table>
  `

  const section1 = `
    <div class="section">
      <div class="section-title">1. Tổng quan</div>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Doanh thu ghi nhận</div>
          <div class="kpi-value">${money(r.netRecognizedRevenue)}</div>
          <div class="kpi-hint">Giá trị hàng đã bán trong kỳ</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Tổng tiền thu vào</div>
          <div class="kpi-value">${money(r.totalCashIn)}</div>
          <div class="kpi-hint">Tiền thực nhận, gồm cả chuyển khoản</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Tiền mặt tại két</div>
          <div class="kpi-value">${money(tillCash)}</div>
          <div class="kpi-hint">Không gồm VietQR và chuyển khoản</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Đơn hoàn tất</div>
          <div class="kpi-value">${r.completedOrders || 0}</div>
          <div class="kpi-hint">${r.totalLineCount || 0} dòng hàng · ${r.distinctSkuCount || 0} SKU</div>
        </div>
      </div>
      <div class="note">
        Ba chỉ số trên không thay thế cho nhau: doanh thu ghi nhận theo hàng đã bán, tiền thu vào theo dòng tiền
        thực tế, tiền mặt tại két chỉ tính phần tiền mặt vật lý.
      </div>
    </div>
  `

  const section2 = tableSection({
    title: '2. Doanh thu ghi nhận',
    head: ['Nội dung', 'Giá trị'],
    rows: [
      `<tr><td>Doanh thu đơn hoàn tất</td><td>${money(r.salesRevenue)}</td></tr>`,
      `<tr><td>Giảm giá</td><td>${money(r.salesDiscount)}</td></tr>`,
      `<tr><td>Trừ hàng trả</td><td>${money(r.returnedRevenue)}</td></tr>`,
      `<tr><td>Đơn hoàn tất</td><td>${r.completedOrders || 0}</td></tr>`,
      `<tr><td>Tổng dòng hàng</td><td>${r.totalLineCount || 0}</td></tr>`,
      `<tr><td>Số SKU phát sinh</td><td>${r.distinctSkuCount || 0}</td></tr>`,
    ],
    foot: `<tr><td>Doanh thu ghi nhận thuần</td><td>${money(r.netRecognizedRevenue)}</td></tr>`,
    note: 'Ghi nhận theo đơn hoàn tất trong kỳ. Số lượng không cộng gộp giữa các đơn vị tính nên báo cáo đếm dòng hàng và số SKU.',
  })

  const cashInRows = (r.cashIn || []).map(
    (l) => `<tr><td>${escapeHtml(l.label)}</td><td>${l.count || 0}</td><td class="font-bold">${money(l.amount)}</td></tr>`,
  )
  const cashOutRows = (r.cashOut || []).map(
    (l) => `<tr><td>${escapeHtml(l.label)}</td><td>${l.count || 0}</td><td class="font-bold">${money(l.amount)}</td></tr>`,
  )

  const section3 = `
    ${tableSection({
      title: '3. Tiền thu vào',
      head: ['Loại thu', 'Số lượt', 'Số tiền'],
      rows: cashInRows,
      foot: `<tr><td colspan="2">Tổng thu vào</td><td>${money(r.totalCashIn)}</td></tr>`,
    })}
    ${tableSection({
      title: 'Tiền chi ra (hoàn trả hàng)',
      head: ['Phương thức hoàn', 'Số lượt', 'Số tiền'],
      rows: cashOutRows,
      foot: `<tr><td colspan="2">Tổng chi ra</td><td>${money(r.totalCashOut)}</td></tr>`,
    })}
    <div class="section">
      <table>
        <tbody>
          <tr>
            <td>Cọc bị giữ do hủy đơn chờ hàng (${r.forfeitedDepositOrders || 0} đơn)</td>
            <td class="font-bold">${money(r.forfeitedDepositIncome)}</td>
          </tr>
        </tbody>
      </table>
      <div class="note">Thu nhập khác — tiền đã nằm trong két nhưng không có hàng giao, không cộng vào doanh thu bán hàng.</div>
    </div>
  `

  const section4 = tableSection({
    title: '4. Tổng hợp dòng tiền theo phương thức thanh toán',
    head: ['Phương thức', 'Loại', 'Thu vào', 'Chi ra', 'Còn lại'],
    rows: byMethod.map(
      (l) => `<tr>
        <td>${escapeHtml(l.label)}</td>
        <td class="text-center">${l.isCash ? 'Tiền két' : 'Tài khoản'}</td>
        <td>${money(l.amountIn)}</td>
        <td>${l.amountOut ? `-${money(l.amountOut)}` : '—'}</td>
        <td class="font-bold">${money(l.net)}</td>
      </tr>`,
    ),
    foot: `<tr>
      <td colspan="2">Chênh lệch ròng</td>
      <td>${money(r.totalCashIn)}</td>
      <td>${r.totalCashOut ? `-${money(r.totalCashOut)}` : '—'}</td>
      <td>${money(r.netCashFlow)}</td>
    </tr>`,
    note: 'Đây là tổng hợp dòng tiền theo sổ sách. Chỉ gọi là đối soát két khi đã có số tiền mặt kiểm đếm thực tế.',
  })

  const section5 = tableSection({
    title: '5. Cầu nối doanh thu và dòng tiền',
    head: ['Nội dung', 'Giá trị'],
    rows: [
      `<tr><td>Doanh thu ghi nhận</td><td>${money(b.recognizedRevenue)}</td></tr>`,
      `<tr><td>(-) Doanh thu chưa thu tiền</td><td>${money(b.unpaidRevenue)}</td></tr>`,
      `<tr><td>(+) Tiền thu của đơn kỳ trước</td><td>${money(b.priorPeriodCollections)}</td></tr>`,
      `<tr><td>(+) Tiền thu trước của đơn chưa hoàn tất</td><td>${money(b.advanceOnOpenOrders)}</td></tr>`,
      `<tr><td>(+) Cọc bị giữ do hủy đơn</td><td>${money(b.forfeitedDeposit)}</td></tr>`,
      `<tr><td>(-) Hoàn tiền trả hàng</td><td>${money(b.refunds)}</td></tr>`,
    ],
    foot: `<tr><td>= Tổng tiền thu vào</td><td>${money(b.totalCashIn)}</td></tr>`,
    note: 'Giải thích vì sao doanh thu ghi nhận và tiền thực thu của cùng một kỳ không bằng nhau. Đơn chưa hoàn tất gồm đơn chờ nguyên vật liệu, chờ sản xuất và chờ điều chuyển.',
  })

  const section6 = tableSection({
    title: '6. Hàng hóa đã bán',
    head: ['Mã SKU', 'Tên hàng', 'Nhóm hàng', 'SL bán', 'SL trả', 'Doanh thu'],
    rows: (r.products || []).map(
      (p) => `<tr>
        <td>${escapeHtml(p.skuCode)}</td>
        <td class="text-left">${escapeHtml(p.skuName)}</td>
        <td class="text-left">${escapeHtml(p.categoryName || '—')}</td>
        <td>${p.quantity || 0}</td>
        <td>${p.returnedQuantity || 0}</td>
        <td class="font-bold">${money(p.revenue)}</td>
      </tr>`,
    ),
    emptyText: 'Không có hàng hóa nào được bán trong kỳ.',
  })

  const section7 = `
    ${tableSection({
      title: '7. Chi tiết các khoản thu',
      head: ['Mã đơn', 'Thời gian', 'Phương thức', 'Mục đích', 'Khách hàng', 'Số tiền'],
      rows: receipts.map(
        (p) => `<tr>
          <td class="font-bold">${escapeHtml(p.orderCode)}</td>
          <td class="text-center">${timeOnly(p.paidAt)}</td>
          <td class="text-center">${paymentMethodLabel(p.paymentMethod)}</td>
          <td class="text-center">${paymentPurposeLabel(p.paymentPurpose)}</td>
          <td class="text-left">${escapeHtml(p.customerName || 'Khách lẻ')}</td>
          <td class="font-bold">${money(p.amount)}</td>
        </tr>`,
      ),
      emptyText: 'Không có khoản thu nào trong kỳ.',
    })}
    ${
      underpaid.length || priorPeriod.length
        ? tableSection({
            title: 'Ngoại lệ cần xử lý',
            head: ['Loại', 'Mã đơn', 'Ghi chú', 'Số tiền'],
            rows: [
              ...underpaid.map(
                (o) => `<tr>
                  <td>Chưa thu đủ tiền</td>
                  <td class="text-left font-bold">${escapeHtml(o.orderCode)}</td>
                  <td class="text-left">${getOrderStatusLabel(o.orderStatus)} · đã thu ${money(o.paidAmount)}/${money(o.finalAmount)}</td>
                  <td class="font-bold negative">${money((o.finalAmount || 0) - (o.paidAmount || 0))}</td>
                </tr>`,
              ),
              ...priorPeriod.map(
                (x) => `<tr>
                  <td>Thu của đơn kỳ trước</td>
                  <td class="text-left font-bold">${escapeHtml(x.orderCode)}</td>
                  <td class="text-left">${paymentPurposeLabel(x.paymentPurpose)} · thu lúc ${timeOnly(x.paidAt)}</td>
                  <td class="font-bold">${money(x.amount)}</td>
                </tr>`,
              ),
            ],
          })
        : ''
    }
  `

  return `${header}${section1}${section2}${section3}${section4}${section5}${section6}${section7}`
}

function buildDocument(data) {
  const title = data.filename || 'Bao cao cuoi ngay'
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${getPrintCss(data.orientation)}</style>
</head>
<body><div class="report-shell">${buildEndOfDayHtml(data)}</div></body>
</html>`
}

/** Mở hộp thoại in của trình duyệt với khổ A4 dọc hoặc ngang. */
export function printEndOfDayReport(data) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', data.filename || 'Báo cáo cuối ngày')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    if (!win) {
      document.body.removeChild(iframe)
      resolve()
      return
    }

    const doc = win.document
    doc.open()
    doc.write(buildDocument(data))
    doc.close()

    const finish = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      resolve()
    }

    let printed = false
    const doPrint = () => {
      if (printed) return
      printed = true
      win.onafterprint = finish
      setTimeout(finish, 2500)
      win.focus()
      win.print()
    }

    iframe.onload = () => setTimeout(doPrint, 50)
    setTimeout(doPrint, 120)
  })
}

const PDF_SHELL_CLASS = 'eod-pdf-shell'

/**
 * Xuất thẳng ra file PDF, không đi qua hộp thoại in.
 *
 * Hai điểm bắt buộc phải giữ, nếu không file sẽ trắng hoặc mất định dạng:
 * - html2canvas chỉ chụp được phần tử nằm trong vùng nhìn thấy, nên phần tử nguồn đặt ở
 *   toạ độ 0,0 và chỉ giấu bằng opacity/z-index thay vì đẩy ra ngoài màn hình.
 * - html2pdf deep-clone phần tử nguồn rồi gắn bản sao vào một container mới ngay dưới
 *   document.body, nên thẻ <style> phải nằm BÊN TRONG phần tử nguồn để đi theo bản sao,
 *   và CSS phải scope theo class của chính phần tử đó thay vì theo phần tử cha.
 */
export async function exportEndOfDayPdf(data) {
  const { default: html2pdf } = await import('html2pdf.js')
  const orientation = data.orientation === 'landscape' ? 'landscape' : 'portrait'

  const holder = document.createElement('div')
  holder.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${orientation === 'landscape' ? '1123px' : '794px'}`,
    'background:#ffffff',
    'z-index:-1',
    'opacity:0',
    'pointer-events:none',
    'overflow:visible',
  ].join(';')

  const shell = document.createElement('div')
  shell.className = `report-shell ${PDF_SHELL_CLASS}`
  shell.innerHTML = `<style>${getPrintCss(orientation, `.${PDF_SHELL_CLASS}`)}</style>${buildEndOfDayHtml(data)}`

  holder.appendChild(shell)
  document.body.appendChild(holder)

  try {
    // Chờ một nhịp layout để html2canvas đo được kích thước thật của bảng.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    await html2pdf()
      .set({
        margin: 10,
        filename: `${data.filename || 'Bao_cao_cuoi_ngay'}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: shell.scrollWidth,
          windowHeight: shell.scrollHeight,
          // Bản sao mà html2canvas dựng trong iframe riêng vẫn thừa hưởng opacity:0
          // của phần tử nguồn nên phải bật lại, không thì ảnh chụp ra trắng.
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll(`.${PDF_SHELL_CLASS}`).forEach((node) => {
              node.style.opacity = '1'
            })
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(shell)
      .save()
  } finally {
    if (holder.parentNode) holder.parentNode.removeChild(holder)
  }
}
