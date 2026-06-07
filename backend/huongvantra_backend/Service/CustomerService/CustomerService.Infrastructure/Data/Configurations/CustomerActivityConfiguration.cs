using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerActivityConfiguration : IEntityTypeConfiguration<CustomerActivity>
{
    public void Configure(EntityTypeBuilder<CustomerActivity> builder)
    {
        builder.ToTable("CustomerActivities");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.ActivityType).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(a => a.Description).HasMaxLength(500).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.HasIndex(a => a.CustomerId);

        builder.HasOne(a => a.Customer)
            .WithMany(c => c.Activities)
            .HasForeignKey(a => a.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
