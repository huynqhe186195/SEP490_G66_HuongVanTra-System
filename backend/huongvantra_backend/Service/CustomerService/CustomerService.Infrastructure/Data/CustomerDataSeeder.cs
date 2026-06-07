using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Data;

public static class CustomerDataSeeder
{
    private static readonly (string Name, decimal Threshold, decimal Discount)[] DefaultTiers =
    [
        ("Member", 0, 0),
        ("Silver", 5_000_000, 3),
        ("Gold", 20_000_000, 5),
        ("Diamond", 50_000_000, 10)
    ];

    public static async Task SeedAsync(CustomerDbContext context)
    {
        foreach (var (name, threshold, discount) in DefaultTiers)
        {
            var exists = await context.CustomerTiers
                .AnyAsync(t => t.TierName == name && !t.IsDeleted);

            if (exists) continue;

            context.CustomerTiers.Add(new CustomerTier
            {
                TierName = name,
                MinSpendingThreshold = threshold,
                DiscountPercent = discount,
                ValidityMonths = 12,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync();
    }
}
