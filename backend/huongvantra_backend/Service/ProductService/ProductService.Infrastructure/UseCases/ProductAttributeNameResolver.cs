using Microsoft.EntityFrameworkCore;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

internal sealed class AttributeNameResolutionCache
{
    public Dictionary<string, AttributeName> ByKey { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<int, AttributeName> ById { get; } = new();
}

internal static class ProductAttributeNameResolver
{
    public static async Task<AttributeNameResolutionCache> LoadAsync(ProductDbContext db, CancellationToken ct)
    {
        var cache = new AttributeNameResolutionCache();
        var items = await db.AttributeNames.IgnoreQueryFilters().ToListAsync(ct);

        foreach (var item in items)
        {
            cache.ById[item.Id] = item;
        }

        foreach (var item in items
                     .OrderBy(item => item.IsDeleted ? 2 : item.IsActive ? 0 : 1)
                     .ThenBy(item => item.Name))
        {
            var key = ProductInputValidator.NormalizeAttributeNameKey(item.Name);
            if (key is not null && !cache.ByKey.ContainsKey(key))
                cache.ByKey[key] = item;
        }

        return cache;
    }

    public static async Task<CreateProductRequest> ResolveAsync(
        ProductDbContext db,
        CreateProductRequest product,
        AttributeNameResolutionCache cache,
        CancellationToken ct)
    {
        var attributes = ProductInputValidator.ValidateAttributes(product.Attributes);
        if (attributes.Count == 0)
            return product with { Attributes = [] };

        var now = DateTime.UtcNow;
        var changed = false;
        var resolved = new List<(AttributeName Master, ProductAttributeValueRequest Attribute)>();

        foreach (var attribute in attributes)
        {
            var key = ProductInputValidator.NormalizeAttributeNameKey(attribute.AttributeName)!;
            var master = ResolveExisting(attribute, key, cache);

            if (master is null)
            {
                master = new AttributeName
                {
                    Name = attribute.AttributeName,
                    CreatedAt = now
                };
                db.AttributeNames.Add(master);
                cache.ByKey[key] = master;
                changed = true;
            }
            else if (master.IsDeleted)
            {
                master.IsDeleted = false;
                master.IsActive = true;
                master.UpdatedAt = now;
                changed = true;
            }

            resolved.Add((master, attribute));
        }

        if (changed)
            await db.SaveChangesAsync(ct);

        return product with
        {
            Attributes = resolved
                .Select(item => new ProductAttributeValueRequest(
                    item.Master.Id,
                    item.Master.Name,
                    item.Attribute.Value))
                .ToList()
        };
    }

    private static AttributeName? ResolveExisting(
        ProductAttributeValueRequest attribute,
        string key,
        AttributeNameResolutionCache cache)
    {
        if (attribute.AttributeNameId.HasValue
            && cache.ById.TryGetValue(attribute.AttributeNameId.Value, out var byId)
            && !byId.IsDeleted
            && byId.IsActive)
        {
            return byId;
        }

        return cache.ByKey.TryGetValue(key, out var byName) ? byName : null;
    }
}
