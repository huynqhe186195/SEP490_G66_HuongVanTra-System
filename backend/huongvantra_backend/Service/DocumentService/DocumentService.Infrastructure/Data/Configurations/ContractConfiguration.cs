using DocumentService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DocumentService.Infrastructure.Data.Configurations;

public class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> builder)
    {
        builder.ToTable("Contracts");
        builder.HasKey(c => c.Id);

        builder.HasQueryFilter(c => !c.IsDeleted);

        builder.Property(c => c.ContractCode).HasMaxLength(20).IsRequired();
        builder.Property(c => c.CustomerName).HasMaxLength(200).IsRequired();
        builder.Property(c => c.CustomerCode).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Title).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Notes).HasMaxLength(4000);
        builder.Property(c => c.RejectionNote).HasMaxLength(1000);
        builder.Property(c => c.DiscountPercent).HasPrecision(5, 2);
        builder.Property(c => c.CreditLimit).HasPrecision(18, 2);

        builder.Property(c => c.SignedAtLocation).HasMaxLength(200);
        builder.Property(c => c.PaymentMethod).HasMaxLength(500);
        builder.Property(c => c.DeliveryTerms).HasMaxLength(1000);
        builder.Property(c => c.ShippingResponsibility).HasMaxLength(200);

        builder.HasIndex(c => c.ContractCode).IsUnique();
        builder.HasIndex(c => new { c.CustomerId, c.Status });
        builder.HasIndex(c => new { c.CreatedByUserId, c.Status });

        builder.HasMany(c => c.LineItems)
               .WithOne(l => l.Contract)
               .HasForeignKey(l => l.ContractId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
