using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class ProcessedIntegrationEventConfiguration : IEntityTypeConfiguration<ProcessedIntegrationEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedIntegrationEvent> builder)
    {
        builder.ToTable("ProcessedIntegrationEvents");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.CorrelationId).IsRequired();
        builder.Property(e => e.ProcessedAt).IsRequired();
        builder.HasIndex(e => new { e.EventType, e.CorrelationId }).IsUnique();
    }
}
