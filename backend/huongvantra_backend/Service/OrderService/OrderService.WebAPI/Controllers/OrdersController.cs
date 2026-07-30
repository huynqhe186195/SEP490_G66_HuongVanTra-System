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

    [HttpGet("by-code/{orderCode}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByCode(string orderCode, CancellationToken ct) =>
        Ok(await orderLogic.GetByCodeAsync(orderCode, AccessContext(), ct));

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

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        if (IsCodCheckout(request) && !CanOperateCod())
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ Sale COD / Quản lý mới được tạo đơn COD."
            });

        if (!IsCodCheckout(request) && !CanOperatePosCounter())
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ Sale quầy (POS) / Quản lý mới được tạo đơn bán tại quầy."
            });

        var (actorId, actorName) = Actor();
        var idempotencyKey = Request.Headers.TryGetValue("X-Idempotency-Key", out var keyValues)
            ? keyValues.FirstOrDefault()
            : null;
        var result = await orderLogic.CreateAsync(request, AccessContext(), actorId, actorName, idempotencyKey, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    private bool CanOperateCod() =>
        User.HasPermission(PermissionNames.CreateCodOrder);

    private bool CanOperatePosCounter() =>
        User.HasPermission(PermissionNames.CreatePosOrder);

    private static bool IsCodCheckout(CreateOrderRequest request) =>
        request.OrderChannel == OrderService.Domain.Enums.OrderChannel.COD
        || request.PaymentMethod == OrderService.Domain.Enums.PaymentMethod.COD;

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

    [HttpPost("{id:guid}/ship")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
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

    [HttpPost("{id:guid}/return")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Return(Guid id, [FromBody] ReturnOrderRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.ReturnAsync(id, request, AccessContext(), actorId, actorName, ct));
    }
}
