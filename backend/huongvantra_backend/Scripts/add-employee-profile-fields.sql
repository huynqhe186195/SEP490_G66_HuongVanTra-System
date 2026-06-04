-- Fix: Unknown column 'e.Notes' in 'field list'
-- Run if dotnet ef database update did not apply migration 20260601150821_AddEmployeeProfileFields

ALTER TABLE `employees` ADD COLUMN `Phone` varchar(20) NULL;
ALTER TABLE `employees` ADD COLUMN `Notes` varchar(500) NULL;

CREATE INDEX `IX_employees_StoreId` ON `employees` (`StoreId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260601150821_AddEmployeeProfileFields', '8.0.27'
WHERE NOT EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory`
  WHERE `MigrationId` = '20260601150821_AddEmployeeProfileFields'
);
