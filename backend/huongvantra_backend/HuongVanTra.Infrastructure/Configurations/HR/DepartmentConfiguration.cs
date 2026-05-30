using HuongVanTra.Core.Entities.HR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.HR {
    public class DepartmentConfiguration : IEntityTypeConfiguration<Department> {
        public void Configure(EntityTypeBuilder<Department> builder) {
            builder.ToTable("departments");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Name).HasMaxLength(100).IsRequired();

            builder.HasOne(d => d.Store)
                   .WithMany()
                   .HasForeignKey(d => d.StoreId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}