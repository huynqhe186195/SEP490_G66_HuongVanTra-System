import { useCallback, useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { confirmPacking, fetchPendingCustomBundles } from '../../orders/services/customBundleApi.js'

function fmt(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function IngredientList({ ingredients }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-[#717971]">
      {ingredients.map((ing, idx) => (
        <li key={idx}>
          <span className="font-medium text-[#414942]">{ing.materialSnapshotName}</span>
          {ing.materialSkuCode ? <span className="ml-1 text-[#717971]">({ing.materialSkuCode})</span> : null}
          {' '}&times; {ing.quantity.toLocaleString('vi-VN')}
          <span className="ml-1 text-[#356647]">= {fmt(ing.subTotal)}</span>
        </li>
      ))}
    </ul>
  )
}

function BundleRow({ bundle, onConfirm, isConfirming }) {
  return (
    <div className="rounded-xl border border-[#c1c9c0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#1b1c17]">
              {bundle.orderCode || bundle.orderId?.slice(0, 8) || '—'}
            </p>
            {bundle.label ?
              <span className="rounded-full bg-[#e8f0e9] px-2 py-0.5 text-xs font-medium text-[#356647]">
                {bundle.label}
              </span>
            : null}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Chờ đóng gói
            </span>
          </div>
          {bundle.customerName ?
            <p className="mt-0.5 text-xs text-[#717971]">Khách: {bundle.customerName}</p>
          : null}
          <IngredientList ingredients={bundle.ingredients} />
          <p className="mt-2 text-sm font-bold text-[#356647]">Tổng: {fmt(bundle.totalPrice)}</p>
        </div>
        <button
          type="button"
          onClick={() => onConfirm(bundle.id)}
          disabled={isConfirming}
          className="shrink-0 rounded-lg bg-[#356647] px-4 py-2 text-sm font-bold text-white hover:bg-[#2a5238] disabled:opacity-50">
          {isConfirming ? 'Đang xử lý...' : 'Xác nhận đóng gói'}
        </button>
      </div>
    </div>
  )
}

export default function CustomBundlesPage() {
  const [bundles, setBundles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const PAGE_SIZE = 20

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await fetchPendingCustomBundles({ page: p, pageSize: PAGE_SIZE })
      setBundles(result.items)
      setTotalPages(Math.max(1, result.totalPages ?? Math.ceil(result.totalCount / PAGE_SIZE)))
    } catch (err) {
      showError(err?.message ?? 'Không tải được danh sách gói custom.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  const handleConfirm = async (bundleId) => {
    if (confirmingId) return
    setConfirmingId(bundleId)
    try {
      await confirmPacking(bundleId)
      showSuccess('Đã xác nhận đóng gói. Kho nguyên liệu đã được trừ.')
      setBundles((prev) => prev.filter((b) => b.id !== bundleId))
    } catch (err) {
      showError(err?.message ?? 'Xác nhận thất bại, vui lòng thử lại.')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1b1c17]">Gói trà theo yêu cầu</h1>
          <p className="text-sm text-[#717971]">Danh sách gói custom chờ đóng gói</p>
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] bg-white px-3 py-1.5 text-sm font-medium text-[#356647] hover:bg-[#f0f7f0] disabled:opacity-50">
          <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          Làm mới
        </button>
      </div>

      {isLoading && bundles.length === 0 ?
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-[#717971]">Đang tải...</p>
        </div>
      : bundles.length === 0 ?
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c1c9c0] bg-[#f6f4ec]/40 p-8 text-center">
          <span className="material-symbols-outlined mb-2 text-4xl text-[#717971]/50">inventory</span>
          <p className="text-sm font-semibold text-[#414942]">Không có gói nào đang chờ</p>
          <p className="mt-1 text-xs text-[#717971]">Tất cả gói custom đã được đóng gói.</p>
        </div>
      :
        <div className="space-y-3">
          {bundles.map((bundle) => (
            <BundleRow
              key={bundle.id}
              bundle={bundle}
              onConfirm={handleConfirm}
              isConfirming={confirmingId === bundle.id}
            />
          ))}
        </div>
      }

      {totalPages > 1 ?
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-40">
            Trước
          </button>
          <span className="text-sm text-[#717971]">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-medium text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-40">
            Sau
          </button>
        </div>
      : null}
    </div>
  )
}
