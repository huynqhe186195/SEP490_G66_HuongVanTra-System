using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UserService.Domain.Entities;
using UserService.Domain.Enums;

namespace UserService.Infrastructure.Data.Configurations;

public class ShiftRegistrationConfiguration : IEntityTypeConfiguration<ShiftRegistration>
{
    public void Configure(EntityTypeBuilder<ShiftRegistration> builder)
    {
        builder.ToTable("ShiftRegistrations");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.StaffName).HasMaxLength(100).IsRequired();
        builder.Property(r => r.RoleName).HasMaxLength(50).IsRequired();
        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ShiftRegistrationStatus.Pending);
        builder.Property(r => r.RegisteredAt).IsRequired();
        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(r => new { r.SlotId, r.UserId }).IsUnique();
        builder.HasIndex(r => r.UserId);
        builder.HasIndex(r => r.Status);
    }
}
