import fs from 'fs';
import { parseSupplierReceiptTt200Excel } from './src/features/inventory/utils/supplierReceiptTt200Excel.js';

const paths = [
  'c:/Users/Simon/Downloads/phieu-nhap-kho-excel-tt200-co-du-lieu.xlsx',
  'D:/SEP490_G66_HuongVanTra-System/frontend/huongvantra-web-client/public/templates/phieu-nhap-kho-excel-tt200-co-du-lieu.xlsx',
];

for (const p of paths) {
  const buf = fs.readFileSync(p);
  const result = parseSupplierReceiptTt200Excel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log('===', p);
  console.log('errors', result.errors);
  console.log('headerPatch', JSON.stringify(result.headerPatch, null, 2));
  console.log('skuCodes', result.rawLines.map((l) => l.skuCode));
  console.log('lines', result.rawLines.map((l) => ({ sku: l.skuCode, qty: l.actualQuantity, unit: l.submittedUnit, cost: l.unitCost, lot: l.lotCode, mfg: l.manufacturedAt, exp: l.expiresAt, name: l.nameHint })));
  console.log('');
}
