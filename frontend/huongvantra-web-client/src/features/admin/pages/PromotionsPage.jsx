import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDate, toVietnamDateInputValue } from '../../../utils/vietnamDateTime.js'
import {
  formatPromotionLabel,
  getPromotionValidityLabel,
} from '../../pos/utils/posPromotionUtils.js'
import {
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminPromotions,
  updateAdminPromotion,
} from '../services/promotionsAdminApi.js'

const EMPTY_FORM = {
  promoCode: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  validFrom: '',
  validTo: '',
}

const VALIDITY_BADGE_CLASS = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_started: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
  unlimited: 'bg-slate-50 text-slate-600 border-slate-200',
}

function formatPromotionPeriod(promotion) {
  const from = promotion.validFromUtc ? formatVietnamDate(promotion.validFromUtc) : null
  const to = promotion.validToUtc ? formatVietnamDate(promotion.validToUtc) : null

  if (from && to) return `${from} → ${to}`
  if (from) return `Từ ${from}`
  if (to) return `Đến ${to}`
  return 'Không giới hạn'
}

function PromotionsPage() {
  const [promotions, setPromotions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchAdminPromotions()
      setPromotions(items)
    } catch (error) {
      setPromotions([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (promotion) => {
    setEditingId(promotion.id)
    setForm({
      promoCode: promotion.promoCode,
      discountType: promotion.discountType,
      discountValue: String(promotion.discountValue),
      validFrom: promotion.validFromUtc ? toVietnamDateInputValue(promotion.validFromUtc) : '',
      validTo: promotion.validToUtc ? toVietnamDateInputValue(promotion.validToUtc) : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      promoCode: form.promoCode.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
    }

    if (!payload.promoCode) {
      showError('Vui lòng nhập mã giảm giá.')
      return
    }

    if (payload.validFrom && payload.validTo && payload.validFrom > payload.validTo) {
      showError('Ngày bắt đầu không được sau ngày kết thúc.')
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateAdminPromotion(editingId, payload)
        showSuccess('Đã cập nhật mã giảm giá.')
      } else {
        await createAdminPromotion(payload)
        showSuccess('Đã thêm mã giảm giá.')
      }
      setModalOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (promotion) => {
    if (!window.confirm(`Xóa mã "${promotion.promoCode}"?`)) return
    try {
      await deleteAdminPromotion(promotion.id)
      showSuccess('Đã xóa mã giảm giá.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Quản lý mã giảm giá"
        description="Tạo và chỉnh sửa mã khuyến mãi dùng tại POS và trên đơn hàng"
        rightContent={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Thêm mã
          </button>
        }
      />

      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loại giảm: <strong>PERCENTAGE</strong> (% trên đơn sau CK thủ công) hoặc <strong>FIXED</strong> (số tiền cố định).
        Thời hạn để trống = không giới hạn. Mã đã dùng trên đơn không thể xóa.
      </p>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã</th>
                <th className="px-4 py-4">Loại</th>
                <th className="px-4 py-4">Giá trị</th>
                <th className="px-4 py-4">Thời hạn</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Mô tả</th>
                <th className="px-4 py-4">Số đơn</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={8}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && promotions.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={8}>
                    Chưa có mã giảm giá. Bấm &quot;Thêm mã&quot; để tạo.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? promotions.map((promotion) => {
                    const status = promotion.validityStatus || 'unlimited'
                    const badgeClass = VALIDITY_BADGE_CLASS[status] ?? VALIDITY_BADGE_CLASS.unlimited

                    return (
                      <tr key={promotion.id} className="hover:bg-[#fbf9f1]/30">
                        <td className="px-8 py-5 font-bold text-slate-800">{promotion.promoCode}</td>
                        <td className="px-4 py-5 text-slate-600">{promotion.discountType}</td>
                        <td className="px-4 py-5 text-slate-700">
                          {promotion.discountType === 'FIXED'
                            ? `${promotion.discountValue.toLocaleString('vi-VN')} đ`
                            : `${promotion.discountValue}%`}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatPromotionPeriod(promotion)}
                        </td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                            {getPromotionValidityLabel(status)}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-sm text-[#538463]">
                          {formatPromotionLabel(promotion)}
                        </td>
                        <td className="px-4 py-5 text-slate-600">{promotion.orderCount}</td>
                        <td className="px-8 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(promotion)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá'}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Mã</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                  value={form.promoCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
                  placeholder="VD: SALE10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Loại giảm</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.discountType}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
                >
                  <option value="PERCENTAGE">PERCENTAGE — giảm theo %</option>
                  <option value="FIXED">FIXED — giảm số tiền cố định</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">
                  Giá trị {form.discountType === 'FIXED' ? '(đ)' : '(%)'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.discountValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Từ ngày</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.validFrom}
                    onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">Đến ngày</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.validTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Để trống cả hai ô nếu mã không giới hạn thời gian. Ngày tính theo giờ Việt Nam.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default PromotionsPage
