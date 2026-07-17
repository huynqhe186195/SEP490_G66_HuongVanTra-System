import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { searchMaterials } from '../services/bomApi.js'
import {
  approveProductCreationRequest,
  cancelProductCreationRequest,
  createProductCreationRequest,
  fetchProductCreationRequests,
  rejectProductCreationRequest,
  submitProductCreationRequest,
  updateProductCreationRequest,
} from '../services/productsApi.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'
import {
  INVENTORY_UNIT_OPTIONS,
  PRODUCT_TYPE,
  PRODUCT_TYPE_OPTIONS,
  getDefaultSellableByType,
  getInventoryUnitShortLabel,
  getProductTypeLabel,
} from '../utils/productTypes.js'

const STATUS_LABELS = {
  Draft: 'Nháp',
  PendingApproval: 'Chờ Admin duyệt',
  Rejected: 'Bị từ chối',
  Completed: 'Đã tạo hàng hóa',
  Cancelled: 'Đã hủy',
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'co', 'có', 'x'])

function createDraftProduct() {
  const key = `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    clientKey: key,
    variantClientKey: `${key}-sku`,
    name: '',
    productType: PRODUCT_TYPE.THANH_PHAM,
    categoryId: '',
    baseUnit: 'gói',
    inventoryUnit: 'Piece',
    skuCode: '',
    variantName: '',
    retailPrice: '',
    costPrice: '0',
    minStock: '0',
    maxStock: '',
    isSellable: true,
    bomLines: [],
  }
}

function isAdmin(session) {
  return (session?.roles ?? []).some((role) => String(role).toLowerCase() === 'admin')
}

function isWarehouse(session) {
  return (session?.roles ?? []).some((role) => String(role).toLowerCase() === 'warehouse')
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value
  const text = normalizeText(value).toLowerCase()
  if (!text) return fallback
  return TRUE_VALUES.has(text)
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '—'
}

function getMaterialUnit(material) {
  const inventoryUnit = getInventoryUnitShortLabel(material?.inventoryUnit)
  if (inventoryUnit) return inventoryUnit

  const baseUnit = material?.units?.find((unit) => unit.isBaseUnit) || material?.units?.[0]
  return material?.materialUnitName || material?.baseUnit || baseUnit?.unitName || ''
}

function getMaterialLabel(material) {
  if (!material) return ''
  const firstVariant = material.variants?.[0] || material.skus?.[0]
  const skuCode = firstVariant?.skuCode ? ` · ${firstVariant.skuCode}` : ''
  const unit = getMaterialUnit(material) ? ` (${getMaterialUnit(material)})` : ''
  return `${material.name}${skuCode}${unit}`
}

function createBomLineFromMaterial(material, quantity = 1) {
  return {
    materialId: material.id,
    materialName: material.name,
    materialUnitName: getMaterialUnit(material),
    quantity,
  }
}

function normalizeBomLine(line, materialsById) {
  const materialId = line.materialId ?? line.material_id ?? line.MaterialId
  const material = materialId ? materialsById.get(String(materialId)) : null
  return {
    materialId,
    materialName: line.materialName ?? line.MaterialName ?? material?.name ?? '',
    materialUnitName:
      line.materialUnitName ??
      line.MaterialUnitName ??
      line.baseUnit ??
      line.BaseUnit ??
      getMaterialUnit(material),
    quantity: numberOrNull(line.quantity ?? line.Quantity) ?? 1,
  }
}

function toProductPayload(row) {
  const retailPrice = numberOrNull(row.retailPrice) ?? 0
  const costPrice = numberOrNull(row.costPrice) ?? 0
  const baseUnit = row.baseUnit || 'unit'
  const isSellable = Boolean(row.isSellable)
  const isFinishedProduct = row.productType === PRODUCT_TYPE.THANH_PHAM

  return {
    categoryId: Number(row.categoryId),
    name: row.name.trim(),
    origin: '',
    flavorProfile: '',
    brewingGuide: '',
    description: '',
    baseUnit,
    inventoryUnit: row.inventoryUnit || 'Piece',
    weightValue: null,
    weightUnit: null,
    isVariantParent: true,
    productType: row.productType,
    images: [],
    units: [
      {
        unitName: baseUnit,
        conversionRate: 1,
        price: retailPrice > 0 ? retailPrice : null,
        barcode: '',
        isDirectSell: isSellable,
        isBaseUnit: true,
      },
    ],
    variants: [
      {
        skuCode: row.skuCode.trim().toUpperCase(),
        barcode: '',
        variantName: row.variantName.trim() || row.name.trim(),
        optionValuesJson: '{}',
        costPrice,
        retailPrice,
        minStock: numberOrNull(row.minStock),
        maxStock: numberOrNull(row.maxStock),
        isSellable,
        allowRewardPoints: true,
        isActive: true,
        imageUrl: '',
        units: [],
        bomLines: isFinishedProduct
          ? row.bomLines
            .filter((line) => line.materialId && Number(line.quantity) > 0)
            .map((line) => ({ materialId: line.materialId, quantity: Number(line.quantity) }))
          : [],
      },
    ],
    variantGenerator: null,
  }
}

function fromProductSnapshot(item, materialsById) {
  const product = item.productSnapshot ?? {}
  const variant = product.variants?.[0] ?? {}
  const bomLines = Array.isArray(variant.bomLines)
    ? variant.bomLines.map((line) => normalizeBomLine(line, materialsById))
    : []

  return {
    clientKey: item.clientKey || `item-${Date.now()}`,
    variantClientKey: variant.skuCode || `${item.clientKey || Date.now()}-sku`,
    name: product.name || '',
    productType: product.productType || PRODUCT_TYPE.THANH_PHAM,
    categoryId: product.categoryId ? String(product.categoryId) : '',
    baseUnit: product.baseUnit || 'gói',
    inventoryUnit: product.inventoryUnit || 'Piece',
    skuCode: variant.skuCode || '',
    variantName: variant.variantName || '',
    retailPrice: String(variant.retailPrice ?? ''),
    costPrice: String(variant.costPrice ?? 0),
    minStock: String(variant.minStock ?? 0),
    maxStock: variant.maxStock == null ? '' : String(variant.maxStock),
    isSellable: variant.isSellable !== false,
    bomLines,
  }
}

function validateForm(title, rows) {
  const errors = []
  if (!title.trim()) errors.push('Tiêu đề yêu cầu là bắt buộc.')
  if (!rows.length) errors.push('Cần ít nhất một sản phẩm.')

  const skuCodes = new Set()
  const names = new Set()
  rows.forEach((row, index) => {
    const prefix = `Sản phẩm ${index + 1}`
    const isFinishedProduct = row.productType === PRODUCT_TYPE.THANH_PHAM
    if (!row.name.trim()) errors.push(`${prefix}: thiếu tên sản phẩm.`)
    if (!row.categoryId) errors.push(`${prefix}: thiếu danh mục.`)
    if (!row.skuCode.trim()) errors.push(`${prefix}: thiếu SKU.`)
    if (row.name.trim()) {
      const nameKey = row.name.trim().toLowerCase()
      if (names.has(nameKey)) errors.push(`${prefix}: tên sản phẩm bị trùng trong yêu cầu.`)
      names.add(nameKey)
    }
    if (row.skuCode.trim()) {
      const skuKey = row.skuCode.trim().toUpperCase()
      if (skuCodes.has(skuKey)) errors.push(`${prefix}: SKU bị trùng trong yêu cầu.`)
      skuCodes.add(skuKey)
    }
    if (Number(row.retailPrice) <= 0 && row.isSellable) errors.push(`${prefix}: SKU bán trực tiếp cần giá bán > 0.`)
    if (!isFinishedProduct && row.bomLines.length > 0) errors.push(`${prefix}: BOM chỉ áp dụng cho Sản phẩm kệ.`)

    const materialIds = new Set()
    row.bomLines.forEach((line, lineIndex) => {
      const linePrefix = `${prefix}, BOM ${lineIndex + 1}`
      if (!line.materialId) errors.push(`${linePrefix}: thiếu Nguyên liệu/Bao bì.`)
      if (line.materialId && materialIds.has(String(line.materialId))) errors.push(`${linePrefix}: component bị trùng.`)
      if (line.materialId) materialIds.add(String(line.materialId))
      if (Number(line.quantity) <= 0) errors.push(`${linePrefix}: định mức phải lớn hơn 0.`)
    })
  })

  return errors
}

function workbookRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function firstCell(row, names) {
  for (const name of names) {
    const value = row[name]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function parseProductCreationWorkbook(workbook, materialsById) {
  const productRows = workbookRows(workbook, 'Products')
  const variantRows = workbookRows(workbook, 'Variants')
  const bomRows = workbookRows(workbook, 'BOM')
  const errors = []

  if (!productRows.length) errors.push('Sheet Products không có dữ liệu.')
  if (!variantRows.length) errors.push('Sheet Variants không có dữ liệu.')

  const productsByKey = new Map()
  productRows.forEach((row, index) => {
    const productClientKey = normalizeText(firstCell(row, ['ProductClientKey', 'ProductKey']))
    if (!productClientKey) {
      errors.push(`Products dòng ${index + 2}: thiếu ProductClientKey.`)
      return
    }
    if (productsByKey.has(productClientKey)) errors.push(`Products dòng ${index + 2}: ProductClientKey bị trùng.`)
    productsByKey.set(productClientKey, { row, index, variants: [] })
  })

  const variantsByKey = new Map()
  variantRows.forEach((row, index) => {
    const productClientKey = normalizeText(firstCell(row, ['ProductClientKey', 'ProductKey']))
    const variantClientKey = normalizeText(firstCell(row, ['VariantClientKey', 'VariantKey']))
    if (!productClientKey) errors.push(`Variants dòng ${index + 2}: thiếu ProductClientKey.`)
    if (!variantClientKey) errors.push(`Variants dòng ${index + 2}: thiếu VariantClientKey.`)
    if (!productsByKey.has(productClientKey)) errors.push(`Variants dòng ${index + 2}: ProductClientKey không tồn tại trong Products.`)
    if (variantClientKey && variantsByKey.has(variantClientKey)) errors.push(`Variants dòng ${index + 2}: VariantClientKey bị trùng.`)

    const product = productsByKey.get(productClientKey)
    if (product && variantClientKey) {
      const variant = { row, index, bomLines: [] }
      product.variants.push(variant)
      variantsByKey.set(variantClientKey, variant)
    }
  })

  bomRows.forEach((row, index) => {
    const variantClientKey = normalizeText(firstCell(row, ['VariantClientKey', 'VariantKey']))
    const materialId = normalizeText(firstCell(row, ['MaterialId', 'MaterialProductId']))
    const quantity = numberOrNull(firstCell(row, ['Quantity', 'BomQuantity']))
    if (!variantClientKey) errors.push(`BOM dòng ${index + 2}: thiếu VariantClientKey.`)
    if (!materialId) errors.push(`BOM dòng ${index + 2}: thiếu MaterialId.`)
    if (!quantity || quantity <= 0) errors.push(`BOM dòng ${index + 2}: Quantity phải lớn hơn 0.`)
    if (variantClientKey && !variantsByKey.has(variantClientKey)) errors.push(`BOM dòng ${index + 2}: VariantClientKey không tồn tại.`)

    const variant = variantsByKey.get(variantClientKey)
    if (variant && materialId && quantity && quantity > 0) {
      const material = materialsById.get(materialId)
      variant.bomLines.push({
        materialId,
        materialName: material?.name ?? '',
        materialUnitName: getMaterialUnit(material),
        quantity,
      })
    }
  })

  const rows = Array.from(productsByKey.values()).flatMap((productEntry) => {
    if (productEntry.variants.length === 0) {
      errors.push(`Products dòng ${productEntry.index + 2}: cần ít nhất một SKU trong sheet Variants.`)
      return []
    }

    if (productEntry.variants.length > 1) {
      errors.push(`Products dòng ${productEntry.index + 2}: UI hiện hỗ trợ 1 SKU cho mỗi product item trong request.`)
      return []
    }

    const productRow = productEntry.row
    const variantEntry = productEntry.variants[0]
    const variantRow = variantEntry.row
    const productType = normalizeText(firstCell(productRow, ['ProductType'])) || PRODUCT_TYPE.THANH_PHAM
    const productKey = normalizeText(firstCell(productRow, ['ProductClientKey', 'ProductKey']))
    const variantKey = normalizeText(firstCell(variantRow, ['VariantClientKey', 'VariantKey']))
    return [{
      ...createDraftProduct(),
      clientKey: productKey,
      variantClientKey: variantKey,
      name: normalizeText(firstCell(productRow, ['ProductName', 'Name'])),
      productType,
      categoryId: normalizeText(firstCell(productRow, ['CategoryId'])),
      baseUnit: normalizeText(firstCell(productRow, ['BaseUnit'])) || 'gói',
      inventoryUnit: normalizeText(firstCell(productRow, ['InventoryUnit'])) || 'Piece',
      skuCode: normalizeText(firstCell(variantRow, ['SkuCode', 'SKU'])).toUpperCase(),
      variantName: normalizeText(firstCell(variantRow, ['VariantName', 'SkuName'])),
      retailPrice: String(firstCell(variantRow, ['RetailPrice', 'Price']) || ''),
      costPrice: String(firstCell(variantRow, ['CostPrice']) || '0'),
      minStock: String(firstCell(variantRow, ['MinStock']) || '0'),
      maxStock: String(firstCell(variantRow, ['MaxStock']) || ''),
      isSellable: normalizeBoolean(firstCell(variantRow, ['IsSellable']), getDefaultSellableByType(productType)),
      bomLines: productType === PRODUCT_TYPE.THANH_PHAM ? variantEntry.bomLines : [],
    }]
  })

  return { rows, errors }
}

function buildTemplateWorkbook() {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Hướng dẫn'],
    ['1. Điền Products trước, mỗi ProductClientKey là một sản phẩm trong request.'],
    ['2. Điền Variants, hiện UI hỗ trợ 1 SKU cho mỗi ProductClientKey.'],
    ['3. Điền BOM cho Sản phẩm kệ bằng MaterialId của Nguyên liệu/Bao bì đã có.'],
    ['4. Import chỉ nạp vào Draft UI; backend sẽ validate lại khi Submit/Approve.'],
  ]), 'Instructions')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {
      ProductClientKey: 'P001',
      ProductName: 'Trà nhài túi 50g',
      ProductType: 'THANH_PHAM',
      CategoryId: 1,
      BaseUnit: 'gói',
      InventoryUnit: 'Piece',
    },
  ]), 'Products')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {
      ProductClientKey: 'P001',
      VariantClientKey: 'V001',
      SkuCode: 'FG-TRA-NHAI-50G',
      VariantName: 'Gói 50g',
      RetailPrice: 75000,
      CostPrice: 0,
      MinStock: 0,
      MaxStock: '',
      IsSellable: true,
    },
  ]), 'Variants')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {
      VariantClientKey: 'V001',
      MaterialId: '',
      Quantity: 50,
    },
  ]), 'BOM')
  return wb
}

function exportRowsToWorkbook({ title, warehouseNote, rows }) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Title: title, WarehouseNote: warehouseNote }]), 'Request')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((row) => ({
    ProductClientKey: row.clientKey,
    ProductName: row.name,
    ProductType: row.productType,
    CategoryId: row.categoryId,
    BaseUnit: row.baseUnit,
    InventoryUnit: row.inventoryUnit,
  }))), 'Products')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((row) => ({
    ProductClientKey: row.clientKey,
    VariantClientKey: row.variantClientKey,
    SkuCode: row.skuCode,
    VariantName: row.variantName,
    RetailPrice: row.retailPrice,
    CostPrice: row.costPrice,
    MinStock: row.minStock,
    MaxStock: row.maxStock,
    IsSellable: row.isSellable,
  }))), 'Variants')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.flatMap((row) => row.bomLines.map((line) => ({
    VariantClientKey: row.variantClientKey,
    MaterialId: line.materialId,
    MaterialName: line.materialName,
    Quantity: line.quantity,
  })))), 'BOM')
  return wb
}

function ProductRow({ row, categories, materials, onChange, onRemove, canRemove }) {
  const isFinishedProduct = row.productType === PRODUCT_TYPE.THANH_PHAM
  const availableMaterials = materials.filter(
    (material) => !row.bomLines.some((line) => String(line.materialId) === String(material.id)),
  )

  function addMaterial(materialId) {
    const material = materials.find((item) => String(item.id) === String(materialId))
    if (!material) return
    onChange({ bomLines: [...row.bomLines, createBomLineFromMaterial(material)] })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold text-slate-500">
          Tên sản phẩm
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Loại hàng
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={row.productType}
            onChange={(event) => {
              const productType = event.target.value
              onChange({
                productType,
                isSellable: getDefaultSellableByType(productType),
                bomLines: productType === PRODUCT_TYPE.THANH_PHAM ? row.bomLines : [],
              })
            }}
          >
            {PRODUCT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Danh mục
          <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })}>
            <option value="">Chọn danh mục</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Đơn vị tồn kho
          <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.inventoryUnit} onChange={(event) => onChange({ inventoryUnit: event.target.value })}>
            {INVENTORY_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-6">
        <label className="text-xs font-semibold text-slate-500">
          Đơn vị gốc
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.baseUnit} onChange={(event) => onChange({ baseUnit: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-500 md:col-span-2">
          SKU
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase" value={row.skuCode} onChange={(event) => onChange({ skuCode: event.target.value.toUpperCase() })} />
        </label>
        <label className="text-xs font-semibold text-slate-500 md:col-span-2">
          Tên SKU/Biến thể
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.variantName} onChange={(event) => onChange({ variantName: event.target.value })} />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={row.isSellable} onChange={(event) => onChange({ isSellable: event.target.checked })} />
          Bán trực tiếp
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold text-slate-500">
          Giá bán
          <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.retailPrice} onChange={(event) => onChange({ retailPrice: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Giá vốn
          <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.costPrice} onChange={(event) => onChange({ costPrice: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Tồn tối thiểu
          <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.minStock} onChange={(event) => onChange({ minStock: event.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Tồn tối đa
          <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.maxStock} onChange={(event) => onChange({ maxStock: event.target.value })} />
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">BOM cho SKU</p>
            <p className="text-xs text-slate-500">Chỉ áp dụng cho Sản phẩm kệ. Backend sẽ validate lại component Nguyên liệu/Bao bì khi submit.</p>
          </div>
          {isFinishedProduct ? (
            <select
              className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value=""
              onChange={(event) => addMaterial(event.target.value)}
            >
              <option value="">Thêm Nguyên liệu/Bao bì</option>
              {availableMaterials.map((material) => <option key={material.id} value={material.id}>{getMaterialLabel(material)}</option>)}
            </select>
          ) : null}
        </div>
        {!isFinishedProduct ? (
          <p className="mt-3 text-xs text-slate-400">Nguyên liệu và Bao bì không cấu hình BOM đầu ra.</p>
        ) : null}
        {isFinishedProduct && row.bomLines.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">Chưa có component BOM trong draft.</p>
        ) : null}
        {isFinishedProduct && row.bomLines.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Nguyên liệu/Bao bì</th>
                  <th className="py-2 pr-3">Định mức</th>
                  <th className="py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {row.bomLines.map((line, index) => (
                  <tr key={`${line.materialId}-${index}`}>
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-slate-700">{line.materialName || line.materialId}</p>
                      <p className="font-mono text-[11px] text-slate-400">{line.materialId}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={line.quantity}
                          onChange={(event) => onChange({
                            bomLines: row.bomLines.map((current, currentIndex) => (
                              currentIndex === index ? { ...current, quantity: event.target.value } : current
                            )),
                          })}
                        />
                        <span className="text-slate-500">{line.materialUnitName || 'đơn vị'}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="font-semibold text-rose-600"
                        onClick={() => onChange({ bomLines: row.bomLines.filter((_, currentIndex) => currentIndex !== index) })}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end">
        <button type="button" disabled={!canRemove} onClick={onRemove} className="font-semibold text-rose-600 disabled:opacity-40">Xóa sản phẩm</button>
      </div>
    </div>
  )
}

export default function ProductApprovalsPage() {
  const session = useAuthSession()
  const admin = isAdmin(session)
  const warehouse = isWarehouse(session)
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [materials, setMaterials] = useState([])
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [activeRequestCode, setActiveRequestCode] = useState('')
  const [title, setTitle] = useState('')
  const [warehouseNote, setWarehouseNote] = useState('')
  const [rows, setRows] = useState([createDraftProduct()])
  const [statusFilter, setStatusFilter] = useState('all')
  const [importErrors, setImportErrors] = useState([])

  const materialsById = useMemo(() => new Map(materials.map((material) => [String(material.id), material])), [materials])

  const loadRequests = useCallback(async (nextStatus) => {
    setIsLoading(true)
    try {
      const result = await fetchProductCreationRequests({ status: nextStatus, page: 1, pageSize: 50 })
      setRequests(result.items)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      Promise.all([
        fetchCategories({ isDeleted: false }),
        searchMaterials('', 100),
        fetchProductCreationRequests({ status: 'all', page: 1, pageSize: 50 }),
      ])
        .then(([categoryItems, materialItems, requestResult]) => {
          if (cancelled) return
          setCategories(categoryItems)
          setMaterials(materialItems)
          setRequests(requestResult.items)
        })
        .catch((error) => showError(error.message))
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  function updateRow(index, changes) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row)))
  }

  function resetForm() {
    setActiveRequestId(null)
    setActiveRequestCode('')
    setTitle('')
    setWarehouseNote('')
    setRows([createDraftProduct()])
    setImportErrors([])
  }

  function loadIntoForm(request) {
    setActiveRequestId(request.id)
    setActiveRequestCode(request.requestCode)
    setTitle(request.title)
    setWarehouseNote(request.warehouseNote || '')
    setRows(request.items.length ? request.items.map((item) => fromProductSnapshot(item, materialsById)) : [createDraftProduct()])
    setImportErrors([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveDraft({ showToast = true } = {}) {
    const errors = validateForm(title, rows)
    if (errors.length) {
      showError(errors[0])
      return null
    }

    setIsSaving(true)
    try {
      const payload = { title, warehouseNote, items: rows.map((row) => ({ clientKey: row.clientKey, product: toProductPayload(row) })) }
      const saved = activeRequestId
        ? await updateProductCreationRequest(activeRequestId, payload)
        : await createProductCreationRequest(payload)
      setActiveRequestId(saved.id)
      setActiveRequestCode(saved.requestCode)
      if (showToast) showSuccess('Đã lưu yêu cầu tạo hàng hóa.')
      await loadRequests(statusFilter)
      return saved
    } catch (error) {
      showError(error.message)
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit() {
    const saved = await saveDraft({ showToast: false })
    if (!saved?.id) return

    setIsSaving(true)
    try {
      await submitProductCreationRequest(saved.id, warehouseNote)
      showSuccess('Đã gửi yêu cầu cho Admin duyệt.')
      resetForm()
      await loadRequests(statusFilter)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDecision(request, action) {
    const reason = action === 'approve' ? '' : window.prompt(action === 'reject' ? 'Nhập lý do từ chối:' : 'Nhập lý do hủy:')
    if (action !== 'approve' && !String(reason || '').trim()) return

    setIsSaving(true)
    try {
      if (action === 'approve') await approveProductCreationRequest(request.id, '')
      if (action === 'reject') await rejectProductCreationRequest(request.id, reason, '')
      if (action === 'cancel') await cancelProductCreationRequest(request.id, reason, '')
      showSuccess('Đã cập nhật yêu cầu.')
      await loadRequests(statusFilter)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function downloadTemplate() {
    XLSX.writeFile(buildTemplateWorkbook(), 'Mau_ProductCreationRequest.xlsx')
  }

  function exportCurrentDraft() {
    const errors = validateForm(title || 'Yêu cầu tạo hàng hóa', rows)
    if (errors.length) {
      showError(errors[0])
      return
    }

    const safeCode = activeRequestCode || normalizeText(title).replace(/[^\w-]+/g, '-') || 'ProductCreationRequest'
    XLSX.writeFile(exportRowsToWorkbook({ title, warehouseNote, rows }), `${safeCode}.xlsx`)
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const parsed = parseProductCreationWorkbook(workbook, materialsById)
      setImportErrors(parsed.errors)
      if (parsed.errors.length) {
        showError(parsed.errors[0])
        return
      }

      setRows(parsed.rows.length ? parsed.rows : [createDraftProduct()])
      if (!title.trim()) setTitle(file.name.replace(/\.xlsx$/i, ''))
      showSuccess('Đã import dữ liệu vào draft. Backend sẽ validate lại khi gửi duyệt.')
    } catch (error) {
      showError(error.message || 'Không thể đọc file Excel.')
    }
  }

  return (
    <PageShell
      title="Yêu cầu tạo hàng hóa"
      description="Warehouse tạo yêu cầu nhiều sản phẩm, Admin duyệt và hệ thống tạo Product/SKU/BOM atomically."
      actions={(
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); loadRequests(event.target.value) }}>
          <option value="all">Tất cả</option>
          <option value="Draft">Nháp</option>
          <option value="PendingApproval">Chờ duyệt</option>
          <option value="Rejected">Bị từ chối</option>
          <option value="Completed">Đã tạo</option>
          <option value="Cancelled">Đã hủy</option>
        </select>
      )}
    >
      {warehouse ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{activeRequestId ? 'Sửa yêu cầu' : 'Tạo yêu cầu mới'}</h2>
              <p className="text-sm text-slate-500">Không dùng approval code. Admin chỉ duyệt/từ chối nội dung Warehouse gửi.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleImportFile} />
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={downloadTemplate}>Tải mẫu Excel</button>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={() => fileInputRef.current?.click()}>Import Excel</button>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={exportCurrentDraft}>Export Excel</button>
              {activeRequestId ? <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={resetForm}>Tạo yêu cầu khác</button> : null}
            </div>
          </div>

          {importErrors.length ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">Import Excel chưa hợp lệ</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {importErrors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">
              Tiêu đề
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Ghi chú Warehouse
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={warehouseNote} onChange={(event) => setWarehouseNote(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <ProductRow
                key={row.clientKey}
                row={row}
                categories={categories}
                materials={materials}
                onChange={(changes) => updateRow(index, changes)}
                onRemove={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={() => setRows((current) => [...current, createDraftProduct()])}>Thêm sản phẩm</button>
            <button type="button" disabled={isSaving} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => saveDraft()}>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</button>
            <button type="button" disabled={isSaving} className="rounded-lg bg-[#356647] px-4 py-2 text-sm font-semibold text-white" onClick={handleSubmit}>{isSaving ? 'Đang gửi...' : 'Gửi Admin duyệt'}</button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{admin ? 'Yêu cầu chờ xử lý' : 'Yêu cầu tạo hàng hóa'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã yêu cầu</th>
                <th className="px-4 py-3">Tiêu đề</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Revision</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : null}
              {!isLoading && requests.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Chưa có yêu cầu tạo hàng hóa.</td></tr>
              ) : null}
              {requests.map((request) => (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-xs text-[#356647]">{request.requestCode}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <p>{request.title}</p>
                    {request.createdByName ? <p className="mt-1 text-xs font-normal text-slate-500">Người tạo: {request.createdByName}</p> : null}
                    {request.rejectReason ? <p className="mt-1 text-xs text-rose-600">Từ chối: {request.rejectReason}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {request.items.map((item) => (
                        <p key={item.clientKey} className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{item.productName}</span> · {getProductTypeLabel(item.productType)} · {item.variantCount} SKU · {item.bomLineCount} BOM
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusLabel(request.status)}</td>
                  <td className="px-4 py-3">{request.revisionNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeVN(request.submittedAt || request.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {warehouse && ['Draft', 'Rejected'].includes(request.status) ? (
                        <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => loadIntoForm(request)}>Sửa</button>
                      ) : null}
                      {admin && request.status === 'PendingApproval' ? (
                        <>
                          <button type="button" className="rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => handleDecision(request, 'approve')}>Duyệt</button>
                          <button type="button" className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700" onClick={() => handleDecision(request, 'reject')}>Từ chối</button>
                          <button type="button" className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={() => handleDecision(request, 'cancel')}>Hủy</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}
