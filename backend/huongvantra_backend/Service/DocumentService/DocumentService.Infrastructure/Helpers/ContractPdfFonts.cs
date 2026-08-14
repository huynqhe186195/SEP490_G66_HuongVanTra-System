using QuestPDF.Drawing;

namespace DocumentService.Infrastructure.Helpers;

/// <summary>
/// Alpine/Linux không có Times New Roman. Đăng ký Liberation Serif nếu có trên máy.
/// </summary>
public static class ContractPdfFonts
{
    private static readonly string[] CandidateDirectories =
    [
        "/usr/share/fonts/liberation",
        "/usr/share/fonts/truetype/liberation",
        "/usr/share/fonts/TTF",
        "/usr/share/fonts/dejavu",
        "/usr/share/fonts/truetype/dejavu"
    ];

    private static readonly object Sync = new();
    private static string? _resolvedFamily;
    private static bool _registered;

    public static string ResolveFamily()
    {
        EnsureRegistered();
        return _resolvedFamily ?? "Times New Roman";
    }

    private static void EnsureRegistered()
    {
        if (_registered) return;
        lock (Sync)
        {
            if (_registered) return;

            var regular = FindFont("LiberationSerif-Regular.ttf")
                ?? FindFont("DejaVuSerif.ttf");
            if (regular is null)
            {
                _resolvedFamily = "Times New Roman";
                _registered = true;
                return;
            }

            var dir = Path.GetDirectoryName(regular)!;
            var isLiberation = Path.GetFileName(regular).Contains("Liberation", StringComparison.OrdinalIgnoreCase);
            foreach (var fileName in isLiberation
                ? new[] { "LiberationSerif-Regular.ttf", "LiberationSerif-Bold.ttf", "LiberationSerif-Italic.ttf", "LiberationSerif-BoldItalic.ttf" }
                : new[] { "DejaVuSerif.ttf", "DejaVuSerif-Bold.ttf", "DejaVuSerif-Italic.ttf", "DejaVuSerif-BoldItalic.ttf" })
            {
                RegisterIfExists(Path.Combine(dir, fileName));
            }

            _resolvedFamily = isLiberation ? "Liberation Serif" : "DejaVu Serif";
            _registered = true;
        }
    }

    private static void RegisterIfExists(string path)
    {
        if (!File.Exists(path)) return;
        using var stream = File.OpenRead(path);
        FontManager.RegisterFont(stream);
    }

    private static string? FindFont(string fileName)
    {
        foreach (var dir in CandidateDirectories)
        {
            var path = Path.Combine(dir, fileName);
            if (File.Exists(path)) return path;
        }

        return null;
    }
}
