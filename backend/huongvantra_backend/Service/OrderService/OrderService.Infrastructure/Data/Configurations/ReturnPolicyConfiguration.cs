using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Data.Configurations;

public class ReturnPolicyConfiguration : IEntityTypeConfiguration<ReturnPolicy>
{
    public void Configure(EntityTypeBuilder<ReturnPolicy> builder)
    {
        builder.ToTable("ReturnPolicies");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.AllowedReasonCodesJson).HasColumnType("longtext").IsRequired();
        builder.Property(x => x.ChecklistJson).HasColumnType("longtext").IsRequired();
        builder.Property(x => x.SummaryText).HasColumnType("longtext").IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.IsActive, x.Version });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
