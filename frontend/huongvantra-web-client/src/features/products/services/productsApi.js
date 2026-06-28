import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function trimOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function mapProductImage(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    productId: item.productId ?? item.ProductId,
    imageUrl: item.imageUrl ?? item.ImageUrl ?? '',
    altText: item.altText ?? item.AltText ?? '',
    sortOrder: Number(item.sortOrder ?? item.SortOrder ?? 0),
    isThumbnail: Boolean(item.isThumbnail ?? item.IsThumbnail ?? false),
  }
}

export function mapProductUnit(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    productId: item.productId ?? item.ProductId,
    variantId: item.variantId ?? item.VariantId ?? null,
    unitName: item.unitName ?? item.UnitName ?? '',
    conversionRate: Number(item.conversionRate ?? item.ConversionRate ?? 1),
    price: numberOrNull(item.price ?? item.Price),
    barcode: item.barcode ?? item.Barcode ?? '',
    isDirectSell: Boolean(item.isDirectSell ?? item.IsDirectSell ?? true),
    isBaseUnit: Boolean(item.isBaseUnit ?? item.IsBaseUnit ?? false),
  }
}

export function mapProductVariant(item) {
  if (!item || typeof item !== 'object') return null
  const rawUnits = item.units ?? item.Units ?? []
  const rawBomLines = item.bomLines ?? item.BomLines ?? []
  return {
    id: item.id ?? item.Id,
    productId: item.productId ?? item.ProductId,
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    barcode: item.barcode ?? item.Barcode ?? '',
    variantName: item.variantName ?? item.VariantName ?? '',
    optionValuesJson: item.optionValuesJson ?? item.OptionValuesJson ?? '{}',
    costPrice: Number(item.costPrice ?? item.CostPrice ?? 0),
    retailPrice: Number(item.retailPrice ?? item.RetailPrice ?? 0),
    minStock: numberOrNull(item.minStock ?? item.MinStock),
    maxStock: numberOrNull(item.maxStock ?? item.MaxStock),
    isSellable: Boolean(item.isSellable ?? item.IsSellable ?? true),
    allowRewardPoints: Boolean(item.allowRewardPoints ?? item.AllowRewardPoints ?? true),
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    imageUrl: item.imageUrl ?? item.ImageUrl ?? '',
    units: toArray(rawUnits).map(mapProductUnit).filter(Boolean),
    bomLines: toArray(rawBomLines).map((line) => ({
      materialId: line.materialId ?? line.MaterialId,
      materialName: line.materialName ?? line.MaterialName ?? '',
      quantity: Number(line.quantity ?? line.Quantity ?? 0),
    })),
  }
}

export function mapProductSku(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    productId: item.productId ?? item.ProductId,
    productName: item.productName ?? item.ProductName ?? '',
    categoryId: item.categoryId ?? item.CategoryId ?? null,
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    skuCode: item.skuCode ?? item.SkuCode ?? '',
    barcode: item.barcode ?? item.Barcode ?? '',
    // packagingType is now VariantName — keep packagingType field for compatibility
    packagingType: item.packagingType ?? item.PackagingType ?? item.variantName ?? item.VariantName ?? '',
    variantName: item.variantName ?? item.VariantName ?? item.packagingType ?? item.PackagingType ?? '',
    weightInGrams: Number(item.weightInGrams ?? item.WeightInGrams ?? 0),
    // basePrice is now RetailPrice — keep basePrice field for compatibility
    basePrice: Number(item.basePrice ?? item.BasePrice ?? item.retailPrice ?? item.RetailPrice ?? 0),
    costPrice: Number(item.costPrice ?? item.CostPrice ?? item.basePrice ?? item.BasePrice ?? 0),
    retailPrice: Number(item.retailPrice ?? item.RetailPrice ?? item.basePrice ?? item.BasePrice ?? 0),
    minStock: numberOrNull(item.minStock ?? item.MinStock),
    maxStock: numberOrNull(item.maxStock ?? item.MaxStock),
    isSellable: Boolean(item.isSellable ?? item.IsSellable ?? true),
    allowRewardPoints: Boolean(item.allowRewardPoints ?? item.AllowRewardPoints ?? true),
    imageUrl: item.imageUrl ?? item.ImageUrl ?? '',
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    syncedToStoreAt: item.syncedToStoreAt ?? item.SyncedToStoreAt ?? null,
  }
}

export function mapProduct(item) {
  if (!item || typeof item !== 'object') return null
  const rawSkus = item.skus ?? item.Skus ?? []
  const rawImages = item.images ?? item.Images ?? []
  const rawUnits = item.units ?? item.Units ?? []
  const rawVariants = item.variants ?? item.Variants ?? []
  return {
    id: item.id ?? item.Id,
    categoryId: item.categoryId ?? item.CategoryId,
    categoryName: item.categoryName ?? item.CategoryName ?? '',
    name: item.name ?? item.Name ?? '',
    origin: item.origin ?? item.Origin ?? '',
    flavorProfile: item.flavorProfile ?? item.FlavorProfile ?? '',
    brewingGuide: item.brewingGuide ?? item.BrewingGuide ?? '',
    description: item.description ?? item.Description ?? '',
    baseUnit: item.baseUnit ?? item.BaseUnit ?? 'unit',
    weightValue: numberOrNull(item.weightValue ?? item.WeightValue),
    weightUnit: item.weightUnit ?? item.WeightUnit ?? '',
    isVariantParent: Boolean(item.isVariantParent ?? item.IsVariantParent ?? false),
    isActive: Boolean(item.isActive ?? item.IsActive ?? true),
    isDeleted: Boolean(item.isDeleted ?? item.IsDeleted ?? false),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
    syncedToStoreAt: item.syncedToStoreAt ?? item.SyncedToStoreAt ?? null,
    productType: item.productType ?? item.ProductType ?? 'THANH_PHAM',
    skus: toArray(rawSkus).map(mapProductSku).filter(Boolean),
    images: toArray(rawImages).map(mapProductImage).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder),
    units: toArray(rawUnits).map(mapProductUnit).filter(Boolean),
    variants: toArray(rawVariants).map(mapProductVariant).filter(Boolean),
  }
}

