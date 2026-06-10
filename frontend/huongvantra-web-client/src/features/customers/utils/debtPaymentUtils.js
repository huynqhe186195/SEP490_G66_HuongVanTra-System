import { buildDebtReceiptCode } from '../../pos/utils/buildDebtReceiptPaperHtml.js'
import { vietnamNowLabel } from '../../../utils/vietnamDateTime.js'

export function mapDebtAllocation(item) {
  if (!item || typeof item !== 'object') return null
  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    amount: Number(item.amount ?? item.Amount ?? 0),
    remainingAfter: Number(item.remainingAfter ?? item.RemainingAfter ?? 0),
  }
}

export function mapOpenDebt(item) {
  if (!item || typeof item !== 'object') return null
  return {
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    originalDebt: Number(item.originalDebt ?? item.OriginalDebt ?? 0),
    paidAmount: Number(item.paidAmount ?? item.PaidAmount ?? 0),
    remainingDebt: Number(item.remainingDebt ?? item.RemainingDebt ?? 0),
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export function mapDebtPaymentResult(item) {
  if (!item || typeof item !== 'object') return null
  const transaction = item.transaction ?? item.Transaction
  const allocations = item.allocations ?? item.Allocations ?? []
  return {
    transaction: transaction
      ? {
          id: transaction.id ?? transaction.Id,
          amount: Number(transaction.amount ?? transaction.Amount ?? 0),
          balanceAfter: Number(transaction.balanceAfter ?? transaction.BalanceAfter ?? 0),
          note: transaction.note ?? transaction.Note ?? '',
        }
      : null,
    allocations: Array.isArray(allocations) ? allocations.map(mapDebtAllocation).filter(Boolean) : [],
    allocatedAmount: Number(item.allocatedAmount ?? item.AllocatedAmount ?? 0),
    unallocatedAmount: Number(item.unallocatedAmount ?? item.UnallocatedAmount ?? 0),
  }
}

export function mapDebtPaymentPreview(item) {
  if (!item || typeof item !== 'object') return null
  const allocations = item.allocations ?? item.Allocations ?? []
  return {
    requestedAmount: Number(item.requestedAmount ?? item.RequestedAmount ?? 0),
    allocatedAmount: Number(item.allocatedAmount ?? item.AllocatedAmount ?? 0),
    unallocatedAmount: Number(item.unallocatedAmount ?? item.UnallocatedAmount ?? 0),
    allocations: Array.isArray(allocations) ? allocations.map(mapDebtAllocation).filter(Boolean) : [],
  }
}

export function buildDebtReceiptFromPayment({
  payment,
  customerName,
  customerCode,
  paymentMethodLabel,
  balanceBefore,
  relatedOrderCode,
  sellerName,
  sellerRole,
}) {
  if (!payment) return null
  return {
    kind: 'debt',
    receiptCode: buildDebtReceiptCode(payment.transaction?.id),
    customerName: customerName || 'Khách lẻ',
    customerCode: customerCode || '',
    paymentMethodLabel: paymentMethodLabel || 'Tiền mặt',
    createdAtLabel: vietnamNowLabel(),
    sellerName,
    sellerRole,
    amount: payment.allocatedAmount,
    balanceBefore,
    balanceAfter: Number(payment.transaction?.balanceAfter ?? balanceBefore - payment.allocatedAmount),
    relatedOrderCode: relatedOrderCode || undefined,
    allocations: payment.allocations,
    note: payment.transaction?.note || '',
  }
}

export function formatAllocationSummary(allocations = []) {
  if (!allocations.length) return ''
  return allocations.map((row) => `${row.orderCode}: ${row.amount}`).join(' · ')
}
