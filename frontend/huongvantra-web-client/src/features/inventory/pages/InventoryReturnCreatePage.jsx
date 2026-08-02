import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canOperateSupplierReturn } from '../../auth/utils/permissions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { uploadImage } from '../../products/services/cloudinaryApi.js'
import SupplierReturnConfirmModal, {
  SUPPLIER_RETURN_FLOW_DESCRIPTION,
} from '../components/SupplierReturnConfirmModal.jsx'
import { fetchSupplierReceiptById, fetchSupplierReceipts } from '../services/supplierReceiptApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'
import {
  createSupplierReturnRequest,
  fetchSupplierReturnDefectReasons,
} from '../services/inventoryReturnApi.js'

const LIST_PATH = '/inventory/returns'
const SOURCE_LOCATION = 'Warehouse'
const DEFECT_REASON_OTHER = 'OTHER'
const MAX_EVIDENCE_IMAGES = 5
const MAX_EVIDENCE_IMAGE_BYTES = 5 * 1024 * 1024
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'
const FIELD_CLASS =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#538463]'
const RECEIPT_GRID = 'grid grid-cols-[1.1fr_1.4fr_1.1fr_auto] items-center gap-3'

function newOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Chỉ cho trả đúng lô đã nhập theo phiếu NCC gốc: ghép từng dòng phiếu nhập với lô tồn Kho
 * tương ứng, dòng nào lô đã hết/không còn ở Kho thì vẫn hiện nhưng khoá không cho trả.
 */
function buildReceiptLineOptions(receipt, batches) {
  if (!receipt) return []
  const normalizedLocation = SOURCE_LOCATION.toLowerCase()
  const batchById = new Map(batches.map((batch) => [batch.id, batch]))

  return (receipt.items ?? [])
    .filter((line) => line.warehouseBatchId)
    .map((line) => {
      const batch = batchById.get(line.warehouseBatchId)
      const inWarehouse = batch && String(batch.location || 'Warehouse').toLowerCase() === normalizedLocation
      const batchItem = inWarehouse
        ? (batch.items ?? []).find((item) => item.skuId === line.skuId)
        : null
      return {
        key: `${line.warehouseBatchId}:${line.skuId}`,
        receiptLine: line,
        batchId: line.warehouseBatchId,
        lotCode: line.warehouseBatchLotCode || line.lotCode || batch?.lotCode || '',
        expiresAt: batch?.expiresAt ?? line.expiresAt ?? null,
        receivedQuantity: Number(line.actualReceivedQuantity || line.quantity || 0),
        availableQuantity: Number(batchItem?.quantityOnHand ?? 0),
      }
    })
}

function StepBadge({ index, title, hint }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#538463] text-xs font-bold text-white">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  )
}

