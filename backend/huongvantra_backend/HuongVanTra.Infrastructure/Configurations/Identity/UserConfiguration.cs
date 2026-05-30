using HuongVanTra.Core.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations {
    public class UserConfiguration : IEntityTypeConfiguration<User> {
        public void Configure(EntityTypeBuilder<User> builder) {
            builder.ToTable("users");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Username).HasMaxLength(50).IsRequired();
            builder.Property(x => x.PasswordHash).HasMaxLength(255).IsRequired();
        }
    }
}