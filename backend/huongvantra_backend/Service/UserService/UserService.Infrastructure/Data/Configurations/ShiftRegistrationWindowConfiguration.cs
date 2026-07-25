using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UserService.Domain.Entities;

namespace UserService.Infrastructure.Data.Configurations;

public class ShiftRegistrationWindowConfiguration : IEntityTypeConfiguration<ShiftRegistrationWindow>
{
    public void Configure(EntityTypeBuilder<ShiftRegistrationWindow> builder)
    {
        builder.ToTable("ShiftRegistrationWindows");
        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).ValueGeneratedNever();
        builder.Property(w => w.WeekStart).IsRequired();
        builder.Property(w => w.OpensAt).IsRequired();
        builder.Property(w => w.ClosesAt).IsRequired();
        builder.Property(w => w.IsManuallyClosed).HasDefaultValue(false);
        builder.Property(w => w.OpenedByUserId).IsRequired();
        builder.Property(w => w.CreatedAt).IsRequired();
        builder.Property(w => w.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(w => w.WeekStart).IsUnique();
    }
}
