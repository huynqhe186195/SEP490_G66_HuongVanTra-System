using HuongVanTra.Core.Entities.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Customers {
    public class CustomerConfiguration : IEntityTypeConfiguration<Customer> {
        public void Configure(EntityTypeBuilder<Customer> builder) {
            builder.ToTable("customers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.CustomerCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.CustomerType).HasMaxLength(20).IsRequired();
            builder.Property(x => x.Phone).HasMaxLength(20);
            builder.Property(x => x.TotalSpend).HasColumnType("decimal(18,2)");

            // Quan hệ 1-N: MembershipTier -> Customers
            builder.HasOne(c => c.Tier)
                   .WithMany(t => t.Customers)
                   .HasForeignKey(c => c.TierId)
                   .OnDelete(DeleteBehavior.SetNull);

            // Quan hệ 1-N: Employee -> Customers
            builder.HasOne(c => c.AssignedEmployee)
                   .WithMany(e => e.AssignedCustomers)
                   .HasForeignKey(c => c.AssignedEmployeeId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}