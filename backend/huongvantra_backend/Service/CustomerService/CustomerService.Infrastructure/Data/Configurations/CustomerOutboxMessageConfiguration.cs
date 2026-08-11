using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public sealed class CustomerOutboxMessageConfiguration : IEntityTypeConfiguration<CustomerOutboxMessage>
{
    public void Configure(EntityTypeBuilder<CustomerOutboxMessage> builder)
    {
        builder.ToTable("CustomerOutboxMessages"); builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.EventType).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Payload).HasColumnType("longtext").IsRequired();
        builder.Property(x => x.Status).HasMaxLength(20).IsRequired();
        builder.Property(x => x.LastError).HasColumnType("text");
        builder.HasIndex(x => new { x.Status, x.NextAttemptAtUtc });
        builder.HasIndex(x => new { x.AggregateId, x.EventType });
    }
}
