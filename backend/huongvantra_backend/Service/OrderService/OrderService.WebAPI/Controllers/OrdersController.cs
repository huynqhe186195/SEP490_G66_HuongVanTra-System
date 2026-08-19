using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;
using OrderService.WebAPI.Authorization;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController(OrderLogic orderLogic, ReceiptReprintLogic receiptReprintLogic) : ControllerBase
{
    private OrderAccessContext AccessContext() => User.CreateOrderAccessContext();

    private (Guid? ActorId, string? ActorName) Actor() =>
    (
        User.GetUserId() is var id && id != Guid.Empty ? id : null,
        User.GetDisplayName()
    );

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged([FromQuery] GetOrdersRequest request, CancellationToken ct) =>
        Ok(await orderLogic.GetPagedAsync(request, AccessContext(), ct));

    [HttpGet("export")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> ExportOrders([FromQuery] GetOrdersRequest request, CancellationToken ct)
    {
        var result = await orderLogic.ExportToExcelAsync(request, AccessContext(), ct);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [HttpGet("by-code/{orderCode}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByCode(string orderCode, CancellationToken ct) =>
        Ok(await orderLogic.GetByCodeAsync(orderCode, AccessContext(), ct));

    [HttpGet("return-slips/export")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> ExportReturnSlips(
        [FromQuery] string? search,
        [FromQuery] string? channel,
        CancellationToken ct = default)
    {
        var result = await orderLogic.ExportReturnSlipsToExcelAsync(search, channel, AccessContext(), ct);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [HttpGet("return-slips")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturnSlipsPaged(
        [FromQuery] string? search,
        [FromQuery] string? channel,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await orderLogic.GetReturnsPagedAsync(search, channel, AccessContext(), page, pageSize, ct));

    [HttpGet("return-slips/{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturnSlipById(Guid id, CancellationToken ct) =>
        Ok(await orderLogic.GetReturnByIdAsync(id, AccessContext(), ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        Ok(await orderLogic.GetByIdAsync(id, AccessContext(), ct));

    [HttpGet("{id:guid}/activities")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetActivities(Guid id, CancellationToken ct) =>
        Ok(await orderLogic.GetActivitiesAsync(id, AccessContext(), ct));

    [HttpGet("{orderId:guid}/returns")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturnsByOrderId(Guid orderId, CancellationToken ct) =>
        Ok(await orderLogic.GetReturnsByOrderIdAsync(orderId, AccessContext(), ct));

    [HttpGet("{id:guid}/receipt-reprints")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReceiptReprints(Guid id, CancellationToken ct) =>
        Ok(await receiptReprintLogic.GetHistoryAsync(id, AccessContext(), ct));

    [HttpPost("{id:guid}/receipt-reprints")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> ReprintReceipt(
        Guid id, [FromBody] ReprintReceiptRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        var idempotencyKey = Request.Headers.TryGetValue("X-Idempotency-Key", out var keyValues)
            ? keyValues.FirstOrDefault()
            : null;
        return Ok(await receiptReprintLogic.ReprintAsync(
            id, request?.Reason, actorId, actorName, idempotencyKey, AccessContext(), ct));
    }

    /// <summary>
    /// Tạo đơn (POS / COD / B2B). FE POS: posApi → ordersApi.createOrder.
    /// Quyền theo channel: CREATE_POS_ORDER / CREATE_COD_ORDER / CREATE_B2B_ORDER.
    /// 409 requiresBackorderConfirmation = preview tồn, chưa lưu đơn, chưa trừ kệ.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        // DEBUG LOG
        Console.WriteLine($"🔍 Backend nhận được CustomBundles: {request.CustomBundles?.Count ?? 0} bundles");
        if (request.CustomBundles != null)
        {
            foreach (var bundle in request.CustomBundles)
            {
                Console.WriteLine($"  - Bundle: Label={bundle.Label}, Ingredients={bundle.Ingredients?.Count ?? 0}");
            }
        }
        Console.WriteLine($"🔍 Backend nhận được Items: {request.Items?.Count ?? 0} items");

        if (IsB2BCheckout(request) && !CanOperateB2B())
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ Kế toán / Quản lý mới được lập đơn bán theo hợp đồng."
            });

        if (!IsB2BCheckout(request) && IsCodCheckout(request) && !CanOperateCod())
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ Sale COD / Quản lý mới được tạo đơn COD."
            });

        // POS mặc định: không B2B, không COD → cần CREATE_POS_ORDER (SaleCod thiếu permission này → 403).
        if (!IsB2BCheckout(request) && !IsCodCheckout(request) && !CanOperatePosCounter())
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ Sale quầy (POS) / Quản lý mới được tạo đơn bán tại quầy."
            });

        var (actorId, actorName) = Actor();
        var idempotencyKey = Request.Headers.TryGetValue("X-Idempotency-Key", out var keyValues)
            ? keyValues.FirstOrDefault()
            : null;
        OrderService.Application.DTOs.Responses.OrderResponse result;
        try
        {
            result = await orderLogic.CreateAsync(request, AccessContext(), actorId, actorName, idempotencyKey, ct);
        }
        catch (OrderService.Application.Interfaces.BackorderConfirmationRequiredException ex)
        {
            // HTTP 409. FE handleConfirmPayment đọc requiresBackorderConfirmation → BackorderConfirmModal.
            return Conflict(new
            {
                requiresBackorderConfirmation = true,
                backorderMessage = ex.Message,
                availableQuantity = ex.Lines.Sum(line => line.FinishedDeductedQuantity),
                backorderQuantity = ex.Lines.Sum(line => line.PendingBomQuantity),
                lines = ex.Lines
            });
        }
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    private bool CanOperateCod() =>
        User.HasPermission(PermissionNames.CreateCodOrder);

    private bool CanOperatePosCounter() =>
        User.HasPermission(PermissionNames.CreatePosOrder);

    private bool CanOperateB2B() =>
        User.HasPermission(PermissionNames.CreateB2BOrder);

    private static bool IsCodCheckout(CreateOrderRequest request) =>
        request.OrderChannel == OrderService.Domain.Enums.OrderChannel.COD
        || request.PaymentMethod == OrderService.Domain.Enums.PaymentMethod.COD;

    private static bool IsB2BCheckout(CreateOrderRequest request) =>
        request.OrderChannel == OrderService.Domain.Enums.OrderChannel.B2B
        || request.ContractId.HasValue;

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.UpdateAsync(id, request, AccessContext(), actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        await orderLogic.CancelAsync(id, AccessContext(), request.Reason, actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/backorder-cancellation")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> RequestBackorderCancellation(
        Guid id,
        [FromBody] CancelOrderRequest request,
        CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.RequestBackorderCancellationAsync(
            id, AccessContext(), request.Reason, actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/backorder-cancellation/review")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> ReviewBackorderCancellation(
        Guid id,
        [FromBody] ReviewBackorderCancellationRequest request,
        CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.ReviewBackorderCancellationAsync(
            id, request, AccessContext() with { CanViewAllOrders = true }, actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/backorder-refund/complete")]
    [Authorize(Roles = "Manager,Accountant")]
    public async Task<IActionResult> CompleteBackorderRefund(
        Guid id,
        [FromBody] CompleteBackorderRefundRequest request,
        CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.CompleteBackorderRefundAsync(
            id, request, AccessContext() with { CanViewAllOrders = true }, actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/ship")]
    [Authorize(Policy = PermissionNames.ShipOrderAccess)]
    public async Task<IActionResult> Ship(Guid id, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        await orderLogic.MarkShippingAsync(id, AccessContext(), actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        await orderLogic.CompleteAsync(id, AccessContext(), actorId, actorName, ct: ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/mark-delivered")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> MarkDelivered(Guid id, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        await orderLogic.MarkDeliveredAsync(id, AccessContext(), actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/collect-and-deliver")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> CollectAndDeliver(Guid id, [FromBody] CollectRemainingRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.CollectRemainingAndDeliverAsync(id, request, AccessContext(), actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/cancel-overdue-deposit")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> CancelOverdueDeposit(Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.CancelOverdueDepositAsync(
            id, AccessContext() with { CanViewAllOrders = true }, request.Reason, actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/return")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Return(Guid id, [FromBody] ReturnOrderRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.ReturnAsync(id, request, AccessContext(), actorId, actorName, ct));
    }
}
