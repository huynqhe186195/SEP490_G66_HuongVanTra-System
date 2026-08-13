using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Data.Configurations;

public class ReturnOrderEvidenceImageConfiguration : IEntityTypeConfiguration<ReturnOrderEvidenceImage>
{
    public void Configure(EntityTypeBuilder<ReturnOrderEvidenceImage> builder)
    {
        builder.ToTable("ReturnOrderEvidenceImages");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
        builder.HasOne(x => x.ReturnOrder)
            .WithMany(x => x.EvidenceImages)
            .HasForeignKey(x => x.ReturnOrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => x.ReturnOrderId);
    }
}
