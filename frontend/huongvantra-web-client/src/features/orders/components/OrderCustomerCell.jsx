import { parseCustomerOrderSnapshot } from '../../customers/utils/customerDisplay.js'

export default function OrderCustomerCell({ snapshot, customerId, fallback = 'Khách lẻ' }) {
  const text = String(snapshot || '').trim()
  if (!text) {
    return <span className="text-slate-500">{customerId ? 'Khách hàng' : fallback}</span>
  }

  const { name, code } = parseCustomerOrderSnapshot(text)

  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-800" title={name}>
        {name}
      </p>
      {code ? (
        <p className="truncate text-xs text-slate-500" title={code}>
          {code}
        </p>
      ) : null}
    </div>
  )
}
