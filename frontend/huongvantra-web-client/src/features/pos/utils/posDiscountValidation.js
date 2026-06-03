/**
 * Chuẩn hóa / kiểm tra chiết khấu đơn POS (%, VNĐ cố định).
 * CK đơn áp trên tổng sau CK từng dòng; không vượt số tiền còn lại của đơn.
 */

export function normalizeOrderDiscountInput({
  percent = 0,
  fixedAmount = 0,
  subtotalAfterItemDiscount = 0,
}) {
  const base = Math.max(0, Math.round(Number(subtotalAfterItemDiscount) || 0))
  const fixed = Math.max(0, Math.round(Number(fixedAmount) || 0))
  const pct = Math.min(100, Math.max(0, Number(percent) || 0))

  if (fixed > 0) {
    if (base <= 0) {
      return {
        ok: false,
        error: 'Không thể chiết khấu đơn khi tổng sau chiết khấu dòng bằng 0.',
        orderDiscountPercent: 0,
        orderDiscountAmountFixed: 0,
      }
    }
    if (fixed > base) {
      return {
        ok: true,
        clamped: true,
        warning: 'Chiết khấu cố định không được vượt tổng còn lại sau CK dòng — đã điều chỉnh.',
        orderDiscountPercent: 0,
        orderDiscountAmountFixed: base,
      }
    }
    return {
      ok: true,
      orderDiscountPercent: 0,
      orderDiscountAmountFixed: fixed,
    }
  }

  if (pct > 100) {
    return {
      ok: false,
      error: 'Chiết khấu đơn không được vượt 100%.',
      orderDiscountPercent: 100,
      orderDiscountAmountFixed: 0,
    }
  }

  if (pct > 0 && base <= 0) {
    return {
      ok: false,
      error: 'Không thể áp dụng % chiết khấu khi tổng sau CK dòng bằng 0.',
      orderDiscountPercent: 0,
      orderDiscountAmountFixed: 0,
    }
  }

  return {
    ok: true,
    orderDiscountPercent: pct,
    orderDiscountAmountFixed: 0,
  }
}

/** Kiểm tra trước thanh toán — đồng bộ với computePosTotals. */
export function validatePosDiscountsBeforePayment({
  cartItems,
  orderDiscountPercent = 0,
  orderDiscountAmountFixed = 0,
  grossSubtotal = 0,
  subtotalAfterItemDiscount = 0,
  orderDiscountAmount = 0,
  totalDiscount = 0,
  total = 0,
}) {
  const base = Math.max(0, Math.round(subtotalAfterItemDiscount))
  const gross = Math.max(0, Math.round(grossSubtotal))

  if (orderDiscountPercent > 100) {
    return { ok: false, error: 'Chiết khấu đơn không được vượt 100%.' }
  }

  const fixedStored = Math.max(0, Math.round(Number(orderDiscountAmountFixed) || 0))
  if (fixedStored > 0 && fixedStored > base) {
    return {
      ok: false,
      error: 'Chiết khấu cố định không được lớn hơn tổng còn lại sau CK từng sản phẩm.',
      clampOrderDiscount: { orderDiscountPercent: 0, orderDiscountAmountFixed: base },
    }
  }

  const appliedOrder = Math.round(orderDiscountAmount)
  if (appliedOrder > base) {
    return { ok: false, error: 'Chiết khấu đơn không được vượt tổng còn lại sau CK dòng.' }
  }

  if (totalDiscount > gross) {
    return { ok: false, error: 'Tổng chiết khấu không được lớn hơn tạm tính đơn hàng.' }
  }

  if (total < 0) {
    return { ok: false, error: 'Số tiền cần thanh toán không hợp lệ.' }
  }

  for (const row of cartItems || []) {
    const grossLine = (row.qty || 0) * (row.price || 0)
    const value = row.lineDiscountValue || 0
    if (!value) continue
    if (row.lineDiscountType === 'amount' && value > grossLine) {
      return { ok: false, error: `Chiết khấu "${row.name}" vượt thành tiền dòng.` }
    }
    if (row.lineDiscountType !== 'amount' && value > 100) {
      return { ok: false, error: `Chiết khấu % của "${row.name}" không hợp lệ.` }
    }
  }

  return { ok: true }
}
