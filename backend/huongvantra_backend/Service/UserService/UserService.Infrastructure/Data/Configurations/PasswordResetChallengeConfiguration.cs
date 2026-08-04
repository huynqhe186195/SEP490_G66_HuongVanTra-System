using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UserService.Domain.Entities;

namespace UserService.Infrastructure.Data.Configurations;

public class PasswordResetChallengeConfiguration : IEntityTypeConfiguration<PasswordResetChallenge>
{
    public void Configure(EntityTypeBuilder<PasswordResetChallenge> builder)
    {
        builder.ToTable("PasswordResetChallenges");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PhoneNormalized).HasMaxLength(20).IsRequired();
        builder.Property(x => x.OtpHash).HasMaxLength(255).IsRequired();
        builder.Property(x => x.ResetToken).HasMaxLength(512);
        builder.Property(x => x.OtpExpiresAt).IsRequired();
        builder.Property(x => x.FailedAttempts).HasDefaultValue(0);
        builder.Property(x => x.IsConsumed).HasDefaultValue(false);
        builder.Property(x => x.CreatedAt).IsRequired();

        builder.HasIndex(x => x.PhoneNormalized);
        builder.HasIndex(x => x.ResetToken);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
