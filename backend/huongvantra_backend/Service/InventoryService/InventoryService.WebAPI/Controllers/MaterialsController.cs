using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory")]
[Authorize]
public class MaterialsController(InventoryLogic _logic) : ControllerBase
{
    // Giữ comment: OrderService/CustomBundle có thể forward JWT Warehouse/Manager/Admin.
    [HttpPost("deduct-materials")]
    [Authorize(Policy = PermissionNames.MaterialsDeductAccess)]
    public async Task<IActionResult> DeductMaterials(
        [FromBody] DeductMaterialsRequest request,
        CancellationToken ct)
    {
        await _logic.DeductMaterialsAsync(
            request,
            User.GetUserId(),
            User.ToCreatorSnapshot(),
            ct);
        return NoContent();
    }

    [HttpPost("pos-stock-handling")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> PreparePosStockDeduction(
        [FromBody] PreparePosStockDeductionRequest request,
        CancellationToken ct)
    {
        var result = await _logic.PreparePosStockDeductionAsync(
            request,
            User.GetUserId(),
            User.ToCreatorSnapshot(),
            ct);
        return Ok(result);
    }

    /// <summary>
    /// POS-04 (H4): OrderService gọi đồng bộ khi sửa đơn COD chờ xác nhận — thay giữ chỗ
    /// tồn Kệ Hàng nguyên tử (release + re-reserve all-or-nothing, idempotent theo OperationId).
    /// </summary>
    [HttpPost("cod-reservation-replace")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> ReplaceCodReservation(
        [FromBody] ReplaceCodReservationRequest request,
        CancellationToken ct)
    {
        var result = await _logic.ReplaceCodReservationAsync(request, ct);
        return Ok(result);
    }
}
