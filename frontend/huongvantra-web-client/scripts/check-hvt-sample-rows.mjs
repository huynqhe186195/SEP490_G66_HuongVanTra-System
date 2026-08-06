/**
 * Kiểm tra dữ liệu mẫu Hương Vân theo đúng ràng buộc của trình import:
 * quy đổi nguyên dương, đúng 1 đơn vị cơ bản, giá SKU quy đổi = giá base × quy đổi,
 * mã SKU duy nhất và BOM chỉ tham chiếu SKU nguyên liệu / bao bì có trong file.
 * Run: node scripts/check-hvt-sample-rows.mjs
 */
import { richSampleProductRows } from '../src/features/products/utils/productCreationExcelMultiSheet.js'

const { products, skus, boms } = richSampleProductRows()
const errors = []

const skusByProduct = new Map()
skus.forEach((sku) => {
  if (!skusByProduct.has(sku.productKey)) skusByProduct.set(sku.productKey, [])
  skusByProduct.get(sku.productKey).push(sku)
})

const seenCodes = new Set()
skus.forEach((sku) => {
  const code = String(sku.skuCode || '').trim().toUpperCase()
  if (!code) errors.push(`${sku.skuRef}: thiếu mã SKU.`)
  if (seenCodes.has(code)) errors.push(`${code}: mã SKU bị trùng.`)
  seenCodes.add(code)

  const rate = Number(sku.conversionRate)
  if (!Number.isInteger(rate) || rate <= 0) {
    errors.push(`${sku.skuCode}: Quy đổi ${sku.conversionRate} không phải số nguyên dương.`)
  }
})

products.forEach((product) => {
  const rows = skusByProduct.get(product.productKey) ?? []
  if (!rows.length) {
    errors.push(`${product.productKey}: không có SKU nào.`)
    return
  }
  const baseRows = rows.filter((sku) => sku.isBaseUnit === 'Có')
  if (baseRows.length !== 1) {
    errors.push(`${product.productKey}: cần đúng 1 đơn vị cơ bản, đang có ${baseRows.length}.`)
    return
  }
  const base = baseRows[0]
  if (Number(base.conversionRate) !== 1) {
    errors.push(`${base.skuCode}: đơn vị cơ bản phải có Quy đổi = 1.`)
  }
  if (base.isSellable === 'Có' && Number(base.retailPrice) <= 0) {
    errors.push(`${base.skuCode}: SKU cơ bản bán trực tiếp cần giá > 0.`)
  }
  rows.filter((sku) => sku !== base).forEach((sku) => {
    const expected = Number(base.retailPrice) * Number(sku.conversionRate)
    if (Number(sku.retailPrice) !== expected) {
      errors.push(`${sku.skuCode}: giá ${sku.retailPrice} ≠ giá base × quy đổi (${expected}).`)
    }
  })
})

boms.forEach((line) => {
  if (!seenCodes.has(String(line.componentSku || '').trim().toUpperCase())) {
    errors.push(`${line.productKey}: BOM tham chiếu SKU không tồn tại (${line.componentSku}).`)
  }
  if (!(Number(line.bomQuantity) > 0)) {
    errors.push(`${line.productKey}: BOM ${line.componentSku} có định lượng không hợp lệ.`)
  }
})

const componentCodes = new Set(
  skus.filter((sku) => sku.isSellable === 'Không').map((sku) => sku.skuCode),
)
const unusedComponents = [...componentCodes].filter(
  (code) => !boms.some((line) => line.componentSku === code),
)

console.log(`Sản phẩm: ${products.length} | SKU: ${skus.length} | Dòng BOM: ${boms.length}`)
if (unusedComponents.length) console.log('Nguyên liệu/bao bì chưa dùng trong BOM:', unusedComponents.join(', '))

if (errors.length) {
  console.error(`\nCó ${errors.length} lỗi:`)
  errors.forEach((message) => console.error(' -', message))
  process.exit(1)
}
console.log('\nDữ liệu mẫu hợp lệ với ràng buộc import.')
