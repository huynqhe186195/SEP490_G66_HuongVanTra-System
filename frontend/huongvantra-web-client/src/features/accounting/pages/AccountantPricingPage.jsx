import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showSuccess } from '../../../app/toast.js'
import { formatProductPrice } from '../../products/utils/productDisplay.js'
import { createPriceProposalMock } from '../services/priceProposalMockApi.js'
import { MOCK_PRICING_ROWS } from '../data/mockAccountingData.js'

function calculateMargin(costPrice, retailPrice) {
  if (!retailPrice || retailPrice <= 0) return null
  return ((retailPrice - costPrice) / retailPrice) * 100
}

function calculateSuggestedPrice(costPrice, targetMarginPercent) {
  const m = Number(targetMarginPercent)
  if (!Number.isFinite(m) || m <= 0 || m >= 100) return null
  return Math.round(costPrice / (1 - m / 100))
}

export default function AccountantPricingPage() {
  const [targetMarginPercent, setTargetMarginPercent] = useState('30')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return MOCK_PRICING_ROWS
      .map((row) => {
        const suggestedPrice = calculateSuggestedPrice(row.costPrice, targetMarginPercent)
        return {
          ...row,
          suggestedPrice,
          margin: calculateMargin(row.costPrice, row.retailPrice),
        }
      })
      .filter((row) => {
        if (typeFilter !== 'all' && row.productType !== typeFilter) return false
        if (!keyword) return true
        return `${row.skuCode} ${row.productName} ${row.productType}`.toLowerCase().includes(keyword)
      })
  }, [search, targetMarginPercent, typeFilter])

  const suggestableRows = useMemo(
    () => rows.filter((row) => row.suggestedPrice && row.suggestedPrice !== row.retailPrice),
    [rows],
  )

  async function submitBulkProposal() {
    for (const row of suggestableRows) {
      await createPriceProposalMock({
        skuCode: row.skuCode,
        productName: row.productName,
        currentRetailPrice: row.retailPrice,
        proposedRetailPrice: row.suggestedPrice,
        costPriceSnapshot: row.costPrice,
        targetMarginPercent: Number(targetMarginPercent),
      })
    }
    showSuccess(`Da gui ${suggestableRows.length} de xuat gia.`)
  }

  async function submitProposal(row) {
    await createPriceProposalMock({
      skuCode: row.skuCode,
      productName: row.productName,
      currentRetailPrice: row.retailPrice,
      proposedRetailPrice: row.suggestedPrice,
      costPriceSnapshot: row.costPrice,
      targetMarginPercent: Number(targetMarginPercent),
    })
    showSuccess(`Da gui gia moi cho ${row.skuCode}.`)
  }

  return (
    <PageShell>
      <PageHeader
        title="Bang gia ban hang"
        description="Xem gia mua vao, gia dang ban va goi y gia nen ban theo % lai mong muon."
        searchPlaceholder="Tim ma hang, ten san pham..."
        searchValue={search}
        onSearchChange={setSearch}
        rightContent={(
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="target-margin">Muon lai</label>
            <input
              id="target-margin"
              type="number"
              min="1"
              max="99"
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right"
              value={targetMarginPercent}
              onChange={(e) => setTargetMarginPercent(e.target.value)}
            />
            <span>%</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Tat ca loai</option>
              <option value="THANH_PHAM">Thanh pham</option>
              <option value="NGUYEN_LIEU">Nguyen lieu</option>
            </select>
            <button
              type="button"
              onClick={submitBulkProposal}
              className="rounded-lg bg-[#538463] px-3 py-1.5 font-semibold text-white"
            >
              Gui hang loat ({suggestableRows.length})
            </button>
            <Link to="/accounting/price-proposals" className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold">
              De xuat cua toi
            </Link>
          </div>
        )}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Day la giao dien mock, hien chua cap nhat du lieu backend.
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Tong ma hang</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Can dieu chinh gia</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{suggestableRows.length}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">% lai muc tieu</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{targetMarginPercent}%</p>
        </article>
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Ma hang</th>
              <th className="px-3 py-2 text-left">Ten san pham</th>
              <th className="px-3 py-2 text-left">Loai</th>
              <th className="px-3 py-2 text-right">Gia mua vao</th>
              <th className="px-3 py-2 text-right">Gia dang ban</th>
              <th className="px-3 py-2 text-right">Gia nen ban</th>
              <th className="px-3 py-2 text-right">% lai hien tai</th>
              <th className="px-3 py-2 text-right">Thao tac</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.skuCode}>
                <td className="px-3 py-2 font-mono text-xs">{row.skuCode}</td>
                <td className="px-3 py-2">{row.productName}</td>
                <td className="px-3 py-2">{row.productType === 'THANH_PHAM' ? 'Thanh pham' : 'Nguyen lieu'}</td>
                <td className="px-3 py-2 text-right">{formatProductPrice(row.costPrice)}</td>
                <td className="px-3 py-2 text-right">{formatProductPrice(row.retailPrice)}</td>
                <td className="px-3 py-2 text-right font-semibold text-[#356647]">{formatProductPrice(row.suggestedPrice || 0)}</td>
                <td className="px-3 py-2 text-right">{row.margin == null ? '—' : `${row.margin.toFixed(1)}%`}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => submitProposal(row)}
                    className="rounded-lg border border-[#356647]/30 px-3 py-1.5 text-xs font-semibold text-[#356647]"
                  >
                    Gui gia moi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PageShell>
  )
}
