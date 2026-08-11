using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using OrderService.Infrastructure.Data;

#nullable disable
namespace OrderService.Infrastructure.Migrations;
[DbContext(typeof(OrderDbContext))]
[Migration("20260811230100_AddTierUpgradeEmailDeliveries")]
public partial class AddTierUpgradeEmailDeliveries : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name: "TierUpgradeEmailDeliveries", columns: table => new
        {
            EventId = table.Column<Guid>(type: "char(36)", nullable: false),
            CustomerId = table.Column<Guid>(type: "char(36)", nullable: false),
            TierName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
            ReceivedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
            SentAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
            AttemptCount = table.Column<int>(type: "int", nullable: false),
            LastError = table.Column<string>(type: "text", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TierUpgradeEmailDeliveries", x => x.EventId));
        migrationBuilder.CreateIndex(name: "IX_TierUpgradeEmailDeliveries_CustomerId_TierName", table: "TierUpgradeEmailDeliveries", columns: new[] { "CustomerId", "TierName" });
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "TierUpgradeEmailDeliveries");
}
