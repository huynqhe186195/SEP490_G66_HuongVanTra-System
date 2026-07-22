using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductDeletionRequestRevisionConfiguration : IEntityTypeConfiguration<ProductDeletionRequestRevision>
{
    public void Configure(EntityTypeBuilder<ProductDeletionRequestRevision> builder)
    {
        builder.ToTable("ProductDeletionRequestRevisions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.SubmittedSnapshotJson).IsRequired().HasColumnType("LONGTEXT");
        builder.Property(x => x.SubmittedByName).HasMaxLength(255);
        builder.Property(x => x.SubmittedByRoleName).HasMaxLength(100);
        builder.Property(x => x.Decision).HasMaxLength(50);
        builder.Property(x => x.DecisionReason).HasMaxLength(1000);
        builder.Property(x => x.DecidedByName).HasMaxLength(255);
        builder.Property(x => x.DecidedByRoleName).HasMaxLength(100);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => new { x.RequestId, x.RevisionNumber }).IsUnique();
    }
}
