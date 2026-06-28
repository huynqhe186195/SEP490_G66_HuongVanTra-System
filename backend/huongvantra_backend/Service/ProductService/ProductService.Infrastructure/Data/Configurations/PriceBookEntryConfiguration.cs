using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class PriceBookEntryConfiguration : IEntityTypeConfiguration<PriceBookEntry>
{
    public void Configure(EntityTypeBuilder<PriceBookEntry> builder)
    {
        builder.ToTable("PriceBookEntries");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Price).HasColumnType("decimal(18,2)");
        builder.Property(e => e.IsActive).HasDefaultValue(true);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired(false);
        builder.Property(e => e.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(e => new { e.PriceBookId, e.VariantId, e.UnitId }).IsUnique();

        builder.HasOne(e => e.PriceBook)
            .WithMany(p => p.Entries)
            .HasForeignKey(e => e.PriceBookId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Variant)
            .WithMany(v => v.PriceBookEntries)
            .HasForeignKey(e => e.VariantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Unit)
            .WithMany(u => u.PriceBookEntries)
            .HasForeignKey(e => e.UnitId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
