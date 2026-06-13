import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showSuccess } from '../../../app/toast.js'
import ProductBomConfigModal from '../components/ProductBomConfigModal.jsx'
import { formatProductPrice } from '../utils/productDisplay.js'
import { PRODUCT_TYPES } from '../../inventory/data/bomMockData.js'

const mockBrands = ['Hương Vân Trà', 'Sen Vàng', 'Không thương hiệu']
const mockCategories = ['Trà các loại', 'Đồ uống', 'Bao bì', 'Nguyên liệu pha chế']
const weightUnits = ['gram', 'kg', 'ml', 'lít']

const defaultVariants = [
  {
    id: 'v1',
    sku: 'HVT-TN-50',
    unit: 'hộp',
    attribute: '50g',
    costPrice: 0,
    retailPrice: 100000,
  },
  {
    id: 'v2',
    sku: 'HVT-TN-100',
    unit: 'hộp',
    attribute: '100g',
    costPrice: 0,
    retailPrice: 180000,
  },
]

const defaultBomByVariant = {
  'HVT-TN-50': [
    { material_id: 107, quantity: 50 },
    { material_id: 108, quantity: 1 },
    { material_id: 109, quantity: 1 },
  ],
  'HVT-TN-100': [
    { material_id: 107, quantity: 100 },
    { material_id: 108, quantity: 1 },
    { material_id: 109, quantity: 1 },
  ],
}

function SectionCard({ number, title, children }) {
  return (
    <section className="rounded-[1rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 border-b border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-[#356647]">
        {number}. {title}
      </h2>
      {children}
    </section>
  )
}

function FieldLabel({ children, required }) {
  return (
    <span className="text-xs font-semibold text-[#717971]">
      {children}
      {required ? ' *' : ''}
    </span>
  )
}

function inputClassName(disabled = false) {
  return `w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`
}

