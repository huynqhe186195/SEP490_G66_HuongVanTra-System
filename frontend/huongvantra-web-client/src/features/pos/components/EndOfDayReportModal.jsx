import { useCallback, useEffect, useState } from "react";
import { endOfDayOrderApi } from "../../reports/services/endOfDayApi.js";
import { printEndOfDayK80, printEndOfDayReport } from "../../reports/utils/printEndOfDayReport.js";
import { toDateInputValue } from "../../reports/utils/endOfDayFilters.js";
import ReportDocumentPage, {
    DocumentSection,
    DocumentTable,
    Td,
    KeyValueRows,
    DocumentNotice,
} from "../../reports/components/ReportDocumentPage.jsx";
import { formatVnd } from "../../../utils/vietnamCurrency.js";
import { formatVietnamDateTimeMinute } from "../../../utils/vietnamDateTime.js";
import { getPendingCount } from "../../../lib/offlineDb.js";

/**
 * Bản rút gọn của Báo cáo cuối ngày dùng ngay tại quầy POS.
 *
 * Mọi con số đều lấy từ `/api/reports/end-of-day/*` — màn hình này không tự cộng lại
 * danh sách đơn, để số in ra ở POS luôn khớp với màn hình Back-Office và file Excel.
 *
 * Thân báo cáo dùng chung khung tài liệu với màn hình Báo cáo cuối ngày, nên bản xem tại
 * quầy và bản in ra không thể lệch nhau về bố cục hay cách gọi tên chỉ tiêu.
 *
 * Cảnh báo offline đọc hàng đợi IndexedDB CỦA CHÍNH MÁY NÀY. Hàng đợi nằm trong trình
 * duyệt từng máy nên server không thể biết tổng số đơn offline của mọi thiết bị; không
 * dựng API backend để đếm con số đó.
 */
