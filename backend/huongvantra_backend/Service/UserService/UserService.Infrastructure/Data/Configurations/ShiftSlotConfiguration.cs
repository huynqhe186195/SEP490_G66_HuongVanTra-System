using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UserService.Domain.Entities;
using UserService.Domain.Enums;

namespace UserService.Infrastructure.Data.Configurations;

public class ShiftSlotConfiguration : IEntityTypeConfiguration<ShiftSlot>
{
    public void Configure(EntityTypeBuilder<ShiftSlot> builder)
    {
        builder.ToTable("ShiftSlots");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ShiftSlotStatus.Open);
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(s => new { s.TemplateId, s.WorkDate }).IsUnique();

        builder.HasMany(s => s.Registrations)
            .WithOne(r => r.Slot)
            .HasForeignKey(r => r.SlotId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
