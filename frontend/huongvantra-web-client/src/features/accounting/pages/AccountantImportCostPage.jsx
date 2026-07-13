import { useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showSuccess } from '../../../app/toast.js'
import { MOCK_IMPORT_BATCHES } from '../data/mockAccountingData.js'

export default function AccountantImportCostPage() {
  const [batches, setBatches] = useState(MOCK_IMPORT_BATCHES)
  const [drafts, setDrafts] = useState({})
  const [search, setSearch] = useState('')

  const filteredBatches = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return batches
    return batches.filter((batch) => {
      const all = `${batch.lotCode} ${batch.supplier} ${(batch.items || []).map((it) => `${it.skuCode} ${it.productName}`).join(' ')}`
      return all.toLowerCase().includes(keyword)
    })
  }, [batches, search])

  const totalRows = useMemo(() => batches.reduce((sum, batch) => sum + (batch.items?.length || 0), 0), [batches])
  const totalQty = useMemo(
    () => batches.reduce((sum, batch) => sum + (batch.items || []).reduce((s, row) => s + Number(row.quantity || 0), 0), 0),
    [batches],
  )

  function updateDraft(batchId, skuCode, value) {
    setDrafts((prev) => ({
      ...prev,
      [batchId]: {
        ...(prev[batchId] || {}),
        [skuCode]: value,
      },
    }))
  }

  function confirmBatch(batch) {
    const values = batch.items.map((it) => Number(drafts[batch.id]?.[it.skuCode]))
    if (values.some((v) => !Number.isFinite(v) || v <= 0)) {
      return
    }
    setBatches((prev) => prev.filter((it) => it.id !== batch.id))
    showSuccess(`Da xac nhan gia nhap cho lo ${batch.lotCode}.`)
  }

  return (
    <PageShell>
      <PageHeader
        title="Xac nhan gia nhap"
        description="Ke toan nhap gia mua theo hoa don nha cung cap. Day la giao dien mock, backend se noi sau."
        searchPlaceholder="Tim theo ma lo, nha cung cap, ma hang..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Phien ban nay chi de demo UI. Chua ghi du lieu xuong server.
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Lo cho xac nhan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{batches.length}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Dong hang</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalRows}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Tong so luong</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalQty}</p>
        </article>
      </section>

      {filteredBatches.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Khong co lo nao phu hop.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBatches.map((batch) => (
            <section key={batch.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">{batch.lotCode}</h2>
                <p className="text-sm text-slate-500">Nha cung cap: {batch.supplier}</p>
                <p className="text-xs text-slate-400">Ngay tao: {new Date(batch.createdAt).toLocaleString('vi-VN')}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Ma hang</th>
                      <th className="px-3 py-2 text-left">Ten hang</th>
                      <th className="px-3 py-2 text-right">So luong</th>
                      <th className="px-3 py-2 text-right">Gia mua vao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batch.items.map((item) => (
                      <tr key={item.skuCode}>
                        <td className="px-3 py-2 font-mono text-xs">{item.skuCode}</td>
                        <td className="px-3 py-2">{item.productName}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={drafts[batch.id]?.[item.skuCode] ?? ''}
                            onChange={(e) => updateDraft(batch.id, item.skuCode, e.target.value)}
                            className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-right"
                            placeholder="VD: 85000"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => confirmBatch(batch)}
                  className="rounded-lg bg-[#538463] px-4 py-2 text-sm font-semibold text-white hover:bg-[#457053]"
                >
                  Xac nhan gia nhap
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  )
}
