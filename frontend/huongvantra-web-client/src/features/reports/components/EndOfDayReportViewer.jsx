import { useEffect, useState } from 'react'
import ReportViewerToolbar from './ReportViewerToolbar.jsx'
import ReportDocumentPage from './ReportDocumentPage.jsx'
import { EmptyState } from './reportUi.jsx'
import SalesReportDocument from './documents/SalesReportDocument.jsx'
import PaymentsReportDocument from './documents/PaymentsReportDocument.jsx'
import ProductsReportDocument from './documents/ProductsReportDocument.jsx'
import InventoryReportDocument from './documents/InventoryReportDocument.jsx'
import SummaryReportDocument from './documents/SummaryReportDocument.jsx'

/** Chỉ báo cáo bán hàng có nhóm cha–con mở rộng được, nên nút Mở tất cả chỉ hiện ở đó. */
const CONCERNS_WITH_GROUPS = new Set(['sales'])

/**
 * Khung xem tài liệu báo cáo: thanh công cụ cố định phía trên, bên dưới là trang tài liệu
 * dạng khổ giấy. Mối quan tâm đang chọn quyết định nội dung trang, không phải tab.
 */
function EndOfDayReportViewer({
  concern,
  concernTitle,
  layout,
  onLayoutChange,
  report,
  exceptions,
  params,
  periodLabel,
  criteriaLines,
  printedAtLabel,
  loadedAtLabel,
  isLoading,
  isBusy,
  error,
  hasData,
  onReload,
  onExportExcel,
  onPrintA4,
  onPrintK80,
  onExportPdf,
  onOpenCriteria,
}) {
  const [expandAll, setExpandAll] = useState(false)

  useEffect(() => {
    setExpandAll(false)
  }, [concern, params])

  const renderBody = () => {
    if (error) {
      return (
        <EmptyState
          text={error}
          hint="Kiểm tra kết nối rồi bấm Tải lại."
          action={
            <button
              type="button"
              onClick={onReload}
              className="rounded-full bg-[#356647] px-4 py-1.5 text-xs font-semibold text-white"
            >
              Tải lại
            </button>
          }
        />
      )
    }

    // Kho/Kệ tự gọi API riêng của InventoryService nên vẫn hiển thị được kể cả khi
    // báo cáo bên OrderService rỗng.
    if (concern === 'inventory') return <InventoryReportDocument params={params} />

    if (isLoading && !hasData) {
      return (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-[#f6f4ec]" />
          ))}
        </div>
      )
    }

    if (!hasData) {
      return (
        <EmptyState
          text="Không có phát sinh nào trong kỳ đã chọn."
          hint="Thử mở rộng khoảng thời gian hoặc bỏ bớt điều kiện lọc ở panel bên trái."
        />
      )
    }

    switch (concern) {
      case 'payments':
        return <PaymentsReportDocument report={report} params={params} />
      case 'products':
        return <ProductsReportDocument report={report} params={params} />
      case 'summary':
        return <SummaryReportDocument report={report} exceptions={exceptions} params={params} />
      case 'sales':
      default:
        return <SalesReportDocument report={report} params={params} expandAll={expandAll} />
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#c1c9c0]/60 bg-white">
      <ReportViewerToolbar
        title={concernTitle}
        loadedAtLabel={loadedAtLabel}
        isLoading={isLoading}
        isBusy={isBusy}
        layout={layout}
        onLayoutChange={onLayoutChange}
        onReload={onReload}
        onExpandAll={() => setExpandAll(true)}
        onCollapseAll={() => setExpandAll(false)}
        hasGroups={CONCERNS_WITH_GROUPS.has(concern)}
        onExportExcel={onExportExcel}
        onPrintA4={onPrintA4}
        onPrintK80={onPrintK80}
        onExportPdf={onExportPdf}
        onOpenCriteria={onOpenCriteria}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-[#f1efe7] p-3 sm:p-5">
        <ReportDocumentPage
          title={concernTitle}
          periodLabel={periodLabel}
          criteriaLines={criteriaLines}
          layout={layout}
          printedAtLabel={printedAtLabel}
        >
          {renderBody()}
        </ReportDocumentPage>
      </div>
    </div>
  )
}

export default EndOfDayReportViewer
