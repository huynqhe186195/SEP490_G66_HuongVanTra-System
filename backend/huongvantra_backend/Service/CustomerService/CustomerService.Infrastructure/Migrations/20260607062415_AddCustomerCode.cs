using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CustomerService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerCode",
                table: "Customers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE Customers c
                INNER JOIN (
                    SELECT Id, CONCAT('KH', LPAD(ROW_NUMBER() OVER (ORDER BY CreatedAt), 6, '0')) AS NewCode
                    FROM Customers
                ) ranked ON c.Id = ranked.Id
                SET c.CustomerCode = ranked.NewCode
                WHERE c.CustomerCode IS NULL OR c.CustomerCode = '';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "CustomerCode",
                table: "Customers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CustomerCode",
                table: "Customers",
                column: "CustomerCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Customers_CustomerCode",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CustomerCode",
                table: "Customers");
        }
    }
}
