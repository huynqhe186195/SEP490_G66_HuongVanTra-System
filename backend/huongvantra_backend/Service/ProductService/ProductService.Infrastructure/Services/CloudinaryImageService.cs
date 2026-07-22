using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;

namespace ProductService.Infrastructure.Services;

public partial class CloudinaryImageService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<CloudinaryImageService> logger)
    : ICloudinaryImageService
{
    private readonly string? _cloudName = configuration["Cloudinary:CloudName"];
    private readonly string? _apiKey = configuration["Cloudinary:ApiKey"];
    private readonly string? _apiSecret = configuration["Cloudinary:ApiSecret"];

    public async Task DeleteByUrlsAsync(IEnumerable<string> imageUrls, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_cloudName)
            || string.IsNullOrWhiteSpace(_apiKey)
            || string.IsNullOrWhiteSpace(_apiSecret))
        {
            logger.LogWarning("Cloudinary credentials chưa được cấu hình. Bỏ qua việc xóa ảnh.");
            return;
        }

        var publicIds = (imageUrls ?? [])
            .Select(ExtractPublicId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct()
            .ToList();

        foreach (var publicId in publicIds)
            await DestroyAsync(publicId!, ct);
    }

    private async Task DestroyAsync(string publicId, CancellationToken ct)
    {
        try
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            var signature = Sign($"public_id={publicId}&timestamp={timestamp}{_apiSecret}");

            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["public_id"] = publicId,
                ["timestamp"] = timestamp,
                ["api_key"] = _apiKey!,
                ["signature"] = signature,
            });

            var url = $"https://api.cloudinary.com/v1_1/{_cloudName}/image/destroy";
            var response = await httpClient.PostAsync(url, form, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning(
                    "Xóa ảnh Cloudinary '{PublicId}' thất bại ({StatusCode}): {Body}",
                    publicId, response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Lỗi khi xóa ảnh Cloudinary '{PublicId}'.", publicId);
        }
    }

    private static string Sign(string payload)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    // secure_url dạng: https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg
    // public_id = "folder/name" (bỏ version prefix và phần đuôi mở rộng).
    private static string? ExtractPublicId(string? secureUrl)
    {
        if (string.IsNullOrWhiteSpace(secureUrl)) return null;
        var match = UploadSegmentRegex().Match(secureUrl);
        if (!match.Success) return null;

        var path = match.Groups["path"].Value;
        var lastDot = path.LastIndexOf('.');
        if (lastDot > path.LastIndexOf('/'))
            path = path[..lastDot];
        return string.IsNullOrWhiteSpace(path) ? null : path;
    }

    [GeneratedRegex(@"/image/upload/(?:v\d+/)?(?<path>.+)$", RegexOptions.Compiled)]
    private static partial Regex UploadSegmentRegex();
}
