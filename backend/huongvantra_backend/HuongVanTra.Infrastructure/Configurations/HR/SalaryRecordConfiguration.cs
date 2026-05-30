using HuongVanTra.Core.Entities.HR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.HR {
    public class SalaryRecordConfiguration : IEntityTypeConfiguration<SalaryRecord> {
        public void Configure(EntityTypeBuilder<SalaryRecord> builder) {
            builder.ToTable("salary_records");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.NetSalary).HasColumnType("decimal(18,2)");
            builder.Property(x => x.PaymentStatus).HasMaxLength(30).IsRequired();

            builder.HasOne(sr => sr.Employee)
                   .WithMany(e => e.SalaryRecords)
                   .HasForeignKey(sr => sr.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}