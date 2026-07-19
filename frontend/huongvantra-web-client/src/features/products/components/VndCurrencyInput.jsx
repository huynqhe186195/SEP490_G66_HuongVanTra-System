import { formatWholeVndInput, normalizeWholeVndDigits } from '../utils/productDisplay.js'

export default function VndCurrencyInput({
  value,
  onChange,
  className = '',
  disabled = false,
  readOnly = false,
  placeholder = '0',
  suffix = 'VNĐ',
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        readOnly={readOnly}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm outline-none focus:border-[#538463] read-only:bg-slate-50 read-only:text-slate-600 disabled:bg-slate-50 disabled:text-slate-400"
        value={formatWholeVndInput(value)}
        onChange={(event) => onChange?.(normalizeWholeVndDigits(event.target.value))}
        placeholder={placeholder}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}
