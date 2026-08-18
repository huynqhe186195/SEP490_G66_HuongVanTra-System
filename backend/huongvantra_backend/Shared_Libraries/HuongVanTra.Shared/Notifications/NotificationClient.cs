using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HuongVanTra.Shared.Notifications;

public class NotificationClient : INotificationClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<NotificationClient> _logger;
    private readonly string _internalApiKey;

    public NotificationClient(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<NotificationClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _internalApiKey = configuration["InternalApi:Key"]
            ?? throw new InvalidOperationException("InternalApi:Key is not configured");
    }

    public async Task SendBroadcastAsync(string role, string type, string message, string? linkUrl = null)
    {
        var request = new CreateBroadcastNotificationRequest
        {
            Role = role,
            Type = type,
            Message = message,
            LinkUrl = linkUrl
        };

        await SendAsync("/api/internal/notifications/broadcast", request);
    }

    public async Task SendDirectAsync(Guid recipientUserId, string type, string message, string? linkUrl = null)
    {
        var request = new CreateDirectNotificationRequest
        {
            RecipientUserId = recipientUserId,
            Type = type,
            Message = message,
            LinkUrl = linkUrl
        };

        await SendAsync("/api/internal/notifications/direct", request);
    }

    public async Task SendBatchAsync(List<CreateDirectNotificationRequest> notifications)
    {
        var request = new CreateBatchNotificationRequest
        {
            Notifications = notifications
        };

        await SendAsync("/api/internal/notifications/batch", request);
    }

    private async Task SendAsync(string endpoint, object payload)
    {
        try
        {
            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, endpoint);
            requestMessage.Headers.Add("X-Internal-Api-Key", _internalApiKey);
            requestMessage.Content = JsonContent.Create(payload);

            var response = await _httpClient.SendAsync(requestMessage);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Notification call failed with status {StatusCode}: {Body}",
                    response.StatusCode,
                    body);
            }
        }
        catch (Exception ex)
        {
            // Fire-and-forget: log but don't throw to avoid breaking business flows
            _logger.LogWarning(ex, "Failed to send notification to {Endpoint}", endpoint);
        }
    }
}
