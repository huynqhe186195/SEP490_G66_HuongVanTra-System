import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import WarehouseDailyReportPanels, {
  buildOpenRowsForExport,
  computeDoneTotal,
} from '../components/WarehouseDailyReportPanels.jsx'
import { fetchWarehouseDailyReportSubmission } from '../services/warehouseDailyReportApi.js'
import { exportWarehouseDailyReportExcel } from '../utils/warehouseDailyReportExcel.js'

function formatDateVi(ymd) {
  if (!ymd) return '—'
  const raw = String(ymd).slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return raw
  return `${d}/${m}/${y}`
}

export default function WarehouseDailyReportSubmissionDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setDetail(await fetchWarehouseDailyReportSubmission(id))
    } catch (error) {
      setDetail(null)
      showError(error.message || 'Không tải được chi tiết lần gửi.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const dateLabel = useMemo(() => formatDateVi(detail?.businessDate), [detail])
  const doneTotal = useMemo(() => computeDoneTotal(detail?.report), [detail])
  const openRows = useMemo(() => buildOpenRowsForExport(detail?.report), [detail])

  function handleExport() {
    if (!detail?.report) {
      showError('Chưa có dữ liệu để xuất.')
      return
    }
    try {
      const date = String(detail.businessDate).slice(0, 10)
      exportWarehouseDailyReportExcel({
        report: detail.report,
        date,
        dateLabel,
        doneTotal,
        openRows,
        source: 'snapshot',
      })
      showSuccess('Đã xuất file Excel từ snapshot.')
    } catch (error) {
      showError(error.message || 'Không xuất được file Excel.')
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Chi tiết báo cáo đã gửi"
        titleInfo="Đây là snapshot đầy đủ tại thời điểm Thủ kho gửi. Số liệu không đổi dù kho thay đổi sau đó."
        rightContent={(
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/inventory/warehouse-daily-report/submissions"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]">list</span>
              Danh sách đã gửi
            </Link>
            <button
              type="button"
              onClick={handleExport}
              disabled={!detail?.report || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Xuất Excel
            </button>
          </div>
        )}
      />

      {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : null}
      {!loading && !detail?.report ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Không tải được lần gửi này.
        </p>
      ) : null}

      {detail?.report ? (
        <>
          <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày báo cáo</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{dateLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gửi lúc</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{formatVietnamDateTimeMinute(detail.sentAtUtc)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Người gửi</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {detail.sentByName}
                  {detail.sentByRoleName ? ` · ${detail.sentByRoleName}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tóm tắt</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {detail.doneTotal} đã làm · {detail.openCarryCount} còn dở
                </p>
              </div>
            </div>
          </div>

          <WarehouseDailyReportPanels
            report={detail.report}
            showOpenAsFrozen
            dateLabel={dateLabel}
          />
        </>
      ) : null}
    </PageShell>
  )
}
