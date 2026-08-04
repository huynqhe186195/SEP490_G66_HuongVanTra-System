import ProductImage from '../../products/components/ProductImage.jsx'
import OrderTimeline from './OrderTimeline.jsx'
import { formatVnd, getManualDiscountAmount } from '../utils/orderDisplay.js'

function OrderProductsSection({
  order,
  orderLines,
  constrained = false,
  orderId,
  timelineRefreshKey,
}) {
  const showTimeline = constrained && orderId
  const itemCount = orderLines.reduce((sum, { line }) => sum + (line.quantity || 0), 0)

  return (
    <section
      className={`flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-2 ${
        showTimeline
          ? 'max-h-[min(520px,calc(100dvh-11rem))] p-4'
          : constrained
            ? 'max-h-[min(360px,52vh)] p-4'
            : 'space-y-4 p-5'
      }`}
    >
      <div className={`flex shrink-0 items-baseline justify-between gap-2 ${constrained ? 'mb-2' : ''}`}>
        <h2 className={`font-bold text-slate-800 ${constrained ? 'text-base' : 'text-lg'}`}>Sản phẩm</h2>
        {constrained ? (
          <span className="text-xs text-slate-500">
            {itemCount} món · {orderLines.length} dòng
          </span>
        ) : null}
      </div>

      <div
        className={`custom-scrollbar min-h-0 overflow-x-auto ${
          showTimeline
            ? 'max-h-[min(200px,28vh)] overflow-y-auto rounded-lg border border-slate-50'
            : constrained
              ? 'flex-1 overflow-y-auto rounded-lg border border-slate-50'
              : ''
        }`}
      >
        <table className={`min-w-full text-left ${constrained ? 'text-xs' : 'text-sm'}`}>
          <thead
            className={`uppercase text-slate-400 ${constrained ? 'sticky top-0 z-10 bg-white text-[10px] shadow-[0_1px_0_#f1f5f9]' : 'text-xs'}`}
          >
            <tr>
              <th className={`pr-3 ${constrained ? 'pb-2 pl-2 pt-1' : 'pb-3 pr-4'}`}>Ảnh</th>
              <th className={`pr-3 ${constrained ? 'pb-2 pr-3 pt-1' : 'pb-3 pr-4'}`}>Sản Phẩm</th>
              <th className={`pr-3 ${constrained ? 'pb-2 pr-3 pt-1' : 'pb-3 pr-4'}`}>SL</th>
              {!constrained ? <th className="pb-3 pr-4">Đã trả</th> : null}
              <th className={`pr-3 ${constrained ? 'pb-2 pr-3 pt-1' : 'pb-3 pr-4'}`}>Đơn giá</th>
              <th className={`text-right ${constrained ? 'pb-2 pr-2 pt-1' : 'pb-3'}`}>Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orderLines.map(({ line, display }) => (
              <tr key={line.id}>
                <td className={constrained ? 'py-1.5 pl-2 pr-3' : 'py-3 pr-4'}>
                  <ProductImage
                    src={display.imageUrl}
                    alt={display.productName}
                    className={constrained ? 'h-8 w-8 rounded-md' : 'h-12 w-12 rounded-lg'}
                  />
                </td>
                <td className={constrained ? 'py-1.5 pr-3' : 'py-3 pr-4'}>
                  <p className={`text-slate-900 ${constrained ? 'font-medium leading-snug' : 'font-semibold'}`}>
                    {display.productName}
                    {line.isGift ? (
                      <span className="ml-1.5 rounded-full bg-[#fff8e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#7e5700]">
                        Quà
                      </span>
                    ) : null}
                  </p>
                  {!constrained && display.categoryName ? (
                    <p className="mt-0.5 text-xs text-slate-500">Danh mục: {display.categoryName}</p>
                  ) : null}
                  {!constrained && display.origin ? (
                    <p className="mt-0.5 text-xs text-slate-500">Xuất xứ: {display.origin}</p>
                  ) : null}
                  {!constrained && display.flavorProfile ? (
                    <p className="mt-0.5 text-xs text-slate-500">Hương vị: {display.flavorProfile}</p>
                  ) : null}
                  {display.packagingType ? (
                    <p className={`mt-0.5 ${constrained ? 'text-slate-600' : 'text-sm text-slate-700'}`}>
                      {display.packagingType}
                    </p>
                  ) : null}
                  {display.skuCode ? (
                    <p className={`mt-0.5 font-mono text-slate-500 ${constrained ? 'text-[10px]' : 'text-xs'}`}>
                      {display.skuCode}
                    </p>
                  ) : null}
                  {display.weightLabel ? (
                    <p className={`text-slate-500 ${constrained ? 'text-[10px]' : 'text-xs'}`}>
                      {display.weightLabel}
                    </p>
                  ) : null}
                  {Number(line.immediateFulfilledQuantity || 0) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Giao ngay: {line.immediateFulfilledQuantity}
                    </p>
                  ) : null}
                  {Number(line.reservedFinishedQuantity || 0) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      Đã giữ: {line.reservedFinishedQuantity}
                    </p>
                  ) : null}
                  {Number(line.backorderQuantity || 0) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      Chờ nguyên liệu: {line.backorderQuantity}
                    </p>
                  ) : null}
                </td>
                <td className={constrained ? 'py-1.5 pr-3' : 'py-3 pr-4'}>{line.quantity}</td>
                {!constrained ? (
                  <td className="py-3 pr-4 text-amber-700">
                    {line.returnedQuantity > 0 ? line.returnedQuantity : '—'}
                  </td>
                ) : null}
                <td className={constrained ? 'whitespace-nowrap py-1.5 pr-3' : 'py-3 pr-4'}>
                  {line.isGift ? (
                    <span className="text-[#7e5700]">0 VND</span>
                  ) : (
                    formatVnd(line.unitPrice)
                  )}
                </td>
                <td
                  className={`text-right font-semibold ${constrained ? 'whitespace-nowrap py-1.5 pr-2' : 'py-3'}`}
                >
                  {formatVnd(line.subTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={`shrink-0 border-t border-slate-100 text-sm ${
          constrained ? 'mt-2 space-y-0.5 pt-2 text-xs' : 'space-y-0 pt-4'
        }`}
      >
        {constrained ? (
          <>
            <div className="flex justify-between text-slate-500">
              <span>Tạm tính · Giảm giá</span>
              <span>
                {formatVnd(order.totalAmount)} · -{formatVnd(order.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-[#356647]">
              <span>Thành tiền</span>
              <span>{formatVnd(order.finalAmount)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Tạm tính</span>
              <span>{formatVnd(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Giảm giá thủ công</span>
              <span>-{formatVnd(getManualDiscountAmount(order))}</span>
            </div>
            {order.promotionCode ? (
              <div className="flex justify-between py-1 text-xs text-slate-500">
                <span>Mã KM ({order.promotionCode})</span>
                <span>-{formatVnd(order.promotionDiscountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-2 text-base font-bold text-[#356647]">
              <span>Thành tiền</span>
              <span>{formatVnd(order.finalAmount)}</span>
            </div>
          </>
        )}
      </div>

      {showTimeline ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-3">
          <h2 className="mb-2 shrink-0 text-sm font-bold text-slate-800">Lịch sử xử lý</h2>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            <OrderTimeline orderId={orderId} refreshKey={timelineRefreshKey} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OrderProductsSection
