import { exportFormattedListExcel } from '../../../utils/exportListExcel.js'
import { getProductStatusMeta } from './productDisplay.js'
import { getInventoryUnitLabel, getProductTypeLabel } from './productTypes.js'

const MAX_EXPORT_ROWS = 10_000

const WAREHOUSE_HEADERS = [
  'Mã SKU',
  'Tên sản phẩm',
  'Biến thể',
  'Nhóm hàng',
  'Loại hàng',
  'Đơn vị tồn',
  'Barcode',
  'Giá vốn',
  'Giá bán',
  'Tồn kho tổng',
  'Tồn cửa hàng',
  'Trạng thái',
  'Được bán',
]

const STORE_HEADERS = [
  'Mã SKU',
  'Tên sản phẩm',
  'Quy cách / biến thể',
  'Nhóm hàng',
  'Barcode',
  'Giá vốn',
  'Giá bán',
  'Tồn cửa hàng',
  'Tồn giữ chỗ',
  'Ngưỡng kệ',
  'Bán POS',
  'Trạng thái',
]

function variantLabel(sku, productName) {
  if (!sku) return ''
  const name = String(sku.variantName || sku.packagingType || '').trim()
  if (!name) return sku.skuCode || ''
  const prefix = productName ? `${productName} - ` : ''
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

function statusLabel(isActive, isDeleted = false) {
  return getProductStatusMeta(isActive !== false, Boolean(isDeleted)).label
}

/**
 * Xuất danh sách SKU trang Sản phẩm & số lượng (view kho).
 * @param {object} options
 * @param {Array<{ product: object, sku: object|null }>} options.rows
 * @param {Map<string|number, number>} [options.warehouseStockBySkuId]
 * @param {Map<string|number, number>} [options.storeStockBySkuId]
 * @param {string} [options.filename]
 * @param {string} [options.subtitle]
 */
export async function exportWarehouseProductsListExcel({
  rows = [],
  warehouseStockBySkuId = new Map(),
  storeStockBySkuId = new Map(),
  filename = 'San_Pham_Kho',
  subtitle,
} = {}) {
  const limited = rows.slice(0, MAX_EXPORT_ROWS)
  const excelRows = limited.map((row) => {
    const product = row.product || {}
    const sku = row.sku
    const skuId = sku?.id
    const warehouseQty = skuId != null ? Number(warehouseStockBySkuId.get(skuId) ?? 0) : 0
    const storeQty = skuId != null ? Number(storeStockBySkuId.get(skuId) ?? 0) : 0
    const sellable = sku ? sku.isSellable !== false : null

    return [
      sku?.skuCode || '',
      product.name || '',
      variantLabel(sku, product.name),
      product.categoryName || '',
      getProductTypeLabel(product.productType),
      getInventoryUnitLabel(product.inventoryUnit) || product.inventoryUnit || '',
      sku?.barcode || '',
      sku ? Number(sku.costPrice) || 0 : '',
      sku && sellable ? Number(sku.retailPrice) || 0 : '',
      sku ? warehouseQty : '',
      sku ? storeQty : '',
      statusLabel(product.isActive !== false && sku?.isActive !== false, product.isDeleted),
      sku == null ? '' : sellable ? 'Có' : 'Không',
    ]
  })

  await exportFormattedListExcel({
    sheetName: 'Sản phẩm kho',
    title: 'Danh sách sản phẩm & số lượng (kho)',
    subtitle,
    headers: WAREHOUSE_HEADERS,
    rows: excelRows,
    columnWidths: [16, 28, 22, 18, 14, 12, 16, 12, 12, 14, 14, 12, 10],
    moneyColumns: [7, 8],
    integerColumns: [9, 10],
    filename,
  })
}

/**
 * Xuất danh sách SKU trang Hàng hóa (view cửa hàng).
 * @param {object} options
 * @param {Array<object>} options.skus
 * @param {Map<string|number, number>} [options.stockBySkuId]
 * @param {Map<string|number, number>} [options.reservedBySkuId]
 * @param {Map<string|number, number>} [options.shelfThresholdBySkuId]
 * @param {string} [options.filename]
 * @param {string} [options.subtitle]
 */
export async function exportStoreProductsListExcel({
  skus = [],
  stockBySkuId = new Map(),
  reservedBySkuId = new Map(),
  shelfThresholdBySkuId = new Map(),
  filename = 'Hang_Hoa_Cua_Hang',
  subtitle,
} = {}) {
  const limited = skus.slice(0, MAX_EXPORT_ROWS)
  const excelRows = limited.map((sku) => {
    const stockQty = Number(stockBySkuId.get(sku.id) ?? 0)
    const reservedQty = Number(reservedBySkuId.get(sku.id) ?? 0)
    const threshold = Number(shelfThresholdBySkuId.get(sku.id) ?? 0)
    const sellable = sku.isSellable !== false && sku.isDirectSell !== false

    return [
      sku.skuCode || '',
      sku.productName || '',
      variantLabel(sku, sku.productName),
      sku.categoryName || '',
      sku.barcode || '',
      Number(sku.costPrice) || 0,
      sellable ? Number(sku.retailPrice ?? sku.basePrice) || 0 : '',
      stockQty,
      reservedQty,
      threshold,
      sellable ? 'Có' : 'Không',
      statusLabel(sku.isActive !== false, false),
    ]
  })

  await exportFormattedListExcel({
    sheetName: 'Hàng hóa cửa hàng',
    title: 'Danh sách hàng hóa cửa hàng',
    subtitle,
    headers: STORE_HEADERS,
    rows: excelRows,
    columnWidths: [16, 28, 22, 18, 16, 12, 12, 14, 12, 12, 10, 12],
    moneyColumns: [5, 6],
    integerColumns: [7, 8, 9],
    filename,
  })
}
