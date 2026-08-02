/**
 * Clickable reason suggestion chips — fills the reason field on click.
 * @param {{
 *   suggestions?: string[],
 *   value?: string,
 *   onSelect: (text: string) => void,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function ReasonSuggestionChips({
  suggestions = [],
  value = '',
  onSelect,
  className = '',
  label = 'Gợi ý lý do (nhấp để điền)',
}) {
  const items = (suggestions ?? []).map((item) => String(item || '').trim()).filter(Boolean)
  if (!items.length) return null

  const current = String(value || '').trim()

  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((text) => {
          const selected = current === text
          return (
            <button
              key={text}
              type="button"
              onClick={() => onSelect(text)}
              className={`rounded-full border px-2.5 py-1 text-left text-xs font-semibold transition ${
                selected
                  ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#356647]/40 hover:bg-[#f6f4ec]'
              }`}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
