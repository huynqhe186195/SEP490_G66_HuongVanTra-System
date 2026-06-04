import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { TIER_AUTO_UPGRADE_HINT } from '../../customers/utils/membershipTierUtils.js'
import {
  createAdminMembershipTier,
  deleteAdminMembershipTier,
  fetchAdminMembershipTiers,
  updateAdminMembershipTier,
} from '../services/tiersAdminApi.js'

const EMPTY_FORM = {
  tierCode: '',
  minTotalSpend: '',
  discountPercent: '',
}

function MembershipTiersPage() {
  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchAdminMembershipTiers()
      setTiers(items)
    } catch (error) {
      setTiers([])
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

  const openEdit = (tier) => {
    setEditingId(tier.id)
    setForm({
      tierCode: tier.tierCode,
      minTotalSpend: String(tier.minTotalSpend),
      discountPercent: String(tier.discountPercent),
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      tierCode: form.tierCode.trim(),
      minTotalSpend: Number(form.minTotalSpend),
      discountPercent: Number(form.discountPercent),
    }

    if (!payload.tierCode) {
      showError('Vui lòng nhập mã hạng.')
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateAdminMembershipTier(editingId, payload)
        showSuccess('Đã cập nhật hạng thẻ.')
      } else {
        await createAdminMembershipTier(payload)
        showSuccess('Đã thêm hạng thẻ.')
      }
      setModalOpen(false)
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (tier) => {
    if (!window.confirm(`Xóa hạng "${tier.tierCode}"?`)) return
    try {
      await deleteAdminMembershipTier(tier.id)
      showSuccess('Đã xóa hạng thẻ.')
      await loadData()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Quản lý hạng thẻ"
        description="Cấu hình ngưỡng chi tiêu và chiết khấu theo hạng khách hàng thân thiết"
        rightContent={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Thêm hạng
          </button>
        }
      />

      <p className="mb-6 rounded-xl border border-[#538463]/20 bg-[#538463]/5 px-4 py-3 text-sm text-slate-600">
        {TIER_AUTO_UPGRADE_HINT}
      </p>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã hạng</th>
                <th className="px-4 py-4">Ngưỡng chi tiêu</th>
                <th className="px-4 py-4">Chiết khấu</th>
                <th className="px-4 py-4">Số khách</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={5}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && tiers.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={5}>
                    Chưa có hạng thẻ. Bấm &quot;Thêm hạng&quot; để tạo.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tiers.map((tier) => (
                    <tr key={tier.id} className="hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-800">{tier.tierCode}</td>
                      <td className="px-4 py-5 text-slate-700">
                        {tier.minTotalSpend.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-5 text-slate-700">{tier.discountPercent}%</td>
                      <td className="px-4 py-5 text-slate-600">{tier.customerCount}</td>
                      <td className="px-8 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(tier)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tier)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? 'Sửa hạng thẻ' : 'Thêm hạng thẻ'}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Mã hạng</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                  value={form.tierCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, tierCode: e.target.value.toUpperCase() }))}
                  placeholder="VD: SILVER"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Ngưỡng chi tiêu (đ)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.minTotalSpend}
                  onChange={(e) => setForm((prev) => ({ ...prev, minTotalSpend: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-400">Chiết khấu (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.discountPercent}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
                />
              </label>
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

export default MembershipTiersPage
