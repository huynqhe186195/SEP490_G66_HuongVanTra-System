using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public sealed class ProductCostPriceHistoryConfiguration : IEntityTypeConfiguration<ProductCostPriceHistory>
{
    public void Configure(EntityTypeBuilder<ProductCostPriceHistory> builder)
    {
        builder.ToTable("ProductCostPriceHistories");
        builder.HasKey(history => history.Id);
        builder.Property(history => history.Id).ValueGeneratedNever();
        builder.Property(history => history.OldCostPrice).HasColumnType("decimal(18,2)");
        builder.Property(history => history.IncomingUnitCost).HasColumnType("decimal(18,2)");
        builder.Property(history => history.IncomingQuantity).HasColumnType("decimal(18,4)").HasDefaultValue(0m);
        builder.Property(history => history.IncomingValue).HasColumnType("decimal(20,4)").HasDefaultValue(0m);
        builder.Property(history => history.TotalQuantityBefore).HasColumnType("decimal(18,4)").HasDefaultValue(0m);
        builder.Property(history => history.TotalQuantityAfter).HasColumnType("decimal(18,4)").HasDefaultValue(0m);
        builder.Property(history => history.TotalValueBefore).HasColumnType("decimal(20,4)").HasDefaultValue(0m);
        builder.Property(history => history.TotalValueAfter).HasColumnType("decimal(20,4)").HasDefaultValue(0m);
        builder.Property(history => history.NewCostPrice).HasColumnType("decimal(18,2)");
        builder.Property(history => history.SourceType).HasMaxLength(50).IsRequired();
        builder.Property(history => history.SourceReceiptCode).HasMaxLength(50).IsRequired();
        builder.Property(history => history.ReceiptLineOrder).HasDefaultValue(1);
        builder.Property(history => history.ReceiptSkuLineCount).HasDefaultValue(1);
        builder.Property(history => history.ProcessingResult).HasMaxLength(50).IsRequired();
        builder.Property(history => history.UpdatedBy).HasMaxLength(100).IsRequired();
        builder.HasIndex(history => history.EventId).IsUnique();
        builder.HasIndex(history => history.SourceReceiptLineId).IsUnique();
        builder.HasIndex(history => new { history.SkuId, history.SourceApprovedAt });
        builder.HasIndex(history => new { history.SkuId, history.SourceApprovedAt, history.ReceiptLineOrder });
        builder.HasOne<ProductVariant>()
            .WithMany()
            .HasForeignKey(history => history.SkuId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
