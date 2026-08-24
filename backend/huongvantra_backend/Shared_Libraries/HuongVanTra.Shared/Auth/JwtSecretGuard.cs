using Microsoft.Extensions.Configuration;

namespace HuongVanTra.Shared.Auth;

/// <summary>
/// SEC-01: chan JWT secret yeu / secret placeholder tung bi commit vao repo.
/// </summary>
public static class JwtSecretGuard
{
    public const int MinimumLength = 32;

    // Cac gia tri tung nam trong appsettings.json cua repo => coi nhu da lo, khong duoc dung lai.
    private static readonly string[] KnownLeakedPrefixes =
    {
        "your-super-secret-key",
        "doi_thanh_chuoi_random",
        "change-me",
        "changeme",
        "secret",
    };

    public static string RequireSecret(IConfiguration configuration, string configKey = "Jwt:Secret")
    {
        var secret = configuration[configKey];

        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                $"{configKey} chua duoc cau hinh. Dat bien moi truong JWT_SECRET (>= {MinimumLength} ky tu) " +
                "trong file .env - xem .env.example. Khong hardcode vao appsettings.json.");

        if (secret.Length < MinimumLength)
            throw new InvalidOperationException(
                $"{configKey} chi dai {secret.Length} ky tu, toi thieu {MinimumLength}. " +
                "Sinh gia tri moi: openssl rand -hex 32");

        foreach (var prefix in KnownLeakedPrefixes)
        {
            if (secret.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    $"{configKey} dang dung gia tri placeholder tung bi commit vao repo nen coi nhu da lo. " +
                    "Sinh gia tri that va dat qua JWT_SECRET trong .env: openssl rand -hex 32");
        }

        return secret;
    }
}
