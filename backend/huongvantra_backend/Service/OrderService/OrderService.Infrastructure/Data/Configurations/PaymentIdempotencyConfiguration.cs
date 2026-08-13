using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Data.Configurations;

public class PaymentIdempotencyConfiguration : IEntityTypeConfiguration<PaymentIdempotency>
{
    public void Configure(EntityTypeBuilder<PaymentIdempotency> builder)
    {
        builder.ToTable("PaymentIdempotencies");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.IdempotencyKey).HasMaxLength(100).IsRequired();
        builder.Property(e => e.ActionType).HasMaxLength(30).IsRequired();
        builder.Property(e => e.ResultJson).HasMaxLength(4000);
        builder.Property(e => e.ProcessedAt).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        // Unique constraint: một idempotency key chỉ xử lý một lần
        builder.HasIndex(e => e.IdempotencyKey).IsUnique();

        // Index để query nhanh theo order/payment
        builder.HasIndex(e => new { e.OrderId, e.ActionType });
        builder.HasIndex(e => e.PaymentId);

        builder.HasOne(e => e.Order).WithMany().HasForeignKey(e => e.OrderId);
        builder.HasOne(e => e.Payment).WithMany().HasForeignKey(e => e.PaymentId);
    }
}
