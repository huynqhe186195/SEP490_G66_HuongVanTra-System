using HuongVanTra.Core.Entities.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Documents {
    public class DocumentConfiguration : IEntityTypeConfiguration<Document> {
        public void Configure(EntityTypeBuilder<Document> builder) {
            builder.ToTable("documents");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.DocCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(30).IsRequired();

            builder.HasOne(d => d.Store).WithMany().HasForeignKey(d => d.StoreId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(d => d.CreatedBy).WithMany().HasForeignKey(d => d.CreatedById).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(d => d.ReviewedBy).WithMany().HasForeignKey(d => d.ReviewedById).OnDelete(DeleteBehavior.Restrict);
        }
    }
}