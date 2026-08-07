import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { DocumentSection, DocumentTable, Td, KeyValueRows } from '../ReportDocumentPage.jsx'
import { Pagination } from '../reportUi.jsx'

const PAGE_SIZE = 50

/**
 * Tài liệu "Báo cáo cuối ngày về hàng hóa".
 *
 * Cố ý KHÔNG có dòng "tổng số lượng" chung: hàng tính theo Gram và hàng tính theo cái
 * không cộng chung được, nên tổng được tách theo từng đơn vị. "Số sản phẩm phát sinh"
 * đếm SkuId không trùng lặp, hai quy cách của cùng một mặt hàng vẫn tính là hai.
 */
function ProductsReportDocument({ report, params }) {
  const totals = report.productTotals || []

  const [page, setPage] = useState(1)
  const [pageItems, setPageItems] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPage(1)
    setPageItems(null)
  }, [params])

  useEffect(() => {
    if (page === 1) return undefined
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getProducts({ ...params, page, pageSize: PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setPageItems(res?.items || [])
      })
      .catch((err) => {
        if (signal.aborted || err.name === 'AbortError') return
        setError(err.statusCode === 403 ? 'Bạn không có quyền xem số liệu hàng hóa.' : err.message)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [params, page])

  const totalCount = report.productsTotalCount || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const products = page === 1 ? (report.products || []).slice(0, PAGE_SIZE) : pageItems || []

  return (
    <>
      <DocumentSection title="I. Chỉ tiêu chung">
        <KeyValueRows
          items={[
            { label: 'Tổng dòng hàng', value: report.totalLineCount || 0 },
            { label: 'Số sản phẩm phát sinh', hint: 'đếm theo SKU', value: report.distinctSkuCount || 0 },
            { label: 'Giảm giá đã áp dụng', value: formatVnd(report.salesDiscount) },
          ]}
        />
      </DocumentSection>

      {totals.length > 0 && (
        <DocumentSection
          title="II. Tổng theo đơn vị tính"
          note="Gram và Cái không cộng chung, mỗi đơn vị một dòng."
        >
          <DocumentTable
            columns={[
              { key: 'unit', label: 'Đơn vị' },
              { key: 'qty', label: 'SL bán', align: 'right' },
              { key: 'returned', label: 'SL trả', align: 'right' },
              { key: 'lines', label: 'Số dòng hàng', align: 'right' },
              { key: 'revenue', label: 'Doanh thu thuần', align: 'right' },
            ]}
            rows={totals}
            renderRow={(t) => (
              <tr key={t.unit}>
                <Td>{t.unitLabel}</Td>
                <Td align="right">
                  {t.quantity} {t.unitLabel}
                </Td>
                <Td align="right" className={t.returnedQuantity > 0 ? 'text-[#b42318]' : ''}>
                  {t.returnedQuantity}
                </Td>
                <Td align="right">{t.lineCount}</Td>
                <Td align="right" className="font-semibold">
                  {formatVnd(t.netRevenue)}
                </Td>
              </tr>
            )}
          />
        </DocumentSection>
      )}

      <DocumentSection
        title="III. Hàng hóa đã bán trong kỳ"
        note="Số lượng theo đơn vị cơ sở của từng mặt hàng, không cộng gộp giữa các đơn vị khác nhau."
      >
        {error && (
          <p className="mb-2 border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">{error}</p>
        )}
        <DocumentTable
          dense
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên hàng' },
            { key: 'category', label: 'Danh mục' },
            { key: 'unit', label: 'Đơn vị', align: 'center' },
            { key: 'qty', label: 'SL bán', align: 'center' },
            { key: 'returned', label: 'SL trả', align: 'center' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'discount', label: 'Giảm giá phân bổ', align: 'right' },
            { key: 'revenue', label: 'Doanh thu thuần', align: 'right' },
          ]}
          rows={products}
          renderRow={(p) => (
            <tr key={`${p.skuId}-${p.unit}`}>
              <Td mono className="whitespace-nowrap">
                {p.skuCode}
              </Td>
              <Td>{p.skuName}</Td>
              <Td muted>{p.categoryName || '—'}</Td>
              <Td align="center" className={`text-[11px] ${p.unit === 'Unknown' ? 'text-[#7e5700]' : 'text-[#717971]'}`}>
                {p.unitLabel}
              </Td>
              <Td align="center">{p.quantity}</Td>
              <Td align="center" className={p.returnedQuantity > 0 ? 'text-[#b42318]' : ''}>
                {p.returnedQuantity}
              </Td>
              <Td align="center">{p.orderCount}</Td>
              <Td align="right" className="whitespace-nowrap text-[#7e5700]">
                {formatVnd(p.allocatedDiscount)}
              </Td>
              <Td align="right" className="whitespace-nowrap font-semibold">
                {formatVnd(p.netRevenue)}
              </Td>
            </tr>
          )}
          footer={
            <tr>
              <Td colSpan={8}>Tổng doanh thu hàng hóa toàn kỳ</Td>
              <Td align="right" className="text-[#356647]">
                {formatVnd(totals.reduce((s, t) => s + (t.netRevenue || 0), 0))}
              </Td>
            </tr>
          }
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          unitLabel="mặt hàng"
          isLoading={isLoading}
          onChange={setPage}
        />
      </DocumentSection>
    </>
  )
}

export default ProductsReportDocument