export default function InventoryReturnCreatePage() {
  const navigate = useNavigate()
  const canOperate = canOperateSupplierReturn(loadAuthSession())

  const [defectReasons, setDefectReasons] = useState([])
  const [defectReasonCode, setDefectReasonCode] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [originalSearch, setOriginalSearch] = useState('')
  const [originalOptions, setOriginalOptions] = useState([])
  const [selectedOriginal, setSelectedOriginal] = useState(null)
  const [receiptDetail, setReceiptDetail] = useState(null)
  const [batches, setBatches] = useState([])
  const [quantityDrafts, setQuantityDrafts] = useState({})
  const [evidenceImageUrls, setEvidenceImageUrls] = useState([])
  const [uploadingCount, setUploadingCount] = useState(0)

  const [isLoadingOriginals, setIsLoadingOriginals] = useState(false)
  const [isLoadingReceiptLines, setIsLoadingReceiptLines] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDraft, setConfirmDraft] = useState(null)
  const operationIdRef = useRef(null)

  useEffect(() => {
    if (!canOperate) return undefined
    let mounted = true
    fetchSupplierReturnDefectReasons()
      .then((result) => {
        if (!mounted) return
        setDefectReasons(result)
        setDefectReasonCode((current) => current || result[0]?.code || '')
      })
      .catch((error) => {
        if (mounted) showError(error.message)
      })
    return () => {
      mounted = false
    }
  }, [canOperate])

  useEffect(() => {
    if (!canOperate) return undefined
    let mounted = true
    const timer = window.setTimeout(async () => {
      setIsLoadingOriginals(true)
      try {
        const result = await fetchSupplierReceipts({
          status: 'completed',
          search: originalSearch.trim() || undefined,
          page: 1,
          pageSize: 8,
        })
        if (mounted) setOriginalOptions(result.items ?? [])
      } catch {
        if (mounted) setOriginalOptions([])
      } finally {
        if (mounted) setIsLoadingOriginals(false)
      }
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [originalSearch, canOperate])

  // Chọn phiếu nhập gốc là nạp lại toàn bộ dòng hàng của chính phiếu đó; dòng đã chọn trước bị xoá
  // trong chooseOriginal/clearOriginal để không lẫn hàng của phiếu khác.
  useEffect(() => {
    if (!selectedOriginal) return undefined

    let mounted = true
    Promise.all([
      fetchSupplierReceiptById(selectedOriginal.id),
      fetchWarehouseBatches({ availableOnly: true }),
    ])
      .then(([detail, warehouseBatches]) => {
        if (!mounted) return
        setReceiptDetail(detail)
        setBatches(warehouseBatches)
      })
      .catch((error) => {
        if (!mounted) return
        setReceiptDetail(null)
        setBatches([])
        showError(error.message)
      })
      .finally(() => {
        if (mounted) setIsLoadingReceiptLines(false)
      })

    return () => {
      mounted = false
    }
  }, [selectedOriginal])

  function resetReceiptSelection() {
    setReceiptDetail(null)
    setBatches([])
    setQuantityDrafts({})
  }

  function chooseOriginal(option) {
    // Bấm lại đúng phiếu đang chọn là bỏ chọn.
    if (selectedOriginal?.id === option.id) {
      clearOriginal('')
      return
    }
    resetReceiptSelection()
    setIsLoadingReceiptLines(true)
    setSelectedOriginal(option)
    setOriginalSearch(option.receiptCode)
  }

  function clearOriginal(nextSearch) {
    resetReceiptSelection()
    setIsLoadingReceiptLines(false)
    setSelectedOriginal(null)
    setOriginalSearch(nextSearch)
  }

  const receiptLineOptions = useMemo(
    () => buildReceiptLineOptions(receiptDetail, batches),
    [receiptDetail, batches],
  )

  // Dòng trả chính là các dòng của phiếu nhập được nhập số lượng > 0, không còn bước "Thêm" riêng.
  const lines = useMemo(
    () =>
      receiptLineOptions
        .map((option) => ({
          key: option.key,
          skuId: option.receiptLine.skuId,
          skuCode: option.receiptLine.skuCode,
          skuSnapshotName: option.receiptLine.skuNameSnapshot,
          batchId: option.batchId,
          lotCode: option.lotCode,
          quantity: Number(quantityDrafts[option.key] ?? 0),
        }))
        .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0),
    [receiptLineOptions, quantityDrafts],
  )
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const selectedDefectReason = defectReasons.find((item) => item.code === defectReasonCode)

  function changeReturnQuantity(option, raw) {
    if (raw === '') {
      setQuantityDrafts((current) => ({ ...current, [option.key]: '' }))
      return
    }
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed < 0) return
    const clamped = Math.min(parsed, option.availableQuantity)
    setQuantityDrafts((current) => ({ ...current, [option.key]: String(clamped) }))
  }

  async function handleEvidenceChange(event) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length === 0) return

    const remaining = MAX_EVIDENCE_IMAGES - evidenceImageUrls.length
    if (remaining <= 0) {
      showError(`Chỉ được đính kèm tối đa ${MAX_EVIDENCE_IMAGES} ảnh bằng chứng.`)
      return
    }
    if (picked.length > remaining) {
      showError(`Chỉ còn chỗ cho ${remaining} ảnh, các ảnh dư sẽ bị bỏ qua.`)
    }

    const accepted = []
    for (const file of picked.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        showError(`"${file.name}": bằng chứng hậu kiểm phải là file ảnh.`)
        continue
      }
      if (file.size > MAX_EVIDENCE_IMAGE_BYTES) {
        showError(`"${file.name}": ảnh tối đa 5MB.`)
        continue
      }
      accepted.push(file)
    }
    if (accepted.length === 0) return

    setUploadingCount((current) => current + accepted.length)
    for (const file of accepted) {
      try {
        const url = await uploadImage(file)
        setEvidenceImageUrls((current) =>
          current.includes(url) || current.length >= MAX_EVIDENCE_IMAGES ? current : [...current, url],
        )
      } catch (error) {
        showError(error.message)
      } finally {
        setUploadingCount((current) => current - 1)
      }
    }
  }

  function removeEvidenceImage(url) {
    setEvidenceImageUrls((current) => current.filter((item) => item !== url))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!selectedOriginal) {
      showError('Vui lòng chọn phiếu nhập nhà cung cấp gốc.')
      return
    }
    if (!defectReasonCode) {
      showError('Vui lòng chọn lý do trả hàng.')
      return
    }
    if (defectReasonCode === DEFECT_REASON_OTHER && !reason.trim()) {
      showError('Lý do lỗi "Khác" phải mô tả chi tiết.')
      return
    }
    if (evidenceImageUrls.length === 0) {
      showError('Vui lòng đính kèm ảnh hàng lỗi làm bằng chứng hậu kiểm.')
      return
    }
    if (uploadingCount > 0) {
      showError('Vui lòng đợi ảnh tải lên xong.')
      return
    }
    if (lines.length === 0) {
      showError('Vui lòng thêm ít nhất một dòng sản phẩm cần trả.')
      return
    }

    if (!operationIdRef.current) operationIdRef.current = newOperationId()
    setConfirmDraft({
      lines,
      totalQuantity,
      supplierReceiptCode: selectedOriginal.receiptCode,
      supplierName: selectedOriginal.supplierName,
      defectReasonLabel: selectedDefectReason?.label ?? defectReasonCode,
      reason: reason.trim(),
      note: note.trim(),
      evidenceImageUrls,
    })
  }

  async function handleConfirm() {
    const payload = {
      operationId: operationIdRef.current,
      supplierReceiptId: selectedOriginal.id,
      supplierReceiptCode: selectedOriginal.receiptCode ?? null,
      supplierName: selectedOriginal.supplierName ?? null,
      supplierReference: selectedOriginal.supplierReference ?? null,
      defectReasonCode,
      evidenceImageUrls,
      reason: reason.trim() || null,
      note: note.trim() || null,
      items: lines.map((line) => ({
        skuId: line.skuId,
        skuCode: line.skuCode,
        skuSnapshotName: line.skuSnapshotName,
        quantity: line.quantity,
        batchId: line.batchId,
        lotCode: line.lotCode,
        note: null,
      })),
    }

    setIsSaving(true)
    try {
      const created = await createSupplierReturnRequest(payload)
      operationIdRef.current = null
      showSuccess(`Đã trả hàng nhập ${created.returnCode} và trừ tồn Kho.`)
      navigate(LIST_PATH)
    } catch (error) {
      showError(error.message)
      setConfirmDraft(null)
    } finally {
      setIsSaving(false)
    }
  }

  if (!canOperate) {
    return (
      <PageShell>
        <PageHeader title="Tạo phiếu trả hàng nhập" description="Bạn không có quyền tạo phiếu trả hàng nhập." />
        <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Chỉ Thủ kho được tạo phiếu trả hàng nhập. Admin và Quản lý chỉ được xem danh sách và chi tiết.
          <button
            type="button"
            onClick={() => navigate(LIST_PATH)}
            className="ml-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Quay lại danh sách
          </button>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Tạo phiếu trả hàng nhập"
        description={SUPPLIER_RETURN_FLOW_DESCRIPTION}
        rightContent={
          <button
            type="button"
            onClick={() => navigate(LIST_PATH)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Quay lại danh sách
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <StepBadge
                index={1}
                title="Chọn phiếu nhập NCC gốc"
                hint="Chỉ hiện phiếu nhập đã hoàn tất. Bấm lại phiếu đang chọn để bỏ chọn."
              />
            </div>

            <div className="px-5 py-4">
              <label className="block">
                <span className={LABEL_CLASS}>Tìm phiếu nhập *</span>
                <input
                  value={originalSearch}
                  onChange={(event) => clearOriginal(event.target.value)}
                  className={FIELD_CLASS}
                  placeholder="VD: PNCC-20260717-0001"
                />
              </label>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div
                  className={`${RECEIPT_GRID} border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500`}
                >
                  <span>Mã phiếu</span>
                  <span>Nhà cung cấp</span>
                  <span>Thời gian nhập</span>
                  <span className="text-right">Sản phẩm</span>
                </div>
                <div className="custom-scrollbar max-h-72 overflow-y-auto">
                  {isLoadingOriginals ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Đang tải phiếu gốc...</p>
                  ) : originalOptions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Không tìm thấy phiếu nhập NCC phù hợp.</p>
                  ) : (
                    originalOptions.map((option) => {
                      const selected = selectedOriginal?.id === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => chooseOriginal(option)}
                          title={selected ? 'Bấm lại để bỏ chọn' : 'Chọn phiếu này'}
                          className={`${RECEIPT_GRID} w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                            selected ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`truncate font-mono text-sm font-semibold ${
                              selected ? 'text-[#356647]' : 'text-slate-800'
                            }`}
                          >
                            {option.receiptCode}
                          </span>
                          <span className="truncate text-sm text-slate-700">
                            {option.supplierName || 'Chưa có tên NCC'}
                          </span>
                          <span className="truncate text-xs text-slate-500">
                            {formatVietnamDateTime(option.receivedDate)}
                          </span>
                          <span className="text-right text-sm font-semibold text-slate-800">
                            {option.items.length} dòng
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <StepBadge
                index={2}
                title="Chọn hàng trả"
                hint="Chỉ được trả đúng lô đã nhập theo phiếu gốc. Nhập số lượng để đưa dòng vào phiếu trả."
              />
              <p className="shrink-0 text-sm font-semibold text-slate-700">
                Tổng trả: {formatStockQuantity(totalQuantity)}
              </p>
            </div>

            <div className="custom-scrollbar max-h-[32rem] overflow-y-auto">
              {!selectedOriginal ? (
                <p className="px-5 py-4 text-sm text-slate-500">Vui lòng chọn phiếu nhập NCC gốc trước.</p>
              ) : isLoadingReceiptLines ? (
                <p className="px-5 py-4 text-sm text-slate-500">Đang tải hàng của phiếu...</p>
              ) : receiptLineOptions.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">Phiếu này không có lô nào truy vết được ở Kho.</p>
              ) : (
                receiptLineOptions.map((option) => {
                  const canReturn = option.availableQuantity > 0
                  const draft = quantityDrafts[option.key] ?? ''
                  const picked = Number(draft) > 0
                  return (
                    <div
                      key={option.key}
                      className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0 ${
                        picked ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <div className="min-w-[12rem] flex-1">
                        <p className="text-sm font-semibold text-slate-800">{option.receiptLine.skuNameSnapshot}</p>
                        <p className="font-mono text-xs text-slate-500">{option.receiptLine.skuCode}</p>
                        <p className="mt-0.5 font-mono text-xs text-[#356647]">Lô {option.lotCode || '—'}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Đã nhập</p>
                          <p className="text-sm font-bold text-slate-800">
                            {formatStockQuantity(option.receivedQuantity)}
                          </p>
                        </div>
                        <div className={`rounded-lg px-3 py-1.5 text-center ${canReturn ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              canReturn ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            Còn ở Kho
                          </p>
                          <p className={`text-sm font-bold ${canReturn ? 'text-[#356647]' : 'text-rose-700'}`}>
                            {canReturn ? formatStockQuantity(option.availableQuantity) : '0'}
                          </p>
                        </div>
                      </div>
                      {canReturn ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            max={option.availableQuantity}
                            value={draft}
                            onChange={(event) => changeReturnQuantity(option, event.target.value)}
                            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#538463]"
                            placeholder="SL trả"
                          />
                          {picked ? (
                            <button
                              type="button"
                              onClick={() => changeReturnQuantity(option, '')}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Bỏ
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          Hết tồn
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <StepBadge index={3} title="Lý do & bằng chứng" hint="Ảnh hàng lỗi là bằng chứng hậu kiểm bắt buộc." />
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <span className={LABEL_CLASS}>Luồng trả</span>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  Kho → Nhà cung cấp
                </div>
              </div>

              <label className="block">
                <span className={LABEL_CLASS}>Lý do trả hàng *</span>
                <select
                  value={defectReasonCode}
                  onChange={(event) => setDefectReasonCode(event.target.value)}
                  className={FIELD_CLASS}
                >
                  {defectReasons.length === 0 ? <option value="">Đang tải...</option> : null}
                  {defectReasons.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={LABEL_CLASS}>
                  Mô tả chi tiết {defectReasonCode === DEFECT_REASON_OTHER ? '*' : ''}
                </span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={FIELD_CLASS}
                  placeholder={defectReasonCode === DEFECT_REASON_OTHER ? 'Bắt buộc khi chọn lý do Khác' : 'Không bắt buộc'}
                />
              </label>

              <label className="block">
                <span className={LABEL_CLASS}>Ghi chú</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} className={FIELD_CLASS} />
              </label>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className={LABEL_CLASS}>Ảnh hàng lỗi *</span>
                <p className="text-xs text-slate-500">
                  Tối đa {MAX_EVIDENCE_IMAGES} ảnh, mỗi ảnh dưới 5MB.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label
                    className={`rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 ${
                      evidenceImageUrls.length >= MAX_EVIDENCE_IMAGES || uploadingCount > 0
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:bg-slate-50'
                    }`}
                  >
                    {uploadingCount > 0 ? `Đang tải ${uploadingCount} ảnh...` : 'Thêm ảnh'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleEvidenceChange}
                      disabled={uploadingCount > 0 || evidenceImageUrls.length >= MAX_EVIDENCE_IMAGES}
                    />
                  </label>
                  <span className="text-sm text-slate-500">
                    {evidenceImageUrls.length}/{MAX_EVIDENCE_IMAGES} ảnh
                  </span>
                </div>
                {evidenceImageUrls.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {evidenceImageUrls.map((url) => (
                      <div key={url} className="relative">
                        <img
                          src={url}
                          alt="Ảnh hàng lỗi"
                          className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeEvidenceImage(url)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow"
                          title="Xoá ảnh"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tóm tắt phiếu trả</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Phiếu nhập gốc</dt>
                <dd className="text-right font-mono font-semibold text-slate-800">
                  {selectedOriginal?.receiptCode || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Nhà cung cấp</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {selectedOriginal?.supplierName || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Dòng trả</dt>
                <dd className="text-right font-semibold text-slate-800">{lines.length}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Tổng số lượng</dt>
                <dd className="text-right font-semibold text-[#356647]">{formatStockQuantity(totalQuantity)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">Ảnh bằng chứng</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {evidenceImageUrls.length}/{MAX_EVIDENCE_IMAGES}
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Phiếu chốt ngay và trừ tồn Kho khi xác nhận, không thể hoàn tác.
            </p>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => navigate(LIST_PATH)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving || uploadingCount > 0}
                className="flex-1 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-60"
              >
                Tiếp tục
              </button>
            </div>
          </section>
        </div>
      </form>

      <SupplierReturnConfirmModal
        draft={confirmDraft}
        isSaving={isSaving}
        onCancel={() => setConfirmDraft(null)}
        onConfirm={handleConfirm}
      />
    </PageShell>
  )
}
