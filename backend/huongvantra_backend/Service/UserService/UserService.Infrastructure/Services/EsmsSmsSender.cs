using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UserService.Application.Interfaces;
using UserService.Application.Options;
using UserService.Domain.Exceptions;

namespace UserService.Infrastructure.Services;

public class EsmsSmsSender(
    IHttpClientFactory httpClientFactory,
    IOptions<SmsOptions> options,
    ILogger<EsmsSmsSender> logger) : ISmsSender
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public bool IsEnabled
    {
        get
        {
            var o = options.Value;
            return o.Enabled
                && !string.IsNullOrWhiteSpace(o.ApiKey)
                && !string.IsNullOrWhiteSpace(o.SecretKey)
                && !string.IsNullOrWhiteSpace(o.BrandName);
        }
    }

    public async Task SendAsync(string phoneDigits, string message, CancellationToken ct = default)
    {
        var o = options.Value;
        if (!IsEnabled)
        {
            logger.LogInformation(
                "SMS disabled/misconfigured — log only. To={Phone} Content={Content}",
                Mask(phoneDigits),
                message);
            return;
        }

        var payload = new Dictionary<string, string>
        {
            ["ApiKey"] = o.ApiKey.Trim(),
            ["SecretKey"] = o.SecretKey.Trim(),
            ["Phone"] = phoneDigits,
            ["Content"] = message,
            ["Brandname"] = o.BrandName.Trim(),
            ["SmsType"] = string.IsNullOrWhiteSpace(o.SmsType) ? "2" : o.SmsType.Trim(),
            ["IsUnicode"] = string.IsNullOrWhiteSpace(o.IsUnicode) ? "0" : o.IsUnicode.Trim(),
            ["Sandbox"] = string.IsNullOrWhiteSpace(o.Sandbox) ? "0" : o.Sandbox.Trim(),
            ["RequestId"] = Guid.NewGuid().ToString("N"),
        };

        var client = httpClientFactory.CreateClient("esms");
        using var response = await client.PostAsJsonAsync(o.ApiUrl, payload, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        EsmsSendResponse? parsed = null;
        try
        {
            parsed = JsonSerializer.Deserialize<EsmsSendResponse>(body, JsonOptions);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "eSMS response parse failed. Status={Status} Body={Body}", response.StatusCode, body);
            throw new PasswordResetException("Không gửi được SMS OTP. Vui lòng thử lại sau.");
        }

        var code = parsed?.CodeResult ?? string.Empty;
        if (!response.IsSuccessStatusCode || code is not ("100" or "00"))
        {
            logger.LogError(
                "eSMS send failed. Code={Code} Error={Error} SmsId={SmsId} Body={Body}",
                code,
                parsed?.ErrorMessage,
                parsed?.SMSID,
                body);
            throw new PasswordResetException(
                string.IsNullOrWhiteSpace(parsed?.ErrorMessage)
                    ? "Không gửi được SMS OTP. Kiểm tra cấu hình eSMS / brandname / số dư."
                    : $"Không gửi được SMS: {parsed!.ErrorMessage}");
        }

        logger.LogInformation(
            "eSMS OTP sent. To={Phone} SmsId={SmsId} Sandbox={Sandbox}",
            Mask(phoneDigits),
            parsed?.SMSID,
            o.Sandbox);
    }

    private static string Mask(string phone) =>
        phone.Length < 7 ? "****" : $"{phone[..2]}****{phone[^3..]}";

    private sealed class EsmsSendResponse
    {
        [JsonPropertyName("CodeResult")]
        public string? CodeResult { get; set; }

        [JsonPropertyName("ErrorMessage")]
        public string? ErrorMessage { get; set; }

        [JsonPropertyName("SMSID")]
        public string? SMSID { get; set; }
    }
}
