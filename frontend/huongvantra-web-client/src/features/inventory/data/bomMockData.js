/** Mock data — chỉ dùng cho giao diện BOM, chưa nối API */

export const PRODUCT_TYPES = {
  NGUYEN_LIEU: 'NGUYEN_LIEU',
  THANH_PHAM: 'THANH_PHAM',
}

export const PRODUCT_TYPE_LABELS = {
  [PRODUCT_TYPES.NGUYEN_LIEU]: 'Nguyên liệu',
  [PRODUCT_TYPES.THANH_PHAM]: 'Thành phẩm',
}

export const mockCategories = [
  { id: 1, name: 'Đồ uống' },
  { id: 2, name: 'Trà' },
  { id: 3, name: 'Nguyên liệu pha chế' },
]

export const mockProducts = [
  {
    id: 1,
    name: 'Trà sữa trân châu đường đen',
    product_type: PRODUCT_TYPES.THANH_PHAM,
    description: 'Đồ uống signature',
    category_id: 1,
    base_unit: 'ly',
    weight_value: 500,
    weight_unit: 'ml',
    is_variant_parent: true,
  },
  {
    id: 2,
    name: 'Matcha latte sen vàng',
    product_type: PRODUCT_TYPES.THANH_PHAM,
    description: 'Matcha Nhật pha sữa',
    category_id: 1,
    base_unit: 'ly',
    weight_value: 450,
    weight_unit: 'ml',
    is_variant_parent: true,
  },
  {
    id: 3,
    name: 'Hộp trà oolong quà tặng',
    product_type: PRODUCT_TYPES.THANH_PHAM,
    description: 'Combo quà tặng',
    category_id: 2,
    base_unit: 'hộp',
    weight_value: 200,
    weight_unit: 'g',
    is_variant_parent: false,
  },
  {
    id: 5,
    name: 'Trà Nhài Đặc Sản',
    product_type: PRODUCT_TYPES.THANH_PHAM,
    description: 'Trà nhài đóng hộp quà',
    category_id: 2,
    base_unit: 'hộp',
    weight_value: 50,
    weight_unit: 'g',
    is_variant_parent: true,
  },
  {
    id: 101,
    name: 'Sữa tươi không đường',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    code: 'NL-100',
    description: 'Sữa pha chế',
    category_id: 3,
    base_unit: 'ml',
    unit_cost: 36,
  },
  {
    id: 107,
    name: 'Lá Trà Nhài Thô',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    code: 'NL-001',
    description: 'Nguyên liệu trà nhài',
    category_id: 3,
    base_unit: 'gram',
    unit_cost: 42,
  },
  {
    id: 108,
    name: 'Hộp giấy 50g',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    code: 'BB-012',
    description: 'Bao bì hộp 50g',
    category_id: 3,
    base_unit: 'cái',
    unit_cost: 3500,
  },
  {
    id: 109,
    name: 'Tem niêm phong',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    code: 'BB-005',
    description: 'Tem dán hộp',
    category_id: 3,
    base_unit: 'cái',
    unit_cost: 200,
  },
  {
    id: 102,
    name: 'Trân châu đường đen',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    code: 'NL-102',
    description: 'Topping',
    category_id: 3,
    base_unit: 'g',
    unit_cost: 85,
  },
  {
    id: 103,
    name: 'Bột matcha Uji',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    description: 'Matcha Nhật',
    category_id: 3,
    base_unit: 'g',
    unit_cost: 280,
  },
  {
    id: 104,
    name: 'Siro sen vàng',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    description: 'Siro pha chế',
    category_id: 3,
    base_unit: 'ml',
    unit_cost: 120,
  },
  {
    id: 105,
    name: 'Trà oolong lá',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    description: 'Lá trà khô',
    category_id: 3,
    base_unit: 'g',
    unit_cost: 45,
  },
  {
    id: 106,
    name: 'Hộp giấy quà tặng',
    product_type: PRODUCT_TYPES.NGUYEN_LIEU,
    description: 'Bao bì',
    category_id: 3,
    base_unit: 'cái',
    unit_cost: 8000,
  },
]

