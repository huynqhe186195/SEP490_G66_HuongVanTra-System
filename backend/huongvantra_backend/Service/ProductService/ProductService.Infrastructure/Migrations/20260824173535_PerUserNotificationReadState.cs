using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProductService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PerUserNotificationReadState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationRecipients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    NotificationId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RecipientUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IsRead = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    ReadAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationRecipients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationRecipients_Notifications_NotificationId",
                        column: x => x.NotificationId,
                        principalTable: "Notifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationRecipients_NotificationId_RecipientUserId",
                table: "NotificationRecipients",
                columns: new[] { "NotificationId", "RecipientUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationRecipients_RecipientUserId_IsRead_CreatedAt",
                table: "NotificationRecipients",
                columns: new[] { "RecipientUserId", "IsRead", "CreatedAt" });

            // Direct notifications have an unambiguous recipient, so preserve their
            // historical read state. Role broadcasts deliberately receive no shared
            // backfill: the old IsRead value cannot identify which user read it.
            migrationBuilder.Sql(@"
                INSERT INTO NotificationRecipients
                    (Id, NotificationId, RecipientUserId, IsRead, ReadAt, CreatedAt, UpdatedAt, IsDeleted)
                SELECT UUID(), Id, RecipientUserId, IsRead, ReadAt, CreatedAt, UpdatedAt, 0
                FROM Notifications
                WHERE RecipientUserId IS NOT NULL AND IsDeleted = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationRecipients");
        }
    }
}
