using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrderService.Infrastructure.Migrations
{
    public partial class AddPromotionCustomerTierScopes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS `PromotionCustomerTierScopes` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `PromotionId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `TierId` int NOT NULL,
                    `TierSnapshotName` varchar(255) CHARACTER SET utf8mb4 NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    `IsDeleted` tinyint(1) NOT NULL,
                    PRIMARY KEY (`Id`),
                    KEY `IX_PromotionCustomerTierScopes_PromotionId` (`PromotionId`),
                    KEY `IX_PromotionCustomerTierScopes_TierId` (`TierId`),
                    CONSTRAINT `FK_PromotionCustomerTierScopes_Promotions_PromotionId`
                        FOREIGN KEY (`PromotionId`) REFERENCES `Promotions` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET=utf8mb4;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PromotionCustomerTierScopes");
        }
    }
}