function buildProductQuery(params = {}) {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.categoryId) search.set('categoryId', String(params.categoryId))
  if (params.isActive === true || params.isActive === false) search.set('isActive', String(params.isActive))
  if (params.isDeleted === true) search.set('isDeleted', 'true')
  if (params.productType) search.set('productType', String(params.productType))
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  return search.toString()
}

export async function fetchProducts(params = {}) {
  const query = buildProductQuery(params)
  const data = await apiRequestAuth(`/api/v1/products?${query}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapProduct).filter(Boolean),
    totalPages: Number(data?.totalPages ?? data?.TotalPages ?? (Math.ceil(paged.totalCount / paged.pageSize) || 1)),
  }
}

export async function fetchProductById(id) {
  const data = await apiRequestAuth(`/api/v1/products/${id}`, { method: 'GET' })
  return mapProduct(data)
}

function buildImageBody(image, index) {
  return {
    imageUrl: trimOrNull(image.imageUrl) || '',
    altText: trimOrNull(image.altText),
    sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : index,
    isThumbnail: Boolean(image.isThumbnail),
  }
}

function buildUnitBody(unit) {
  return {
    variantId: unit.variantId || null,
    unitName: trimOrNull(unit.unitName) || '',
    conversionRate: Number(unit.conversionRate || 1),
    price: numberOrNull(unit.price),
    barcode: trimOrNull(unit.barcode),
    isDirectSell: Boolean(unit.isDirectSell),
    isBaseUnit: Boolean(unit.isBaseUnit),
  }
}

function buildVariantBody(variant) {
  return {
    skuCode: String(variant.skuCode || '').trim().toUpperCase(),
    barcode: trimOrNull(variant.barcode),
    variantName: trimOrNull(variant.variantName) || '',
    optionValuesJson: trimOrNull(variant.optionValuesJson) || '{}',
    costPrice: Number(variant.costPrice || 0),
    retailPrice: Number(variant.retailPrice || 0),
    minStock: numberOrNull(variant.minStock),
    maxStock: numberOrNull(variant.maxStock),
    isSellable: Boolean(variant.isSellable),
    allowRewardPoints: Boolean(variant.allowRewardPoints),
    isActive: variant.isActive !== false,
    imageUrl: trimOrNull(variant.imageUrl),
    units: toArray(variant.units).map(buildUnitBody),
    bomLines: toArray(variant.bomLines)
      .filter((l) => l.materialId && Number(l.quantity) > 0)
      .map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity) })),
  }
}

function buildVariantGeneratorBody(generator) {
  if (!generator || !toArray(generator.optionGroups).length) return null
  return {
    optionGroups: generator.optionGroups.map((group) => {
      const values = toArray(group.values).length
        ? group.values
        : String(group.valuesText || '').split(',')
      return {
        name: trimOrNull(group.name) || '',
        values: values.map((value) => String(value || '').trim()).filter(Boolean),
      }
    }),
    costPrice: Number(generator.costPrice || 0),
    retailPrice: Number(generator.retailPrice || 0),
    minStock: numberOrNull(generator.minStock),
    maxStock: numberOrNull(generator.maxStock),
    isSellable: generator.isSellable !== false,
    allowRewardPoints: generator.allowRewardPoints !== false,
  }
}

export function buildCreateProductBody(payload) {
  return {
    categoryId: Number(payload.categoryId),
    name: payload.name?.trim(),
    origin: trimOrNull(payload.origin),
    flavorProfile: trimOrNull(payload.flavorProfile),
    brewingGuide: trimOrNull(payload.brewingGuide),
    description: trimOrNull(payload.description),
    baseUnit: trimOrNull(payload.baseUnit) || 'unit',
    weightValue: numberOrNull(payload.weightValue),
    weightUnit: trimOrNull(payload.weightUnit),
    productType: payload.productType || 'THANH_PHAM',
    isVariantParent: Boolean(payload.isVariantParent),
    images: toArray(payload.images).map(buildImageBody).filter((image) => image.imageUrl),
    units: toArray(payload.units).map(buildUnitBody).filter((unit) => unit.unitName),
    variants: toArray(payload.variants).map(buildVariantBody).filter((variant) => variant.variantName),
    variantGenerator: buildVariantGeneratorBody(payload.variantGenerator),
  }
}

export function buildUpdateProductBody(payload) {
  const body = buildCreateProductBody(payload)
  if (payload.isActive === true || payload.isActive === false) {
    body.isActive = payload.isActive
  }
  return body
}

export async function createProduct(payload) {
  const data = await apiRequestAuth('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(buildCreateProductBody(payload)),
  })
  return mapProduct(data)
}

export async function updateProduct(id, payload) {
  const data = await apiRequestAuth(`/api/v1/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdateProductBody(payload)),
  })
  return mapProduct(data)
}

export async function deleteProduct(id) {
  return apiRequestAuth(`/api/v1/products/${id}`, { method: 'DELETE' })
}

export async function restoreProduct(id) {
  const data = await apiRequestAuth(`/api/v1/products/${id}/restore`, { method: 'POST' })
  return mapProduct(data)
}

export async function setProductStatus(product, isActive) {
  return updateProduct(product.id, {
    ...product,
    isActive,
  })
}
