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
    min-height: calc(100vh - 20mm);
    margin: 0 auto;
    padding: 14mm 16mm 18mm;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    line-height: 1.5;
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  .receipt-brand {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }
  .receipt-title {
    margin-top: 8px;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
  }
  .receipt-reprint-banner {
    margin-top: 8px;
    padding: 4px 0;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.2em;
    border: 2px solid #000;
  }
  .receipt-meta {
    text-align: center;
    font-size: 13px;
    color: #333;
  }
  .receipt-divider {
    margin: 14px 0;
    border: none;
    border-top: 1px dashed #000;
  }
  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .receipt-label { flex-shrink: 0; color: #444; }
  .receipt-value { text-align: right; word-break: break-word; }
  .receipt-highlight { font-weight: 700; }
  .receipt-item { margin-bottom: 14px; }
  .receipt-item-name {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    word-break: break-word;
  }
  .receipt-item-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    font-size: 13px;
  }
  .receipt-item-total { flex-shrink: 0; font-weight: 700; }
  .receipt-item-sku { margin-top: 2px; font-size: 12px; color: #555; }
  .receipt-total-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 14px;
  }
  .receipt-total-row.receipt-grand {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 2px solid #000;
    font-size: 17px;
    font-weight: 700;
  }
  .receipt-total-row.receipt-debt { font-weight: 700; }
  .receipt-thanks {
    margin-top: 20px;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
  }
  .receipt-footer-note {
    margin-top: 6px;
    text-align: center;
    font-size: 12px;
    color: #555;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  @media print {
    html, body {
      width: 100% !important;
      min-height: auto !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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
      min-height: calc(100vh - 20mm) !important;
      margin: 0 !important;
      padding: 10mm 12mm 14mm !important;
      box-shadow: none !important;
    }
  }
`
