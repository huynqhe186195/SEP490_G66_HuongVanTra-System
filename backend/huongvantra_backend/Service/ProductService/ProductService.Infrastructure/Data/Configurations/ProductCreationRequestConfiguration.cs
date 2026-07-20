using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductCreationRequestConfiguration : IEntityTypeConfiguration<ProductCreationRequest>
{
    public void Configure(EntityTypeBuilder<ProductCreationRequest> builder)
    {
        builder.ToTable("ProductCreationRequests");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RequestCode).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(255);
        builder.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(50);
        builder.Property(x => x.CreatedByName).HasMaxLength(255);
        builder.Property(x => x.CreatedByRoleName).HasMaxLength(100);
        builder.Property(x => x.ReviewedByName).HasMaxLength(255);
        builder.Property(x => x.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(x => x.RejectReason).HasMaxLength(1000);
        builder.Property(x => x.CancelReason).HasMaxLength(1000);
        builder.Property(x => x.WarehouseNote).HasColumnType("TEXT");
        builder.Property(x => x.AdminNote).HasColumnType("TEXT");
        builder.Property(x => x.CreatedProductIdsJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasMany(x => x.Items)
            .WithOne(x => x.Request)
            .HasForeignKey(x => x.RequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Revisions)
            .WithOne(x => x.Request)
            .HasForeignKey(x => x.RequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.RequestCode).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CreatedBy);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