export const mockVariants = [
  {
    id: 1,
    product_id: 1,
    sku: 'TST-DD-L',
    barcode: '8936001001001',
    cost_price: 12500,
    retail_price: 45000,
    stock_quantity: 0,
    min_stock: 0,
    max_stock: 999999,
    is_sellable: true,
    allow_negative_stock: false,
  },
  {
    id: 2,
    product_id: 1,
    sku: 'TST-DD-M',
    barcode: '8936001001002',
    cost_price: 10500,
    retail_price: 39000,
    stock_quantity: 0,
    min_stock: 0,
    max_stock: 999999,
    is_sellable: true,
    allow_negative_stock: false,
  },
  {
    id: 3,
    product_id: 2,
    sku: 'MLT-SV-L',
    barcode: '8936001002001',
    cost_price: 18000,
    retail_price: 55000,
    stock_quantity: 0,
    min_stock: 0,
    max_stock: 999999,
    is_sellable: true,
    allow_negative_stock: true,
  },
  {
    id: 5,
    product_id: 5,
    sku: 'HVT-TN-50',
    barcode: '8936001005001',
    cost_price: 0,
    retail_price: 100000,
    stock_quantity: 0,
    min_stock: 10,
    max_stock: 999999,
    is_sellable: true,
    allow_negative_stock: false,
    attribute_label: '50g',
    unit_name: 'hộp',
  },
  {
    id: 6,
    product_id: 5,
    sku: 'HVT-TN-100',
    barcode: '8936001005002',
    cost_price: 0,
    retail_price: 180000,
    stock_quantity: 0,
    min_stock: 10,
    max_stock: 999999,
    is_sellable: true,
    allow_negative_stock: true,
    attribute_label: '100g',
    unit_name: 'hộp',
  },
  {
    id: 4,
    product_id: 3,
    sku: 'OOL-GIFT-200',
    barcode: '8936001003001',
    cost_price: 65000,
    retail_price: 180000,
    stock_quantity: 12,
    min_stock: 5,
    max_stock: 200,
    is_sellable: true,
    allow_negative_stock: false,
  },
]

export const mockProductUnits = [
  { id: 1, variant_id: 1, unit_name: 'Ly lớn', conversion_rate: 1, price: 45000, is_direct_sell: true },
  { id: 2, variant_id: 1, unit_name: 'Ly nhỏ', conversion_rate: 1, price: 39000, is_direct_sell: true },
  { id: 3, variant_id: 3, unit_name: 'Ly', conversion_rate: 1, price: 55000, is_direct_sell: true },
  { id: 4, variant_id: 3, unit_name: 'Combo 2 ly', conversion_rate: 2, price: 105000, is_direct_sell: true },
]

export const mockBomConfigs = {
  1: [
    { material_id: 101, quantity: 180 },
    { material_id: 102, quantity: 50 },
  ],
  2: [
    { material_id: 101, quantity: 150 },
    { material_id: 102, quantity: 40 },
  ],
  3: [
    { material_id: 103, quantity: 12 },
    { material_id: 101, quantity: 200 },
    { material_id: 104, quantity: 25 },
  ],
  4: [
    { material_id: 105, quantity: 200 },
    { material_id: 106, quantity: 1 },
  ],
  5: [
    { material_id: 107, quantity: 50 },
    { material_id: 108, quantity: 1 },
    { material_id: 109, quantity: 1 },
  ],
  6: [
    { material_id: 107, quantity: 100 },
    { material_id: 108, quantity: 1 },
    { material_id: 109, quantity: 1 },
  ],
}

export function getFinishedProducts() {
  return mockProducts.filter((item) => item.product_type === PRODUCT_TYPES.THANH_PHAM)
}

export function getMaterials() {
  return mockProducts.filter((item) => item.product_type === PRODUCT_TYPES.NGUYEN_LIEU)
}

export function getProductById(id) {
  return mockProducts.find((item) => item.id === Number(id)) ?? null
}

export function getVariantById(id) {
  return mockVariants.find((item) => item.id === Number(id)) ?? null
}

export function getVariantsByProductId(productId) {
  return mockVariants.filter((item) => item.product_id === Number(productId))
}

export function getUnitsByVariantId(variantId) {
  return mockProductUnits.filter((item) => item.variant_id === Number(variantId))
}

export function getCategoryName(categoryId) {
  return mockCategories.find((item) => item.id === categoryId)?.name ?? '—'
}

export function calculateBomLineCost(materialId, quantity) {
  const material = getProductById(materialId)
  if (!material) return 0
  return Math.round(Number(material.unit_cost || 0) * Number(quantity || 0))
}

export function calculateBomTotalCost(lines = []) {
  return lines.reduce((sum, line) => sum + calculateBomLineCost(line.material_id, line.quantity), 0)
}

export function buildBomListRows() {
  return Object.entries(mockBomConfigs).map(([variantId, lines]) => {
    const variant = getVariantById(variantId)
    const product = variant ? getProductById(variant.product_id) : null
    const totalCost = calculateBomTotalCost(lines)
    const margin =
      variant?.retail_price > 0
        ? Math.round(((variant.retail_price - totalCost) / variant.retail_price) * 1000) / 10
        : 0

    return {
      variantId: Number(variantId),
      variant,
      product,
      lines,
      materialCount: lines.length,
      totalCost,
      retailPrice: variant?.retail_price ?? 0,
      margin,
      updatedAt: '08/06/2026',
      attributeLabel: variant?.attribute_label ?? '—',
      unitName: variant?.unit_name ?? product?.base_unit ?? '—',
    }
  })
}

export function getBomLinesForVariant(variantId) {
  return (mockBomConfigs[Number(variantId)] ?? []).map((line) => ({ ...line }))
}

export function emptyBomLine() {
  const firstMaterial = getMaterials()[0]
  return {
    material_id: firstMaterial?.id ?? '',
    quantity: 1,
  }
}
