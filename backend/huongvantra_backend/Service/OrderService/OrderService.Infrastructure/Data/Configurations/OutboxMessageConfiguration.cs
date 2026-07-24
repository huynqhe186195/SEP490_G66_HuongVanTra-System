using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Infrastructure.Data.Configurations;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("OutboxMessages");

        builder.HasKey(message => message.Id);

        builder.Property(message => message.Id)
            .ValueGeneratedNever();

        builder.Property(message => message.EventType)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(message => message.AggregateId)
            .IsRequired();

        builder.Property(message => message.Payload)
            .HasColumnType("longtext")
            .IsRequired();

        builder.Property(message => message.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(OutboxMessageStatus.Pending)
            .IsRequired();

        builder.Property(message => message.RetryCount)
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(message => message.OccurredAtUtc)
            .IsRequired();

        builder.Property(message => message.LastAttemptAtUtc);

        builder.Property(message => message.NextAttemptAtUtc)
            .IsRequired();

        builder.Property(message => message.LockedUntilUtc);

        builder.Property(message => message.LockedBy)
            .HasMaxLength(100);

        builder.Property(message => message.PublishedAtUtc);

        builder.Property(message => message.LastError)
            .HasColumnType("text");

        builder.HasIndex(message => new
        {
            message.Status,
            message.NextAttemptAtUtc
        });

        builder.HasIndex(message => message.LockedUntilUtc);

        builder.HasIndex(message => new
        {
            message.AggregateId,
            message.EventType
        });

        builder.HasIndex(message => message.OccurredAtUtc);
    }
}