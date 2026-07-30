using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderEmployeeSnapshotName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmployeeSnapshotName",
                table: "Orders",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            // Backfill từ activity sớm nhất có ActorName (thường là lúc tạo đơn).
            migrationBuilder.Sql("""
                UPDATE Orders o
                INNER JOIN (
                    SELECT oa.OrderId, oa.ActorName
                    FROM OrderActivities oa
                    INNER JOIN (
                        SELECT OrderId, MIN(CreatedAt) AS MinCreatedAt
                        FROM OrderActivities
                        WHERE ActorName IS NOT NULL AND TRIM(ActorName) <> ''
                        GROUP BY OrderId
                    ) first_named ON first_named.OrderId = oa.OrderId
                        AND first_named.MinCreatedAt = oa.CreatedAt
                    WHERE oa.ActorName IS NOT NULL AND TRIM(oa.ActorName) <> ''
                ) src ON src.OrderId = o.Id
                SET o.EmployeeSnapshotName = LEFT(src.ActorName, 100)
                WHERE o.EmployeeSnapshotName IS NULL
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmployeeSnapshotName",
                table: "Orders");
        }
    }
}
