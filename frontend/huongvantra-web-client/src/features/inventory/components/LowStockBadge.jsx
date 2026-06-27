import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchLowStockSkus } from '../services/inventoryStockApi.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'

const POLL_INTERVAL_MS = 60_000

export default function LowStockBadge() {
  const [items, setItems] = useState([])
  const [productNames, setProductNames] = useState(new Map())
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const namesFetchedRef = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await fetchLowStockSkus()
        if (mounted) setItems(data)
      } catch { /* silent */ }
    }
    void load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => { mounted = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open || namesFetchedRef.current) return
    namesFetchedRef.current = true
    const loadNames = async () => {
      try {
        const skus = await fetchAllActiveSkus()
        setProductNames(new Map(skus.map((s) => [s.id, s.productName ?? ''])))
      } catch { /* silent */ }
    }
    void loadNames()
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#356647] hover:bg-[#356647]/10 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Cảnh báo tồn kho thấp"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {items.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-[#c1c9c0]/50 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#c1c9c0]/30 px-4 py-3">
            <span className="text-sm font-semibold text-[#1b1c17]">Tồn kho thấp</span>
            {items.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                {items.length} SKU
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#717971]">
              Không có SKU nào cạn kho
            </div>
          ) : (
            <>
              <ul className="max-h-72 overflow-y-auto divide-y divide-[#c1c9c0]/20">
                {items.map((item) => {
                  const pName = productNames.get(item.skuId) ?? ''
                  return (
                    <li key={item.skuId} className="px-4 py-3">
                      {pName && (
                        <p className="text-xs font-semibold text-[#356647] truncate">{pName}</p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-sm font-medium text-[#1b1c17]">{item.skuCode}</span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 shrink-0 ml-2">
                          còn {item.quantityOnHand}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#717971]">Ngưỡng cảnh báo: {item.lowStockThreshold}</p>
                    </li>
                  )
                })}
              </ul>
              <div className="border-t border-[#c1c9c0]/30 px-4 py-2.5">
                <button
                  type="button"
                  className="w-full text-center text-xs font-medium text-[#356647] hover:underline"
                  onClick={() => { setOpen(false); navigate('/inventory') }}
                >
                  Xem tất cả trong Quản lý kho →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
