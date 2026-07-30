using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InventoryService.Infrastructure.Data.Configurations;

public sealed class InventoryOutboxMessageConfiguration : IEntityTypeConfiguration<InventoryOutboxMessage>
{
    public void Configure(EntityTypeBuilder<InventoryOutboxMessage> builder)
    {
        builder.ToTable("InventoryOutboxMessages");
        builder.HasKey(message => message.Id);
        builder.Property(message => message.Id).ValueGeneratedNever();
        builder.Property(message => message.EventType).HasMaxLength(200).IsRequired();
        builder.Property(message => message.Payload).HasColumnType("longtext").IsRequired();
        builder.Property(message => message.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(InventoryOutboxMessageStatus.Pending)
            .IsRequired();
        builder.Property(message => message.RetryCount).HasDefaultValue(0).IsRequired();
        builder.Property(message => message.LockedBy).HasMaxLength(200);
        builder.Property(message => message.LastError).HasColumnType("text");
        builder.HasIndex(message => new { message.Status, message.NextAttemptAtUtc });
        builder.HasIndex(message => message.LockedUntilUtc);
        builder.HasIndex(message => new { message.EventType, message.SourceId }).IsUnique();
        builder.HasIndex(message => new { message.AggregateId, message.EventType });
        builder.HasIndex(message => message.OccurredAtUtc);
    }
}
