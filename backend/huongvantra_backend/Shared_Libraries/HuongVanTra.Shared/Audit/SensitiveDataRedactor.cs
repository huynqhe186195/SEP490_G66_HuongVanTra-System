using System.Text.RegularExpressions;

namespace HuongVanTra.Shared.Audit;

public static class SensitiveDataRedactor
{
    private const int MaxLength = 2000;

    private static readonly string[] SensitiveWords =
    [
        "password",
        "pass",
        "token",
        "refresh",
        "otp",
        "authorization",
        "secret",
        "card",
        "cvv"
    ];

    public static string? Redact(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim();
        foreach (var word in SensitiveWords)
        {
            text = SensitivePattern(word).Replace(text, "$1[redacted]");
        }

        return text.Length <= MaxLength ? text : text[..MaxLength];
    }

    public static bool IsSensitiveKey(string? key)
    {
        var text = (key ?? string.Empty).ToLowerInvariant();
        return SensitiveWords.Any(text.Contains);
    }

    private static Regex SensitivePattern(string key) =>
        new("(?i)(" + Regex.Escape(key) + "[\"'\\s:=]+)([^,\"'\\s}]+)", RegexOptions.Compiled);
}
