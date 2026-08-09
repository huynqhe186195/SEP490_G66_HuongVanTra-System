using DocumentService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DocumentService.Infrastructure.Data.Configurations;

public class ContractLineItemConfiguration : IEntityTypeConfiguration<ContractLineItem>
{
    public void Configure(EntityTypeBuilder<ContractLineItem> builder)
    {
        builder.ToTable("ContractLineItems");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(l => l.ProductName).HasMaxLength(200).IsRequired();
        builder.Property(l => l.Unit).HasMaxLength(50);
        builder.Property(l => l.Quantity).HasPrecision(18, 4);
        builder.Property(l => l.UnitPrice).HasPrecision(18, 2);
        builder.Property(l => l.LineAmount).HasPrecision(18, 2);
        builder.Property(l => l.Note).HasMaxLength(500);
        builder.HasIndex(l => new { l.ContractId, l.LineNumber });
    }
}
