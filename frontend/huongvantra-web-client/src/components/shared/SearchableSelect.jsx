import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Combobox: gõ để lọc, chọn một mục. Phù hợp danh sách nhân viên dài.
 */
function SearchableSelect({
  label,
  placeholder = 'Gõ tên để tìm...',
  emptyLabel = 'Tất cả',
  value,
  onChange,
  options = [],
  getOptionValue = (opt) => String(opt.value ?? opt.id ?? ''),
  getOptionLabel = (opt) => opt.label ?? opt.fullName ?? opt.name ?? '',
  className = '',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedValue = value ? String(value) : ''

  const selectedOption = useMemo(
    () => options.find((opt) => getOptionValue(opt) === normalizedValue),
    [options, normalizedValue, getOptionValue],
  )

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(q))
  }, [options, query, getOptionLabel])

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption ? getOptionLabel(selectedOption) : '')
    }
  }, [isOpen, selectedOption, getOptionLabel])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const displayWhenClosed = selectedOption ? getOptionLabel(selectedOption) : emptyLabel

  const applyValue = (nextValue) => {
    onChange(nextValue)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      ) : null}
      <div ref={rootRef} className="relative">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[#fbf9f1] focus-within:border-[#538463]">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none"
            placeholder={placeholder}
            value={isOpen ? query : displayWhenClosed}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => {
              setIsOpen(true)
              setQuery(selectedOption ? getOptionLabel(selectedOption) : '')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false)
                inputRef.current?.blur()
              }
            }}
          />
          {normalizedValue ? (
            <button
              type="button"
              className="mr-2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white/80"
              title="Bỏ lọc"
              onClick={() => applyValue('')}
            >
              ✕
            </button>
          ) : null}
        </div>

        {isOpen ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            <li>
              <button
                type="button"
                role="option"
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#f6f4ec] ${
                  !normalizedValue ? 'bg-[#eef5f0] font-semibold text-[#356647]' : 'text-slate-700'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyValue('')}
              >
                {emptyLabel}
              </button>
            </li>
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">Không tìm thấy nhân viên phù hợp.</li>
            ) : (
              filteredOptions.map((opt) => {
                const optValue = getOptionValue(opt)
                const isSelected = optValue === normalizedValue
                return (
                  <li key={optValue}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#f6f4ec] ${
                        isSelected ? 'bg-[#eef5f0] font-semibold text-[#356647]' : 'text-slate-800'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyValue(optValue)}
                    >
                      {getOptionLabel(opt)}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        ) : null}
      </div>
    </label>
  )
}

export default SearchableSelect
