using HuongVanTra.Core.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations {
    public class EmployeeRoleConfiguration : IEntityTypeConfiguration<EmployeeRole> {
        public void Configure(EntityTypeBuilder<EmployeeRole> builder) {
            builder.ToTable("employee_roles");
            builder.HasKey(er => new { er.EmployeeId, er.RoleId, er.StoreId });

            builder.HasOne(er => er.Employee)
                   .WithMany(e => e.EmployeeRoles)
                   .HasForeignKey(er => er.EmployeeId);

            builder.HasOne(er => er.Role)
                   .WithMany(r => r.EmployeeRoles)
                   .HasForeignKey(er => er.RoleId);
        }
    }
}