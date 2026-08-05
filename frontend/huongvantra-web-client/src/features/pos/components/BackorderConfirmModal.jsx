import { useState } from 'react'
import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'

const toDateInputValue = (date) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const addDays = (days) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '')

// Tên người nhận chỉ gồm chữ cái (kể cả dấu tiếng Việt) và khoảng trắng.
const NAME_PATTERN = /^[\p{L}\s]+$/u
const PHONE_PATTERN = /^0\d{9}$/

export default function BackorderConfirmModal({
  isOpen,
  message = '',
  lines = [],
  availableQuantity = 0,
  backorderQuantity = 0,
  estimatedReadyFrom = null,
  selectedCustomer = null,
  isSubmitting = false,
  onAccept,
  onDecline,
}) {
  const canChooseFulfillment = availableQuantity > 0
  const [selectedPreference, setSelectedPreference] = useState(null)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupNote, setPickupNote] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const fulfillmentPreference = canChooseFulfillment
    ? selectedPreference ?? 'PartialDelivery'
    : 'CompleteDelivery'

  const minPickupDate = toDateInputValue(addDays(1))
  const suggestedPickupDate = estimatedReadyFrom
    ? toDateInputValue(new Date(estimatedReadyFrom))
    : toDateInputValue(addDays(3))
  const effectivePickupDate = pickupDate || suggestedPickupDate
  const isPickupDateValid = effectivePickupDate >= minPickupDate

  // Khách có hồ sơ thì lấy sẵn tên/SĐT; khách vãng lai buộc thu ngân nhập tay.
  const effectiveContactName = (contactName || selectedCustomer?.fullName || '').trim()
  const effectiveContactPhone = normalizePhone(contactPhone || selectedCustomer?.phone || '')
  const isContactNameValid = effectiveContactName.length > 0 && NAME_PATTERN.test(effectiveContactName)
  const isContactPhoneValid = PHONE_PATTERN.test(effectiveContactPhone)
  const canAccept = isPickupDateValid && isContactNameValid && isContactPhoneValid

  if (!isOpen) return null

  const shortageLines = lines.filter((line) => Number(line.pendingBomQuantity || 0) > 0)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="alertdialog"
        aria-labelledby="backorder-confirm-title"
        aria-describedby="backorder-confirm-message"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[#f0eee6] px-5 py-4">
          <span className="material-symbols-outlined mt-0.5 text-[24px] text-[#7e5700]">inventory_2</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Hàng chưa đủ để giao ngay</p>
            <h2 id="backorder-confirm-title" className="mt-1 text-xl font-bold text-[#1b1c17]">
              Khách có đồng ý chờ hàng không?
            </h2>
          </div>
        </header>

        <CustomScrollArea className="min-h-0 flex-1" contentClassName="min-h-0 px-5 py-4">
          <p id="backorder-confirm-message" className="text-sm leading-relaxed text-[#414942]">
            {message || 'Sản phẩm này tạm thời hết hàng.'}
          </p>

          {shortageLines.length > 0 ? (
            <section className="mt-4 rounded-xl border border-[#f0eee6]">
              <div className="border-b border-[#f0eee6] px-4 py-2.5">
                <h3 className="text-sm font-bold text-[#1b1c17]">Sản phẩm phải chờ</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fbf9f1] text-xs uppercase tracking-wide text-[#717971]">
                  <tr>
                    <th className="px-4 py-2">Sản phẩm</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">Giao ngay</th>
                    <th className="whitespace-nowrap px-4 py-2 text-right">Phải chờ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eee6]">
                  {shortageLines.map((line) => (
                    <tr key={line.skuId}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold leading-snug text-[#1b1c17]">{line.skuName}</p>
                        {line.skuCode ? <p className="mt-0.5 text-xs text-[#717971]">{line.skuCode}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[#414942]">
                        {line.finishedDeductedQuantity || 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#7e5700]">
                        {line.pendingBomQuantity || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="mt-4 rounded-xl border border-[#f0eee6] bg-[#fbf9f1] p-4">
            <p className="text-sm font-bold text-[#1b1c17]">
              Người tới nhận hàng <span className="text-[#7e5700]">*</span>
            </p>
            <p className="mt-1 text-xs text-[#717971]">
              {selectedCustomer?.customerId
                ? 'Lấy từ hồ sơ khách đã chọn, có thể sửa nếu người khác tới nhận thay.'
                : 'Khách vãng lai — bắt buộc nhập để đối chiếu khi khách quay lại lấy hàng.'}
            </p>

            <label htmlFor="backorder-contact-name" className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#717971]">
              Họ tên
            </label>
            <input
              id="backorder-contact-name"
              type="text"
              value={contactName || selectedCustomer?.fullName || ''}
              onChange={(event) => setContactName(event.target.value)}
              disabled={isSubmitting}
              placeholder="Nguyễn Văn A"
              className="mt-1.5 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] focus:border-[#356647] focus:outline-none disabled:opacity-50"
            />
            {!isContactNameValid ? (
              <p className="mt-1.5 text-xs font-semibold text-[#7e5700]">
                Tên người nhận chỉ gồm chữ cái và khoảng trắng.
              </p>
            ) : null}

            <label htmlFor="backorder-contact-phone" className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#717971]">
              Số điện thoại
            </label>
            <input
              id="backorder-contact-phone"
              type="tel"
              inputMode="numeric"
              value={contactPhone || normalizePhone(selectedCustomer?.phone).slice(0, 10)}
              onChange={(event) => setContactPhone(normalizePhone(event.target.value).slice(0, 10))}
              maxLength={10}
              disabled={isSubmitting}
              placeholder="09xxxxxxxx"
              className="mt-1.5 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] focus:border-[#356647] focus:outline-none disabled:opacity-50"
            />
            {!isContactPhoneValid ? (
              <p className="mt-1.5 text-xs font-semibold text-[#7e5700]">
                Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.
              </p>
            ) : null}
          </section>

          <section className="mt-4 rounded-xl border border-[#f0eee6] bg-[#fbf9f1] p-4">
            <label htmlFor="backorder-pickup-date" className="block text-sm font-bold text-[#1b1c17]">
              Ngày hẹn khách quay lại lấy hàng <span className="text-[#7e5700]">*</span>
            </label>
            <input
              id="backorder-pickup-date"
              type="date"
              value={effectivePickupDate}
              min={minPickupDate}
              onChange={(event) => setPickupDate(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] focus:border-[#356647] focus:outline-none disabled:opacity-50"
            />
            {!isPickupDateValid ? (
              <p className="mt-1.5 text-xs font-semibold text-[#7e5700]">
                Ngày hẹn phải từ ngày mai trở đi.
              </p>
            ) : null}

            <label htmlFor="backorder-pickup-note" className="mt-3 block text-sm font-bold text-[#1b1c17]">
              Ghi chú <span className="font-normal text-[#717971]">(tuỳ chọn)</span>
            </label>
            <textarea
              id="backorder-pickup-note"
              rows={2}
              value={pickupNote}
              onChange={(event) => setPickupNote(event.target.value)}
              disabled={isSubmitting}
              placeholder="Ví dụ: khách gọi trước khi tới, giao buổi chiều..."
              className="mt-2 w-full resize-none rounded-xl border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] focus:border-[#356647] focus:outline-none disabled:opacity-50"
            />
          </section>

          {canChooseFulfillment ? (
            <section className="mt-4">
              <p className="text-sm font-bold text-[#1b1c17]">
                Có {availableQuantity} sản phẩm giao được ngay và {backorderQuantity} sản phẩm phải chờ. Khách muốn nhận
                thế nào?
              </p>
              <div className="mt-2.5 space-y-2">
                {[
                  {
                    value: 'PartialDelivery',
                    title: 'Nhận trước phần hàng sẵn',
                    detail: 'Giao ngay phần có sẵn, phần còn lại giao khi đủ hàng.',
                  },
                  {
                    value: 'CompleteDelivery',
                    title: 'Nhận một lần khi đủ hàng',
                    detail: 'Giữ toàn bộ đơn, giao một lần khi đã đủ hàng.',
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                      fulfillmentPreference === option.value
                        ? 'border-[#356647] bg-[#356647]/5'
                        : 'border-[#c1c9c0] bg-white hover:bg-[#f6f4ec]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="backorder-fulfillment"
                      value={option.value}
                      checked={fulfillmentPreference === option.value}
                      onChange={() => setSelectedPreference(option.value)}
                      disabled={isSubmitting}
                      className="mt-1 accent-[#356647]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[#1b1c17]">{option.title}</span>
                      <span className="mt-0.5 block text-xs text-[#717971]">{option.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ) : null}
        </CustomScrollArea>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#f0eee6] bg-[#fbf9f1] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            disabled={isSubmitting}
            className="rounded-xl border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
          >
            Khách không chờ
          </button>
          <button
            type="button"
            onClick={() =>
              onAccept({
                fulfillmentPreference,
                pickupDate: effectivePickupDate,
                pickupNote: pickupNote.trim() || null,
                pickupContactName: effectiveContactName,
                pickupContactPhone: effectiveContactPhone,
              })
            }
            disabled={isSubmitting || !canAccept}
            className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Khách đồng ý chờ'}
          </button>
        </footer>
      </div>
    </div>
  )
}
