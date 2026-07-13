export const MOCK_IMPORT_BATCHES = [
  {
    id: 'lot-20260707-a',
    lotCode: 'LO-2026-0707-A',
    supplier: 'Cong ty Nguyen lieu Tra Thai Nguyen',
    createdAt: '2026-07-07T02:10:00.000Z',
    items: [
      { skuCode: 'NL-TRA-1KG', productName: 'Tra xanh nguyen lieu 1kg', quantity: 20, unitCost: null },
      { skuCode: 'NL-DUONG-1KG', productName: 'Duong tinh luyen 1kg', quantity: 10, unitCost: null },
    ],
  },
  {
    id: 'lot-20260707-b',
    lotCode: 'LO-2026-0707-B',
    supplier: 'Cong ty Bao bi An Phat',
    createdAt: '2026-07-07T06:30:00.000Z',
    items: [
      { skuCode: 'HOP-GIAY-200G', productName: 'Hop giay dong goi 200g', quantity: 200, unitCost: null },
    ],
  },
]

export const MOCK_PRICING_ROWS = [
  {
    skuCode: 'TRA-OL-100G',
    productName: 'Tra O Long dac biet 100g',
    productType: 'THANH_PHAM',
    costPrice: 62000,
    retailPrice: 95000,
  },
  {
    skuCode: 'TRA-TQ-200G',
    productName: 'Tra Tiet Quan 200g',
    productType: 'THANH_PHAM',
    costPrice: 70000,
    retailPrice: 120000,
  },
  {
    skuCode: 'TRA-TQ-500G',
    productName: 'Tra Tiet Quan 500g',
    productType: 'THANH_PHAM',
    costPrice: 148000,
    retailPrice: 220000,
  },
  {
    skuCode: 'NL-TRA-1KG',
    productName: 'Tra xanh nguyen lieu 1kg',
    productType: 'NGUYEN_LIEU',
    costPrice: 85000,
    retailPrice: 180000,
  },
  {
    skuCode: 'NL-DUONG-1KG',
    productName: 'Duong tinh luyen 1kg',
    productType: 'NGUYEN_LIEU',
    costPrice: 22000,
    retailPrice: 35000,
  },
]
