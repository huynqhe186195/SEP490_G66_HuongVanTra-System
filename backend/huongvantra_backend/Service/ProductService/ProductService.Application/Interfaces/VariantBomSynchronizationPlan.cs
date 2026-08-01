using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public sealed record VariantBomSynchronizationAggregate(
    ProductVariant TargetVariant,
    IReadOnlyList<ProductVariant> DirectDerivedVariants);

public sealed record VariantBomSynchronizationPlan(
    Guid ProductId,
    Guid BaseVariantId,
    IReadOnlyList<VariantBomReplacement> Replacements);

public sealed record VariantBomReplacement(
    Guid VariantId,
    IReadOnlyList<ProductVariantBomLine> Lines);
