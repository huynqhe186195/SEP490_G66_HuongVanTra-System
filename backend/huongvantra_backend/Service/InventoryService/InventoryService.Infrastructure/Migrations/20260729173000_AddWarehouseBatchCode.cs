using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

[DbContext(typeof(InventoryDbContext))]
[Migration("20260729173000_AddWarehouseBatchCode")]
public partial class AddWarehouseBatchCode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "BatchCode",
            table: "WarehouseBatches",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE `WarehouseBatches`
            SET `BatchCode` = `LotCode`
            WHERE `BatchCode` IS NULL OR TRIM(`BatchCode`) = '';
            """);

        migrationBuilder.AlterColumn<string>(
            name: "BatchCode",
            table: "WarehouseBatches",
            type: "varchar(50)",
            maxLength: 50,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "varchar(50)",
            oldMaxLength: 50,
            oldNullable: true);

        migrationBuilder.DropIndex(
            name: "IX_WarehouseBatches_LotCode",
            table: "WarehouseBatches");

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseBatches_BatchCode",
            table: "WarehouseBatches",
            column: "BatchCode",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseBatches_LotCode",
            table: "WarehouseBatches",
            column: "LotCode");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_WarehouseBatches_BatchCode",
            table: "WarehouseBatches");

        migrationBuilder.DropIndex(
            name: "IX_WarehouseBatches_LotCode",
            table: "WarehouseBatches");

        migrationBuilder.DropColumn(
            name: "BatchCode",
            table: "WarehouseBatches");

        migrationBuilder.CreateIndex(
            name: "IX_WarehouseBatches_LotCode",
            table: "WarehouseBatches",
            column: "LotCode",
            unique: true);
    }
}
