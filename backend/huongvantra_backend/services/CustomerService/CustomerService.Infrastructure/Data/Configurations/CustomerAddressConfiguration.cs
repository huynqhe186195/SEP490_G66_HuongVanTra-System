using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerAddressConfiguration : IEntityTypeConfiguration<CustomerAddress>
{
    public void Configure(EntityTypeBuilder<CustomerAddress> builder)
    {
        builder.ToTable("CustomerAddresses");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.ReceiverName).HasMaxLength(100).IsRequired();
        builder.Property(a => a.ReceiverPhone).HasMaxLength(20).IsRequired();
        builder.Property(a => a.AddressLine).HasMaxLength(255).IsRequired();
        builder.Property(a => a.Ward).HasMaxLength(50).IsRequired();
        builder.Property(a => a.District).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Province).HasMaxLength(50).IsRequired();
        builder.Property(a => a.IsDefault).HasDefaultValue(false);
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired();
        builder.Property(a => a.IsDeleted).HasDefaultValue(false);
    }
}
