export default function ReturnPolicyPanel({
  context,
  loading = false,
  checklistAnswers = {},
  onToggleChecklist,
  evidenceImageUrls = [],
  onEvidenceChange,
  onRemoveEvidence,
  uploadingCount = 0,
  maxEvidenceImages = 5,
  canManagerOverride = false,
  managerOverride = false,
  onManagerOverrideChange,
}) {
  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-[#fbf9f1] px-3 py-3 text-sm text-slate-500">
        Đang tải chính sách trả hàng…
      </section>
    )
  }

  if (!context?.policy) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Chưa tải được chính sách trả hàng. Hệ thống sẽ từ chối nhận trả nếu không có policy.
      </section>
    )
  }

  const {
    policy,
    softWarnings = [],
    daysRemaining,
    isWithinReturnWindow,
    customReturnBlocked,
    channelAllowed,
  } = context
  const checklist = policy.checklist || []
  const minImages = Number(policy.minEvidenceImages) || 0
  const hardBlocked =
    customReturnBlocked ||
    channelAllowed === false ||
    isWithinReturnWindow === false

  return (
    <section className="rounded-xl border border-[#356647]/30 bg-[#f3f8f3] px-3 py-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#356647]">Chính sách trả / đổi hàng</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {policy.name}
            <span className="ml-2 text-xs font-normal text-slate-500">v{policy.version}</span>
          </p>
        </div>
        <div className="text-right text-xs text-slate-600">
          <p>
            Cửa sổ: <strong>{policy.returnWindowDays} ngày</strong>
          </p>
          {daysRemaining != null ? (
            <p className={isWithinReturnWindow ? 'text-emerald-700' : 'font-semibold text-amber-700'}>
              {isWithinReturnWindow
                ? `Còn khoảng ${Math.max(0, daysRemaining)} ngày`
                : 'Đã quá hạn trả'}
            </p>
          ) : null}
        </div>
      </div>

      {policy.summaryText ? (
        <p className="mb-2 text-xs leading-relaxed text-slate-700">{policy.summaryText}</p>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border border-white/80 bg-white/70 px-2.5 py-2">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Checklist tình trạng hàng
          </p>
          {checklist.length === 0 ? (
            <p className="text-xs text-slate-600">Không có checklist.</p>
          ) : (
            <ul className="space-y-1.5">
              {checklist.map((item) => {
                const checked = Boolean(checklistAnswers[item.id])
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => onToggleChecklist?.(item.id)}
                      />
                      <span>
                        {item.label}
                        {item.required ? (
                          <span className="ml-1 font-semibold text-rose-600">*</span>
                        ) : (
                          <span className="ml-1 text-slate-400">(tuỳ chọn)</span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-white/80 bg-white/70 px-2.5 py-2">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Ảnh minh chứng
            {minImages > 0 ? (
              <span className="ml-1 font-semibold text-rose-600">
                (tối thiểu {minImages})
              </span>
            ) : null}
          </p>
          <p className="mb-2 text-[11px] text-slate-500">
            Tối đa {maxEvidenceImages} ảnh · đang có {evidenceImageUrls.length}
            {uploadingCount > 0 ? ` · đang tải ${uploadingCount}…` : ''}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#356647]/40 bg-[#f8fbf8] px-2.5 py-1.5 text-xs font-semibold text-[#356647] hover:bg-white">
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            Thêm ảnh
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onEvidenceChange}
              disabled={uploadingCount > 0 || evidenceImageUrls.length >= maxEvidenceImages}
            />
          </label>
          {evidenceImageUrls.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {evidenceImageUrls.map((url) => (
                <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200">
                  <img src={url} alt="Minh chứng trả hàng" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveEvidence?.(url)}
                    className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
                    aria-label="Xóa ảnh"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>
              Đơn chỉ gồm gói pha chế (custom):{' '}
              <strong>
                {policy.allowCustomBundleReturns ? 'Được phép trả' : 'Không áp dụng trả hàng'}
              </strong>
              {customReturnBlocked ? ' — đơn hiện tại thuộc trường hợp này' : ''}
            </li>
            <li>
              Khi đủ điều kiện:{' '}
              <strong>
                {policy.autoAcceptOnPolicyPass
                  ? 'Hệ thống tự xác nhận nhận trả'
                  : 'Cần Quản lý xác nhận nhận trả'}
              </strong>
            </li>
          </ul>
        </div>
      </div>

      {softWarnings.length > 0 ? (
        <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          {softWarnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-900">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {hardBlocked ? (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
          Đơn này chưa đủ điều kiện trả hàng theo chính sách
          {canManagerOverride
            ? '. Quản lý có thể cho phép trả ngoại lệ bằng ô bên dưới.'
            : '. Liên hệ Quản lý nếu cần xử lý ngoại lệ.'}
        </div>
      ) : null}

      {canManagerOverride ? (
        <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={managerOverride}
            onChange={(e) => onManagerOverrideChange?.(e.target.checked)}
          />
          <span>
            <strong>Cho phép trả ngoại lệ</strong>
            <span className="mt-0.5 block font-normal text-slate-600">
              Dùng khi đơn chưa đủ điều kiện nhưng vẫn cần nhận trả. Viết rõ lý do (≥ 10 ký tự) vào ô
              ghi chú phía dưới.
            </span>
          </span>
        </label>
      ) : null}
    </section>
  )
}
