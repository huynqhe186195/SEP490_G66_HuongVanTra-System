/** CSS in iframe — hóa đơn A4 full trang (preview in trình duyệt + máy in thường) */
export const RECEIPT_PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #fff;
  }
  body {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
  }
  .thermal-print-shell {
    width: 100%;
    max-width: 100%;
    flex: 1;
  }
  .receipt-paper {
    width: 100%;
    max-width: 100%;
    min-height: 100vh;
    margin: 0 auto;
    padding: 14mm 16mm 18mm;
    color: #000;
    font-family: 'Manrope', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 13.5px;
    line-height: 1.55;
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  .receipt-brand {
    text-align: center;
    font-size: 27px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #000;
  }
  .receipt-title {
    margin: 8px 0 0;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #444;
  }
  .receipt-reprint-banner {
    margin: 10px 0 0;
    padding: 4px 0;
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.2em;
    color: #000;
    border: 1.5px solid #000;
  }
  .receipt-meta {
    text-align: center;
    font-size: 12.5px;
    color: #444;
  }
  .receipt-divider {
    margin: 14px 0;
    border: none;
    border-top: 1px solid #ccc;
  }
  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .receipt-label { flex-shrink: 0; color: #555; }
  .receipt-value { text-align: right; word-break: break-word; color: #000; }
  .receipt-highlight { font-weight: 700; }
  .receipt-item { padding: 9px 0; border-bottom: 1px solid #e0e0e0; }
  .receipt-item-name {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
    word-break: break-word;
    color: #000;
  }
  .receipt-item-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    font-size: 13px;
    color: #222;
  }
  .receipt-item-total { flex-shrink: 0; font-weight: 700; color: #000; }
  .receipt-item-sku { margin-top: 2px; font-size: 11.5px; color: #666; }
  .receipt-total-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 5px;
    font-size: 13.5px;
    color: #222;
  }
  .receipt-total-row.receipt-discount { color: #222; }
  .receipt-total-row.receipt-grand {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 2px solid #000;
    font-size: 18px;
    font-weight: 800;
    color: #000;
  }
  .receipt-total-row.receipt-debt { font-weight: 700; color: #000; }
  .receipt-thanks {
    margin-top: 22px;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: #000;
  }
  .receipt-footer-note {
    margin-top: 4px;
    text-align: center;
    font-size: 12px;
    color: #666;
  }
  @page {
    size: A4 portrait;
    margin: 0;
  }
  @media print {
    html, body {
      width: 100% !important;
      min-height: auto !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body {
      display: block !important;
      min-height: 0 !important;
    }
    .thermal-print-shell {
      width: 100% !important;
      max-width: none !important;
    }
    .receipt-paper {
      width: 100% !important;
      max-width: none !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 14mm 16mm 18mm !important;
      box-shadow: none !important;
    }
  }
`