function EndOfDayReportModal({ onClose, sellerName = "", sellerRole = "—", agencyName = "Chi nhánh chính" }) {
    const [date, setDate] = useState(() => toDateInputValue(new Date()));
    const [summary, setSummary] = useState(null);
    const [exceptions, setExceptions] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const [pendingOffline, setPendingOffline] = useState(0);
    const [loadedAt, setLoadedAt] = useState(null);
    // Khổ giấy chọn ở đây quyết định luôn cả bố cục đang xem, để bản xem đúng bằng bản in.
    const [paper, setPaper] = useState("k80");
    const isReceipt = paper === "k80";

    useEffect(() => {
        let cancelled = false;
        getPendingCount()
            .then((n) => {
                if (!cancelled) setPendingOffline(n || 0);
            })
            .catch(() => {
                if (!cancelled) setPendingOffline(0);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadNonce]);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const params = { date };

        setIsLoading(true);
        setError(null);
        Promise.all([
            endOfDayOrderApi.getSummary(params, { signal }),
            endOfDayOrderApi.getExceptions({ ...params, page: 1, pageSize: 1 }, { signal }),
        ])
            .then(([s, e]) => {
                if (signal.aborted) return;
                setSummary(s || null);
                setExceptions(e || null);
                setLoadedAt(new Date().toISOString());
            })
            .catch((err) => {
                if (signal.aborted || err.name === "AbortError") return;
                setError(err.statusCode === 403 ? "Bạn không có quyền xem báo cáo cuối ngày." : err.message);
                setSummary(null);
                setExceptions(null);
            })
            .finally(() => {
                if (!signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [date, reloadNonce]);

    const creatorName = sellerName ? `${sellerName} · ${sellerRole}` : sellerRole;

    const handlePrint = useCallback(() => {
        const payload = {
            periodLabel: date,
            employeeName: sellerName || "Bản thân",
            report: summary || {},
            exceptions,
            creatorName,
            agencyName,
        };
        if (paper === "a4") printEndOfDayReport({ ...payload, orientation: "portrait" });
        else printEndOfDayK80(payload);
    }, [date, sellerName, creatorName, agencyName, summary, exceptions, paper]);

    const r = summary || {};
    const byMethod = (r.byPaymentMethod || []).filter((m) => (m.amountIn || 0) !== 0 || (m.amountOut || 0) !== 0);
    const exceptionCount = exceptions?.underpaidCount || 0;

    const criteriaLines = [
        { label: "Kỳ báo cáo", value: date },
        { label: "Chi nhánh", value: agencyName },
        { label: "Nhân viên", value: sellerName || "Bản thân" },
        { label: "Người kết xuất", value: creatorName },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={onClose}>
            <div
                className={`flex h-full max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl [font-family:'Manrope',sans-serif] ${
                    isReceipt ? "max-w-2xl" : "max-w-5xl"
                }`}
                onClick={(event) => event.stopPropagation()}>
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#c1c9c0]/60 px-5 py-3">
                    <div>
                        <h2 className="text-base font-bold text-[#1b1c17]">Báo cáo cuối ngày</h2>
                        <p className="mt-0.5 text-xs text-[#717971]">Bản rút gọn tại quầy · múi giờ GMT+7</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-semibold text-[#717971]" htmlFor="pos-eod-date">
                            Ngày
                        </label>
                        <input
                            id="pos-eod-date"
                            type="date"
                            value={date}
                            max={toDateInputValue(new Date())}
                            onChange={(event) => setDate(event.target.value)}
                            className="rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-sm outline-none focus:border-[#356647]"
                        />

                        <div className="flex items-center rounded-lg border border-[#c1c9c0] p-0.5">
                            {[
                                { key: "k80", label: "K80", icon: "receipt" },
                                { key: "a4", label: "A4", icon: "description" },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setPaper(option.key)}
                                    aria-pressed={paper === option.key}
                                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                                        paper === option.key ?
                                            "bg-[#356647] text-white"
                                        :   "text-[#414942] hover:bg-[#f6f4ec]"
                                    }`}>
                                    <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setReloadNonce((n) => n + 1)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50">
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Tải lại
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={isLoading || !!error || !summary}
                            className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2b5439] disabled:opacity-50">
                            <span className="material-symbols-outlined text-[18px]">print</span>
                            In {paper === "a4" ? "A4" : "K80"}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-[#717971] hover:bg-[#f6f4ec]"
                            aria-label="Đóng">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </header>

                {pendingOffline > 0 && (
                    <p className="flex shrink-0 items-start gap-1.5 border-b border-[#7e5700]/30 bg-[#fec25b]/15 px-5 py-2 text-xs text-[#7e5700]">
                        <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                        Thiết bị này còn {pendingOffline} đơn offline chưa đồng bộ; dữ liệu báo cáo trên server có thể
                        chưa đầy đủ.
                    </p>
                )}

                <div className="min-h-0 flex-1 overflow-auto bg-[#f1efe7] p-3 sm:p-5">
                    {error ?
                        <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 bg-white px-6 py-10 text-center shadow-sm ring-1 ring-[#c1c9c0]/50">
                            <p className="text-sm text-[#b42318]">{error}</p>
                            <button
                                type="button"
                                onClick={() => setReloadNonce((n) => n + 1)}
                                className="rounded-full bg-[#356647] px-4 py-1.5 text-xs font-semibold text-white">
                                Thử lại
                            </button>
                        </div>
                    :   <ReportDocumentPage
                            title="BÁO CÁO CUỐI NGÀY TẠI QUẦY"
                            periodLabel={date}
                            criteriaLines={criteriaLines}
                            layout={isReceipt ? "receipt" : "report"}
                            printedAtLabel={loadedAt ? formatVietnamDateTimeMinute(loadedAt) : null}>
                            {isLoading ?
                                <div className="space-y-3">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-24 animate-pulse bg-[#f6f4ec]" />
                                    ))}
                                </div>
                            :   <>
                                    <DocumentSection
                                        title="I. Ba chỉ tiêu tài chính của kỳ"
                                        note="Ba số này không thay thế nhau. VietQR và chuyển khoản không nằm trong két.">
                                        <KeyValueRows
                                            items={[
                                                {
                                                    label: "Doanh thu ghi nhận",
                                                    hint: "đơn hoàn tất, đã trừ hàng trả",
                                                    value: formatVnd(r.netRecognizedRevenue),
                                                    strong: true,
                                                },
                                                {
                                                    label: "Tổng tiền thu vào",
                                                    hint: "gồm cả cọc và đơn của kỳ trước",
                                                    value: formatVnd(r.totalCashIn),
                                                    strong: true,
                                                },
                                                {
                                                    label: "Tiền mặt tại két",
                                                    hint: "chỉ tiền mặt",
                                                    value: formatVnd(r.cashOnHand),
                                                    strong: true,
                                                },
                                            ]}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title="II. Sản lượng bán trong kỳ">
                                        <KeyValueRows
                                            items={[
                                                { label: "Đơn hoàn tất", value: r.completedOrders || 0 },
                                                { label: "Dòng hàng", value: r.totalLineCount || 0 },
                                                { label: "Mặt hàng", value: r.distinctSkuCount || 0 },
                                            ]}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title="III. Theo phương thức thanh toán">
                                        <DocumentTable
                                            columns={[
                                                { key: "method", label: "Phương thức" },
                                                { key: "count", label: "Số lượt", align: "center" },
                                                { key: "net", label: "Thực nhận", align: "right" },
                                            ]}
                                            rows={byMethod}
                                            emptyText="Không có phát sinh"
                                            renderRow={(m) => (
                                                <tr key={m.paymentMethod}>
                                                    <Td>
                                                        {m.label}
                                                        {!m.isCash && (
                                                            <span className="ml-1.5 text-[11px] text-[#717971]">
                                                                vào tài khoản
                                                            </span>
                                                        )}
                                                    </Td>
                                                    <Td align="center">{m.count}</Td>
                                                    <Td align="right" className="whitespace-nowrap font-semibold">
                                                        {formatVnd(m.net)}
                                                    </Td>
                                                </tr>
                                            )}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title="IV. Ngoại lệ cần xử lý">
                                        <KeyValueRows
                                            items={[
                                                {
                                                    label: "Đơn chưa thu đủ tiền",
                                                    hint:
                                                        exceptionCount > 0 ?
                                                            `Còn thiếu ${formatVnd(exceptions?.underpaidAmount)}`
                                                        :   undefined,
                                                    value: exceptionCount,
                                                    strong: exceptionCount > 0,
                                                },
                                            ]}
                                        />
                                        <DocumentNotice items={exceptions?.dataGaps} />
                                        <p className="mt-3 text-[11px] text-[#717971]">
                                            Số liệu lúc{" "}
                                            {formatVietnamDateTimeMinute(loadedAt || new Date().toISOString())}. Bản đầy
                                            đủ có ở màn hình Báo cáo cuối ngày.
                                        </p>
                                    </DocumentSection>
                                </>
                            }
                        </ReportDocumentPage>
                    }
                </div>
            </div>
        </div>
    );
}

export default EndOfDayReportModal;
