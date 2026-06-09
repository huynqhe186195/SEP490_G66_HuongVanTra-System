using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    public partial class AddStoreCatalogSync : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SyncedToStoreAt",
                table: "Categories",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SyncedToStoreAt",
                table: "Products",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SyncedToStoreAt",
                table: "ProductSKUs",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.Sql("UPDATE `Categories` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;");
            migrationBuilder.Sql("UPDATE `Products` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;");
            migrationBuilder.Sql("UPDATE `ProductSKUs` SET `SyncedToStoreAt` = `CreatedAt` WHERE `SyncedToStoreAt` IS NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SyncedToStoreAt", table: "Categories");
            migrationBuilder.DropColumn(name: "SyncedToStoreAt", table: "Products");
            migrationBuilder.DropColumn(name: "SyncedToStoreAt", table: "ProductSKUs");
        }
    }
}
