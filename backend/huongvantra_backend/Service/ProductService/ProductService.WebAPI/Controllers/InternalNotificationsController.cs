using HuongVanTra.Shared.Notifications;
using Microsoft.AspNetCore.Mvc;
using ProductService.Infrastructure.UseCases;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/internal/notifications")]
public class InternalNotificationsController : ControllerBase
{
    private readonly NotificationLogic _notificationLogic;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InternalNotificationsController> _logger;

    public InternalNotificationsController(
        NotificationLogic notificationLogic,
        IConfiguration configuration,
        ILogger<InternalNotificationsController> logger)
    {
        _notificationLogic = notificationLogic;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> CreateBroadcast([FromBody] CreateBroadcastNotificationRequest request)
    {
        if (!ValidateInternalApiKey())
        {
            return Unauthorized();
        }

        try
        {
            await _notificationLogic.BroadcastAsync(
                request.Role,
                request.Type,
                request.Message,
                request.LinkUrl);

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create broadcast notification for role {Role}, type {Type}",
                request.Role, request.Type);
            return StatusCode(500, "Failed to create notification");
        }
    }

    [HttpPost("direct")]
    public async Task<IActionResult> CreateDirect([FromBody] CreateDirectNotificationRequest request)
    {
        if (!ValidateInternalApiKey())
        {
            return Unauthorized();
        }

        try
        {
            await _notificationLogic.CreateDirectAsync(
                request.RecipientUserId,
                request.Type,
                request.Message,
                request.LinkUrl);

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create direct notification for user {UserId}, type {Type}",
                request.RecipientUserId, request.Type);
            return StatusCode(500, "Failed to create notification");
        }
    }

    [HttpPost("batch")]
    public async Task<IActionResult> CreateBatch([FromBody] CreateBatchNotificationRequest request)
    {
        if (!ValidateInternalApiKey())
        {
            return Unauthorized();
        }

        try
        {
            foreach (var notification in request.Notifications)
            {
                await _notificationLogic.CreateDirectAsync(
                    notification.RecipientUserId,
                    notification.Type,
                    notification.Message,
                    notification.LinkUrl);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create batch notifications");
            return StatusCode(500, "Failed to create notifications");
        }
    }

    private bool ValidateInternalApiKey()
    {
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var headerValue))
        {
            return false;
        }

        var expectedKey = _configuration["InternalApi:Key"];
        if (string.IsNullOrEmpty(expectedKey))
        {
            _logger.LogWarning("InternalApi:Key not configured");
            return false;
        }

        return headerValue == expectedKey;
    }
}
