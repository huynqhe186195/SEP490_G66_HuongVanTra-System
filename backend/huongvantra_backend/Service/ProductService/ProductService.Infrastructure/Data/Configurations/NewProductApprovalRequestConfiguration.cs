using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class NewProductApprovalRequestConfiguration : IEntityTypeConfiguration<NewProductApprovalRequest>
{
    public void Configure(EntityTypeBuilder<NewProductApprovalRequest> builder)
    {
        builder.ToTable("NewProductApprovalRequests");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ApprovalCode).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(50);
        builder.Property(x => x.ProductSnapshotJson).IsRequired().HasColumnType("LONGTEXT");
        builder.Property(x => x.FinalProductSnapshotJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(255);
        builder.Property(x => x.ProductType).HasMaxLength(50);
        builder.Property(x => x.InitialPrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.RequestedByName).HasMaxLength(255);
        builder.Property(x => x.RequestedByRoleName).HasMaxLength(100);
        builder.Property(x => x.AuthorisedByName).HasMaxLength(255);
        builder.Property(x => x.AuthorisedByRoleName).HasMaxLength(100);
        builder.Property(x => x.ConfirmedByName).HasMaxLength(255);
        builder.Property(x => x.ConfirmedByRoleName).HasMaxLength(100);
        builder.Property(x => x.CancelledByName).HasMaxLength(255);
        builder.Property(x => x.CancelledByRoleName).HasMaxLength(100);
        builder.Property(x => x.CancelReason).HasMaxLength(500);
        builder.Property(x => x.CreationMethod).HasConversion<string>().HasMaxLength(30);
        builder.Property(x => x.ManualModeReason).HasMaxLength(500);
        builder.Property(x => x.CreatedSkuIdsJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.CreatedBomIdsJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.AdminNotes).HasColumnType("TEXT");
        builder.Property(x => x.WarehouseNotes).HasColumnType("TEXT");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(x => x.ApprovalCode).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.ProductName);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
