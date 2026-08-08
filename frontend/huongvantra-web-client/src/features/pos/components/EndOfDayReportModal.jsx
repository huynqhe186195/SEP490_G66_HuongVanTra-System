import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
    expectedCash as calcExpectedCash,
    loadOpenCashSession,
    refreshCashSession,
} from "../utils/posCashSessionStore.js";

/**
 * Bản rút gọn báo cáo trên POS.
 *
 * - Quầy (`variant=shift`): Báo cáo chốt ca — kèm ca làm + quỹ đang mở.
 * - COD (`variant=cod`): Báo cáo chốt ca COD — kèm ca làm (không dùng quỹ két).
 *
 * Số liệu bán hàng lấy từ `/api/reports/end-of-day/*` (lọc `channel`).
 */
function EndOfDayReportModal({
    onClose,
    sellerName = "",
    sellerRole = "—",
    agencyName = "Chi nhánh chính",
    channel = "",
    /** 'shift' = chốt ca quầy; 'cod' = chốt ca COD */
    variant = "shift",
    onDutyShift = null,
    cashSession: cashSessionProp = null,
}) {
    const isShiftReport = variant === "shift";
    const isCodReport = variant === "cod";
    const isCloseShiftReport = isShiftReport || isCodReport;
    const documentTitle = isShiftReport
        ? "BÁO CÁO CHỐT CA"
        : isCodReport
          ? "BÁO CÁO CHỐT CA COD"
          : "BÁO CÁO CUỐI NGÀY";
    const headerTitle = isShiftReport
        ? "Báo cáo chốt ca"
        : isCodReport
          ? "Báo cáo chốt ca COD"
          : "Báo cáo cuối ngày";
    const scopeLabel = isShiftReport
        ? "chốt ca tại quầy"
        : isCodReport
          ? "chốt ca COD / mang đi"
          : "cuối ngày";

    const [date, setDate] = useState(() => toDateInputValue(new Date()));
    const [summary, setSummary] = useState(null);
    const [exceptions, setExceptions] = useState(null);
    const [cashSession, setCashSession] = useState(
        () => (isShiftReport ? cashSessionProp || loadOpenCashSession() : null),
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const [pendingOffline, setPendingOffline] = useState(0);
    const [loadedAt, setLoadedAt] = useState(null);
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
        if (!isShiftReport) {
            setCashSession(null);
            return undefined;
        }
        let cancelled = false;
        refreshCashSession()
            .then((session) => {
                if (!cancelled) setCashSession(session || cashSessionProp || null);
            })
            .catch(() => {
                if (!cancelled) setCashSession(cashSessionProp || loadOpenCashSession());
            });
        return () => {
            cancelled = true;
        };
    }, [isShiftReport, cashSessionProp, reloadNonce]);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const params = { date };
        if (channel) params.channel = channel;

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
                setError(
                    err.statusCode === 403
                        ? "Bạn không có quyền xem báo cáo này."
                        : err.message,
                );
                setSummary(null);
                setExceptions(null);
            })
            .finally(() => {
                if (!signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [date, channel, reloadNonce]);

    const creatorName = sellerName ? `${sellerName} · ${sellerRole}` : sellerRole;

    const shiftLabel =
        cashSession?.shiftLabel
        || onDutyShift?.label
        || onDutyShift?.templateName
        || "—";
    const shiftHours =
        onDutyShift?.start && onDutyShift?.end
            ? `${onDutyShift.start}–${onDutyShift.end}`
            : null;
    const expectedInDrawer = cashSession ? calcExpectedCash(cashSession) : null;

    const criteriaLines = useMemo(() => {
        const lines = [
            { label: isCloseShiftReport ? "Ngày chốt" : "Kỳ báo cáo", value: date },
            { label: "Chi nhánh", value: agencyName },
            { label: "Nhân viên", value: sellerName || "Bản thân" },
            { label: "Phạm vi", value: scopeLabel },
        ];
        if (isCloseShiftReport) {
            lines.push({ label: "Ca làm", value: shiftLabel });
            if (onDutyShift?.workDate) {
                lines.push({ label: "Ngày làm việc", value: onDutyShift.workDate });
            }
            if (shiftHours) {
                lines.push({ label: "Giờ ca", value: shiftHours });
            }
            if (isCodReport) {
                lines.push({ label: "Kênh", value: "COD" });
            }
        }
        lines.push({ label: "Người kết xuất", value: creatorName });
        return lines;
    }, [
        isCloseShiftReport,
        isCodReport,
        date,
        agencyName,
        sellerName,
        scopeLabel,
        shiftLabel,
        onDutyShift,
        shiftHours,
        creatorName,
    ]);

    const handlePrint = useCallback(() => {
        const payload = {
            periodLabel: date,
            employeeName: sellerName || "Bản thân",
            report: summary || {},
            exceptions,
            creatorName,
            agencyName,
            documentTitle,
        };
        if (paper === "a4") printEndOfDayReport({ ...payload, orientation: "portrait" });
        else printEndOfDayK80(payload);
    }, [date, sellerName, creatorName, agencyName, summary, exceptions, paper, documentTitle]);

    const r = summary || {};
    const byMethod = (r.byPaymentMethod || []).filter(
        (m) => (m.amountIn || 0) !== 0 || (m.amountOut || 0) !== 0,
    );
    const exceptionCount = exceptions?.underpaidCount || 0;

    const sectionSales = isCloseShiftReport ? "II" : "I";
    const sectionVolume = isCloseShiftReport ? "III" : "II";
    const sectionPay = isCloseShiftReport ? "IV" : "III";
    const sectionEx = isCloseShiftReport ? "V" : "IV";

    const shiftInfoItems = [
        { label: "Ca làm", value: shiftLabel, strong: true },
        onDutyShift?.workDate
            ? { label: "Ngày làm việc", value: onDutyShift.workDate }
            : null,
        shiftHours ? { label: "Giờ ca (lịch)", value: shiftHours } : null,
        {
            label: "Trạng thái ca",
            value: onDutyShift?.bypassed
                ? "Bỏ qua kiểm ca (quản lý)"
                : onDutyShift
                  ? "Đang trong ca"
                  : "Chưa trong ca / ngoài giờ",
            strong: !onDutyShift || Boolean(onDutyShift?.bypassed),
        },
        isCodReport
            ? {
                  label: "Hình thức bán",
                  value: "COD / mang đi (không dùng quỹ két quầy)",
              }
            : null,
    ].filter(Boolean);

    const cashInfoItems = isShiftReport
        ? [
              {
                  label: "Trạng thái quỹ",
                  value: cashSession
                      ? cashSession.requiresCloseForNewShift
                          ? "Cần đóng quỹ ca trước"
                          : cashSession.status === "Open"
                            ? "Đang mở"
                            : cashSession.status || "—"
                      : "Chưa mở quỹ",
                  strong: !cashSession,
              },
              cashSession?.openedAt
                  ? {
                        label: "Mở quỹ lúc",
                        value: formatVietnamDateTimeMinute(cashSession.openedAt),
                    }
                  : null,
              cashSession?.openedByName
                  ? {
                        label: "Người mở quỹ",
                        value: cashSession.openedByRole
                            ? `${cashSession.openedByName} · ${cashSession.openedByRole}`
                            : cashSession.openedByName,
                    }
                  : null,
              cashSession
                  ? {
                        label: "Tiền đầu ca",
                        value: formatVnd(cashSession.openingCash),
                        strong: true,
                    }
                  : null,
              cashSession
                  ? {
                        label: "Tiền mặt bán trong ca",
                        value: formatVnd(cashSession.cashSalesTotal),
                    }
                  : null,
              cashSession
                  ? {
                        label: "Hoàn tiền mặt trong ca",
                        value: formatVnd(cashSession.cashRefundTotal),
                    }
                  : null,
              cashSession
                  ? {
                        label: "Số đơn gắn quỹ",
                        value: cashSession.orderCount || 0,
                    }
                  : null,
              expectedInDrawer != null
                  ? {
                        label: "Tiền mặt kỳ vọng trong két",
                        hint: "đầu ca + bán tiền mặt − hoàn tiền mặt",
                        value: formatVnd(expectedInDrawer),
                        strong: true,
                    }
                  : null,
              cashSession?.note
                  ? { label: "Ghi chú mở quỹ", value: cashSession.note }
                  : null,
          ].filter(Boolean)
        : [];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
            onClick={onClose}
        >
            <div
                className={`flex h-full max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl [font-family:'Manrope',sans-serif] ${
                    isReceipt ? "max-w-2xl" : "max-w-5xl"
                }`}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#c1c9c0]/60 px-5 py-3">
                    <div>
                        <h2 className="text-base font-bold text-[#1b1c17]">{headerTitle}</h2>
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
                                        paper === option.key
                                            ? "bg-[#356647] text-white"
                                            : "text-[#414942] hover:bg-[#f6f4ec]"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        {option.icon}
                                    </span>
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setReloadNonce((n) => n + 1)}
                            disabled={isLoading}
                            className="flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-2.5 py-1.5 text-xs font-semibold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Tải lại
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={isLoading || !!error || !summary}
                            className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2b5439] disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                            In {paper === "a4" ? "A4" : "K80"}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1 text-[#717971] hover:bg-[#f6f4ec]"
                            aria-label="Đóng"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </header>

                {pendingOffline > 0 && (
                    <p className="flex shrink-0 items-start gap-1.5 border-b border-[#7e5700]/30 bg-[#fec25b]/15 px-5 py-2 text-xs text-[#7e5700]">
                        <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                        Thiết bị này còn {pendingOffline} đơn offline chưa đồng bộ; dữ liệu báo cáo trên
                        server có thể chưa đầy đủ.
                    </p>
                )}

                <div className="min-h-0 flex-1 overflow-auto bg-[#f1efe7] p-3 sm:p-5">
                    {error ? (
                        <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 bg-white px-6 py-10 text-center shadow-sm ring-1 ring-[#c1c9c0]/50">
                            <p className="text-sm text-[#b42318]">{error}</p>
                            <button
                                type="button"
                                onClick={() => setReloadNonce((n) => n + 1)}
                                className="rounded-full bg-[#356647] px-4 py-1.5 text-xs font-semibold text-white"
                            >
                                Thử lại
                            </button>
                        </div>
                    ) : (
                        <ReportDocumentPage
                            title={documentTitle}
                            periodLabel={date}
                            criteriaLines={criteriaLines}
                            layout={isReceipt ? "receipt" : "report"}
                            printedAtLabel={
                                loadedAt ? formatVietnamDateTimeMinute(loadedAt) : null
                            }
                        >
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-24 animate-pulse bg-[#f6f4ec]" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {isCloseShiftReport ? (
                                        <DocumentSection
                                            title={
                                                isShiftReport
                                                    ? "I. Thông tin ca làm & quỹ"
                                                    : "I. Thông tin ca làm (COD)"
                                            }
                                            note={
                                                isShiftReport
                                                    ? "Số quỹ lấy từ phiên ca đang mở trên máy này."
                                                    : "Sale COD dùng chung ca quầy Shelf; không mở quỹ két. Số bán lấy theo kênh COD."
                                            }
                                        >
                                            <KeyValueRows items={[...shiftInfoItems, ...cashInfoItems]} />
                                            {isShiftReport && !cashSession ? (
                                                <p className="mt-3 text-[11px] text-[#7e5700]">
                                                    Chưa có quỹ ca đang mở — mở quỹ trước khi bán tại quầy để
                                                    số liệu chốt ca đầy đủ.
                                                </p>
                                            ) : null}
                                            {isCodReport && !onDutyShift ? (
                                                <p className="mt-3 text-[11px] text-[#7e5700]">
                                                    Chưa trong ca quầy hoặc đang ngoài giờ — đăng ký/duyệt ca
                                                    tại «Lịch làm việc» để bán COD.
                                                </p>
                                            ) : null}
                                        </DocumentSection>
                                    ) : null}

                                    <DocumentSection
                                        title={`${sectionSales}. Ba chỉ tiêu tài chính của kỳ`}
                                        note="Ba số này không thay thế nhau. VietQR và chuyển khoản không nằm trong két."
                                    >
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
                                                    label: isCodReport
                                                        ? "Tiền mặt thu trong kỳ (COD)"
                                                        : "Tiền mặt tại két (theo ngày)",
                                                    hint: isCodReport
                                                        ? "chỉ các khoản tiền mặt của kênh COD"
                                                        : "chỉ tiền mặt trong kỳ báo cáo",
                                                    value: formatVnd(r.cashOnHand),
                                                    strong: true,
                                                },
                                            ]}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title={`${sectionVolume}. Sản lượng bán trong kỳ`}>
                                        <KeyValueRows
                                            items={[
                                                { label: "Đơn hoàn tất", value: r.completedOrders || 0 },
                                                { label: "Dòng hàng", value: r.totalLineCount || 0 },
                                                { label: "Mặt hàng", value: r.distinctSkuCount || 0 },
                                            ]}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title={`${sectionPay}. Theo phương thức thanh toán`}>
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
                                                    <Td
                                                        align="right"
                                                        className="whitespace-nowrap font-semibold"
                                                    >
                                                        {formatVnd(m.net)}
                                                    </Td>
                                                </tr>
                                            )}
                                        />
                                    </DocumentSection>

                                    <DocumentSection title={`${sectionEx}. Ngoại lệ cần xử lý`}>
                                        <KeyValueRows
                                            items={[
                                                {
                                                    label: "Đơn chưa thu đủ tiền",
                                                    hint:
                                                        exceptionCount > 0
                                                            ? `Còn thiếu ${formatVnd(exceptions?.underpaidAmount)}`
                                                            : undefined,
                                                    value: exceptionCount,
                                                    strong: exceptionCount > 0,
                                                },
                                            ]}
                                        />
                                        <DocumentNotice items={exceptions?.dataGaps} />
                                        <p className="mt-3 text-[11px] text-[#717971]">
                                            Số liệu lúc{" "}
                                            {formatVietnamDateTimeMinute(
                                                loadedAt || new Date().toISOString(),
                                            )}
                                            . Bản đầy đủ có ở màn hình Báo cáo cuối ngày.
                                        </p>
                                    </DocumentSection>
                                </>
                            )}
                        </ReportDocumentPage>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EndOfDayReportModal;
