using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

/// <summary>
/// Additive migration: danh mục sản phẩm/nguyên liệu theo nhà cung cấp và lịch sử giá chào.
///
/// SkuId là tham chiếu lỏng sang ProductService (database khác) nên chỉ đánh index, không khoá ngoại.
/// QuotedPrice là giá chào — không tham gia vào bất kỳ phép tính giá vốn nào.
/// </summary>
[DbContext(typeof(InventoryDbContext))]
[Migration("20260730140000_AddSupplierProducts")]
public partial class AddSupplierProducts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SupplierProducts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SupplierId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuCodeSnapshot = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SkuNameSnapshot = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                ProductTypeSnapshot = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                InventoryUnitSnapshot = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                SupplierItemCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                NormalizedSupplierItemCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                SupplierItemName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                QuotedPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                MinimumOrderQuantity = table.Column<int>(type: "int", nullable: true),
                LeadTimeDays = table.Column<int>(type: "int", nullable: true),
                IsPrimarySource = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                Note = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SupplierProducts", x => x.Id);
                table.ForeignKey(
                    name: "FK_SupplierProducts_Suppliers_SupplierId",
                    column: x => x.SupplierId,
                    principalTable: "Suppliers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "SupplierProductPriceHistories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SupplierProductId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SupplierId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SkuId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                OldPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                NewPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                EffectiveDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                ChangedBy = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                ChangedByName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                ChangedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SupplierProductPriceHistories", x => x.Id);
            });

        // BR-01: một nhà cung cấp không được có hai bản ghi cho cùng một SKU.
        migrationBuilder.CreateIndex(
            name: "IX_SupplierProducts_SupplierId_SkuId",
            table: "SupplierProducts",
            columns: ["SupplierId", "SkuId"],
            unique: true);

        // BR-02: mã hàng nhà cung cấp duy nhất trong phạm vi một nhà cung cấp.
        // MySQL cho phép nhiều NULL trong unique index nên bỏ trống mã vẫn hợp lệ.
        migrationBuilder.CreateIndex(
            name: "IX_SupplierProducts_SupplierId_NormalizedSupplierItemCode",
            table: "SupplierProducts",
            columns: ["SupplierId", "NormalizedSupplierItemCode"],
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_SupplierProducts_SkuId",
            table: "SupplierProducts",
            column: "SkuId");

        migrationBuilder.CreateIndex(
            name: "IX_SupplierProducts_IsActive",
            table: "SupplierProducts",
            column: "IsActive");

        migrationBuilder.CreateIndex(
            name: "IX_SupplierProductPriceHistories_SupplierProductId",
            table: "SupplierProductPriceHistories",
            column: "SupplierProductId");

        migrationBuilder.CreateIndex(
            name: "IX_SupplierProductPriceHistories_SkuId_ChangedAt",
            table: "SupplierProductPriceHistories",
            columns: ["SkuId", "ChangedAt"]);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "SupplierProductPriceHistories");
        migrationBuilder.DropTable(name: "SupplierProducts");
    }
}
