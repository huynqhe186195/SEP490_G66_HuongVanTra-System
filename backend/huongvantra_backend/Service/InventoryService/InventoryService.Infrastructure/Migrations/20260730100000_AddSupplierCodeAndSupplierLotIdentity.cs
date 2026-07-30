using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Additive migration:
/// - Supplier.SupplierCode + NormalizedSupplierCode (unique, case-insensitive qua cột chuẩn hóa).
/// - SupplierReceipt.SupplierNameSnapshot + SupplierCodeSnapshot.
/// - WarehouseBatch.SupplierId + SkuId + NormalizedSupplierLotCode + ManufactureDate,
///   kèm composite unique index cho lô nhà cung cấp.
///
/// KHÔNG đổi collation toàn cục. KHÔNG backfill giả cho WarehouseBatch legacy.
/// KHÔNG tự xóa hoặc gộp lô trùng đang tồn tại.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260730100000_AddSupplierCodeAndSupplierLotIdentity")]
public partial class AddSupplierCodeAndSupplierLotIdentity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "SupplierCode",
            table: "Suppliers",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "NormalizedSupplierCode",
            table: "Suppliers",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true);

        // Backfill NCC-###### theo thứ tự CreatedAt rồi Id để kết quả ổn định.
        // Dùng ROW_NUMBER() (MySQL 8.0+) trong một câu lệnh duy nhất: không phụ thuộc
        // biến session @seq nên không vỡ nếu provider tách connection giữa các lệnh.
        // MySQL cấm subquery trên chính bảng đang UPDATE, nhưng derived table trong
        // JOIN được materialize trước nên hợp lệ.
        migrationBuilder.Sql("""
            UPDATE `Suppliers` AS s
            JOIN (
                SELECT
                    `Id`,
                    ROW_NUMBER() OVER (ORDER BY `CreatedAt`, `Id`) AS `Seq`
                FROM `Suppliers`
            ) AS ordered ON ordered.`Id` = s.`Id`
            SET s.`SupplierCode` = CONCAT('NCC-', LPAD(ordered.`Seq`, 6, '0')),
                s.`NormalizedSupplierCode` = CONCAT('NCC-', LPAD(ordered.`Seq`, 6, '0'))
            WHERE s.`SupplierCode` IS NULL OR TRIM(s.`SupplierCode`) = '';
            """);

        migrationBuilder.AlterColumn<string>(
            name: "SupplierCode",
            table: "Suppliers",
            type: "varchar(50)",
            maxLength: 50,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "varchar(50)",
            oldMaxLength: 50,
            oldNullable: true);

        migrationBuilder.AlterColumn<string>(
            name: "NormalizedSupplierCode",
            table: "Suppliers",
            type: "varchar(50)",
            maxLength: 50,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "varchar(50)",
            oldMaxLength: 50,
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Suppliers_NormalizedSupplierCode",
            table: "Suppliers",
            column: "NormalizedSupplierCode",
            unique: true);

        migrationBuilder.AddColumn<string>(
            name: "SupplierNameSnapshot",
            table: "SupplierReceipts",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SupplierCodeSnapshot",
            table: "SupplierReceipts",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "SupplierId",
            table: "WarehouseBatches",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.AddColumn<Guid>(
            name: "SkuId",
            table: "WarehouseBatches",
            type: "char(36)",
            nullable: true,
            collation: "ascii_general_ci");

        migrationBuilder.AddColumn<string>(
            name: "NormalizedSupplierLotCode",
            table: "WarehouseBatches",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "ManufactureDate",
            table: "WarehouseBatches",
            type: "datetime(6)",
            nullable: true);

        // Composite unique index: MySQL bỏ qua hàng có cột NULL nên lô legacy
        // (SupplierId/SkuId/NormalizedSupplierLotCode = NULL) không bị ảnh hưởng.
        migrationBuilder.CreateIndex(
            name: "IX_WarehouseBatches_SupplierLotIdentity",
            table: "WarehouseBatches",
            columns: ["SupplierId", "SkuId", "NormalizedSupplierLotCode"],
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_WarehouseBatches_SupplierLotIdentity",
            table: "WarehouseBatches");

        migrationBuilder.DropColumn(name: "ManufactureDate", table: "WarehouseBatches");
        migrationBuilder.DropColumn(name: "NormalizedSupplierLotCode", table: "WarehouseBatches");
        migrationBuilder.DropColumn(name: "SkuId", table: "WarehouseBatches");
        migrationBuilder.DropColumn(name: "SupplierId", table: "WarehouseBatches");

        migrationBuilder.DropColumn(name: "SupplierCodeSnapshot", table: "SupplierReceipts");
        migrationBuilder.DropColumn(name: "SupplierNameSnapshot", table: "SupplierReceipts");

        migrationBuilder.DropIndex(
            name: "IX_Suppliers_NormalizedSupplierCode",
            table: "Suppliers");

        migrationBuilder.DropColumn(name: "NormalizedSupplierCode", table: "Suppliers");
        migrationBuilder.DropColumn(name: "SupplierCode", table: "Suppliers");
    }
}
