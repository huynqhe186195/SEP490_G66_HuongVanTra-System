import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from './cashReportLabels.js'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function getReceiptPrintCss(paperSize) {
  // Common reset
  let css = `
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .mt-4 { margin-top: 16px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: right; font-size: 13px; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #f5f5f5; font-weight: bold; text-align: center; }
    
    .header-info {
      display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;
      margin-bottom: 16px; font-size: 13px; color: #333;
    }

    .section-title {
      margin-top: 18px; font-weight: bold; font-size: 13px;
      text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 4px;
    }
    .note { margin-top: 6px; font-size: 11px; color: #666; font-style: italic; }
  `

  if (paperSize === 'A4') {
    css += `
      @page { size: A4 portrait; margin: 0; }
      body { padding: 15mm; }
      .thermal-print-shell { width: 100%; max-width: 800px; margin: 0 auto; }
      .report-title { font-size: 24px; margin-bottom: 8px; text-transform: uppercase; }
    `
  } else {
    // K80
    css += `
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; margin: 0 auto; padding: 10px; }
      .thermal-print-shell { width: 100%; }
      .report-title { font-size: 18px; margin-bottom: 8px; text-transform: uppercase; }
      th, td { font-size: 11px; padding: 4px; border: 1px dashed #ccc; }
      /* Hide some columns on K80 to save space */
      .hide-on-k80 { display: none !important; }
    `
  }

  return css
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function buildFlowSection(title, lines, totalLabel, total) {
  const rows = lines.length
    ? lines
        .map(
          (l) => `
      <tr>
        <td class="text-left">${l.label}</td>
        <td class="text-center">${l.count}</td>
        <td class="font-bold">${formatCurrency(l.amount)}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="text-center">Không có phát sinh</td></tr>'

  return `
    <div class="section-title">${title}</div>
    <table>
      <thead>
        <tr><th>Nội dung</th><th>Số lượt</th><th>Số tiền</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background: #f9f9f9; font-weight: bold;">
          <td colspan="2" class="text-left">${totalLabel}</td>
          <td>${formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  `
}

export function buildCashReconciliationHtml({
  dateStr,
  employeeName,
  report,
  paperSize = 'A4',
  creatorName = '—',
  agencyName = 'Chi nhánh chính',
}) {
  const r = report || {}
  const cashIn = r.cashIn || []
  const cashOut = r.cashOut || []
  const byMethod = r.byPaymentMethod || []
  const receipts = r.receipts || []

  const methodRows = byMethod.length
    ? byMethod
        .map(
          (l) => `
      <tr>
        <td class="text-left">${l.label}</td>
        <td>${formatCurrency(l.amountIn)}</td>
        <td class="hide-on-k80">${l.amountOut ? `-${formatCurrency(l.amountOut)}` : '—'}</td>
        <td class="font-bold">${formatCurrency(l.net)}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="text-center">Không có phát sinh</td></tr>'

  const receiptRows = receipts.length
    ? receipts
        .map(
          (p) => `
      <tr>
        <td class="text-left font-bold">${p.orderCode}</td>
        <td class="text-center" style="font-size: 0.85em; color: #555;">${formatTime(p.paidAt)}</td>
        <td class="text-center">${paymentMethodLabel(p.paymentMethod)}</td>
        <td class="hide-on-k80 text-center">${paymentPurposeLabel(p.paymentPurpose)}</td>
        <td class="font-bold">${formatCurrency(p.amount)}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="text-center">Không có khoản thu nào trong ngày.</td></tr>'

  return `
    <div class="text-center mb-4">
      <h1 class="report-title font-bold" style="font-size: 22px; text-transform: uppercase;">BÁO CÁO ĐỐI SOÁT KÉT CUỐI NGÀY</h1>
      <div style="font-weight: bold; margin-bottom: 8px;">Hệ thống Quản lý Hương Vân Trà</div>
      <div style="font-weight: bold; margin-bottom: 16px;">Ngày giao dịch: ${dateStr}</div>

      <table style="width: 100%; max-width: 600px; margin: 0 auto; border: none; font-size: 13px;">
        <tr>
          <td style="border: none; padding: 4px; text-align: left;"><strong>Thời gian tạo:</strong> ${formatVietnamDateTime(new Date().toISOString())}</td>
          <td style="border: none; padding: 4px; text-align: left;"><strong>Người tạo:</strong> ${creatorName}</td>
        </tr>
        <tr>
          <td style="border: none; padding: 4px; text-align: left;"><strong>Chi nhánh:</strong> ${agencyName}</td>
          <td style="border: none; padding: 4px; text-align: left;"><strong>Nhân viên:</strong> ${employeeName}</td>
        </tr>
      </table>
    </div>

    ${buildFlowSection('1. TIỀN THU VÀO', cashIn, 'Tổng thu vào', r.totalCashIn || 0)}
    ${buildFlowSection('2. TIỀN CHI RA (HOÀN TRẢ HÀNG)', cashOut, 'Tổng chi ra', r.totalCashOut || 0)}

    <div class="section-title">3. ĐỐI SOÁT KÉT THEO PHƯƠNG THỨC</div>
    <table>
      <thead>
        <tr>
          <th>Phương thức</th>
          <th>Thu vào</th>
          <th class="hide-on-k80">Chi ra</th>
          <th>Còn lại</th>
        </tr>
      </thead>
      <tbody>${methodRows}</tbody>
      <tfoot>
        <tr style="background: #f9f9f9; font-weight: bold;">
          <td class="text-left">CHÊNH LỆCH RÒNG</td>
          <td>${formatCurrency(r.totalCashIn || 0)}</td>
          <td class="hide-on-k80">${r.totalCashOut ? `-${formatCurrency(r.totalCashOut)}` : '—'}</td>
          <td style="color: #c92a2a;">${formatCurrency(r.netCashFlow || 0)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="section-title">4. THU NHẬP KHÁC</div>
    <table>
      <tbody>
        <tr>
          <td class="text-left">Cọc bị giữ do hủy đơn chờ hàng (${r.forfeitedDepositOrders || 0} đơn)</td>
          <td class="font-bold">${formatCurrency(r.forfeitedDepositIncome || 0)}</td>
        </tr>
      </tbody>
    </table>
    <div class="note">Thu nhập khác — tiền đã nằm trong két nhưng không có hàng giao, không cộng vào doanh thu bán hàng.</div>

    <div class="section-title">5. DOANH THU BÁN HÀNG GHI NHẬN</div>
    <table>
      <tbody>
        <tr><td class="text-left">Đơn hoàn tất</td><td>${r.completedOrders || 0}</td></tr>
        <tr><td class="text-left">Tổng dòng hàng</td><td>${r.totalLineCount || 0}</td></tr>
        <tr><td class="text-left">Số SKU phát sinh</td><td>${r.distinctSkuCount || 0}</td></tr>
        <tr><td class="text-left">Giảm giá</td><td>${formatCurrency(r.salesDiscount || 0)}</td></tr>
        <tr><td class="text-left">Trừ hàng trả</td><td>${formatCurrency(r.returnedRevenue || 0)}</td></tr>
        <tr style="background: #f9f9f9; font-weight: bold;">
          <td class="text-left">Doanh thu ghi nhận thuần</td>
          <td>${formatCurrency(r.netRecognizedRevenue ?? r.salesRevenue ?? 0)}</td>
        </tr>
      </tbody>
    </table>
    <div class="note">Ghi nhận theo đơn hoàn tất trong ngày, có thể khác dòng tiền vì cọc và phần còn lại thu ở các ngày khác nhau.</div>

    <div class="section-title">CHI TIẾT CÁC KHOẢN THU</div>
    <table>
      <thead>
        <tr>
          <th>Mã đơn</th>
          <th>Thời gian</th>
          <th>Phương thức</th>
          <th class="hide-on-k80">Mục đích</th>
          <th>Số tiền</th>
        </tr>
      </thead>
      <tbody>${receiptRows}</tbody>
    </table>
  `
}

export function printCashReconciliationReport(data) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    const title = data.filename || 'Báo cáo đối soát két cuối ngày'
    iframe.setAttribute('title', title)
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
    doc.write(
      `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${getReceiptPrintCss(data.paperSize)}</style>
</head>
<body><div class="thermal-print-shell">${buildCashReconciliationHtml(data)}</div></body>
</html>`
    )
    doc.close()

    const finish = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
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

    iframe.onload = () => {
      setTimeout(doPrint, 50)
    }
    setTimeout(doPrint, 120)
  })
}
