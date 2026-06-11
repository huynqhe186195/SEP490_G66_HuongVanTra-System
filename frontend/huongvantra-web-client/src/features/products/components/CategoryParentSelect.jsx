import { useMemo } from 'react'
import { buildCategoryParentOptions } from '../utils/categoryTreeUtils.js'

export default function CategoryParentSelect({
  value,
  onChange,
  categories = [],
  excludeId = null,
  error = '',
  disabled = false,
  className = '',
}) {
  const options = useMemo(
    () => buildCategoryParentOptions(categories, { excludeId }),
    [categories, excludeId],
  )

  return (
    <div className={className}>
      <select
        className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 disabled:opacity-60"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || 'root'} value={option.value}>
            {`${option.depth > 0 ? `${'— '.repeat(option.depth)}` : ''}${option.label}`}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-[#b42318]">{error}</p> : null}
    </div>
  )
}
