using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using CustomerService.Infrastructure.Data;

#nullable disable
namespace CustomerService.Infrastructure.Migrations;
[DbContext(typeof(CustomerDbContext))]
[Migration("20260811230000_AddCustomerTierUpgradeOutbox")]
public partial class AddCustomerTierUpgradeOutbox : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name: "CustomerOutboxMessages", columns: table => new
        {
            Id = table.Column<Guid>(type: "char(36)", nullable: false),
            EventType = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
            AggregateId = table.Column<Guid>(type: "char(36)", nullable: false),
            Payload = table.Column<string>(type: "longtext", nullable: false),
            Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
            RetryCount = table.Column<int>(type: "int", nullable: false),
            OccurredAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
            NextAttemptAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
            PublishedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
            LastError = table.Column<string>(type: "text", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_CustomerOutboxMessages", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_CustomerOutboxMessages_Status_NextAttemptAtUtc", table: "CustomerOutboxMessages", columns: new[] { "Status", "NextAttemptAtUtc" });
        migrationBuilder.CreateIndex(name: "IX_CustomerOutboxMessages_AggregateId_EventType", table: "CustomerOutboxMessages", columns: new[] { "AggregateId", "EventType" });
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "CustomerOutboxMessages");
}
