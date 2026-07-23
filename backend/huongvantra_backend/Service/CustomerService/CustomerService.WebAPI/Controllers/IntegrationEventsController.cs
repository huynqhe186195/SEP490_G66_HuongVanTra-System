using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.UseCases;
using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/integration-events")]
[Authorize]
public class IntegrationEventsController : ControllerBase
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly IWebHostEnvironment _environment;

    public IntegrationEventsController(IPublishEndpoint publishEndpoint, IWebHostEnvironment environment)
    {
        _publishEndpoint = publishEndpoint;
        _environment = environment;
    }

    /// <summary>
    /// Dev/test: publish OrderCompletedEvent to RabbitMQ (same path as real Order Service).
    /// </summary>
    [HttpPost("order-completed/simulate")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> SimulateOrderCompleted(
        [FromBody] SimulateOrderCompletedRequest request,
        CancellationToken ct = default)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var orderId = request.OrderId ?? Guid.NewGuid();
        var orderCode = string.IsNullOrWhiteSpace(request.OrderCode)
            ? $"SIM-{orderId.ToString()[..8].ToUpperInvariant()}"
            : request.OrderCode.Trim();

        var message = new OrderCompletedEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = request.CustomerId,
            TotalAmount = request.TotalAmount,
            DebtAmount = request.DebtAmount
        };

        await _publishEndpoint.Publish(message, ct);

        return Accepted(new
        {
            message = "OrderCompletedEvent published to RabbitMQ.",
            orderId,
            orderCode,
            request.CustomerId,
            request.TotalAmount,
            request.DebtAmount
        });
    }
}
