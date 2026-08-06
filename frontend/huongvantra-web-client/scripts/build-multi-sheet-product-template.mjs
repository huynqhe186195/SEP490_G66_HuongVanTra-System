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
    { categoryDisplay: 'Trà xanh Tân Cương Thái Nguyên', productType: 'THANH_PHAM' },
    { categoryDisplay: 'Set Quà Cao Cấp', productType: 'THANH_PHAM' },
    { categoryDisplay: 'Kẹo Trà', productType: 'THANH_PHAM' },
    { categoryDisplay: 'Dụng Cụ Trà', productType: 'THANH_PHAM' },
    { categoryDisplay: 'Hoa Trà Sáng Tạo', productType: 'THANH_PHAM' },
    { categoryDisplay: 'Trà nguyên liệu', productType: 'NGUYEN_LIEU' },
    { categoryDisplay: 'Bao bì sản xuất', productType: 'BAO_BI' },
  ],
  componentSkus: [
    { skuCode: 'NL-TRA-XANH-G', display: 'NL-TRA-XANH-G — Trà xanh thô Tân Cương — g' },
    { skuCode: 'NL-HONG-TRA-G', display: 'NL-HONG-TRA-G — Hồng trà thô Hương Vân — g' },
    { skuCode: 'BB-HOP-GIAY-HVT', display: 'BB-HOP-GIAY-HVT — Hộp giấy Hương Vân — Cái' },
  ],
  attributeNames: [
    { attributeName: 'Hương vị' },
    { attributeName: 'Xuất xứ' },
    { attributeName: 'Đóng gói' },
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
