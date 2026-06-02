/** CSS dùng trong iframe in — đồng bộ class với paymentReceipt.css */
export const RECEIPT_PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  body {
    display: flex;
    justify-content: center;
    padding: 0;
  }
  .receipt-paper {
    width: 72mm;
    max-width: 72mm;
    padding: 4mm 3mm 6mm;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.35;
  }
  .receipt-brand {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  .receipt-title {
    margin-top: 4px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
  }
  .receipt-meta {
    text-align: center;
    font-size: 10px;
    color: #333;
  }
  .receipt-divider {
    margin: 8px 0;
    border: none;
    border-top: 1px dashed #000;
  }
  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 3px;
    font-size: 10px;
  }
  .receipt-label { flex-shrink: 0; color: #444; }
  .receipt-value { text-align: right; word-break: break-word; }
  .receipt-highlight { font-weight: 700; }
  .receipt-item { margin-bottom: 8px; }
  .receipt-item-name {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-word;
  }
  .receipt-item-line {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin-top: 2px;
    font-size: 10px;
  }
  .receipt-item-total { flex-shrink: 0; font-weight: 700; }
  .receipt-item-sku { margin-top: 1px; font-size: 9px; color: #555; }
  .receipt-total-row {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 2px;
    font-size: 10px;
  }
  .receipt-total-row.receipt-grand {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid #000;
    font-size: 12px;
    font-weight: 700;
  }
  .receipt-total-row.receipt-debt { font-weight: 700; }
  .receipt-thanks {
    margin-top: 4px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
  }
  .receipt-footer-note {
    margin-top: 2px;
    text-align: center;
    font-size: 9px;
    color: #555;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  @media print {
    body { padding: 0; }
    .receipt-paper {
      width: 72mm;
      max-width: 72mm;
    }
  }
`
