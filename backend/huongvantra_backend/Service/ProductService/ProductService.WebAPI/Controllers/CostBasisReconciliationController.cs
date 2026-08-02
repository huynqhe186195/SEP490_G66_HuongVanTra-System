using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Infrastructure.Services;

namespace ProductService.WebAPI.Controllers;

/// <summary>
/// Chạy lại cost basis lịch sử cho ProductVariant.
/// Chỉ ghi lại TotalApprovedInboundQuantity/Value và CostPrice; không tạo side effect tồn kho.
/// </summary>
[ApiController]
[Route("api/v1/products/cost-basis-reconciliation")]
public class CostBasisReconciliationController(
    ICostBasisReconciliationService reconciliationService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageBusinessPolicy)]
    public async Task<IActionResult> Reconcile(
        [FromQuery] Guid? skuId = null,
        CancellationToken ct = default)
    {
        var bearerToken = Request.Headers.Authorization.ToString();
        var result = await reconciliationService.ReconcileAsync(skuId, bearerToken, ct);
        return Ok(result);
    }
}
