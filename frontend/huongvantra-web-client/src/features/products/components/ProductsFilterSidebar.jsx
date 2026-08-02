import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { flattenCategoryTreeForSelect } from '../utils/categoryTreeUtils.js'

const STOCK_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'in_stock', label: 'Còn hàng' },
  { value: 'out_of_stock', label: 'Hết hàng' },
  { value: 'low', label: 'Sắp hết' },
]

const DIRECT_SELL_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
]

const STATUS_FILTERS = [
  { value: 'active', label: 'Hàng đang kinh doanh' },
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'hidden', label: 'Hàng đã ẩn' },
]

function FilterSection({ title, children, action }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              active ? 'bg-[#356647] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function ProductsFilterContent({
  categories = [],
  categoryId,
  onCategoryChange,
  stockFilter,
  onStockFilterChange,
  directSellFilter,
  onDirectSellFilterChange,
  statusFilter,
  onStatusFilterChange,
  canCreate = false,
  showFooterNote = true,
}) {
  const categoryTreeOptions = useMemo(() => {
    const visible = categories.filter((c) => !c.isDeleted && c.isActive !== false)
    return flattenCategoryTreeForSelect(visible)
  }, [categories])

  return (
    <>
      <FilterSection
        title="Nhóm hàng"
        action={
          canCreate ? (
            <Link to="/products/categories" className="text-[11px] font-bold text-[#356647] hover:underline">
              Tạo mới
            </Link>
          ) : null
        }
      >
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-[#356647]"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">Tất cả nhóm hàng</option>
          {categoryTreeOptions.map((cat) => (
            <option key={cat.id} value={String(cat.id)}>
              {cat.selectLabel}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection title="Tồn kho">
        <ChipGroup options={STOCK_FILTERS} value={stockFilter} onChange={onStockFilterChange} />
      </FilterSection>

      <FilterSection title="Bán trực tiếp">
        <ChipGroup options={DIRECT_SELL_FILTERS} value={directSellFilter} onChange={onDirectSellFilterChange} />
      </FilterSection>

      <FilterSection title="Trạng thái hàng hóa">
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-[#356647]"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterSection>

      {showFooterNote ? (
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Lọc tồn kho và bán trực tiếp áp dụng trên trang hiện tại.
        </div>
      ) : null}
    </>
  )
}

export default function ProductsFilterSidebar(props) {
  return (
    <aside className="hidden h-full min-h-0 w-[248px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex custom-scrollbar">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">Bộ lọc</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <ProductsFilterContent {...props} />
      </div>
    </aside>
  )
}
