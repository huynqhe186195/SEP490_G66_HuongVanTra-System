using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RecipientRoleName).HasMaxLength(100);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(255);
        builder.Property(x => x.Body).IsRequired().HasColumnType("TEXT");
        builder.Property(x => x.Link).HasMaxLength(500);
        builder.Property(x => x.ReferenceType).HasMaxLength(100);
        builder.Property(x => x.IsRead).HasDefaultValue(false);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(x => new { x.RecipientRoleName, x.IsRead, x.CreatedAt });
        builder.HasIndex(x => new { x.RecipientUserId, x.IsRead, x.CreatedAt });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
