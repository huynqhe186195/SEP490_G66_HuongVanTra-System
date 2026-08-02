/**
 * Regenerates multi-sheet templates with real Excel colors (OOXML style inject).
 * Run: node scripts/build-multi-sheet-product-template.mjs
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  PRODUCT_CREATION_SAMPLE_FILENAME,
  buildMultiSheetProductCreationWorkbookBuffer,
} from '../src/features/products/utils/productCreationExcelMultiSheet.js'
import { injectXlsxWorkbookColors } from '../src/features/utils/xlsxColorInject.js'
import { buildSupplierProductsWorkbookBuffer } from '../src/features/inventory/utils/supplierProductsExcel.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, '..', 'public', 'templates')

const referenceData = {
  categories: [
    { categoryDisplay: 'Trà', productType: 'THANH_PHAM' },
  ],
  componentSkus: [
    { skuCode: 'LA-TRA-SEN-G', display: 'LA-TRA-SEN-G — Lá trà sen — g' },
    { skuCode: 'LY-GIAY-350', display: 'LY-GIAY-350 — Ly giấy 350ml — Cái' },
  ],
  attributeNames: [
    { attributeName: 'Hương vị' },
    { attributeName: 'Size' },
    { attributeName: 'Dung tích' },
  ],
}

const templatePath = join(templatesDir, 'FileMau_YeuCauTaoHangHoaMoi.xlsx')
const samplePath = join(templatesDir, PRODUCT_CREATION_SAMPLE_FILENAME)

const template = await injectXlsxWorkbookColors(
  buildMultiSheetProductCreationWorkbookBuffer(referenceData, [], { mode: 'template' }),
  { kind: 'productCreation' },
)
const sample = await injectXlsxWorkbookColors(
  buildMultiSheetProductCreationWorkbookBuffer(referenceData, [], { mode: 'sample' }),
  { kind: 'productCreation' },
)

writeFileSync(templatePath, Buffer.from(template))
writeFileSync(samplePath, Buffer.from(sample))
writeFileSync(
  join(templatesDir, 'Mau_Danh_Muc_Hang_Cung_Ung.xlsx'),
  Buffer.from(await buildSupplierProductsWorkbookBuffer([], 'template')),
)
writeFileSync(
  join(templatesDir, 'Mau_Danh_Muc_Hang_Cung_Ung_CoDuLieu.xlsx'),
  Buffer.from(await buildSupplierProductsWorkbookBuffer([], 'sample')),
)

console.log('Wrote', templatePath)
console.log('Wrote', samplePath)
console.log('Wrote supplier product templates')
console.log('Note: dropdowns are injected when user downloads product-creation files from the web app.')
