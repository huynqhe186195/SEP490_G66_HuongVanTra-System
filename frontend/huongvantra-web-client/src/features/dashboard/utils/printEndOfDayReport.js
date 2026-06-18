import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import html2pdf from 'html2pdf.js'

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

export function buildEndOfDayReportHtml({ 
  dateStr, 
  employeeName, 
  orders, 
  paperSize = 'A4',
  creatorName = '—',
  agencyName = 'Chi nhánh chính'
}) {
  const totalOrders = orders.length
  let totalGross = 0
  let totalNet = 0
  let totalQuantitySum = 0
  let totalDiscountSum = 0

  const orderRows = orders.map((o) => {
    // KiotViet columns: Mã GD, Thời gian, Số lượng, Doanh thu, Thực thu
    const qty = o.totalQuantity || 0
    totalGross += o.totalAmount || 0
    totalNet += o.finalAmount || 0
    totalQuantitySum += qty
    totalDiscountSum += o.discountAmount || 0
    // Simplified return sum
    
    return `
      <tr>
        <td class="text-left">
          <div class="font-bold">${o.orderCode}</div>
        </td>
        <td class="text-center" style="font-size: 0.85em; color: #555;">
          ${new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </td>
        <td class="text-center">${qty}</td>
        <td>${formatCurrency(o.totalAmount)}</td>
        <td class="hide-on-k80">${formatCurrency(o.discountAmount || 0)}</td>
        <td class="font-bold">${formatCurrency(o.finalAmount)}</td>
      </tr>
    `
  }).join('')

  return `
    <div class="text-center mb-4">
      <h1 class="report-title font-bold" style="font-size: 22px; text-transform: uppercase;">BÁO CÁO DOANH THU CUỐI NGÀY</h1>
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

    <table>
      <thead>
        <tr>
          <th>Mã giao dịch</th>
          <th>Thời gian</th>
          <th>SL</th>
          <th>Doanh thu</th>
          <th class="hide-on-k80">Giảm giá</th>
          <th>Thực thu</th>
        </tr>
      </thead>
      <tbody>
        ${orderRows.length ? orderRows : '<tr><td colspan="5" class="text-center">Không có giao dịch nào trong ngày.</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background: #f9f9f9; font-weight: bold;">
          <td colspan="2" class="text-center">TỔNG CỘNG (${totalOrders} Đơn)</td>
          <td class="text-center">${totalQuantitySum}</td>
          <td>${formatCurrency(totalGross)}</td>
          <td class="hide-on-k80">${formatCurrency(totalDiscountSum)}</td>
          <td style="color: #c92a2a;">${formatCurrency(totalNet)}</td>
        </tr>
      </tfoot>
    </table>
  `
}

export function printEndOfDayReport(data) {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    
    // Use the CSS we already defined
    const style = document.createElement('style')
    style.innerHTML = getReceiptPrintCss(data.paperSize)
    container.appendChild(style)
    
    const content = document.createElement('div')
    content.className = 'thermal-print-shell'
    content.innerHTML = buildEndOfDayReportHtml(data)
    container.appendChild(content)
    
    // Must be in DOM for html2canvas to render properly
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    document.body.appendChild(container)

    const title = data.filename || 'Báo cáo doanh thu cuối ngày'

    const opt = {
      margin:       10,
      filename:     `${title}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: data.paperSize === 'K80' ? [80, 297] : 'a4', orientation: 'portrait' }
    }

    html2pdf()
      .from(container)
      .set(opt)
      .save()
      .then(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container)
        }
        resolve()
      })
      .catch((err) => {
        console.error('Failed to generate PDF:', err)
        if (document.body.contains(container)) {
          document.body.removeChild(container)
        }
        resolve()
      })
  })
}
