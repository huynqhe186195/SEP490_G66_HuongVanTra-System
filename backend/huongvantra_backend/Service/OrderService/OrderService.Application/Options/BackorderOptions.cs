namespace OrderService.Application.Options;

public sealed class BackorderOptions
{
    public const string SectionName = "Backorder";

    public int DefaultMinLeadDays { get; set; } = 3;
    public int DefaultMaxLeadDays { get; set; } = 5;
    public Dictionary<string, BackorderLeadTimeWindow> SkuLeadTimes { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, BackorderLeadTimeWindow> CategoryLeadTimes { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    public BackorderLeadTimeWindow Resolve(Guid skuId, string? skuCode, string? categoryName)
    {
        if (SkuLeadTimes.TryGetValue(skuId.ToString(), out var byId))
            return Normalize(byId);
        if (!string.IsNullOrWhiteSpace(skuCode)
            && SkuLeadTimes.TryGetValue(skuCode.Trim(), out var byCode))
            return Normalize(byCode);
        if (!string.IsNullOrWhiteSpace(categoryName)
            && CategoryLeadTimes.TryGetValue(categoryName.Trim(), out var byCategory))
            return Normalize(byCategory);

        return Normalize(new BackorderLeadTimeWindow
        {
            MinLeadDays = DefaultMinLeadDays,
            MaxLeadDays = DefaultMaxLeadDays
        });
    }

    private static BackorderLeadTimeWindow Normalize(BackorderLeadTimeWindow window)
    {
        var min = Math.Max(1, window.MinLeadDays);
        return new BackorderLeadTimeWindow
        {
            MinLeadDays = min,
            MaxLeadDays = Math.Max(min, window.MaxLeadDays)
        };
    }
}

public sealed class BackorderLeadTimeWindow
{
    public int MinLeadDays { get; set; } = 3;
    public int MaxLeadDays { get; set; } = 5;
}
