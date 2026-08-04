using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using UserService.Infrastructure.Data;

#nullable disable

namespace UserService.Infrastructure.Migrations
{
    [DbContext(typeof(UserDbContext))]
    [Migration("20260805010000_AddPasswordResetChallenges")]
    public partial class AddPasswordResetChallenges : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordResetChallenges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PhoneNormalized = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OtpHash = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OtpExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ResetToken = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ResetTokenExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    FailedAttempts = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsConsumed = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetChallenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordResetChallenges_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetChallenges_PhoneNormalized",
                table: "PasswordResetChallenges",
                column: "PhoneNormalized");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetChallenges_ResetToken",
                table: "PasswordResetChallenges",
                column: "ResetToken");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetChallenges_UserId",
                table: "PasswordResetChallenges",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PasswordResetChallenges");
        }
    }
}
