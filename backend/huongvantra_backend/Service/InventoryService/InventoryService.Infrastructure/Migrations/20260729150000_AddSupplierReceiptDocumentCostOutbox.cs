using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InventoryService.Infrastructure.Migrations;

[DbContext(typeof(InventoryDbContext))]
[Migration("20260729150000_AddSupplierReceiptDocumentCostOutbox")]
public partial class AddSupplierReceiptDocumentCostOutbox : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DeliveredByName",
            table: "SupplierReceipts",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "OriginalDocumentReference",
            table: "SupplierReceipts",
            type: "varchar(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalAmount",
            table: "SupplierReceipts",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "DocumentQuantity",
            table: "SupplierReceiptItems",
            type: "decimal(18,3)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "LineAmount",
            table: "SupplierReceiptItems",
            type: "decimal(18,2)",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "InventoryOutboxMessages",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                EventType = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                AggregateId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                SourceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                Payload = table.Column<string>(type: "longtext", nullable: false)
                    .Annotation("MySql:CharSet", "utf8mb4"),
                Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                RetryCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                OccurredAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                LastAttemptAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                NextAttemptAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                LockedUntilUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                LockedBy = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                PublishedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                LastError = table.Column<string>(type: "text", nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4")
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_InventoryOutboxMessages", x => x.Id);
            });

        migrationBuilder.Sql(@"
            UPDATE SupplierReceiptItems
            SET DocumentQuantity = SubmittedQuantity,
                LineAmount = CASE
                    WHEN UnitCost IS NULL THEN NULL
                    ELSE ROUND(SubmittedQuantity * UnitCost, 2)
                END;");

        migrationBuilder.Sql(@"
            UPDATE SupplierReceipts receipt
            SET TotalAmount = COALESCE((
                SELECT SUM(item.LineAmount)
                FROM SupplierReceiptItems item
                WHERE item.SupplierReceiptId = receipt.Id
            ), 0);");

        migrationBuilder.CreateIndex(
            name: "IX_InventoryOutboxMessages_AggregateId_EventType",
            table: "InventoryOutboxMessages",
            columns: new[] { "AggregateId", "EventType" });

        migrationBuilder.CreateIndex(
            name: "IX_InventoryOutboxMessages_EventType_SourceId",
            table: "InventoryOutboxMessages",
            columns: new[] { "EventType", "SourceId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_InventoryOutboxMessages_LockedUntilUtc",
            table: "InventoryOutboxMessages",
            column: "LockedUntilUtc");

        migrationBuilder.CreateIndex(
            name: "IX_InventoryOutboxMessages_OccurredAtUtc",
            table: "InventoryOutboxMessages",
            column: "OccurredAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_InventoryOutboxMessages_Status_NextAttemptAtUtc",
            table: "InventoryOutboxMessages",
            columns: new[] { "Status", "NextAttemptAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "InventoryOutboxMessages");
        migrationBuilder.DropColumn(name: "DeliveredByName", table: "SupplierReceipts");
        migrationBuilder.DropColumn(name: "OriginalDocumentReference", table: "SupplierReceipts");
        migrationBuilder.DropColumn(name: "TotalAmount", table: "SupplierReceipts");
        migrationBuilder.DropColumn(name: "DocumentQuantity", table: "SupplierReceiptItems");
        migrationBuilder.DropColumn(name: "LineAmount", table: "SupplierReceiptItems");
    }
}
