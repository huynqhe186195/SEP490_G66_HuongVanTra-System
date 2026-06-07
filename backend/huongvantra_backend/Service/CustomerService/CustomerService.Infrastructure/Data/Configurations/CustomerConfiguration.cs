using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.FullName).HasMaxLength(100).IsRequired();
        builder.Property(c => c.CustomerCode).HasMaxLength(20).IsRequired();
        builder.HasIndex(c => c.CustomerCode).IsUnique();
        builder.Property(c => c.PhoneNumber).HasMaxLength(20).IsRequired();
        builder.HasIndex(c => c.PhoneNumber).IsUnique();
        builder.Property(c => c.Email).HasMaxLength(100);
        builder.Property(c => c.CustomerGroup)
               .HasConversion<string>()
               .HasMaxLength(20)
               .IsRequired();
        builder.Property(c => c.TaxCode).HasMaxLength(50);
        builder.Property(c => c.TotalSpending).HasColumnType("decimal(18,2)").HasDefaultValue(0);
        builder.Property(c => c.CurrentDebt).HasColumnType("decimal(18,2)").HasDefaultValue(0);
        builder.Property(c => c.AssignedSaleId);
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.UpdatedAt).IsRequired();
        builder.Property(c => c.IsDeleted).HasDefaultValue(false);

        builder.HasOne(c => c.Tier)
               .WithMany(t => t.Customers)
               .HasForeignKey(c => c.TierId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(c => c.Addresses)
               .WithOne(a => a.Customer)
               .HasForeignKey(a => a.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