export default function ProductItemCreatePage() {
  const navigate = useNavigate()
  const [productType, setProductType] = useState(PRODUCT_TYPES.THANH_PHAM)
  const isFinishedProduct = productType === PRODUCT_TYPES.THANH_PHAM

  const [sku, setSku] = useState('Tự động sinh')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('Trà Nhài Đặc Sản')
  const [category, setCategory] = useState('Trà các loại')
  const [brand, setBrand] = useState('Hương Vân Trà')

  const [costPrice, setCostPrice] = useState('0')
  const [retailPrice, setRetailPrice] = useState('0')
  const [weightValue, setWeightValue] = useState('0')
  const [weightUnit, setWeightUnit] = useState('gram')
  const [stockQty] = useState('0')
  const [allowNegativeStock, setAllowNegativeStock] = useState(false)
  const [minStock, setMinStock] = useState('10')
  const [maxStock, setMaxStock] = useState('999999')

  const [baseUnitName, setBaseUnitName] = useState('hộp')
  const [baseUnitPrice, setBaseUnitPrice] = useState('100000')
  const [isDirectSell, setIsDirectSell] = useState(true)

  const [attributeName, setAttributeName] = useState('Trọng lượng')
  const [attributeValues, setAttributeValues] = useState(['50g', '100g'])

  const [variants, setVariants] = useState(defaultVariants)
  const [bomByVariant, setBomByVariant] = useState(defaultBomByVariant)
  const [bomModalVariant, setBomModalVariant] = useState(null)

  useEffect(() => {
    if (!isFinishedProduct) {
      setIsDirectSell(false)
    }
  }, [isFinishedProduct])

  const bomModalLines = useMemo(() => {
    if (!bomModalVariant) return []
    return bomByVariant[bomModalVariant.sku] ?? []
  }, [bomByVariant, bomModalVariant])

  function openBomModal(variant) {
    setBomModalVariant({
      sku: variant.sku,
      productName: name,
      attributeLabel: variant.attribute,
    })
  }

  function handleBomConfirm(lines) {
    if (!bomModalVariant) return
    setBomByVariant((current) => ({ ...current, [bomModalVariant.sku]: lines }))
    showSuccess(`Đã lưu định mức BOM cho ${bomModalVariant.sku} (giao diện mẫu).`)
  }

  function removeAttributeValue(value) {
    setAttributeValues((current) => current.filter((item) => item !== value))
  }

  function handleSave() {
    showSuccess('Đã lưu hàng hóa mới (giao diện mẫu).')
    navigate('/products')
  }

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900 sm:text-2xl">Tạo hàng hóa mới</h1>
        <div className="flex gap-2">
          <Link
            to="/products"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Bỏ qua
          </Link>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Lưu
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <SectionCard number={1} title="Thông tin cơ bản">
          <div className="mb-5 flex flex-wrap gap-6">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="productType"
                checked={productType === PRODUCT_TYPES.NGUYEN_LIEU}
                onChange={() => setProductType(PRODUCT_TYPES.NGUYEN_LIEU)}
                className="text-[#356647] focus:ring-[#356647]"
              />
              <span className="text-sm font-medium text-slate-800">Nguyên liệu / Bao bì</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="productType"
                checked={isFinishedProduct}
                onChange={() => setProductType(PRODUCT_TYPES.THANH_PHAM)}
                className="text-[#356647] focus:ring-[#356647]"
              />
              <span className="text-sm font-medium text-slate-800">Thành phẩm kinh doanh</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <FieldLabel>Mã hàng (SKU)</FieldLabel>
              <input className={inputClassName()} value={sku} onChange={(e) => setSku(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Mã vạch</FieldLabel>
              <input
                className={inputClassName()}
                placeholder="Nhập mã in trên hộp"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </label>
            <label className="block space-y-2 md:col-span-2">
              <FieldLabel required>Tên hàng</FieldLabel>
              <input className={inputClassName()} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Nhóm hàng</FieldLabel>
              <select className={inputClassName()} value={category} onChange={(e) => setCategory(e.target.value)}>
                {mockCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <FieldLabel>Thương hiệu</FieldLabel>
              <select className={inputClassName()} value={brand} onChange={(e) => setBrand(e.target.value)}>
                {mockBrands.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400">add_photo_alternate</span>
            <p className="mt-2 text-sm font-medium text-slate-600">Kéo thả hoặc click để tải ảnh lên</p>
            <p className="text-xs text-slate-400">Tối đa 5 ảnh, &lt;2MB/ảnh</p>
          </div>
        </SectionCard>

        <SectionCard number={2} title="Giá vốn, tồn kho & định mức cảnh báo">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <FieldLabel>Giá vốn</FieldLabel>
              <input className={inputClassName()} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Giá bán</FieldLabel>
              <input className={inputClassName()} value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Trọng lượng</FieldLabel>
              <input className={inputClassName()} value={weightValue} onChange={(e) => setWeightValue(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>&nbsp;</FieldLabel>
              <select className={inputClassName()} value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
                {weightUnits.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <FieldLabel>Tồn kho</FieldLabel>
              <input className={inputClassName(true)} value={stockQty} disabled readOnly />
              <p className="text-xs text-slate-400">Hệ thống tự tính</p>
            </label>
            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  className="rounded border-slate-300 text-[#356647] focus:ring-[#356647]"
                />
                Cho phép bán âm kho
              </label>
            </div>
            <label className="block space-y-2">
              <FieldLabel>Tồn tối thiểu</FieldLabel>
              <input className={inputClassName()} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Tồn tối đa</FieldLabel>
              <input className={inputClassName()} value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
            </label>
          </div>
          {allowNegativeStock ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Khi bật, API thanh toán sẽ gửi <code className="font-mono">allowNegativeStock: true</code> và bỏ qua
              kiểm tra <code className="font-mono">stock_quantity &gt; 0</code> — phục vụ quy trình bán trước, trừ kho sau.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard number={3} title="Đơn vị tính và quy đổi">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="block space-y-2">
              <FieldLabel>Tên ĐV cơ bản</FieldLabel>
              <input className={inputClassName()} value={baseUnitName} onChange={(e) => setBaseUnitName(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <FieldLabel>Giá bán</FieldLabel>
              <input className={inputClassName()} value={baseUnitPrice} onChange={(e) => setBaseUnitPrice(e.target.value)} />
            </label>
            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isDirectSell}
                  disabled={!isFinishedProduct}
                  onChange={(e) => setIsDirectSell(e.target.checked)}
                  className="rounded border-slate-300 text-[#356647] focus:ring-[#356647] disabled:opacity-50"
                />
                Bán trực tiếp
              </label>
            </div>
          </div>
          {!isFinishedProduct ? (
            <p className="mt-2 text-xs text-slate-500">
              Nguyên liệu / bao bì — tự động tắt &quot;Bán trực tiếp&quot; để không hiện trên POS thu ngân.
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#356647] hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm đơn vị quy đổi
          </button>
        </SectionCard>

        {isFinishedProduct ? (
          <>
            <SectionCard number={4} title="Thuộc tính (tạo biến thể)">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                  value={attributeName}
                  onChange={(e) => setAttributeName(e.target.value)}
                >
                  <option>Trọng lượng</option>
                  <option>Dung tích</option>
                  <option>Hương vị</option>
                </select>
                <span className="text-slate-400">|</span>
                <span className="text-xs font-semibold text-slate-500">Giá trị:</span>
                {attributeValues.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-full bg-[#f0eee6] px-3 py-1 text-sm font-medium text-slate-800"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => removeAttributeValue(value)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Xóa ${value}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#356647] hover:underline"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Thêm thuộc tính
                </button>
              </div>
            </SectionCard>

            <SectionCard number={5} title="Hàng cùng loại (danh sách biến thể)">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Mã SKU</th>
                      <th className="px-4 py-3 font-semibold">Đơn vị</th>
                      <th className="px-4 py-3 font-semibold">Thuộc tính</th>
                      <th className="px-4 py-3 font-semibold text-right">Giá vốn (Auto)</th>
                      <th className="px-4 py-3 font-semibold text-right">Giá bán</th>
                      <th className="px-4 py-3 font-semibold text-center">Định mức (BOM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variants.map((variant) => {
                      const bomCount = bomByVariant[variant.sku]?.length ?? 0
                      return (
                        <tr key={variant.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <input
                              className="w-full min-w-[120px] rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs font-bold text-[#356647]"
                              value={variant.sku}
                              onChange={(e) =>
                                setVariants((current) =>
                                  current.map((row) =>
                                    row.id === variant.id ? { ...row, sku: e.target.value } : row,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-700">{variant.unit}</td>
                          <td className="px-4 py-3 text-slate-700">{variant.attribute}</td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {formatProductPrice(variant.costPrice)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm"
                              value={variant.retailPrice}
                              onChange={(e) =>
                                setVariants((current) =>
                                  current.map((row) =>
                                    row.id === variant.id
                                      ? { ...row, retailPrice: Number(e.target.value) || 0 }
                                      : row,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => openBomModal(variant)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-1.5 text-xs font-bold text-[#356647] hover:bg-[#356647]/10"
                            >
                              <span className="material-symbols-outlined text-[16px]">settings</span>
                              Cấu hình BOM
                              {bomCount > 0 ? (
                                <span className="rounded-full bg-[#356647] px-1.5 py-0.5 text-[10px] text-white">
                                  {bomCount}
                                </span>
                              ) : null}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        ) : (
          <SectionCard number={4} title="Thông tin nguyên liệu">
            <p className="text-sm text-slate-600">
              Hàng loại nguyên liệu / bao bì không có biến thể BOM và không cấu hình định mức tiêu hao từ nguyên liệu
              khác.
            </p>
          </SectionCard>
        )}
      </div>

      <ProductBomConfigModal
        isOpen={Boolean(bomModalVariant)}
        variant={bomModalVariant}
        initialLines={bomModalLines}
        onClose={() => setBomModalVariant(null)}
        onConfirm={handleBomConfirm}
      />
    </PageShell>
  )
}
