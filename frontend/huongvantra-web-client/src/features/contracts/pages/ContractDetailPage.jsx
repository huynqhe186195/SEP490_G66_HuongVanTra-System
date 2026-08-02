import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canApproveContracts } from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import {
  deleteContract,
  fetchContractById,
  reviewContract,
  submitContract,
} from '../services/contractsApi.js'

const CONTRACT_TYPE_LABELS = {
  DaiLy: 'Đại lý',
  CungCap: 'Cung cấp',
  KhungHopTac: 'Khung hợp tác',
  Khac: 'Khác',
}

const STATUS_BADGES = {
  Draft: { label: 'Nháp', cls: 'bg-[#f2f0e8] text-[#717971]' },
  PendingApproval: { label: 'Chờ duyệt', cls: 'bg-[#fef3c7] text-[#92400e]' },
  Active: { label: 'Hiệu lực', cls: 'bg-[#dcfce7] text-[#166534]' },
  Rejected: { label: 'Từ chối', cls: 'bg-[#fee2e2] text-[#991b1b]' },
  Expired: { label: 'Hết hạn', cls: 'bg-[#e2e8f0] text-[#475569]' },
}

function StatusBadge({ status }) {
  const badge = STATUS_BADGES[status] ?? { label: status, cls: 'bg-[#f2f0e8] text-[#717971]' }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${badge.cls}`}>
      {badge.label}
    </span>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN')
}

function formatVnd(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('vi-VN') + ' đ'
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-4 border-b border-[#f0eee6] py-3 last:border-0">
      <span className="w-44 shrink-0 text-sm text-[#717971]">{label}</span>
      <span className="text-sm text-[#1a1a1a]">{value ?? '—'}</span>
    </div>
  )
}

function RejectModal({ onClose, onConfirm, isBusy }) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  function handleConfirm() {
    const trimmed = note.trim()
    if (!trimmed) { setErr('Vui lòng nhập lý do từ chối.'); return }
    if (trimmed.length < 10) { setErr('Lý do từ chối phải có ít nhất 10 ký tự.'); return }
    if (trimmed.length > 1000) { setErr('Lý do từ chối không được vượt quá 1000 ký tự.'); return }
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-base font-semibold text-[#1a1a1a]">Lý do từ chối</h3>
        <ReasonSuggestionChips
          className="mb-3"
          suggestions={getReasonSuggestions('contractReject')}
          value={note}
          onSelect={(text) => { setNote(text); setErr('') }}
        />
        <textarea
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] ${err ? 'border-[#b42318]' : 'border-[#e8e5de]'}`}
          rows={4}
          value={note}
          onChange={(e) => { setNote(e.target.value); setErr('') }}
          placeholder="Mô tả lý do từ chối hợp đồng này..."
          maxLength={1000}
          autoFocus
        />
        <div className="flex items-start justify-between">
          {err ? <p className="mt-1 text-xs text-[#b42318]">{err}</p> : <span />}
          <span className={`mt-1 text-xs ${note.length > 900 ? 'text-[#b42318]' : 'text-[#717971]'}`}>
            {note.length}/1000
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg border border-[#e8e5de] px-4 py-2 text-sm text-[#717971] hover:bg-[#f9f7f2]"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={isBusy}
            className="rounded-lg bg-[#b42318] px-4 py-2 text-sm font-medium text-white hover:bg-[#991b1b] disabled:opacity-50"
          >
            {isBusy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useMemo(() => loadAuthSession(), [])
  const canApprove = canApproveContracts(session)
  const currentUserId = session?.userId

  const [contract, setContract] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionBusy, setIsActionBusy] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  async function load() {
    setIsLoading(true)
    try {
      const c = await fetchContractById(id)
      if (!c) { navigate('/contracts'); return }
      setContract(c)
    } catch {
      showError('Không thể tải hợp đồng.')
      navigate('/contracts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleSubmit() {
    if (!(await confirmDialog({
      title: canApprove ? 'Ban hành hợp đồng' : 'Gửi duyệt',
      message: canApprove
        ? 'Ban hành hợp đồng này? Hợp đồng sẽ có hiệu lực ngay và không thể chỉnh sửa.'
        : 'Gửi hợp đồng để duyệt? Bạn sẽ không thể chỉnh sửa cho đến khi Quản lý phản hồi.',
      tone: 'primary',
    }))) return
    setIsActionBusy(true)
    try {
      const updated = await submitContract(id)
      setContract(updated)
      showSuccess(canApprove ? 'Đã ban hành hợp đồng.' : 'Đã gửi hợp đồng chờ duyệt.')
    } catch (err) {
      showError(err?.message ?? 'Không thể gửi hợp đồng.')
    } finally {
      setIsActionBusy(false)
    }
  }

  async function handleApprove() {
    if (!(await confirmDialog({
      title: 'Xác nhận duyệt',
      message: 'Duyệt hợp đồng này?',
      tone: 'primary',
    }))) return
    setIsActionBusy(true)
    try {
      const updated = await reviewContract(id, true, null)
      setContract(updated)
      showSuccess('Đã duyệt hợp đồng.')
    } catch (err) {
      showError(err?.message ?? 'Không thể duyệt hợp đồng.')
    } finally {
      setIsActionBusy(false)
    }
  }

  async function handleReject(note) {
    setIsActionBusy(true)
    try {
      const updated = await reviewContract(id, false, note)
      setContract(updated)
      setShowRejectModal(false)
      showSuccess('Đã từ chối hợp đồng.')
    } catch (err) {
      showError(err?.message ?? 'Không thể từ chối hợp đồng.')
    } finally {
      setIsActionBusy(false)
    }
  }

  async function handleDelete() {
    if (!(await confirmDialog({
      title: 'Xác nhận',
      message: `Xóa hợp đồng "${contract.contractCode}"?`,
      tone: 'danger',
    }))) return
    setIsActionBusy(true)
    try {
      await deleteContract(id)
      showSuccess('Đã xóa hợp đồng.')
      navigate('/contracts')
    } catch (err) {
      showError(err?.message ?? 'Không thể xóa hợp đồng.')
    } finally {
      setIsActionBusy(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex h-48 items-center justify-center text-sm text-[#717971]">Đang tải...</div>
      </PageShell>
    )
  }

  if (!contract) return null

  const isOwner = contract.createdByUserId === currentUserId
  const isPending = contract.status === 'PendingApproval'
  const isRejected = contract.status === 'Rejected'
  const isEditable = contract.status === 'Draft' || contract.status === 'Rejected'

  const showEditActions = isOwner && isEditable
  // Người tạo không tự phán quyết hợp đồng của mình.
  const showApproveActions = canApprove && isPending && !isOwner

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/contracts" className="inline-flex items-center gap-1 text-sm text-[#717971] hover:text-[#1a1a1a]">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại
        </Link>
      </div>
      <PageHeader
        title={contract.contractCode}
        description={contract.title}
        rightContent={
          <div className="flex items-center gap-2">
            <StatusBadge status={contract.status} />
            {showEditActions && (
              <>
                <Link
                  to={`/contracts/${id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e5de] px-3 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f9f7f2]"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Sửa
                </Link>
                <button
                  onClick={handleSubmit}
                  disabled={isActionBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-3 py-2 text-sm font-medium text-white hover:bg-[#333] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  {canApprove ? 'Ban hành' : 'Gửi duyệt'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isActionBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e5de] px-3 py-2 text-sm font-medium text-[#b42318] hover:bg-[#fee2e2] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Xóa
                </button>
              </>
            )}
            {showApproveActions && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isActionBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#166534] px-3 py-2 text-sm font-medium text-white hover:bg-[#14532d] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Duyệt
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isActionBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e5de] px-3 py-2 text-sm font-medium text-[#b42318] hover:bg-[#fee2e2] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">cancel</span>
                  Từ chối
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Rejection note banner */}
      {isRejected && contract.rejectionNote && (
        <div className="mb-6 flex gap-3 rounded-xl border border-[#fecaca] bg-[#fee2e2] px-4 py-3">
          <span className="material-symbols-outlined mt-0.5 text-base text-[#b42318]">report</span>
          <div>
            <p className="text-sm font-semibold text-[#991b1b]">Hợp đồng bị từ chối</p>
            <p className="mt-0.5 text-sm text-[#b42318]">{contract.rejectionNote}</p>
            {isOwner && (
              <p className="mt-1 text-xs text-[#b42318]">
                Bạn có thể chỉnh sửa và gửi duyệt lại.
              </p>
            )}
          </div>
        </div>
      )}

      {isPending && isOwner && (
        <div className="mb-6 flex gap-3 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3">
          <span className="material-symbols-outlined mt-0.5 text-base text-[#92400e]">hourglass_top</span>
          <div>
            <p className="text-sm font-semibold text-[#92400e]">Đang chờ Quản lý phán quyết</p>
            <p className="mt-0.5 text-sm text-[#92400e]">
              Hợp đồng bị khóa chỉnh sửa cho tới khi có phản hồi. Nếu bị từ chối, bạn sẽ sửa lại được.
            </p>
          </div>
        </div>
      )}

      {/* Contract info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Main details */}
          <div className="rounded-xl border border-[#f0eee6] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#717971]">Thông tin hợp đồng</h2>
            <InfoRow label="Mã hợp đồng" value={<span className="font-mono">{contract.contractCode}</span>} />
            <InfoRow label="Khách hàng" value={`${contract.customerName} (${contract.customerCode})`} />
            <InfoRow label="Loại hợp đồng" value={CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType} />
            <InfoRow label="Ngày hiệu lực" value={formatDate(contract.effectiveDate)} />
            <InfoRow label="Ngày hết hạn" value={formatDate(contract.expiryDate)} />
          </div>

          {/* Commercial terms */}
          <div className="rounded-xl border border-[#f0eee6] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#717971]">Điều khoản thương mại</h2>
            <InfoRow
              label="Chiết khấu"
              value={contract.discountPercent != null ? `${contract.discountPercent}%` : null}
            />
            <InfoRow label="Hạn mức công nợ" value={formatVnd(contract.creditLimit)} />
            <InfoRow
              label="Kỳ hạn thanh toán"
              value={contract.paymentTermDays != null ? `NET ${contract.paymentTermDays}` : null}
            />
          </div>

          {/* Notes */}
          {contract.notes && (
            <div className="rounded-xl border border-[#f0eee6] bg-white p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#717971]">Điều khoản / Ghi chú</h2>
              <p className="whitespace-pre-wrap text-sm text-[#1a1a1a]">{contract.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar: timeline */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#f0eee6] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#717971]">Lịch sử trạng thái</h2>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="material-symbols-outlined mt-0.5 text-base text-[#717971]">edit_note</span>
                <div>
                  <p className="font-medium text-[#1a1a1a]">Tạo hợp đồng</p>
                  <p className="text-xs text-[#717971]">{formatDateTime(contract.createdAt)}</p>
                </div>
              </div>
              {contract.submittedAt && (
                <div className="flex gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-base text-[#92400e]">send</span>
                  <div>
                    <p className="font-medium text-[#1a1a1a]">Gửi chờ duyệt</p>
                    <p className="text-xs text-[#717971]">{formatDateTime(contract.submittedAt)}</p>
                  </div>
                </div>
              )}
              {contract.reviewedAt && (
                <div className="flex gap-2">
                  <span
                    className={`material-symbols-outlined mt-0.5 text-base ${
                      isRejected ? 'text-[#b42318]' : 'text-[#166534]'
                    }`}
                  >
                    {isRejected ? 'cancel' : 'check_circle'}
                  </span>
                  <div>
                    <p className="font-medium text-[#1a1a1a]">{isRejected ? 'Đã từ chối' : 'Đã duyệt'}</p>
                    <p className="text-xs text-[#717971]">{formatDateTime(contract.reviewedAt)}</p>
                  </div>
                </div>
              )}
              {contract.status === 'Expired' && (
                <div className="flex gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-base text-[#475569]">event_busy</span>
                  <div>
                    <p className="font-medium text-[#1a1a1a]">Đã hết hạn</p>
                    <p className="text-xs text-[#717971]">{formatDate(contract.expiryDate)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#f0eee6] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#717971]">Cập nhật lần cuối</h2>
            <p className="text-sm text-[#717971]">{formatDateTime(contract.updatedAt)}</p>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <RejectModal
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleReject}
          isBusy={isActionBusy}
        />
      )}
    </PageShell>
  )
}

export default ContractDetailPage
