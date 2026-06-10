using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerDebtTransactionConfiguration : IEntityTypeConfiguration<CustomerDebtTransaction>
{
    public void Configure(EntityTypeBuilder<CustomerDebtTransaction> builder)
    {
        builder.ToTable("CustomerDebtTransactions");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.Amount).HasColumnType("decimal(18,2)");
        builder.Property(t => t.BalanceAfter).HasColumnType("decimal(18,2)");
        builder.Property(t => t.ReferenceType).HasMaxLength(50);
        builder.Property(t => t.RelatedOrderCode).HasMaxLength(50);
        builder.Property(t => t.Note).HasMaxLength(500);
        builder.Property(t => t.CreatedAt).IsRequired();
        builder.HasIndex(t => t.CustomerId);

        builder.HasOne(t => t.Customer)
            .WithMany(c => c.DebtTransactions)
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
