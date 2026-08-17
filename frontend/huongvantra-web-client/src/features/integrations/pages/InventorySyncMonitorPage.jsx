import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'
import { DetailBox, HubSegment, StatusPill } from '../components/IntegrationUi.jsx'
import {
  fetchOutboxMessages,
  fetchOutboxStats,
  retryOutboxMessage,
} from '../services/outboxMonitoringApi.js'
import {
  HUB_CHANNELS,
  buildErrorHint,
  channelLabel,
  errorCode,
  eventActionLabel,
} from '../utils/outboxPayload.js'

const DRAFT_KEY = 'hvt-integration-error-drafts'

function readDrafts() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDrafts(drafts) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

function readStatus(searchParams) {
  const raw = searchParams.get('status')
  if (raw === 'Failed' || raw === 'Pending' || raw === 'Published') return raw
  return ''
}

function statusLabel(status) {
  if (status === 'Failed') return 'Lỗi'
  if (status === 'Pending' || status === 'Processing') return 'Đang chờ'
  if (status === 'Published') return 'Đã gửi'
  return status || '—'
}

function matchesStatus(item, status) {
  if (!status) return true
  if (status === 'Pending') return item.status === 'Pending' || item.status === 'Processing'
  return item.status === status
}

function InventorySyncMonitorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const channel = searchParams.get('channel') || ''
  const status = readStatus(searchParams)
  const selectedId = searchParams.get('id') || ''
  const [searchValue, setSearchValue] = useState('')
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({ pending: 0, processing: 0, published: 0, failed: 0 })
  const [skipped, setSkipped] = useState(() => new Set())
  const [drafts, setDrafts] = useState(readDrafts)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [all, failed, nextStats] = await Promise.all([
        fetchOutboxMessages({ page: 1, pageSize: 100 }),
        fetchOutboxMessages({ status: 'Failed', page: 1, pageSize: 100 }),
        fetchOutboxStats(),
      ])
      const byId = new Map()
      for (const item of [...all.items, ...failed.items]) byId.set(item.id, item)
      setMessages([...byId.values()])
      setStats(nextStats)
    } catch (error) {
      setMessages([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const needle = searchValue.trim().toLowerCase()
    return messages
      .filter((item) => !item.orderChannel || item.orderChannel === 'POS' || item.orderChannel === 'COD')
      .filter((item) => !skipped.has(item.id))
      .filter((item) => !channel || item.orderChannel === channel)
      .filter((item) => matchesStatus(item, status))
      .filter((item) => {
        if (!needle) return true
        return [item.orderCode, item.lastError, item.orderChannel, item.eventType]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      })
  }, [messages, skipped, channel, status, searchValue])

  const selected = visible.find((item) => String(item.id) === selectedId) || visible[0] || null
  const canRetry = Boolean(selected && selected.status !== 'Published')

  useEffect(() => {
    if (!selected) {
      setNote('')
      return
    }
    setNote(drafts[selected.id] || '')
  }, [selected, drafts])

  function patchParams(mutator) {
    const next = new URLSearchParams(searchParams)
    mutator(next)
    setSearchParams(next, { replace: true })
  }

  function selectMessage(message) {
    patchParams((next) => {
      if (message?.id) next.set('id', message.id)
      else next.delete('id')
    })
  }

  async function handleRetry() {
    if (!selected || !canRetry) return
    setRetrying(true)
    try {
      const result = await retryOutboxMessage(selected.id)
      showSuccess(result.message || 'Đã gửi lại.')
      await load()
    } catch (error) {
      showError(error.message)
    } finally {
      setRetrying(false)
    }
  }

  function handleSkip() {
    if (!selected) return
    setSkipped((current) => new Set(current).add(selected.id))
    patchParams((next) => next.delete('id'))
  }

  function handleSaveDraft() {
    if (!selected) {
      showError('Chọn một dòng trước khi lưu nháp.')
      return
    }
    const next = { ...drafts, [selected.id]: note }
    setDrafts(next)
    writeDrafts(next)
    showSuccess('Đã lưu nháp.')
  }

  const createPath = selected?.orderId || selected?.aggregateId
    ? `/orders/${selected.orderId || selected.aggregateId}${selected.orderChannel === 'COD' ? '?from=cod' : ''}`
    : '/orders/cod'

  return (
    <PageShell>
      <PageHeader
        title="Hàng đợi đồng bộ"
        description="Tin POS/COD gửi sang kho. Tab Lỗi chỉ có khi gửi thất bại."
        searchPlaceholder="Tìm mã đơn..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        rightContent={
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded-full bg-[#8fb48c] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#7ea57b]"
          >
            Lưu nháp
          </button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <HubSegment
            label="Trạng thái"
            value={status}
            onChange={(value) => {
              patchParams((next) => {
                if (value) next.set('status', value)
                else next.delete('status')
                next.delete('id')
              })
            }}
            options={[
              { id: '', label: `Tất cả` },
              { id: 'Failed', label: `Lỗi` },
              { id: 'Pending', label: `Đang chờ` },
              { id: 'Published', label: `Đã gửi` },
            ]}
          />
          <span className="hidden h-10 w-px bg-slate-200 lg:block" aria-hidden="true" />
          <HubSegment
            label="Kênh"
            value={channel}
            onChange={(value) => {
              patchParams((next) => {
                if (value) next.set('channel', value)
                else next.delete('channel')
                next.delete('id')
              })
            }}
            options={[
              { id: '', label: 'Tất cả' },
              ...HUB_CHANNELS.map((item) => ({ id: item.id, label: item.label })),
            ]}
          />
        </div>
        <p className="text-xs text-slate-400">
          Lỗi {stats.failed} · Chờ {stats.pending + stats.processing} · Đã gửi {stats.published}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Danh sách</h2>
            <Link to="/integrations" className="text-sm font-semibold text-[#356647] hover:underline">
              Về tích hợp
            </Link>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">Đang tải...</p>
          ) : null}

          {!isLoading && visible.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <p className="font-semibold text-slate-800">
                {status === 'Failed' ? 'Không có lỗi gửi kho' : 'Không có dòng trong bộ lọc này'}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {status === 'Failed'
                  ? 'Kho đang nhận được tin. Chọn tab Đã gửi hoặc Tất cả để xem đơn đã đồng bộ.'
                  : 'Đổi tab trạng thái hoặc kênh.'}
              </p>
            </div>
          ) : null}

          {!isLoading && visible.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((message, index) => {
                const active = selected?.id === message.id
                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => selectMessage(message)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? 'border-[#538463] bg-[#538463]/10'
                        : 'border-slate-100 bg-[#fbf9f1]/70 hover:border-[#cfe0ce]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-800">
                        {message.orderCode || errorCode(message, index)}
                      </p>
                      <StatusPill status={statusLabel(message.status)} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {channelLabel(message.orderChannel)} · {eventActionLabel(message.eventType)}
                    </p>
                    {message.lastError && message.status === 'Failed' ? (
                      <p className="mt-1 truncate text-xs text-rose-600">{message.lastError}</p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-100 bg-[#fbf9f1]/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Action</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={!canRetry || retrying}
                className="rounded-full bg-[#2f5d3a] px-4 py-2 text-sm font-bold text-white hover:bg-[#274e31] disabled:opacity-50"
              >
                {retrying ? 'Đang gửi…' : 'Thử lại'}
              </button>
              <Link
                to={createPath}
                className="rounded-full bg-[#cfe0ce] px-4 py-2 text-sm font-bold text-[#2f5d3a] hover:bg-[#bfd6be]"
              >
                Mở đơn
              </Link>
              <button
                type="button"
                onClick={handleSkip}
                disabled={!selected}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Chi tiết</h2>
          {selected ? (
            <div className="space-y-3">
              <DetailBox label="Nguồn">{channelLabel(selected.orderChannel)}</DetailBox>
              <DetailBox label="Việc">{eventActionLabel(selected.eventType)}</DetailBox>
              <DetailBox label="Trạng thái">{statusLabel(selected.status)}</DetailBox>
              <DetailBox label="Thời điểm">
                {formatVietnamDateTimeMinute(selected.occurredAtUtc || selected.lastAttemptAtUtc)}
              </DetailBox>
              {selected.status === 'Failed' ? (
                <DetailBox label="Gợi ý">{buildErrorHint(selected)}</DetailBox>
              ) : null}
              {selected.orderCode ? (
                <DetailBox label="Mã đơn">{selected.orderCode}</DetailBox>
              ) : null}
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú nháp</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-[#fbf9f1]/80 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#538463]"
                  placeholder="Ghi chú xử lý..."
                />
              </label>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">Chọn một dòng để xem chi tiết</p>
          )}
        </section>
      </div>
    </PageShell>
  )
}

export default InventorySyncMonitorPage
