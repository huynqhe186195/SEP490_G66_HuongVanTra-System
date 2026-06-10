using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerDebtAllocationConfiguration : IEntityTypeConfiguration<CustomerDebtAllocation>
{
    public void Configure(EntityTypeBuilder<CustomerDebtAllocation> builder)
    {
        builder.ToTable("CustomerDebtAllocations");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.OrderCode).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Amount).HasColumnType("decimal(18,2)");
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.HasIndex(a => a.CustomerId);
        builder.HasIndex(a => a.OrderId);
        builder.HasIndex(a => a.DebtTransactionId);

        builder.HasOne(a => a.DebtTransaction)
            .WithMany(t => t.Allocations)
            .HasForeignKey(a => a.DebtTransactionId)
            .HasConstraintName("FK_DebtAlloc_DebtTxn")
            .OnDelete(DeleteBehavior.Cascade);
    }
}
