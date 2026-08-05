/**
 * Clickable reason suggestion chips — fills the reason field on click.
 * @param {{
 *   suggestions?: string[],
 *   value?: string,
 *   onSelect: (text: string) => void,
 *   className?: string,
 *   label?: string,
 *   layout?: 'wrap' | 'grid',
 * }} props
 */
export default function ReasonSuggestionChips({
  suggestions = [],
  value = '',
  onSelect,
  className = '',
  label = 'Gợi ý lý do (nhấp để điền)',
  layout = 'wrap',
}) {
  const items = (suggestions ?? []).map((item) => String(item || '').trim()).filter(Boolean)
  if (!items.length) return null

  const current = String(value || '').trim()
  const isGrid = layout === 'grid'

  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className={isGrid ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2' : 'flex flex-wrap gap-1.5'}>
        {items.map((text) => {
          const selected = current === text
          return (
            <button
              key={text}
              type="button"
              onClick={() => onSelect(text)}
              className={`border text-left text-xs font-semibold transition ${
                isGrid ? 'rounded-lg px-3 py-2 leading-snug' : 'rounded-full px-2.5 py-1'
              } ${
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
