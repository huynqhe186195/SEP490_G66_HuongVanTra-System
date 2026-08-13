import { apiRequestAuth } from '../../../lib/apiClient.js'

function mapChecklistItem(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: String(item.id ?? item.Id ?? '').trim(),
    label: String(item.label ?? item.Label ?? '').trim(),
    required: Boolean(item.required ?? item.Required),
  }
}

export function mapReturnPolicy(item) {
  if (!item || typeof item !== 'object') return null
  const reasons = item.allowedReasonCodes ?? item.AllowedReasonCodes ?? []
  const checklist = item.checklist ?? item.Checklist ?? []
  return {
    id: item.id ?? item.Id,
    code: item.code ?? item.Code ?? '',
    name: item.name ?? item.Name ?? '',
    version: Number(item.version ?? item.Version ?? 1),
    returnWindowDays: Number(item.returnWindowDays ?? item.ReturnWindowDays ?? 0),
    allowedReasonCodes: Array.isArray(reasons) ? reasons.map((x) => String(x).trim()).filter(Boolean) : [],
    checklist: Array.isArray(checklist) ? checklist.map(mapChecklistItem).filter((x) => x?.id) : [],
    minEvidenceImages: Number(item.minEvidenceImages ?? item.MinEvidenceImages ?? 0),
    allowPosChannel: Boolean(item.allowPosChannel ?? item.AllowPosChannel),
    allowCodChannel: Boolean(item.allowCodChannel ?? item.AllowCodChannel),
    allowCustomBundleReturns: Boolean(item.allowCustomBundleReturns ?? item.AllowCustomBundleReturns),
    autoAcceptOnPolicyPass: Boolean(item.autoAcceptOnPolicyPass ?? item.AutoAcceptOnPolicyPass),
    pendingRefundUntilAccept: Boolean(item.pendingRefundUntilAccept ?? item.PendingRefundUntilAccept),
    summaryText: item.summaryText ?? item.SummaryText ?? '',
  }
}

export function mapReturnPolicyForOrder(item) {
  if (!item || typeof item !== 'object') return null
  const policy = mapReturnPolicy(item.policy ?? item.Policy)
  if (!policy) return null
  const warnings = item.softWarnings ?? item.SoftWarnings ?? []
  return {
    policy,
    orderCode: item.orderCode ?? item.OrderCode ?? '',
    orderChannel: item.orderChannel ?? item.OrderChannel ?? '',
    policyAnchorAtUtc: item.policyAnchorAtUtc ?? item.PolicyAnchorAtUtc ?? null,
    policyAnchorSource: item.policyAnchorSource ?? item.PolicyAnchorSource ?? '',
    daysElapsed: item.daysElapsed ?? item.DaysElapsed ?? null,
    daysRemaining: item.daysRemaining ?? item.DaysRemaining ?? null,
    isWithinReturnWindow: Boolean(item.isWithinReturnWindow ?? item.IsWithinReturnWindow),
    channelAllowed: Boolean(item.channelAllowed ?? item.ChannelAllowed),
    hasCustomBundlesOnly: Boolean(item.hasCustomBundlesOnly ?? item.HasCustomBundlesOnly),
    customReturnBlocked: Boolean(item.customReturnBlocked ?? item.CustomReturnBlocked),
    softWarnings: Array.isArray(warnings) ? warnings.map((x) => String(x)) : [],
  }
}

export async function fetchActiveReturnPolicy() {
  const data = await apiRequestAuth('/api/v1/returns/policy', { method: 'GET' })
  return mapReturnPolicy(data)
}

export async function fetchReturnPolicyForOrder(orderId) {
  const data = await apiRequestAuth(
    `/api/v1/returns/policy/for-order/${encodeURIComponent(orderId)}`,
    { method: 'GET' },
  )
  return mapReturnPolicyForOrder(data)
}
