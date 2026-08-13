using System.Text.Json;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class ReturnPolicyLogic(
    IReturnPolicyRepository _policyRepo,
    IOrderRepository _orderRepo)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<ReturnPolicyResponse> GetActivePolicyAsync(CancellationToken ct = default)
    {
        var policy = await _policyRepo.GetActiveAsync(ct)
            ?? throw new OrderValidationException(
                "Chưa cấu hình chính sách trả hàng. Vui lòng liên hệ Quản lý.");
        return MapPolicy(policy);
    }

    public async Task<ReturnPolicyForOrderResponse> GetPolicyForOrderAsync(
        Guid orderId,
        OrderAccessContext access,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        if (!access.CanViewOrder(order))
            throw new OrderForbiddenException();

        var policyEntity = await _policyRepo.GetActiveAsync(ct)
            ?? throw new OrderValidationException(
                "Chưa cấu hình chính sách trả hàng. Vui lòng liên hệ Quản lý.");
        var policy = MapPolicy(policyEntity);

        var hasDetails = (order.OrderDetails?.Count ?? 0) > 0;
        var hasCustom = (order.CustomBundles?.Any(b => (b.Ingredients?.Count ?? 0) > 0) ?? false);
        var customOnly = hasCustom && !hasDetails;

        var (anchorAt, anchorSource) = ResolvePolicyAnchor(order);
        int? daysElapsed = null;
        int? daysRemaining = null;
        var withinWindow = true;
        if (anchorAt.HasValue)
        {
            var elapsed = (int)Math.Floor((DateTime.UtcNow - anchorAt.Value).TotalDays);
            if (elapsed < 0) elapsed = 0;
            daysElapsed = elapsed;
            daysRemaining = policy.ReturnWindowDays - elapsed;
            withinWindow = elapsed <= policy.ReturnWindowDays;
        }

        var channel = order.OrderChannel.ToString();
        var channelAllowed = order.OrderChannel switch
        {
            OrderChannel.POS => policy.AllowPosChannel,
            OrderChannel.COD => policy.AllowCodChannel,
            _ => policy.AllowPosChannel || policy.AllowCodChannel,
        };

        var customBlocked = customOnly && !policy.AllowCustomBundleReturns;
        var warnings = new List<string>();
        if (!withinWindow)
            warnings.Add(
                $"Đã quá thời hạn trả hàng ({policy.ReturnWindowDays} ngày kể từ {DescribeAnchor(anchorSource)}).");
        if (!channelAllowed)
            warnings.Add($"Kênh {channel} hiện không được áp dụng trả hàng theo chính sách.");
        if (customBlocked)
            warnings.Add("Đơn chỉ gồm gói custom — chính sách mặc định không cho trả.");
        if (policy.PendingRefundUntilAccept)
            warnings.Add("Hoàn tiền chỉ sau khi hệ thống chấp nhận trả (Accept).");
        if (policy.MinEvidenceImages > 0)
            warnings.Add($"Cần tối thiểu {policy.MinEvidenceImages} ảnh minh chứng tình trạng hàng.");

        return new ReturnPolicyForOrderResponse(
            policy,
            order.OrderCode,
            channel,
            anchorAt,
            anchorSource,
            daysElapsed,
            daysRemaining,
            withinWindow,
            channelAllowed,
            customOnly,
            customBlocked,
            warnings);
    }

    /// <summary>
    /// Phase 2/3: System đánh giá policy. Fail → không nhận trả (trừ Manager override).
    /// Pass → caller mới được tạo ReturnOrder / hoàn tiền.
    /// </summary>
    public async Task<ReturnPolicyAcceptanceResult> EvaluateAcceptanceAsync(
        Order order,
        ReturnOrderRequest req,
        OrderAccessContext access,
        CancellationToken ct = default)
    {
        var policyEntity = await _policyRepo.GetActiveAsync(ct)
            ?? throw new OrderValidationException(
                "Chưa cấu hình chính sách trả hàng. Vui lòng liên hệ Quản lý.");
        var policy = MapPolicy(policyEntity);
        var failures = new List<string>();

        var hasDetails = (order.OrderDetails?.Count ?? 0) > 0;
        var hasCustom = (order.CustomBundles?.Any(b => (b.Ingredients?.Count ?? 0) > 0) ?? false);
        var customOnly = hasCustom && !hasDetails;

        var channelAllowed = order.OrderChannel switch
        {
            OrderChannel.POS => policy.AllowPosChannel,
            OrderChannel.COD => policy.AllowCodChannel,
            _ => policy.AllowPosChannel || policy.AllowCodChannel,
        };
        if (!channelAllowed)
            failures.Add($"Kênh {order.OrderChannel} không được trả hàng theo chính sách.");

        if (customOnly && !policy.AllowCustomBundleReturns)
            failures.Add("Đơn chỉ gồm gói custom không được trả theo chính sách.");

        var (anchorAt, anchorSource) = ResolvePolicyAnchor(order);
        if (anchorAt.HasValue)
        {
            var elapsed = (int)Math.Floor((DateTime.UtcNow - anchorAt.Value).TotalDays);
            if (elapsed < 0) elapsed = 0;
            if (elapsed > policy.ReturnWindowDays)
            {
                failures.Add(
                    $"Quá hạn trả hàng ({elapsed}/{policy.ReturnWindowDays} ngày kể từ {DescribeAnchor(anchorSource)}).");
            }
        }

        var reasons = (req.Reasons ?? [])
            .Select(r => r?.Trim() ?? string.Empty)
            .Where(r => r.Length > 0)
            .ToList();
        if (reasons.Count == 0)
            failures.Add("Cần chọn ít nhất một lý do trả/đổi hàng theo chính sách.");
        else
        {
            var allowed = new HashSet<string>(policy.AllowedReasonCodes, StringComparer.OrdinalIgnoreCase);
            var invalid = reasons.Where(r => !allowed.Contains(r)).ToList();
            if (invalid.Count > 0)
                failures.Add($"Lý do không thuộc chính sách: {string.Join(", ", invalid)}.");
        }

        var answers = (req.ChecklistAnswers ?? [])
            .Where(a => !string.IsNullOrWhiteSpace(a.Id))
            .GroupBy(a => a.Id.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last().Checked, StringComparer.OrdinalIgnoreCase);

        foreach (var item in policy.Checklist.Where(c => c.Required))
        {
            if (!answers.TryGetValue(item.Id, out var checkedOk) || !checkedOk)
                failures.Add($"Chưa xác nhận điều kiện bắt buộc: {item.Label}.");
        }

        var evidenceUrls = NormalizeEvidenceUrls(req.EvidenceImageUrls);
        if (evidenceUrls.Count < policy.MinEvidenceImages)
        {
            failures.Add(
                $"Cần tối thiểu {policy.MinEvidenceImages} ảnh minh chứng (đang có {evidenceUrls.Count}).");
        }

        if (evidenceUrls.Count > ReturnOrderEvidenceImage.MaxEvidenceImages)
        {
            failures.Add(
                $"Tối đa {ReturnOrderEvidenceImage.MaxEvidenceImages} ảnh minh chứng.");
        }

        var passed = failures.Count == 0;
        var managerOverride = false;
        if (!passed && req.ManagerOverride)
        {
            if (!access.CanViewAllOrders)
                throw new OrderValidationException(
                    "Chỉ Quản lý / Admin mới được ghi đè chính sách trả hàng.");
            if (string.IsNullOrWhiteSpace(req.Note) || req.Note.Trim().Length < 10)
                throw new OrderValidationException(
                    "Ghi đè chính sách cần ghi chú lý do ít nhất 10 ký tự.");
            managerOverride = true;
            passed = true;
        }

        if (!passed)
        {
            throw new OrderValidationException(
                "Hệ thống từ chối nhận trả vì chưa thoả chính sách: " + string.Join(" ", failures));
        }

        var checklistJson = JsonSerializer.Serialize(
            answers.Select(kv => new { id = kv.Key, @checked = kv.Value }),
            JsonOptions);
        var note = managerOverride
            ? $"Manager override. Failures: {string.Join("; ", failures)}"
            : "System Accept — đủ điều kiện policy.";

        return new ReturnPolicyAcceptanceResult(
            policyEntity,
            policy,
            Passed: true,
            ManagerOverrideApplied: managerOverride,
            FailureReasons: failures,
            ChecklistAnswersJson: checklistJson,
            EvidenceImageUrls: evidenceUrls,
            EvaluationNote: note);
    }

    private static List<string> NormalizeEvidenceUrls(List<string>? urls)
    {
        if (urls is null || urls.Count == 0)
            return [];

        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in urls)
        {
            var url = (raw ?? string.Empty).Trim();
            if (url.Length == 0) continue;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                throw new OrderValidationException($"URL ảnh minh chứng không hợp lệ: {url}");
            if (uri.Scheme is not ("http" or "https"))
                throw new OrderValidationException($"URL ảnh minh chứng phải là http/https: {url}");
            if (!seen.Add(url)) continue;
            result.Add(url);
        }

        return result;
    }

    private static (DateTime? AnchorAt, string Source) ResolvePolicyAnchor(Order order)
    {
        if (order.OrderChannel == OrderChannel.COD && order.DeliveredAt.HasValue)
            return (order.DeliveredAt, "DeliveredAt");
        if (order.CompletedAt.HasValue)
            return (order.CompletedAt, "CompletedAt");
        return (order.CreatedAt, "CreatedAt");
    }

    private static string DescribeAnchor(string source) => source switch
    {
        "DeliveredAt" => "ngày giao hàng",
        "CompletedAt" => "ngày hoàn tất",
        _ => "ngày tạo đơn",
    };

    private static ReturnPolicyResponse MapPolicy(ReturnPolicy policy)
    {
        var reasons = ParseStringList(policy.AllowedReasonCodesJson);
        var checklist = ParseChecklist(policy.ChecklistJson);
        return new ReturnPolicyResponse(
            policy.Id,
            policy.Code,
            policy.Name,
            policy.Version,
            policy.ReturnWindowDays,
            reasons,
            checklist,
            policy.MinEvidenceImages,
            policy.AllowPosChannel,
            policy.AllowCodChannel,
            policy.AllowCustomBundleReturns,
            policy.AutoAcceptOnPolicyPass,
            policy.PendingRefundUntilAccept,
            policy.SummaryText);
    }

    private static IReadOnlyList<string> ParseStringList(string json)
    {
        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(json, JsonOptions);
            return list?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList()
                ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static IReadOnlyList<ReturnPolicyChecklistItemResponse> ParseChecklist(string json)
    {
        try
        {
            var list = JsonSerializer.Deserialize<List<ChecklistDto>>(json, JsonOptions);
            if (list is null) return [];
            return list
                .Where(x => !string.IsNullOrWhiteSpace(x.Id))
                .Select(x => new ReturnPolicyChecklistItemResponse(
                    x.Id.Trim(),
                    string.IsNullOrWhiteSpace(x.Label) ? x.Id : x.Label.Trim(),
                    x.Required))
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private sealed class ChecklistDto
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public bool Required { get; set; }
    }
}
