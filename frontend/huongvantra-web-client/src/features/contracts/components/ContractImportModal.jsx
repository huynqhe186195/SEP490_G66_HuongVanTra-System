import { useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { importContractFromDocx } from '../services/contractsApi.js'
import { useNavigate } from 'react-router-dom'

export default function ContractImportModal({ isOpen, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState(null)

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) {
      setFile(null)
      return
    }

    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      showError('Hợp đồng không import từ Excel. Hãy dùng file Word (.docx) hoặc PDF xuất từ hệ thống.')
      setFile(null)
      e.target.value = ''
      return
    }
    if (ext !== 'docx' && ext !== 'pdf') {
      showError('Chỉ hỗ trợ file Word (.docx) hoặc PDF (.pdf)')
      setFile(null)
      e.target.value = ''
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      showError('Kích thước file không được vượt quá 10MB')
      setFile(null)
      e.target.value = ''
      return
    }

    setFile(selectedFile)
    setResult(null)
  }

  async function handleImport() {
    if (!file) {
      showError('Vui lòng chọn file Word (.docx) hoặc PDF cần import.')
      return
    }

    setIsUploading(true)
    try {
      const data = await importContractFromDocx(file)
      setResult(data)

      if (data.success) {
        showSuccess(`Import thành công! Hợp đồng ${data.contractCode} đã được tạo ở trạng thái Nháp.`)
        if (onSuccess) onSuccess()
      }
    } catch (err) {
      showError(err?.message || 'Không thể import hợp đồng.')
    } finally {
      setIsUploading(false)
    }
  }

  function handleViewContract() {
    if (result?.contractId) {
      navigate(`/contracts/${result.contractId}`)
      onClose()
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  const CONFIDENCE_LABELS = {
    Exact: { label: 'Khớp chính xác', cls: 'text-green-700' },
    High: { label: 'Khớp cao', cls: 'text-green-600' },
    Medium: { label: 'Khớp trung bình', cls: 'text-yellow-600' },
    Low: { label: 'Khớp thấp', cls: 'text-orange-600' },
    NotFound: { label: 'Không tìm thấy', cls: 'text-red-600' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#f0eee6] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Import hợp đồng từ Word / PDF</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-[#717971] hover:bg-[#f8f7f4]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {!result && (
            <>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-[#1a1a1a]">
                  Chọn file hợp đồng
                </label>
                <input
                  type="file"
                  accept=".docx,.pdf"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-[#d4d2ca] px-3 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a] disabled:bg-[#f8f7f4]"
                />
                <p className="mt-1 text-xs text-[#717971]">
                  Dùng file Word (.docx) hoặc PDF xuất từ hệ thống (nút Tải Word / Tải PDF). Không hỗ trợ Excel (.xlsx). Tối đa 10MB.
                </p>
              </div>

              {file && (
                <div className="mb-4 rounded-lg bg-[#f8f7f4] p-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#717971]">description</span>
                    <span className="text-sm text-[#1a1a1a]">{file.name}</span>
                    <span className="text-xs text-[#717971]">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {result && !result.success && (
            <div className="space-y-4">
              {/* Lỗi không tìm thấy khách hàng — hiển thị nổi bật + nút tạo mới */}
              {result.customerMatch?.confidence === 'NotFound' ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-xl text-red-600">person_off</span>
                    <div className="flex-1">
                      <p className="font-medium text-red-700">Không tìm thấy khách hàng trong hệ thống</p>
                      <p className="mt-1 text-sm text-red-600">
                        Tên công ty từ file:{' '}
                        <span className="font-semibold">"{result.customerMatch.parsedName}"</span>{' '}
                        chưa tồn tại trong hệ thống.
                      </p>
                      <p className="mt-2 text-sm text-red-600">
                        Vui lòng tạo hồ sơ khách hàng doanh nghiệp trước, sau đó import lại hợp đồng.
                      </p>
                      <Link
                        to={`/customers/new?name=${encodeURIComponent(result.customerMatch.parsedName)}&type=CORPORATE`}
                        onClick={handleClose}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        <span className="material-symbols-outlined text-base">person_add</span>
                        Tạo khách hàng mới
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-[#fef3c7] p-4">
                  <p className="mb-2 font-medium text-[#92400e]">Import không thành công</p>
                  {result.errors?.length > 0 && (
                    <ul className="list-inside list-disc space-y-1 text-sm text-[#92400e]">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {result.customerMatch && (
                <div className="rounded-lg border border-[#d4d2ca] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-[#1a1a1a]">
                    Khớp khách hàng
                  </h3>
                  <div className="text-sm">
                    <p className="text-[#717971]">
                      Parse từ file: <span className="font-medium text-[#1a1a1a]">{result.customerMatch.parsedName}</span>
                    </p>
                    <p className={CONFIDENCE_LABELS[result.customerMatch.confidence]?.cls || 'text-gray-600'}>
                      {CONFIDENCE_LABELS[result.customerMatch.confidence]?.label || result.customerMatch.confidence}
                      {result.customerMatch.matchedName && (
                        <span className="ml-1">→ {result.customerMatch.matchedName}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {result.lineItemMatches?.length > 0 && (
                <div className="rounded-lg border border-[#d4d2ca] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-[#1a1a1a]">
                    Khớp hàng hóa ({result.lineItemMatches.length} dòng)
                  </h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {result.lineItemMatches.map((item, idx) => (
                      <div key={idx} className="rounded bg-[#f8f7f4] p-2 text-xs">
                        <p className="text-[#717971]">
                          Dòng {item.lineNumber}: <span className="font-medium text-[#1a1a1a]">{item.parsedName}</span>
                        </p>
                        <p className={CONFIDENCE_LABELS[item.confidence]?.cls || 'text-gray-600'}>
                          {CONFIDENCE_LABELS[item.confidence]?.label || item.confidence}
                          {item.matchedName && (
                            <span className="ml-1">→ {item.matchedName}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.warnings?.length > 0 && (
                <div className="rounded-lg bg-[#fef3c7] p-3">
                  <p className="mb-1 text-xs font-medium text-[#92400e]">Cảnh báo:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-[#92400e]">
                    {result.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && result.success && (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#dcfce7] p-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-2xl text-[#166534]">check_circle</span>
                  <div>
                    <p className="font-medium text-[#166534]">
                      Import thành công!
                    </p>
                    <p className="mt-1 text-sm text-[#166534]">
                      Hợp đồng <span className="font-semibold">{result.contractCode}</span> đã được tạo ở trạng thái Nháp.
                    </p>
                  </div>
                </div>
              </div>

              {result.warnings?.length > 0 && (
                <div className="rounded-lg bg-[#fef3c7] p-3">
                  <p className="mb-1 text-xs font-medium text-[#92400e]">Lưu ý:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-[#92400e]">
                    {result.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#f0eee6] px-6 py-4">
          {!result && (
            <>
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="rounded-lg border border-[#d4d2ca] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f8f7f4] disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleImport}
                disabled={!file || isUploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333] disabled:opacity-50"
              >
                {isUploading && (
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                )}
                {isUploading ? 'Đang import...' : 'Import'}
              </button>
            </>
          )}
          {result && result.success && (
            <>
              <button
                onClick={handleClose}
                className="rounded-lg border border-[#d4d2ca] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f8f7f4]"
              >
                Đóng
              </button>
              <button
                onClick={handleViewContract}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                Xem hợp đồng
              </button>
            </>
          )}
          {result && !result.success && (
            <button
              onClick={() => { setResult(null); setFile(null) }}
              className="rounded-lg border border-[#d4d2ca] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f8f7f4]"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
