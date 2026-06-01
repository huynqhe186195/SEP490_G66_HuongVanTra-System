using HuongVanTra.Core.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations {
    public class EmployeeConfiguration : IEntityTypeConfiguration<Employee> {
        public void Configure(EntityTypeBuilder<Employee> builder) {
            builder.ToTable("employees");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.EmployeeCode).HasMaxLength(50).IsRequired();
            builder.Property(e => e.FullName).HasMaxLength(150).IsRequired();
            builder.Property(e => e.Status).HasMaxLength(20).IsRequired();
            builder.Property(e => e.Phone).HasMaxLength(20);
            builder.Property(e => e.Notes).HasMaxLength(500);

            builder.HasOne(e => e.Store)
                   .WithMany()
                   .HasForeignKey(e => e.StoreId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.User)
                   .WithOne(u => u.Employee)
                   .HasForeignKey<User>(u => u.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.Department)
                   .WithMany(d => d.Employees)
                   .HasForeignKey(e => e.DepartmentId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}