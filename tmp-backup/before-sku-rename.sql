-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: hvt_product_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `hvt_product_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `hvt_product_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `hvt_product_db`;

--
-- Table structure for table `AttributeNames`
--

DROP TABLE IF EXISTS `AttributeNames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AttributeNames` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AttributeNames`
--

LOCK TABLES `AttributeNames` WRITE;
/*!40000 ALTER TABLE `AttributeNames` DISABLE KEYS */;
/*!40000 ALTER TABLE `AttributeNames` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Brands`
--

DROP TABLE IF EXISTS `Brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Brands` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Brands`
--

LOCK TABLES `Brands` WRITE;
/*!40000 ALTER TABLE `Brands` DISABLE KEYS */;
/*!40000 ALTER TABLE `Brands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Categories`
--

DROP TABLE IF EXISTS `Categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Categories` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ParentId` int DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `SyncedToStoreAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Categories_ParentId` (`ParentId`),
  CONSTRAINT `FK_Categories_Categories_ParentId` FOREIGN KEY (`ParentId`) REFERENCES `Categories` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=9109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Categories`
--

LOCK TABLES `Categories` WRITE;
/*!40000 ALTER TABLE `Categories` DISABLE KEYS */;
INSERT INTO `Categories` VALUES (1,'Trà thành phẩm','Trà đóng gói sẵn bán lẻ',NULL,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,1,'2026-07-21 02:25:16.314685'),(2,'Cà phê','Cà phê hòa tan và rang xay',NULL,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,1,'2026-07-21 02:25:16.314685'),(3,'Nguyên liệu','Nguyên liệu thô dùng sản xuất',NULL,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,1,'2026-07-21 02:25:16.314685'),(4,'Trà nguyên liệu','Trà xanh, trà ô long nguyên liệu',3,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,1,'2026-07-21 02:25:16.314685'),(5,'Nguyên liệu phụ','Đường, sữa và các phụ gia khác',3,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,1,'2026-07-21 02:25:16.314685'),(6,'Bao bì','Bao bì đóng gói sản phẩm',NULL,'2026-07-21 02:43:11.708530','2026-07-21 02:43:27.034298',0,1,'2026-07-21 02:43:27.034298'),(7,'trà thảo mộc',NULL,NULL,'2026-07-26 15:15:36.915034','2026-07-26 15:15:53.280901',1,0,NULL),(9101,'Trà thành phẩm','Trà đóng gói bán lẻ / POS',NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,1,'2026-07-30 17:11:06.639633'),(9102,'Trà thảo mộc','Atiso, hoa cúc, gừng…',NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,1,'2026-07-30 17:11:06.639633'),(9103,'Quà tặng & set','Set quà, combo',NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,1,'2026-07-30 17:11:06.639633'),(9104,'Dụng cụ pha trà','Ấm, ly, phụ kiện',NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,1,'2026-07-30 17:11:06.639633'),(9105,'Nguyên liệu sản xuất','NL thô kho tổng',NULL,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,1,'2026-08-02 20:55:50.779867'),(9106,'Trà nguyên liệu','NL trà lá',9105,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,1,'2026-08-02 20:55:50.779867'),(9107,'Phụ gia NL','Đường, hoa ướp…',9105,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,1,'2026-08-02 20:55:50.779867'),(9108,'Bao bì sản xuất','Túi, hộp, tem',NULL,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,1,'2026-08-02 20:55:50.779867');
/*!40000 ALTER TABLE `Categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `NewProductApprovalRequests`
--

DROP TABLE IF EXISTS `NewProductApprovalRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `NewProductApprovalRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ApprovalCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `FinalProductSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `ProductName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CategoryId` int DEFAULT NULL,
  `InitialPrice` decimal(18,2) DEFAULT NULL,
  `RequestedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `RequestedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `RequestedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `RequestedAt` datetime(6) DEFAULT NULL,
  `AuthorisedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `AuthorisedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AuthorisedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AuthorisedAt` datetime(6) DEFAULT NULL,
  `ConfirmedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ConfirmedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ConfirmedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ConfirmedAt` datetime(6) DEFAULT NULL,
  `CancelledBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CancelledByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelledByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelledAt` datetime(6) DEFAULT NULL,
  `CancelReason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreationMethod` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ManualModeReason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `UsedAt` datetime(6) DEFAULT NULL,
  `CreatedProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedSkuIdsJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedBomIdsJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `AdminNotes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `WarehouseNotes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_NewProductApprovalRequests_ApprovalCode` (`ApprovalCode`),
  KEY `IX_NewProductApprovalRequests_ProductName` (`ProductName`),
  KEY `IX_NewProductApprovalRequests_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `NewProductApprovalRequests`
--

LOCK TABLES `NewProductApprovalRequests` WRITE;
/*!40000 ALTER TABLE `NewProductApprovalRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `NewProductApprovalRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notifications`
--

DROP TABLE IF EXISTS `Notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notifications` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RecipientRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `RecipientUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `Type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReferenceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReferenceType` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IsRead` tinyint(1) NOT NULL DEFAULT '0',
  `ReadAt` datetime(6) DEFAULT NULL,
  `ReadBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IX_Notifications_RecipientRoleName_IsRead_CreatedAt` (`RecipientRoleName`,`IsRead`,`CreatedAt`),
  KEY `IX_Notifications_RecipientUserId_IsRead_CreatedAt` (`RecipientUserId`,`IsRead`,`CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notifications`
--

LOCK TABLES `Notifications` WRITE;
/*!40000 ALTER TABLE `Notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PriceBookEntries`
--

DROP TABLE IF EXISTS `PriceBookEntries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PriceBookEntries` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PriceBookId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `VariantId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `UnitId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `Price` decimal(18,2) NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `StartsAt` datetime(6) DEFAULT NULL,
  `EndsAt` datetime(6) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_PriceBookEntries_PriceBookId_VariantId_UnitId` (`PriceBookId`,`VariantId`,`UnitId`),
  KEY `IX_PriceBookEntries_UnitId` (`UnitId`),
  KEY `IX_PriceBookEntries_VariantId` (`VariantId`),
  CONSTRAINT `FK_PriceBookEntries_PriceBooks_PriceBookId` FOREIGN KEY (`PriceBookId`) REFERENCES `PriceBooks` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_PriceBookEntries_ProductUnits_UnitId` FOREIGN KEY (`UnitId`) REFERENCES `ProductUnits` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_PriceBookEntries_ProductVariants_VariantId` FOREIGN KEY (`VariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PriceBookEntries`
--

LOCK TABLES `PriceBookEntries` WRITE;
/*!40000 ALTER TABLE `PriceBookEntries` DISABLE KEYS */;
INSERT INTO `PriceBookEntries` VALUES ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',NULL,185000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',NULL,420000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',NULL,145000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',NULL,330000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005',NULL,220000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000011','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',NULL,163000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000012','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',NULL,370000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000013','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003',NULL,128000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000014','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004',NULL,290000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('50000000-0000-0000-0000-000000000015','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000005',NULL,194000.00,1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0);
/*!40000 ALTER TABLE `PriceBookEntries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PriceBooks`
--

DROP TABLE IF EXISTS `PriceBooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PriceBooks` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `StartsAt` datetime(6) DEFAULT NULL,
  `EndsAt` datetime(6) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_PriceBooks_Code` (`Code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PriceBooks`
--

LOCK TABLES `PriceBooks` WRITE;
/*!40000 ALTER TABLE `PriceBooks` DISABLE KEYS */;
INSERT INTO `PriceBooks` VALUES ('40000000-0000-0000-0000-000000000001','PB-LE-2026','Bảng giá lẻ 2026','Giá bán lẻ cho khách phổ thông và đối ngoại',1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0),('40000000-0000-0000-0000-000000000002','PB-SI-2026','Bảng giá sỉ 2026','Giá sỉ cho khách doanh nghiệp và đại lý (giảm ~12%)',1,'2026-01-01 00:00:00.000000','2026-12-31 23:59:59.000000','2026-01-01 00:00:00.000000',NULL,0);
/*!40000 ALTER TABLE `PriceBooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductAttributeValues`
--

DROP TABLE IF EXISTS `ProductAttributeValues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductAttributeValues` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `AttributeNameId` int DEFAULT NULL,
  `AttributeName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Value` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IX_ProductAttributeValues_AttributeNameId` (`AttributeNameId`),
  KEY `IX_ProductAttributeValues_ProductId` (`ProductId`),
  KEY `IX_ProductAttributeValues_ProductId_AttributeName_Value` (`ProductId`,`AttributeName`,`Value`),
  CONSTRAINT `FK_ProductAttributeValues_AttributeNames_AttributeNameId` FOREIGN KEY (`AttributeNameId`) REFERENCES `AttributeNames` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_ProductAttributeValues_Products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `Products` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductAttributeValues`
--

LOCK TABLES `ProductAttributeValues` WRITE;
/*!40000 ALTER TABLE `ProductAttributeValues` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductAttributeValues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductCostPriceHistories`
--

DROP TABLE IF EXISTS `ProductCostPriceHistories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCostPriceHistories` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `EventId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OldCostPrice` decimal(18,2) NOT NULL,
  `IncomingUnitCost` decimal(18,2) NOT NULL,
  `NewCostPrice` decimal(18,2) NOT NULL,
  `SourceType` varchar(50) NOT NULL,
  `SourceReceiptId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceReceiptLineId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceReceiptCode` varchar(50) NOT NULL,
  `SourceApprovedAt` datetime(6) NOT NULL,
  `WasApplied` tinyint(1) NOT NULL,
  `ProcessingResult` varchar(50) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `UpdatedBy` varchar(100) NOT NULL,
  `ReceiptLineOrder` int NOT NULL DEFAULT '1',
  `ReceiptSkuLineCount` int NOT NULL DEFAULT '1',
  `IncomingQuantity` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `IncomingValue` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `TotalQuantityBefore` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalQuantityAfter` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalValueBefore` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `TotalValueAfter` decimal(20,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductCostPriceHistories_EventId` (`EventId`),
  UNIQUE KEY `IX_ProductCostPriceHistories_SourceReceiptLineId` (`SourceReceiptLineId`),
  KEY `IX_ProductCostPriceHistories_SkuId_SourceApprovedAt` (`SkuId`,`SourceApprovedAt`),
  KEY `IX_ProductCostPriceHistories_SkuId_SourceApprovedAt_ReceiptLineO` (`SkuId`,`SourceApprovedAt`,`ReceiptLineOrder`),
  CONSTRAINT `FK_ProductCostPriceHistories_ProductVariants_SkuId` FOREIGN KEY (`SkuId`) REFERENCES `ProductVariants` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductCostPriceHistories`
--

LOCK TABLES `ProductCostPriceHistories` WRITE;
/*!40000 ALTER TABLE `ProductCostPriceHistories` DISABLE KEYS */;
INSERT INTO `ProductCostPriceHistories` VALUES ('0155bc3f-4013-46d3-a075-fdac2d471a4b','722d9998-7a0f-48d9-b76f-3adf9c45a1d5','a200002b-0000-4000-8000-0000a200002b',28.00,220.00,28.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','12641583-ef99-4912-b85a-a64751496ae3','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756248','supplier-receipt-consumer',1,1,1000.0000,220000.0000,0.0000,0.0000,0.0000,0.0000),('038a64da-b42d-4e55-9a66-7c267d21d45a','9e0061ba-4d52-46f1-a2d1-d526149d18b9','a200002c-0000-4000-8000-0000a200002c',85.00,180.00,85.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','9d0b0870-1586-4ccf-a0ee-7615a621af98','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756303','supplier-receipt-consumer',1,1,500.0000,90000.0000,0.0000,0.0000,0.0000,0.0000),('283593e1-6206-4844-8bde-678235f4a80a','60fb58df-80af-412d-8b7a-f39d6a7aa760','a200000c-0000-4000-8000-0000a200000c',260000.00,150000.00,260000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','dc740d0e-92f1-4115-bddc-bc6ff2fa5143','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.935284','supplier-receipt-consumer',1,1,10.0000,1500000.0000,0.0000,0.0000,0.0000,0.0000),('31681670-4f7f-4a0a-8efa-e2dc13d70106','3207dda2-42e7-4084-99c2-c3a192d7be46','a2000011-0000-4000-8000-0000a2000011',35000.00,95000.00,35000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','5967018b-5dd6-4c8b-b78e-31b9493f0822','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:31.018131','supplier-receipt-consumer',1,1,12.0000,1140000.0000,0.0000,0.0000,0.0000,0.0000),('426c040f-a9b5-4bc0-bea9-a191a1748e0b','0c71d9f6-c4bf-4f31-b4a6-0e20ecb63b6d','a2000034-0000-4000-8000-0000a2000034',12000.00,3500.00,12000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','0302cb29-6996-44a6-b0cc-34fd6eb3eafe','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.779276','supplier-receipt-consumer',1,1,30.0000,105000.0000,0.0000,0.0000,0.0000,0.0000),('471966ae-1e05-4b63-845e-22de249e3f18','ebfeacc5-f8a6-4df8-904a-f7127ca27a63','a200002e-0000-4000-8000-0000a200002e',75.00,180.00,75.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','3971f49d-6f97-4686-8a27-7a2f24a1786e','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756316','supplier-receipt-consumer',1,1,500.0000,90000.0000,0.0000,0.0000,0.0000,0.0000),('4b7f2e4e-62af-4be5-9b34-43e66f63e1d5','e80a1594-d253-4876-91a3-b13cd121fa01','a200000f-0000-4000-8000-0000a200000f',45000.00,120000.00,45000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','29fc7729-2fe7-4159-8529-35a3a1b3cf78','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.901583','supplier-receipt-consumer',1,1,12.0000,1440000.0000,0.0000,0.0000,0.0000,0.0000),('4edef7be-2598-45cf-adf8-51aeea6e2766','d88f954e-1bfa-4b0b-9643-1bda6cc89700','a2000033-0000-4000-8000-0000a2000033',150.00,2500.00,150.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','4f7168f0-2fa3-4843-9f1e-8987da0d8153','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.826885','supplier-receipt-consumer',1,1,12.0000,30000.0000,0.0000,0.0000,0.0000,0.0000),('4f895994-fa5b-4046-a1da-a9b8ce4cf5b3','83a18dea-def7-4c9c-819b-4bd6e78b01e1','a2000012-0000-4000-8000-0000a2000012',65000.00,120000.00,65000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','8e7868c9-200d-487e-939e-e18e9de498ed','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:31.004265','supplier-receipt-consumer',1,1,25.0000,3000000.0000,0.0000,0.0000,0.0000,0.0000),('5bfee820-bbf8-46fe-8411-b4b0926397e9','bbd374b3-3632-43ea-b96a-8ffc94ffabd4','a200002d-0000-4000-8000-0000a200002d',210.00,220.00,210.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','44fac655-8ecd-44df-a83a-d2d349a3cc9f','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756278','supplier-receipt-consumer',1,1,1000.0000,220000.0000,0.0000,0.0000,0.0000,0.0000),('726b6615-a60a-46f9-9fb5-7f953c7a45a5','e1580afc-a821-4018-97da-e5ca58e51ee0','a200002a-0000-4000-8000-0000a200002a',280.00,150.00,280.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','c953b48c-fbeb-4d7f-a9d8-0e76e70a25a0','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756291','supplier-receipt-consumer',1,1,2000.0000,300000.0000,0.0000,0.0000,0.0000,0.0000),('728005a2-1a3a-466c-a1c0-0db4af628dd1','42a373df-ca1f-4451-929a-658767fdb500','a2000027-0000-4000-8000-0000a2000027',125.00,150.00,125.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','89e63cb2-8ba4-4cf4-b347-724cc6cc5172','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.757782','supplier-receipt-consumer',1,1,2000.0000,300000.0000,0.0000,0.0000,0.0000,0.0000),('8bf6a5bf-3664-45a1-93aa-2f1f251fc958','2d2ba9eb-75a9-4e9e-b5b7-18b8575d75ae','a200002f-0000-4000-8000-0000a200002f',800.00,1500.00,800.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','e9f3d2a3-7c36-4b92-9da0-3f8501d67ecf','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.853825','supplier-receipt-consumer',1,1,10.0000,15000.0000,0.0000,0.0000,0.0000,0.0000),('96192529-8d92-4306-b096-e40e9ba7a322','4535692b-cf39-4131-ab9e-a4199767b3b9','a200001c-0000-4000-8000-0000a200001c',135000.00,85000.00,135000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','2fe5ef63-246e-413a-aa13-540cf6bf69c9','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.991545','supplier-receipt-consumer',1,1,30.0000,2550000.0000,0.0000,0.0000,0.0000,0.0000),('9e05c2a8-bba0-4ded-806b-a61de69192c0','baf8d505-11b7-48ee-9862-6bb182c60637','a2000019-0000-4000-8000-0000a2000019',55000.00,150000.00,55000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','aacb736d-ee8d-410f-85c7-dda29e71eaa3','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:31.036033','supplier-receipt-consumer',1,1,8.0000,1200000.0000,0.0000,0.0000,0.0000,0.0000),('a2132173-a5b3-4353-b040-bde27302df73','685480fe-0b8f-48fa-aada-a9f9a219d0a4','a2000020-0000-4000-8000-0000a2000020',180000.00,85000.00,180000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','5dee5cf5-94fe-43f4-b9dd-26008cb1886d','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.885091','supplier-receipt-consumer',1,1,25.0000,2125000.0000,0.0000,0.0000,0.0000,0.0000),('a72650f4-8e85-4be0-9e00-5d98a5c55bc6','63468102-2cdd-4110-ad1d-b552d656a963','a2000010-0000-4000-8000-0000a2000010',80000.00,95000.00,80000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','c216ccff-42ef-4965-b284-49153577cd35','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.917344','supplier-receipt-consumer',1,1,8.0000,760000.0000,0.0000,0.0000,0.0000,0.0000),('ac2e65b9-b89a-4bc7-889f-40040394f796','a33b585c-bafc-475f-b49d-fac760bc9b15','a2000029-0000-4000-8000-0000a2000029',360.00,350.00,360.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','1515e560-1465-4317-b211-96f774e28a3b','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756255','supplier-receipt-consumer',1,1,1500.0000,525000.0000,0.0000,0.0000,0.0000,0.0000),('c1062551-11be-43d3-9836-2cf251409113','dcbead7b-3197-46ae-9f42-b051eda16e52','a200001b-0000-4000-8000-0000a200001b',60000.00,210000.00,60000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','da0aa638-d1d7-4942-a9b7-d767b23a999f','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.969345','supplier-receipt-consumer',1,1,15.0000,3150000.0000,0.0000,0.0000,0.0000,0.0000),('dc40af81-a641-4c00-92ed-a0ccb5a9b9e7','1a8e476f-cf76-4c7d-bab3-745a590fca17','a2000030-0000-4000-8000-0000a2000030',1200.00,500.00,1200.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','7f5af7ea-a3e7-4bf2-bb18-0bd402504d91','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.869548','supplier-receipt-consumer',1,1,20.0000,10000.0000,0.0000,0.0000,0.0000,0.0000),('e75aa794-4a8f-4585-8819-63b448c4e8e6','3e6ac2b1-1fdc-41a1-98e6-d4b084a3ca60','a2000028-0000-4000-8000-0000a2000028',98.00,90.00,98.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','ef0e8e96-9b01-499e-ae6d-8e157e3b59a7','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.756270','supplier-receipt-consumer',1,1,800.0000,72000.0000,0.0000,0.0000,0.0000,0.0000),('e78a4c97-d404-4c3a-bc05-337c639a0c25','0c65a9d0-38db-4295-adae-5e3d3c333b72','a200000b-0000-4000-8000-0000a200000b',140000.00,75000.00,140000.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','cafa2f16-e36c-4dc8-ab4c-48c9f1a1e2af','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.952820','supplier-receipt-consumer',1,1,20.0000,1500000.0000,0.0000,0.0000,0.0000,0.0000),('eee81434-d0b1-4dd6-a1ae-926c5f616909','2d8e9877-fec7-4643-8327-07ae9563552f','a2000031-0000-4000-8000-0000a2000031',3500.00,12.00,3500.00,'supplier_receipt','5fa422bf-ab75-4174-8e25-ac5ef4467038','90890d51-8910-41ae-b6c2-4bfec96d9fae','NCC-20260803-0003','2026-08-03 03:37:11.179088',0,'reconciliation_required','2026-08-03 03:37:11.498287','supplier-receipt-consumer',1,1,12.0000,144.0000,0.0000,0.0000,0.0000,0.0000),('f34802ba-18f7-4d63-82b3-24a83fccaccf','12542cc9-4a00-4115-8ebe-f88b3f8b989f','953f58df-3312-4217-b1a1-47bf7b830619',5000.00,10000.00,5000.00,'supplier_receipt','10906710-ce7b-4800-b774-51fb54780366','e28548b1-82ee-456a-8441-6fabe2220deb','NCC-20260803-0002','2026-08-03 03:34:46.026935',0,'reconciliation_required','2026-08-03 03:34:47.654244','supplier-receipt-consumer',1,1,12.0000,120000.0000,0.0000,0.0000,0.0000,0.0000),('f393e80c-a0d6-4b87-816a-026f946afb0a','a693e475-d575-4f47-bc40-41195da75704','a2000031-0000-4000-8000-0000a2000031',3500.00,4500.00,3500.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a958863e-9961-4784-b3d1-8718c81908f9','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.803768','supplier-receipt-consumer',1,1,25.0000,112500.0000,0.0000,0.0000,0.0000,0.0000),('f4e9a76a-2924-4ab4-8635-f10ec4058027','ee2f2c22-c8d0-46bd-be7d-e65d4ad4b800','a2000032-0000-4000-8000-0000a2000032',200.00,8000.00,200.00,'supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','f32018bd-9531-4ccb-a365-9f928bdc3625','NCC-20260803-0004','2026-08-03 04:48:29.588034',0,'reconciliation_required','2026-08-03 04:48:30.838016','supplier-receipt-consumer',1,1,8.0000,64000.0000,0.0000,0.0000,0.0000,0.0000);
/*!40000 ALTER TABLE `ProductCostPriceHistories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductCreationRequestItems`
--

DROP TABLE IF EXISTS `ProductCreationRequestItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCreationRequestItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ClientKey` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SortOrder` int NOT NULL,
  `ProductSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CategoryId` int DEFAULT NULL,
  `BaseUnit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `InventoryUnit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VariantCount` int NOT NULL,
  `BomLineCount` int NOT NULL,
  `ValidationStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ValidationMessage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductCreationRequestItems_RequestId_ClientKey` (`RequestId`,`ClientKey`),
  KEY `IX_ProductCreationRequestItems_ProductName` (`ProductName`),
  CONSTRAINT `FK_ProductCreationRequestItems_ProductCreationRequests_RequestId` FOREIGN KEY (`RequestId`) REFERENCES `ProductCreationRequests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductCreationRequestItems`
--

LOCK TABLES `ProductCreationRequestItems` WRITE;
/*!40000 ALTER TABLE `ProductCreationRequestItems` DISABLE KEYS */;
INSERT INTO `ProductCreationRequestItems` VALUES ('00b2ae92-77dc-4fdf-86c6-bcfd24a95280','8e0f9da8-003e-40b1-8846-08d61598c114','NL01',0,'{\"categoryId\":6,\"name\":\"L\\u00E1 tr\\u00E0 sen\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Nguy\\u00EAn li\\u1EC7u pha ch\\u1EBF\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LA-TRA-SEN-G\",\"requestSkuKey\":\"NL01-U1\",\"barcode\":null,\"variantName\":\"L\\u00E1 tr\\u00E0 sen - g\",\"optionValuesJson\":\"{}\",\"costPrice\":2,\"retailPrice\":0,\"minStock\":500,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Lá trà sen','NGUYEN_LIEU',6,'g','Gram',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('05ca5866-8316-4d94-aaee-d1495397de3c','b179b17f-b208-46e8-b821-63ff0805d7a1','item-1784604230972-65aa0686e8e46',0,'{\"categoryId\":6,\"name\":\"Bao B\\u00EC\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"c\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"BAO-BI-CAI\",\"requestSkuKey\":\"item-1784604230972-65aa0686e8e46-base\",\"barcode\":null,\"variantName\":\"Bao B\\u00EC - c\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":5000,\"retailPrice\":6000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Bao Bì','BAO_BI',6,'cái','Piece',1,0,'valid',NULL,'2026-07-21 03:25:12.925007','2026-07-21 03:25:12.982661',0),('0a3c3e5d-e2a5-4202-9793-e576bcd346f9','b179b17f-b208-46e8-b821-63ff0805d7a1','item-1784604255162-e508288c527b48',1,'{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7u\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":12000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-G\",\"requestSkuKey\":\"item-1784604255162-e508288c527b48-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7u - g\",\"optionValuesJson\":\"{}\",\"costPrice\":10000,\"retailPrice\":12000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":12000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Nguyên Liệu','NGUYEN_LIEU',3,'g','Piece',1,0,'valid',NULL,'2026-07-21 03:25:12.925007','2026-07-21 03:25:12.982661',0),('0e9e982f-c426-49fa-8308-6608eeb7bca8','8e0f9da8-003e-40b1-8846-08d61598c114','BB03',7,'{\"categoryId\":6,\"name\":\"\\u1ED0ng h\\u00FAt gi\\u1EA5y\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"\\u1ED0ng h\\u00FAt k\\u00E8m ly mang \\u0111i\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"ONG-HUT-GIAY\",\"requestSkuKey\":\"BB03-U1\",\"barcode\":null,\"variantName\":\"\\u1ED0ng h\\u00FAt gi\\u1EA5y - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":300,\"retailPrice\":0,\"minStock\":200,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Ống hút giấy','BAO_BI',6,'Cái','Piece',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('17352f2c-4126-4215-aab6-8bba4750c116','8e0f9da8-003e-40b1-8846-08d61598c114','SP04',12,'{\"categoryId\":6,\"name\":\"Tr\\u00E0 L\\u00E0i\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m \\u0111\\u01A1n gi\\u1EA3n (1 SKU)\",\"baseUnit\":\"Ly\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":32000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-LAI-LY\",\"requestSkuKey\":\"SP04-U1\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 L\\u00E0i - Ly\",\"optionValuesJson\":\"{}\",\"costPrice\":11000,\"retailPrice\":32000,\"minStock\":10,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":32000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":6,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-SEN-G\",\"componentRequestSkuKey\":\"NL01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"L\\u00E0i\"}]}','Trà Lài','THANH_PHAM',6,'Ly','Piece',1,2,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('262a44a5-c55f-4473-8081-3fddac0a3dbd','22f0437a-49b6-429f-b11b-ab9a3c8ba93f','item-1784604327325-b1dcb02a739f68',0,'{\"categoryId\":6,\"name\":\"Bao B\\u00EC\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"c\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"BAO-BI-CAI\",\"requestSkuKey\":\"item-1784604327325-b1dcb02a739f68-base\",\"barcode\":null,\"variantName\":\"Bao B\\u00EC - c\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":5000,\"retailPrice\":6000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Bao Bì','BAO_BI',6,'cái','Piece',1,0,'not_validated',NULL,'2026-07-21 03:26:09.320127','2026-07-21 03:26:09.320127',0),('327ca7fe-d6e5-47a1-9e4e-cabff1af71da','8e0f9da8-003e-40b1-8846-08d61598c114','NL04',3,'{\"categoryId\":6,\"name\":\"S\\u1EEFa \\u0111\\u1EB7c\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Nguy\\u00EAn li\\u1EC7u tr\\u00E0 s\\u1EEFa\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"SUA-DAC-G\",\"requestSkuKey\":\"NL04-U1\",\"barcode\":null,\"variantName\":\"S\\u1EEFa \\u0111\\u1EB7c - g\",\"optionValuesJson\":\"{}\",\"costPrice\":3,\"retailPrice\":0,\"minStock\":600,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Xu\\u1EA5t x\\u1EE9\",\"value\":\"Vi\\u1EC7t Nam\"}]}','Sữa đặc','NGUYEN_LIEU',6,'g','Gram',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('3819f6e8-21d6-4b32-aa0d-1bcea84ab852','8e0f9da8-003e-40b1-8846-08d61598c114','SP01',9,'{\"categoryId\":6,\"name\":\"Tr\\u00E0 Sen\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m b\\u00E1n t\\u1EA1i qu\\u1EA7y \\u2014 c\\u00F3 BOM\",\"baseUnit\":\"Ly\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":35000,\"barcode\":\"890100100001\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Set\",\"conversionRate\":2,\"price\":70000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-SEN-LY\",\"requestSkuKey\":\"SP01-U1\",\"barcode\":\"890100100001\",\"variantName\":\"Tr\\u00E0 Sen - Ly\",\"optionValuesJson\":\"{}\",\"costPrice\":12000,\"retailPrice\":35000,\"minStock\":10,\"maxStock\":200,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":35000,\"barcode\":\"890100100001\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":8,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-SEN-G\",\"componentRequestSkuKey\":\"NL01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":10,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"ONG-HUT-GIAY\",\"componentRequestSkuKey\":\"BB03-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-SEN-SET\",\"requestSkuKey\":\"SP01-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Sen - Set\",\"optionValuesJson\":\"{}\",\"costPrice\":24000,\"retailPrice\":70000,\"minStock\":5,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Set\",\"conversionRate\":1,\"price\":70000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Set\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-SEN-LY\",\"baseRequestSkuKey\":\"SP01-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Size\",\"value\":\"M\"},{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"Sen\"},{\"attributeNameId\":null,\"attributeName\":\"Nhi\\u1EC7t \\u0111\\u1ED9\",\"value\":\"N\\u00F3ng/L\\u1EA1nh\"}]}','Trà Sen','THANH_PHAM',6,'Ly','Piece',2,4,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('3dc6241a-211e-4e18-9fff-de1372e2d65b','8e0f9da8-003e-40b1-8846-08d61598c114','NL05',4,'{\"categoryId\":6,\"name\":\"\\u0110\\u00E0o ng\\u00E2m\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Topping / h\\u01B0\\u01A1ng \\u0111\\u00E0o\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"DAO-NGAM-G\",\"requestSkuKey\":\"NL05-U1\",\"barcode\":null,\"variantName\":\"\\u0110\\u00E0o ng\\u00E2m - g\",\"optionValuesJson\":\"{}\",\"costPrice\":4,\"retailPrice\":0,\"minStock\":400,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Đào ngâm','NGUYEN_LIEU',6,'g','Gram',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('48d76257-2e70-494b-8850-772eaea68c4d','b1889136-87df-4a9d-9010-1449cd7cf63e','item-1785079729309-d2ac828a291af8',0,'{\"categoryId\":1,\"name\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\\u00F3i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-HOA-NHAI-001-GOI\",\"requestSkuKey\":\"item-1785079729309-d2ac828a291af8-base\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001 - g\\u00F3i\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":100000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"a91fae7b-989b-41e4-9668-2283d720a9b7\",\"quantity\":1,\"componentVariantId\":\"c6250087-30f0-47e7-a925-0416589a1bb8\",\"componentSkuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false}],\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Trà Hoa Nhài 001','THANH_PHAM',1,'gói','Piece',1,1,'not_validated',NULL,'2026-07-26 15:30:25.963040','2026-07-26 15:30:25.963040',0),('5d23b874-5e29-472e-bce1-4e33338dc2c5','7d651bdb-7a3f-43bb-b933-afceaf528d8b','item-1785079286696-c39fa15c80cc98',0,'{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7uu\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\\u00F3i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-GOI\",\"requestSkuKey\":\"item-1785079286696-c39fa15c80cc98-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7uu - g\\u00F3i\",\"optionValuesJson\":\"{}\",\"costPrice\":120000,\"retailPrice\":100000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false}],\"variantGenerator\":null,\"attributes\":[]}','Nguyên Liệuu','NGUYEN_LIEU',3,'gói','Piece',1,0,'valid',NULL,'2026-07-26 15:23:27.854409','2026-07-26 15:23:27.900244',0),('5f989083-a5ad-4ad2-9ffc-5b1ead03f64e','8e0f9da8-003e-40b1-8846-08d61598c114','BB01',5,'{\"categoryId\":6,\"name\":\"Ly gi\\u1EA5y 350ml\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Bao b\\u00EC d\\u00F9ng 1 l\\u1EA7n \\u2014 size M\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LY-GIAY-350\",\"requestSkuKey\":\"BB01-U1\",\"barcode\":null,\"variantName\":\"Ly gi\\u1EA5y 350ml - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":1500,\"retailPrice\":0,\"minStock\":100,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"350ml\"}]}','Ly giấy 350ml','BAO_BI',6,'Cái','Piece',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('6b878d91-452b-4086-8770-ef32f1ea3a2a','997f8073-8591-48a3-bacb-27ce61b3cad9','item-1784602271432-f3a1e6c867139',0,'{\"categoryId\":6,\"name\":\"Bao B\\u00EC \\u0110\\u00F3ng G\\u00F3i\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"c\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":5000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"BAO-BI-DONG-GOI-CAI\",\"requestSkuKey\":\"item-1784602271432-f3a1e6c867139-base\",\"barcode\":null,\"variantName\":\"Bao B\\u00EC \\u0110\\u00F3ng G\\u00F3i - c\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":5000,\"minStock\":50,\"maxStock\":1000,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":5000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Bao Bì Đóng Gói','BAO_BI',6,'cái','Piece',1,0,'valid',NULL,'2026-07-21 02:53:08.752343','2026-07-21 02:53:08.979873',0),('6d3e87df-0d4c-41dd-a303-d20f89a13d30','8e0f9da8-003e-40b1-8846-08d61598c114','BB02',6,'{\"categoryId\":6,\"name\":\"Ly gi\\u1EA5y 500ml\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Bao b\\u00EC d\\u00F9ng 1 l\\u1EA7n \\u2014 size L\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LY-GIAY-500\",\"requestSkuKey\":\"BB02-U1\",\"barcode\":null,\"variantName\":\"Ly gi\\u1EA5y 500ml - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":1800,\"retailPrice\":0,\"minStock\":80,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"500ml\"}]}','Ly giấy 500ml','BAO_BI',6,'Cái','Piece',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('7ba3e181-8031-4a2b-acc2-7efdf4cc7307','8e0f9da8-003e-40b1-8846-08d61598c114','SP02',10,'{\"categoryId\":6,\"name\":\"Tr\\u00E0 \\u0110\\u00E0o\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m c\\u00F3 2 size / BOM\",\"baseUnit\":\"Ly M\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":39000,\"barcode\":\"890100100002\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":2,\"price\":78000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-DAO-M\",\"requestSkuKey\":\"SP02-U1\",\"barcode\":\"890100100002\",\"variantName\":\"Tr\\u00E0 \\u0110\\u00E0o - Ly M\",\"optionValuesJson\":\"{}\",\"costPrice\":14000,\"retailPrice\":39000,\"minStock\":10,\"maxStock\":150,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":39000,\"barcode\":\"890100100002\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":7,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-DEN-G\",\"componentRequestSkuKey\":\"NL02-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":30,\"componentVariantId\":null,\"componentSkuCode\":\"DAO-NGAM-G\",\"componentRequestSkuKey\":\"NL05-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":12,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"NAP-LY-PET\",\"componentRequestSkuKey\":\"BB04-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly M\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-DAO-L\",\"requestSkuKey\":\"SP02-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 \\u0110\\u00E0o - Ly L\",\"optionValuesJson\":\"{}\",\"costPrice\":28000,\"retailPrice\":78000,\"minStock\":8,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":1,\"price\":78000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Ly L\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-DAO-M\",\"baseRequestSkuKey\":\"SP02-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"\\u0110\\u00E0o\"},{\"attributeNameId\":null,\"attributeName\":\"Size\",\"value\":\"M/L\"}]}','Trà Đào','THANH_PHAM',6,'Ly M','Piece',2,5,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('8d4584f5-ead9-483c-88a1-082a6434d0dd','997f8073-8591-48a3-bacb-27ce61b3cad9','item-1784602335583-50aa3813645418',1,'{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7u S\\u1EA3n Xu\\u1EA5t\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":10000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"requestSkuKey\":\"item-1784602335583-50aa3813645418-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7u S\\u1EA3n Xu\\u1EA5t - g\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":10000,\"minStock\":50,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":10000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Nguyên Liệu Sản Xuất','NGUYEN_LIEU',3,'g','Gram',1,0,'valid',NULL,'2026-07-21 02:53:08.752343','2026-07-21 02:53:08.979873',0),('935d3d79-b093-4e3b-94f9-792aa7028161','b2cfdaa1-d2f4-4183-b297-4ac5a907f815','item-1784603099782-efb52da6309b18',0,'{\"categoryId\":1,\"name\":\"S\\u1EA3n Ph\\u1EA9m Demo\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\\u00F3i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":1000000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"SAN-PHAM-DEMO-GOI\",\"requestSkuKey\":\"item-1784603099782-efb52da6309b18-base\",\"barcode\":null,\"variantName\":\"S\\u1EA3n Ph\\u1EA9m Demo - g\\u00F3i\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":1000000,\"minStock\":50,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":1000000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"a91fae7b-989b-41e4-9668-2283d720a9b7\",\"quantity\":1,\"componentVariantId\":\"c6250087-30f0-47e7-a925-0416589a1bb8\",\"componentSkuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false},{\"materialId\":\"7fc81df1-c32f-4e93-8846-eb114c51275b\",\"quantity\":1,\"componentVariantId\":\"02575cb5-719e-43e2-a4fd-c70f1c1860f1\",\"componentSkuCode\":\"BAO-BI-DONG-GOI-CAI\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false}],\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Sản Phẩm Demo','THANH_PHAM',1,'gói','Piece',1,2,'not_validated',NULL,'2026-07-21 03:18:09.730242','2026-07-21 03:18:09.730242',0),('93bacb10-7842-42e8-8624-86650656645d','8e0f9da8-003e-40b1-8846-08d61598c114','NL03',2,'{\"categoryId\":6,\"name\":\"\\u0110\\u01B0\\u1EDDng ph\\u00E8n\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"T\\u1EA1o ng\\u1ECDt\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"DUONG-PHEN-G\",\"requestSkuKey\":\"NL03-U1\",\"barcode\":null,\"variantName\":\"\\u0110\\u01B0\\u1EDDng ph\\u00E8n - g\",\"optionValuesJson\":\"{}\",\"costPrice\":1,\"retailPrice\":0,\"minStock\":1000,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Đường phèn','NGUYEN_LIEU',6,'g','Gram',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('bdfa2035-d729-4a5a-8d81-78ebaf93da94','8e0f9da8-003e-40b1-8846-08d61598c114','BB04',8,'{\"categoryId\":6,\"name\":\"N\\u1EAFp ly pet\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"N\\u1EAFp \\u0111\\u1EADy ly mang \\u0111i\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NAP-LY-PET\",\"requestSkuKey\":\"BB04-U1\",\"barcode\":null,\"variantName\":\"N\\u1EAFp ly pet - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":500,\"retailPrice\":0,\"minStock\":150,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Nắp ly pet','BAO_BI',6,'Cái','Piece',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('da18a4d8-0b26-4f85-b67a-a66fc64ab729','8e0f9da8-003e-40b1-8846-08d61598c114','NL02',1,'{\"categoryId\":6,\"name\":\"L\\u00E1 tr\\u00E0 \\u0111en\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Tr\\u00E0 n\\u1EC1n pha tr\\u00E0 s\\u1EEFa / \\u0111\\u00E0o\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LA-TRA-DEN-G\",\"requestSkuKey\":\"NL02-U1\",\"barcode\":null,\"variantName\":\"L\\u00E1 tr\\u00E0 \\u0111en - g\",\"optionValuesJson\":\"{}\",\"costPrice\":2,\"retailPrice\":0,\"minStock\":800,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}','Lá trà đen','NGUYEN_LIEU',6,'g','Gram',1,0,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('de2c4fb5-7512-4198-bff1-08ed39b86ed9','8e0f9da8-003e-40b1-8846-08d61598c114','SP05',13,'{\"categoryId\":6,\"name\":\"N\\u01B0\\u1EDBc l\\u1ECDc \\u0111\\u00F3ng chai\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m mua s\\u1EB5n \\u2014 v\\u1EABn c\\u1EA7n BOM bao b\\u00EC\",\"baseUnit\":\"Chai\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Chai\",\"conversionRate\":1,\"price\":10000,\"barcode\":\"890100100005\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NUOC-LOC-CHAI\",\"requestSkuKey\":\"SP05-U1\",\"barcode\":\"890100100005\",\"variantName\":\"N\\u01B0\\u1EDBc l\\u1ECDc \\u0111\\u00F3ng chai - Chai\",\"optionValuesJson\":\"{}\",\"costPrice\":4000,\"retailPrice\":10000,\"minStock\":24,\"maxStock\":300,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Chai\",\"conversionRate\":1,\"price\":10000,\"barcode\":\"890100100005\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Chai\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"500ml\"}]}','Nước lọc đóng chai','THANH_PHAM',6,'Chai','Piece',1,1,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('f8e9fefe-33bd-438b-963d-fa96c3ef4657','9b5b9a9d-e461-48cd-9b73-856db8784d4d','spdemo01',0,'{\"categoryId\":1,\"name\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"h\\u1ED9p\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-HOA-NHAI-001-HOP\",\"requestSkuKey\":\"SKU-DEMO\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001 - h\\u1ED9p\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":500000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"a91fae7b-989b-41e4-9668-2283d720a9b7\",\"quantity\":100,\"componentVariantId\":\"c6250087-30f0-47e7-a925-0416589a1bb8\",\"componentSkuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false},{\"materialId\":\"2de6bc81-18e9-471e-947e-21c9e7939197\",\"quantity\":1,\"componentVariantId\":\"953f58df-3312-4217-b1a1-47bf7b830619\",\"componentSkuCode\":\"BAO-BI-CAI\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false}],\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}','Trà Hoa Nhài 001','THANH_PHAM',1,'hộp','Piece',1,2,'valid',NULL,'2026-07-21 03:59:19.283495','2026-07-21 03:59:19.342857',0),('fd91d8de-c7cc-40f7-9d3e-93f881fb0c67','8e0f9da8-003e-40b1-8846-08d61598c114','SP03',11,'{\"categoryId\":6,\"name\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Best-seller \\u2014 nhi\\u1EC1u component BOM\",\"baseUnit\":\"Ly M\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":42000,\"barcode\":\"890100100003\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":2,\"price\":84000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-SUA-TC-M\",\"requestSkuKey\":\"SP03-U1\",\"barcode\":\"890100100003\",\"variantName\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u - Ly M\",\"optionValuesJson\":\"{}\",\"costPrice\":16000,\"retailPrice\":42000,\"minStock\":15,\"maxStock\":180,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":42000,\"barcode\":\"890100100003\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":8,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-DEN-G\",\"componentRequestSkuKey\":\"NL02-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":25,\"componentVariantId\":null,\"componentSkuCode\":\"SUA-DAC-G\",\"componentRequestSkuKey\":\"NL04-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":15,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"ONG-HUT-GIAY\",\"componentRequestSkuKey\":\"BB03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"NAP-LY-PET\",\"componentRequestSkuKey\":\"BB04-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly M\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-SUA-TC-L\",\"requestSkuKey\":\"SP03-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u - Ly L\",\"optionValuesJson\":\"{}\",\"costPrice\":32000,\"retailPrice\":84000,\"minStock\":10,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":1,\"price\":84000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Ly L\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-SUA-TC-M\",\"baseRequestSkuKey\":\"SP03-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"Tr\\u00E0 s\\u1EEFa\"},{\"attributeNameId\":null,\"attributeName\":\"Topping\",\"value\":\"Tr\\u00E2n ch\\u00E2u\"},{\"attributeNameId\":null,\"attributeName\":\"\\u0110\\u1ED9 ng\\u1ECDt\",\"value\":\"70%\"}]}','Trà Sữa Trân Châu','THANH_PHAM',6,'Ly M','Piece',2,6,'valid',NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0);
/*!40000 ALTER TABLE `ProductCreationRequestItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductCreationRequestRevisions`
--

DROP TABLE IF EXISTS `ProductCreationRequestRevisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCreationRequestRevisions` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RevisionNumber` int NOT NULL,
  `SubmittedSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SubmittedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SubmittedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) NOT NULL,
  `Decision` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecisionReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `DecidedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedAt` datetime(6) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductCreationRequestRevisions_RequestId_RevisionNumber` (`RequestId`,`RevisionNumber`),
  CONSTRAINT `FK_ProductCreationRequestRevisions_ProductCreationRequests_Reque` FOREIGN KEY (`RequestId`) REFERENCES `ProductCreationRequests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductCreationRequestRevisions`
--

LOCK TABLES `ProductCreationRequestRevisions` WRITE;
/*!40000 ALTER TABLE `ProductCreationRequestRevisions` DISABLE KEYS */;
INSERT INTO `ProductCreationRequestRevisions` VALUES ('335b3e0f-9215-4f73-a26c-053e23a65aa6','7d651bdb-7a3f-43bb-b933-afceaf528d8b',1,'[{\"clientKey\":\"item-1785079286696-c39fa15c80cc98\",\"product\":{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7uu\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\\u00F3i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-GOI\",\"requestSkuKey\":\"item-1785079286696-c39fa15c80cc98-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7uu - g\\u00F3i\",\"optionValuesJson\":\"{}\",\"costPrice\":120000,\"retailPrice\":100000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"price\":100000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\\u00F3i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false}],\"variantGenerator\":null,\"attributes\":[]}}]','0143485c-c41c-4d24-b3f5-48c850200733','Thủ Kho 2','Warehouse','2026-07-26 15:23:27.900244',NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-26 15:23:27.900244','2026-07-26 15:23:27.900244',0),('999b5c1d-f8d5-4da2-9d22-55698bd082ce','b179b17f-b208-46e8-b821-63ff0805d7a1',1,'[{\"clientKey\":\"item-1784604230972-65aa0686e8e46\",\"product\":{\"categoryId\":6,\"name\":\"Bao B\\u00EC\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"c\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"BAO-BI-CAI\",\"requestSkuKey\":\"item-1784604230972-65aa0686e8e46-base\",\"barcode\":null,\"variantName\":\"Bao B\\u00EC - c\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":5000,\"retailPrice\":6000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":6000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"item-1784604255162-e508288c527b48\",\"product\":{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7u\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":12000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-G\",\"requestSkuKey\":\"item-1784604255162-e508288c527b48-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7u - g\",\"optionValuesJson\":\"{}\",\"costPrice\":10000,\"retailPrice\":12000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":12000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}}]','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-07-21 03:25:12.982661','Approved',NULL,'80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 03:25:24.211422','2026-07-21 03:25:12.982661','2026-07-21 03:25:24.211422',0),('9b8f1ee7-7f4e-4e66-a00b-606ff80cd048','8e0f9da8-003e-40b1-8846-08d61598c114',1,'[{\"clientKey\":\"NL01\",\"product\":{\"categoryId\":6,\"name\":\"L\\u00E1 tr\\u00E0 sen\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Nguy\\u00EAn li\\u1EC7u pha ch\\u1EBF\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LA-TRA-SEN-G\",\"requestSkuKey\":\"NL01-U1\",\"barcode\":null,\"variantName\":\"L\\u00E1 tr\\u00E0 sen - g\",\"optionValuesJson\":\"{}\",\"costPrice\":2,\"retailPrice\":0,\"minStock\":500,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"NL02\",\"product\":{\"categoryId\":6,\"name\":\"L\\u00E1 tr\\u00E0 \\u0111en\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Tr\\u00E0 n\\u1EC1n pha tr\\u00E0 s\\u1EEFa / \\u0111\\u00E0o\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LA-TRA-DEN-G\",\"requestSkuKey\":\"NL02-U1\",\"barcode\":null,\"variantName\":\"L\\u00E1 tr\\u00E0 \\u0111en - g\",\"optionValuesJson\":\"{}\",\"costPrice\":2,\"retailPrice\":0,\"minStock\":800,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"NL03\",\"product\":{\"categoryId\":6,\"name\":\"\\u0110\\u01B0\\u1EDDng ph\\u00E8n\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"T\\u1EA1o ng\\u1ECDt\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"DUONG-PHEN-G\",\"requestSkuKey\":\"NL03-U1\",\"barcode\":null,\"variantName\":\"\\u0110\\u01B0\\u1EDDng ph\\u00E8n - g\",\"optionValuesJson\":\"{}\",\"costPrice\":1,\"retailPrice\":0,\"minStock\":1000,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"NL04\",\"product\":{\"categoryId\":6,\"name\":\"S\\u1EEFa \\u0111\\u1EB7c\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Nguy\\u00EAn li\\u1EC7u tr\\u00E0 s\\u1EEFa\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"SUA-DAC-G\",\"requestSkuKey\":\"NL04-U1\",\"barcode\":null,\"variantName\":\"S\\u1EEFa \\u0111\\u1EB7c - g\",\"optionValuesJson\":\"{}\",\"costPrice\":3,\"retailPrice\":0,\"minStock\":600,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Xu\\u1EA5t x\\u1EE9\",\"value\":\"Vi\\u1EC7t Nam\"}]}},{\"clientKey\":\"NL05\",\"product\":{\"categoryId\":6,\"name\":\"\\u0110\\u00E0o ng\\u00E2m\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Topping / h\\u01B0\\u01A1ng \\u0111\\u00E0o\",\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"DAO-NGAM-G\",\"requestSkuKey\":\"NL05-U1\",\"barcode\":null,\"variantName\":\"\\u0110\\u00E0o ng\\u00E2m - g\",\"optionValuesJson\":\"{}\",\"costPrice\":4,\"retailPrice\":0,\"minStock\":400,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"BB01\",\"product\":{\"categoryId\":6,\"name\":\"Ly gi\\u1EA5y 350ml\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Bao b\\u00EC d\\u00F9ng 1 l\\u1EA7n \\u2014 size M\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LY-GIAY-350\",\"requestSkuKey\":\"BB01-U1\",\"barcode\":null,\"variantName\":\"Ly gi\\u1EA5y 350ml - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":1500,\"retailPrice\":0,\"minStock\":100,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"350ml\"}]}},{\"clientKey\":\"BB02\",\"product\":{\"categoryId\":6,\"name\":\"Ly gi\\u1EA5y 500ml\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Bao b\\u00EC d\\u00F9ng 1 l\\u1EA7n \\u2014 size L\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"LY-GIAY-500\",\"requestSkuKey\":\"BB02-U1\",\"barcode\":null,\"variantName\":\"Ly gi\\u1EA5y 500ml - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":1800,\"retailPrice\":0,\"minStock\":80,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"500ml\"}]}},{\"clientKey\":\"BB03\",\"product\":{\"categoryId\":6,\"name\":\"\\u1ED0ng h\\u00FAt gi\\u1EA5y\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"\\u1ED0ng h\\u00FAt k\\u00E8m ly mang \\u0111i\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"ONG-HUT-GIAY\",\"requestSkuKey\":\"BB03-U1\",\"barcode\":null,\"variantName\":\"\\u1ED0ng h\\u00FAt gi\\u1EA5y - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":300,\"retailPrice\":0,\"minStock\":200,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"BB04\",\"product\":{\"categoryId\":6,\"name\":\"N\\u1EAFp ly pet\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"N\\u1EAFp \\u0111\\u1EADy ly mang \\u0111i\",\"baseUnit\":\"C\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NAP-LY-PET\",\"requestSkuKey\":\"BB04-U1\",\"barcode\":null,\"variantName\":\"N\\u1EAFp ly pet - C\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":500,\"retailPrice\":0,\"minStock\":150,\"maxStock\":null,\"isSellable\":false,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"price\":null,\"barcode\":null,\"isDirectSell\":false,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"C\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":true,\"canUseInCustom\":false,\"canHaveBom\":false}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"SP01\",\"product\":{\"categoryId\":6,\"name\":\"Tr\\u00E0 Sen\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m b\\u00E1n t\\u1EA1i qu\\u1EA7y \\u2014 c\\u00F3 BOM\",\"baseUnit\":\"Ly\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":35000,\"barcode\":\"890100100001\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Set\",\"conversionRate\":2,\"price\":70000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-SEN-LY\",\"requestSkuKey\":\"SP01-U1\",\"barcode\":\"890100100001\",\"variantName\":\"Tr\\u00E0 Sen - Ly\",\"optionValuesJson\":\"{}\",\"costPrice\":12000,\"retailPrice\":35000,\"minStock\":10,\"maxStock\":200,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":35000,\"barcode\":\"890100100001\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":8,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-SEN-G\",\"componentRequestSkuKey\":\"NL01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":10,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"ONG-HUT-GIAY\",\"componentRequestSkuKey\":\"BB03-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-SEN-SET\",\"requestSkuKey\":\"SP01-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Sen - Set\",\"optionValuesJson\":\"{}\",\"costPrice\":24000,\"retailPrice\":70000,\"minStock\":5,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Set\",\"conversionRate\":1,\"price\":70000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Set\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-SEN-LY\",\"baseRequestSkuKey\":\"SP01-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Size\",\"value\":\"M\"},{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"Sen\"},{\"attributeNameId\":null,\"attributeName\":\"Nhi\\u1EC7t \\u0111\\u1ED9\",\"value\":\"N\\u00F3ng/L\\u1EA1nh\"}]}},{\"clientKey\":\"SP02\",\"product\":{\"categoryId\":6,\"name\":\"Tr\\u00E0 \\u0110\\u00E0o\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m c\\u00F3 2 size / BOM\",\"baseUnit\":\"Ly M\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":39000,\"barcode\":\"890100100002\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":2,\"price\":78000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-DAO-M\",\"requestSkuKey\":\"SP02-U1\",\"barcode\":\"890100100002\",\"variantName\":\"Tr\\u00E0 \\u0110\\u00E0o - Ly M\",\"optionValuesJson\":\"{}\",\"costPrice\":14000,\"retailPrice\":39000,\"minStock\":10,\"maxStock\":150,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":39000,\"barcode\":\"890100100002\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":7,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-DEN-G\",\"componentRequestSkuKey\":\"NL02-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":30,\"componentVariantId\":null,\"componentSkuCode\":\"DAO-NGAM-G\",\"componentRequestSkuKey\":\"NL05-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":12,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"NAP-LY-PET\",\"componentRequestSkuKey\":\"BB04-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly M\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-DAO-L\",\"requestSkuKey\":\"SP02-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 \\u0110\\u00E0o - Ly L\",\"optionValuesJson\":\"{}\",\"costPrice\":28000,\"retailPrice\":78000,\"minStock\":8,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":1,\"price\":78000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Ly L\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-DAO-M\",\"baseRequestSkuKey\":\"SP02-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"\\u0110\\u00E0o\"},{\"attributeNameId\":null,\"attributeName\":\"Size\",\"value\":\"M/L\"}]}},{\"clientKey\":\"SP03\",\"product\":{\"categoryId\":6,\"name\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Best-seller \\u2014 nhi\\u1EC1u component BOM\",\"baseUnit\":\"Ly M\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":42000,\"barcode\":\"890100100003\",\"isDirectSell\":true,\"isBaseUnit\":true},{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":2,\"price\":84000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":false}],\"variants\":[{\"skuCode\":\"TRA-SUA-TC-M\",\"requestSkuKey\":\"SP03-U1\",\"barcode\":\"890100100003\",\"variantName\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u - Ly M\",\"optionValuesJson\":\"{}\",\"costPrice\":16000,\"retailPrice\":42000,\"minStock\":15,\"maxStock\":180,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly M\",\"conversionRate\":1,\"price\":42000,\"barcode\":\"890100100003\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":8,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-DEN-G\",\"componentRequestSkuKey\":\"NL02-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":25,\"componentVariantId\":null,\"componentSkuCode\":\"SUA-DAC-G\",\"componentRequestSkuKey\":\"NL04-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":15,\"componentVariantId\":null,\"componentSkuCode\":\"DUONG-PHEN-G\",\"componentRequestSkuKey\":\"NL03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"ONG-HUT-GIAY\",\"componentRequestSkuKey\":\"BB03-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"NAP-LY-PET\",\"componentRequestSkuKey\":\"BB04-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly M\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true},{\"skuCode\":\"TRA-SUA-TC-L\",\"requestSkuKey\":\"SP03-U2\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 S\\u1EEFa Tr\\u00E2n Ch\\u00E2u - Ly L\",\"optionValuesJson\":\"{}\",\"costPrice\":32000,\"retailPrice\":84000,\"minStock\":10,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly L\",\"conversionRate\":1,\"price\":84000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"Ly L\",\"conversionRate\":2,\"baseVariantId\":null,\"baseSkuCode\":\"TRA-SUA-TC-M\",\"baseRequestSkuKey\":\"SP03-U1\",\"isBaseUnitVariant\":false,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"Tr\\u00E0 s\\u1EEFa\"},{\"attributeNameId\":null,\"attributeName\":\"Topping\",\"value\":\"Tr\\u00E2n ch\\u00E2u\"},{\"attributeNameId\":null,\"attributeName\":\"\\u0110\\u1ED9 ng\\u1ECDt\",\"value\":\"70%\"}]}},{\"clientKey\":\"SP04\",\"product\":{\"categoryId\":6,\"name\":\"Tr\\u00E0 L\\u00E0i\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m \\u0111\\u01A1n gi\\u1EA3n (1 SKU)\",\"baseUnit\":\"Ly\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":32000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-LAI-LY\",\"requestSkuKey\":\"SP04-U1\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 L\\u00E0i - Ly\",\"optionValuesJson\":\"{}\",\"costPrice\":11000,\"retailPrice\":32000,\"minStock\":10,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Ly\",\"conversionRate\":1,\"price\":32000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":6,\"componentVariantId\":null,\"componentSkuCode\":\"LA-TRA-SEN-G\",\"componentRequestSkuKey\":\"NL01-U1\",\"isRequiredBaseComponent\":false},{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Ly\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"H\\u01B0\\u01A1ng v\\u1ECB\",\"value\":\"L\\u00E0i\"}]}},{\"clientKey\":\"SP05\",\"product\":{\"categoryId\":6,\"name\":\"N\\u01B0\\u1EDBc l\\u1ECDc \\u0111\\u00F3ng chai\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":\"Th\\u00E0nh ph\\u1EA9m mua s\\u1EB5n \\u2014 v\\u1EABn c\\u1EA7n BOM bao b\\u00EC\",\"baseUnit\":\"Chai\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"Chai\",\"conversionRate\":1,\"price\":10000,\"barcode\":\"890100100005\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NUOC-LOC-CHAI\",\"requestSkuKey\":\"SP05-U1\",\"barcode\":\"890100100005\",\"variantName\":\"N\\u01B0\\u1EDBc l\\u1ECDc \\u0111\\u00F3ng chai - Chai\",\"optionValuesJson\":\"{}\",\"costPrice\":4000,\"retailPrice\":10000,\"minStock\":24,\"maxStock\":300,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"Chai\",\"conversionRate\":1,\"price\":10000,\"barcode\":\"890100100005\",\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"00000000-0000-0000-0000-000000000000\",\"quantity\":1,\"componentVariantId\":null,\"componentSkuCode\":\"LY-GIAY-350\",\"componentRequestSkuKey\":\"BB01-U1\",\"isRequiredBaseComponent\":false}],\"unitName\":\"Chai\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":false,\"isPurchasable\":true,\"canBeBomComponent\":false,\"canUseInCustom\":false,\"canHaveBom\":true}],\"variantGenerator\":null,\"attributes\":[{\"attributeNameId\":null,\"attributeName\":\"Dung t\\u00EDch\",\"value\":\"500ml\"}]}}]','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 04:46:25.000331',NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-03 04:46:25.000331','2026-08-03 04:46:25.000331',0),('dbd02961-8500-4db3-b969-483f7806f719','997f8073-8591-48a3-bacb-27ce61b3cad9',1,'[{\"clientKey\":\"item-1784602271432-f3a1e6c867139\",\"product\":{\"categoryId\":6,\"name\":\"Bao B\\u00EC \\u0110\\u00F3ng G\\u00F3i\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"c\\u00E1i\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"BAO_BI\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":5000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"BAO-BI-DONG-GOI-CAI\",\"requestSkuKey\":\"item-1784602271432-f3a1e6c867139-base\",\"barcode\":null,\"variantName\":\"Bao B\\u00EC \\u0110\\u00F3ng G\\u00F3i - c\\u00E1i\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":5000,\"minStock\":50,\"maxStock\":1000,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"price\":5000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"c\\u00E1i\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}},{\"clientKey\":\"item-1784602335583-50aa3813645418\",\"product\":{\"categoryId\":3,\"name\":\"Nguy\\u00EAn Li\\u1EC7u S\\u1EA3n Xu\\u1EA5t\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"g\",\"inventoryUnit\":\"Gram\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"NGUYEN_LIEU\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":10000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"requestSkuKey\":\"item-1784602335583-50aa3813645418-base\",\"barcode\":null,\"variantName\":\"Nguy\\u00EAn Li\\u1EC7u S\\u1EA3n Xu\\u1EA5t - g\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":10000,\"minStock\":50,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"g\",\"conversionRate\":1,\"price\":10000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[],\"unitName\":\"g\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}}]','eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','2026-07-21 02:53:08.979873','Approved',NULL,'80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 02:53:19.087610','2026-07-21 02:53:08.979873','2026-07-21 02:53:19.087610',0),('f35b9693-de86-435b-a4e5-fdd0ee8f43c8','9b5b9a9d-e461-48cd-9b73-856db8784d4d',1,'[{\"clientKey\":\"spdemo01\",\"product\":{\"categoryId\":1,\"name\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"h\\u1ED9p\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-HOA-NHAI-001-HOP\",\"requestSkuKey\":\"SKU-DEMO\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001 - h\\u1ED9p\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":500000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"a91fae7b-989b-41e4-9668-2283d720a9b7\",\"quantity\":100,\"componentVariantId\":\"c6250087-30f0-47e7-a925-0416589a1bb8\",\"componentSkuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false},{\"materialId\":\"2de6bc81-18e9-471e-947e-21c9e7939197\",\"quantity\":1,\"componentVariantId\":\"953f58df-3312-4217-b1a1-47bf7b830619\",\"componentSkuCode\":\"BAO-BI-CAI\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false}],\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}}]','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-07-21 03:56:17.264619','Rejected','không thích','80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 03:56:40.506054','2026-07-21 03:56:17.264619','2026-07-21 03:56:40.506054',0),('fb9a10db-9b65-46a2-8bc3-76eec75a65f0','9b5b9a9d-e461-48cd-9b73-856db8784d4d',2,'[{\"clientKey\":\"spdemo01\",\"product\":{\"categoryId\":1,\"name\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001\",\"origin\":null,\"flavorProfile\":null,\"brewingGuide\":null,\"description\":null,\"baseUnit\":\"h\\u1ED9p\",\"inventoryUnit\":\"Piece\",\"weightValue\":null,\"weightUnit\":null,\"isVariantParent\":true,\"productType\":\"THANH_PHAM\",\"images\":[],\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"variants\":[{\"skuCode\":\"TRA-HOA-NHAI-001-HOP\",\"requestSkuKey\":\"SKU-DEMO\",\"barcode\":null,\"variantName\":\"Tr\\u00E0 Hoa Nh\\u00E0i 001 - h\\u1ED9p\",\"optionValuesJson\":\"{}\",\"costPrice\":0,\"retailPrice\":500000,\"minStock\":0,\"maxStock\":null,\"isSellable\":true,\"allowRewardPoints\":true,\"isActive\":true,\"imageUrl\":null,\"units\":[{\"variantId\":null,\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"price\":500000,\"barcode\":null,\"isDirectSell\":true,\"isBaseUnit\":true}],\"bomLines\":[{\"materialId\":\"a91fae7b-989b-41e4-9668-2283d720a9b7\",\"quantity\":100,\"componentVariantId\":\"c6250087-30f0-47e7-a925-0416589a1bb8\",\"componentSkuCode\":\"NGUYEN-LIEU-SAN-XUAT-G\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false},{\"materialId\":\"2de6bc81-18e9-471e-947e-21c9e7939197\",\"quantity\":1,\"componentVariantId\":\"953f58df-3312-4217-b1a1-47bf7b830619\",\"componentSkuCode\":\"BAO-BI-CAI\",\"componentRequestSkuKey\":null,\"isRequiredBaseComponent\":false}],\"unitName\":\"h\\u1ED9p\",\"conversionRate\":1,\"baseVariantId\":null,\"baseSkuCode\":null,\"baseRequestSkuKey\":null,\"isBaseUnitVariant\":true,\"isAutoGeneratedSku\":true}],\"variantGenerator\":null,\"attributes\":[]}}]','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-07-21 03:59:19.342857','Approved',NULL,'80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 03:59:29.298750','2026-07-21 03:59:19.342857','2026-07-21 03:59:29.298750',0);
/*!40000 ALTER TABLE `ProductCreationRequestRevisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductCreationRequests`
--

DROP TABLE IF EXISTS `ProductCreationRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductCreationRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `RevisionNumber` int NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `RejectReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `WarehouseNote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `AdminNote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CompletedAt` datetime(6) DEFAULT NULL,
  `CreatedProductIdsJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductCreationRequests_RequestCode` (`RequestCode`),
  KEY `IX_ProductCreationRequests_CreatedBy` (`CreatedBy`),
  KEY `IX_ProductCreationRequests_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductCreationRequests`
--

LOCK TABLES `ProductCreationRequests` WRITE;
/*!40000 ALTER TABLE `ProductCreationRequests` DISABLE KEYS */;
INSERT INTO `ProductCreationRequests` VALUES ('22f0437a-49b6-429f-b11b-ab9a3c8ba93f','PCR-20260721-984370','abc','Draft',0,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-21 03:26:03.552949','2026-07-21 03:26:09.320127',0),('7d651bdb-7a3f-43bb-b933-afceaf528d8b','PCR-20260726-448418','thíchh','PendingApproval',1,'0143485c-c41c-4d24-b3f5-48c850200733','Thủ Kho 2','Warehouse','2026-07-26 15:23:27.900244',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-26 15:22:05.666059','2026-07-26 15:23:27.900244',0),('8e0f9da8-003e-40b1-8846-08d61598c114','PCR-20260803-799742','FileMau_YeuCauTaoHangHoaMoi_CoDuLieu','PendingApproval',1,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 04:46:25.000331',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-03 04:46:24.545076','2026-08-03 04:46:25.000331',0),('997f8073-8591-48a3-bacb-27ce61b3cad9','PCR-20260721-909961','Tạo Bao Bì và Nguyên Liệu','Completed',1,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','2026-07-21 02:53:08.979873','80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 02:53:19.087610',NULL,NULL,NULL,NULL,'2026-07-21 02:53:19.087610','[\"7fc81df1-c32f-4e93-8846-eb114c51275b\",\"a91fae7b-989b-41e4-9668-2283d720a9b7\"]','2026-07-21 02:53:08.752343','2026-07-21 02:53:19.087610',0),('9b5b9a9d-e461-48cd-9b73-856db8784d4d','PCR-20260721-795834','tạo sản phẩm trà hoa nhài 001','Completed',2,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-07-21 03:59:19.342857','80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 03:59:29.298750',NULL,NULL,NULL,NULL,'2026-07-21 03:59:29.298750','[\"1fd9ce79-a91c-4a07-8049-8774d962a769\"]','2026-07-21 03:56:05.481282','2026-07-21 03:59:29.298750',0),('b179b17f-b208-46e8-b821-63ff0805d7a1','PCR-20260721-526723','abc','Completed',1,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-07-21 03:25:12.982661','80d5c297-cf0d-495f-9a76-e79e60b297da','System Administrator','Admin','2026-07-21 03:25:24.211422',NULL,NULL,NULL,NULL,'2026-07-21 03:25:24.211422','[\"2de6bc81-18e9-471e-947e-21c9e7939197\",\"272e081d-b3cd-4e65-86fc-6b44498619a1\"]','2026-07-21 03:25:12.925007','2026-07-21 03:25:24.211422',0),('b1889136-87df-4a9d-9010-1449cd7cf63e','PCR-20260726-319710','thichs','Draft',0,'0143485c-c41c-4d24-b3f5-48c850200733','Thủ Kho 2','Warehouse',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-26 15:30:25.963040','2026-07-26 15:30:25.963040',0),('b2cfdaa1-d2f4-4183-b297-4ac5a907f815','PCR-20260721-709165','Biên bản thêm sản phẩm mới demo','Draft',0,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-21 03:18:09.730242','2026-07-21 03:18:09.730242',0);
/*!40000 ALTER TABLE `ProductCreationRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductDeletionRequestItems`
--

DROP TABLE IF EXISTS `ProductDeletionRequestItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductDeletionRequestItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CategoryName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VariantCount` int NOT NULL,
  `Reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `ValidationStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ValidationMessage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductDeletionRequestItems_RequestId_ProductId` (`RequestId`,`ProductId`),
  KEY `IX_ProductDeletionRequestItems_ProductName` (`ProductName`),
  CONSTRAINT `FK_ProductDeletionRequestItems_ProductDeletionRequests_RequestId` FOREIGN KEY (`RequestId`) REFERENCES `ProductDeletionRequests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductDeletionRequestItems`
--

LOCK TABLES `ProductDeletionRequestItems` WRITE;
/*!40000 ALTER TABLE `ProductDeletionRequestItems` DISABLE KEYS */;
INSERT INTO `ProductDeletionRequestItems` VALUES ('bc93123e-8149-48a5-a5d2-b0a844686742','f542e38a-f24e-44d1-a7d5-9c43ea87c849','10000000-0000-0000-0000-000000000012','{\"id\":\"10000000-0000-0000-0000-000000000012\",\"name\":\"Hoa sen kh\\u00F4\",\"productType\":\"NGUYEN_LIEU\",\"categoryId\":5,\"categoryName\":\"Nguy\\u00EAn li\\u1EC7u ph\\u1EE5\",\"isActive\":true,\"isDeleted\":false,\"variants\":[{\"id\":\"20000000-0000-0000-0000-000000000012\",\"skuCode\":\"NL-HOASEN-1KG\",\"variantName\":\"Hoa sen kh\\u00F4 1kg\",\"costPrice\":350000.00,\"retailPrice\":500000.00,\"isActive\":true,\"bomLines\":[]}]}','Hoa sen khô','NGUYEN_LIEU','Nguyên liệu phụ',1,'v','not_validated',NULL,'2026-07-21 02:49:06.208048','2026-07-21 02:49:06.208048',0);
/*!40000 ALTER TABLE `ProductDeletionRequestItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductDeletionRequestRevisions`
--

DROP TABLE IF EXISTS `ProductDeletionRequestRevisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductDeletionRequestRevisions` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RevisionNumber` int NOT NULL,
  `SubmittedSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SubmittedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SubmittedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) NOT NULL,
  `Decision` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecisionReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `DecidedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DecidedAt` datetime(6) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductDeletionRequestRevisions_RequestId_RevisionNumber` (`RequestId`,`RevisionNumber`),
  CONSTRAINT `FK_ProductDeletionRequestRevisions_ProductDeletionRequests_Reque` FOREIGN KEY (`RequestId`) REFERENCES `ProductDeletionRequests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductDeletionRequestRevisions`
--

LOCK TABLES `ProductDeletionRequestRevisions` WRITE;
/*!40000 ALTER TABLE `ProductDeletionRequestRevisions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductDeletionRequestRevisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductDeletionRequests`
--

DROP TABLE IF EXISTS `ProductDeletionRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductDeletionRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `RevisionNumber` int NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `RejectReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `AdminNote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CompletedAt` datetime(6) DEFAULT NULL,
  `DeletedProductIdsJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductDeletionRequests_RequestCode` (`RequestCode`),
  KEY `IX_ProductDeletionRequests_CreatedBy` (`CreatedBy`),
  KEY `IX_ProductDeletionRequests_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductDeletionRequests`
--

LOCK TABLES `ProductDeletionRequests` WRITE;
/*!40000 ALTER TABLE `ProductDeletionRequests` DISABLE KEYS */;
INSERT INTO `ProductDeletionRequests` VALUES ('f542e38a-f24e-44d1-a7d5-9c43ea87c849','PDR-20260721-462046','a','Draft',0,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'v',NULL,NULL,NULL,'2026-07-21 02:49:06.208048','2026-07-21 02:49:06.208048',0);
/*!40000 ALTER TABLE `ProductDeletionRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductImages`
--

DROP TABLE IF EXISTS `ProductImages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductImages` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ImageUrl` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `AltText` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SortOrder` int NOT NULL DEFAULT '0',
  `IsThumbnail` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IX_ProductImages_ProductId_SortOrder` (`ProductId`,`SortOrder`),
  CONSTRAINT `FK_ProductImages_Products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `Products` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductImages`
--

LOCK TABLES `ProductImages` WRITE;
/*!40000 ALTER TABLE `ProductImages` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductImages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductRetailPriceHistories`
--

DROP TABLE IF EXISTS `ProductRetailPriceHistories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductRetailPriceHistories` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OldRetailPrice` decimal(18,2) NOT NULL,
  `NewRetailPrice` decimal(18,2) NOT NULL,
  `ChangedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ChangedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ChangedAt` datetime(6) NOT NULL,
  `SourceType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ProductRetailPriceHistories_SkuId_ChangedAt` (`SkuId`,`ChangedAt`),
  CONSTRAINT `FK_ProductRetailPriceHistories_ProductVariants_SkuId` FOREIGN KEY (`SkuId`) REFERENCES `ProductVariants` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductRetailPriceHistories`
--

LOCK TABLES `ProductRetailPriceHistories` WRITE;
/*!40000 ALTER TABLE `ProductRetailPriceHistories` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductRetailPriceHistories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductUnits`
--

DROP TABLE IF EXISTS `ProductUnits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductUnits` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `VariantId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `UnitName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ConversionRate` decimal(18,4) NOT NULL,
  `Price` decimal(18,2) DEFAULT NULL,
  `Barcode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IsDirectSell` tinyint(1) NOT NULL DEFAULT '1',
  `IsBaseUnit` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductUnits_Barcode` (`Barcode`),
  KEY `IX_ProductUnits_ProductId_UnitName` (`ProductId`,`UnitName`),
  KEY `IX_ProductUnits_VariantId` (`VariantId`),
  CONSTRAINT `FK_ProductUnits_Products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `Products` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductUnits_ProductVariants_VariantId` FOREIGN KEY (`VariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductUnits`
--

LOCK TABLES `ProductUnits` WRITE;
/*!40000 ALTER TABLE `ProductUnits` DISABLE KEYS */;
INSERT INTO `ProductUnits` VALUES ('0dace3d0-11d5-4ae5-b411-418634d0f0ad','1fd9ce79-a91c-4a07-8049-8774d962a769',NULL,'hộp',1.0000,500000.00,NULL,1,1,'2026-07-21 03:59:29.246896',NULL,0),('1a326779-7e9a-4d5c-94c0-66d01084b626','2de6bc81-18e9-471e-947e-21c9e7939197',NULL,'cái',1.0000,6000.00,NULL,1,1,'2026-07-21 03:25:24.191623',NULL,0),('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Gói',1.0000,185000.00,NULL,1,1,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Thùng',12.0000,2035000.00,NULL,0,0,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Hộp',1.0000,420000.00,NULL,1,1,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Thùng',6.0000,2394000.00,NULL,0,0,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Gói',1.0000,145000.00,NULL,1,1,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Thùng',12.0000,1595000.00,NULL,0,0,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','Hộp',1.0000,330000.00,NULL,1,1,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000005','Gói',1.0000,220000.00,NULL,1,1,'2026-01-01 00:00:00.000000',NULL,0),('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','Kg',1000.0000,180000.00,NULL,0,0,'2026-01-01 00:00:00.000000','2026-08-03 06:00:34.021148',0),('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000012','Kg',1000.0000,500000.00,NULL,0,0,'2026-01-01 00:00:00.000000','2026-08-03 06:00:34.021148',0),('30000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000013','Kg',1000.0000,210000.00,NULL,0,0,'2026-01-01 00:00:00.000000','2026-08-03 06:00:34.021148',0),('42ff311f-a28e-49c8-b577-94bcfbbe7d59','7fc81df1-c32f-4e93-8846-eb114c51275b',NULL,'cái',1.0000,5000.00,NULL,1,1,'2026-07-21 02:53:19.030527',NULL,0),('4d1a6602-2d9a-47d8-b588-fa3b11b21104','2de6bc81-18e9-471e-947e-21c9e7939197','953f58df-3312-4217-b1a1-47bf7b830619','cái',1.0000,6000.00,NULL,1,1,'2026-07-21 03:25:24.192141',NULL,0),('797e4dac-41fb-4c4e-8716-a1eb2c16ce4c','272e081d-b3cd-4e65-86fc-6b44498619a1','6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','g',1.0000,12000.00,NULL,1,1,'2026-07-21 03:25:24.204163',NULL,0),('81ec147c-f64e-455e-8a7e-bc1a61b804b0','1fd9ce79-a91c-4a07-8049-8774d962a769','f4bceb36-e146-4ef1-a9e3-45a70036d3ff','hộp',1.0000,500000.00,NULL,1,1,'2026-07-21 03:59:29.247550',NULL,0),('a40d08bb-8f00-11f1-9034-a6b3f5912d2b','a1000015-0000-4000-8000-0000a1000015','a2000027-0000-4000-8000-0000a2000027','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d0976-8f00-11f1-9034-a6b3f5912d2b','a1000016-0000-4000-8000-0000a1000016','a2000028-0000-4000-8000-0000a2000028','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d09b3-8f00-11f1-9034-a6b3f5912d2b','a1000017-0000-4000-8000-0000a1000017','a2000029-0000-4000-8000-0000a2000029','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d09dd-8f00-11f1-9034-a6b3f5912d2b','a1000018-0000-4000-8000-0000a1000018','a200002a-0000-4000-8000-0000a200002a','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d0a04-8f00-11f1-9034-a6b3f5912d2b','a1000019-0000-4000-8000-0000a1000019','a200002b-0000-4000-8000-0000a200002b','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d0a2d-8f00-11f1-9034-a6b3f5912d2b','a100001a-0000-4000-8000-0000a100001a','a200002c-0000-4000-8000-0000a200002c','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d0a51-8f00-11f1-9034-a6b3f5912d2b','a100001b-0000-4000-8000-0000a100001b','a200002d-0000-4000-8000-0000a200002d','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40d0a76-8f00-11f1-9034-a6b3f5912d2b','a100001c-0000-4000-8000-0000a100001c','a200002e-0000-4000-8000-0000a200002e','g',1.0000,NULL,NULL,0,1,'2026-08-03 06:00:34.025606',NULL,0),('a40da595-8f00-11f1-9034-a6b3f5912d2b','272e081d-b3cd-4e65-86fc-6b44498619a1','6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da6b0-8f00-11f1-9034-a6b3f5912d2b','a1000015-0000-4000-8000-0000a1000015','a2000027-0000-4000-8000-0000a2000027','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da70d-8f00-11f1-9034-a6b3f5912d2b','a1000016-0000-4000-8000-0000a1000016','a2000028-0000-4000-8000-0000a2000028','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da761-8f00-11f1-9034-a6b3f5912d2b','a1000017-0000-4000-8000-0000a1000017','a2000029-0000-4000-8000-0000a2000029','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da7a6-8f00-11f1-9034-a6b3f5912d2b','a1000018-0000-4000-8000-0000a1000018','a200002a-0000-4000-8000-0000a200002a','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da7e9-8f00-11f1-9034-a6b3f5912d2b','a1000019-0000-4000-8000-0000a1000019','a200002b-0000-4000-8000-0000a200002b','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da830-8f00-11f1-9034-a6b3f5912d2b','a100001a-0000-4000-8000-0000a100001a','a200002c-0000-4000-8000-0000a200002c','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da871-8f00-11f1-9034-a6b3f5912d2b','a100001b-0000-4000-8000-0000a100001b','a200002d-0000-4000-8000-0000a200002d','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da8b3-8f00-11f1-9034-a6b3f5912d2b','a100001c-0000-4000-8000-0000a100001c','a200002e-0000-4000-8000-0000a200002e','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('a40da913-8f00-11f1-9034-a6b3f5912d2b','a91fae7b-989b-41e4-9668-2283d720a9b7','c6250087-30f0-47e7-a925-0416589a1bb8','kg',1000.0000,NULL,NULL,0,0,'2026-08-03 06:00:34.032255',NULL,0),('c697750a-698e-45dd-96a6-8ebcd95c57f5','7fc81df1-c32f-4e93-8846-eb114c51275b','02575cb5-719e-43e2-a4fd-c70f1c1860f1','cái',1.0000,5000.00,NULL,1,1,'2026-07-21 02:53:19.036873',NULL,0),('d2c7589c-dffb-43f6-8060-974edd9801a7','272e081d-b3cd-4e65-86fc-6b44498619a1',NULL,'g',1.0000,12000.00,NULL,1,1,'2026-07-21 03:25:24.203048',NULL,0),('f23c46ff-2988-4cb1-abb1-2a409d6135e1','a91fae7b-989b-41e4-9668-2283d720a9b7',NULL,'g',1.0000,10000.00,NULL,1,1,'2026-07-21 02:53:19.079798',NULL,0),('f329cabf-bc34-4f95-b43a-133cb326ba30','a91fae7b-989b-41e4-9668-2283d720a9b7','c6250087-30f0-47e7-a925-0416589a1bb8','g',1.0000,10000.00,NULL,1,1,'2026-07-21 02:53:19.080379',NULL,0);
/*!40000 ALTER TABLE `ProductUnits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductVariantBomLines`
--

DROP TABLE IF EXISTS `ProductVariantBomLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductVariantBomLines` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `ProductVariantId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `MaterialId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Quantity` decimal(18,4) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `ComponentVariantId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `IsRequiredBaseComponent` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IX_ProductVariantBomLines_MaterialId` (`MaterialId`),
  KEY `IX_ProductVariantBomLines_ProductVariantId` (`ProductVariantId`),
  KEY `IX_ProductVariantBomLines_ComponentVariantId` (`ComponentVariantId`),
  CONSTRAINT `FK_ProductVariantBomLines_Products_MaterialId` FOREIGN KEY (`MaterialId`) REFERENCES `Products` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_ProductVariantBomLines_ProductVariants_ComponentVariantId` FOREIGN KEY (`ComponentVariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_ProductVariantBomLines_ProductVariants_ProductVariantId` FOREIGN KEY (`ProductVariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductVariantBomLines`
--

LOCK TABLES `ProductVariantBomLines` WRITE;
/*!40000 ALTER TABLE `ProductVariantBomLines` DISABLE KEYS */;
INSERT INTO `ProductVariantBomLines` VALUES (1,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',0.0900,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(2,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012',0.0200,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(3,'20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000011',0.2300,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(4,'20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000012',0.0500,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(5,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000013',0.1000,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(6,'20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000013',0.2500,'2026-01-01 00:00:00.000000','2026-08-03 01:40:04.000000',1,NULL,0),(7,'f4bceb36-e146-4ef1-a9e3-45a70036d3ff','a91fae7b-989b-41e4-9668-2283d720a9b7',100.0000,'2026-07-21 03:59:29.268711',NULL,0,'c6250087-30f0-47e7-a925-0416589a1bb8',0),(8,'f4bceb36-e146-4ef1-a9e3-45a70036d3ff','2de6bc81-18e9-471e-947e-21c9e7939197',1.0000,'2026-07-21 03:59:29.270096',NULL,0,'953f58df-3312-4217-b1a1-47bf7b830619',0),(129,'a2000001-0000-4000-8000-0000a2000001','a1000015-0000-4000-8000-0000a1000015',100.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(130,'a2000001-0000-4000-8000-0000a2000001','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(131,'a2000001-0000-4000-8000-0000a2000001','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(132,'a2000002-0000-4000-8000-0000a2000002','a1000015-0000-4000-8000-0000a1000015',250.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(133,'a2000002-0000-4000-8000-0000a2000002','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(134,'a2000002-0000-4000-8000-0000a2000002','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(135,'a2000003-0000-4000-8000-0000a2000003','a1000015-0000-4000-8000-0000a1000015',100.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(136,'a2000003-0000-4000-8000-0000a2000003','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(137,'a2000003-0000-4000-8000-0000a2000003','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(138,'a2000004-0000-4000-8000-0000a2000004','a1000015-0000-4000-8000-0000a1000015',250.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(139,'a2000004-0000-4000-8000-0000a2000004','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(140,'a2000004-0000-4000-8000-0000a2000004','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(141,'a2000005-0000-4000-8000-0000a2000005','a1000015-0000-4000-8000-0000a1000015',100.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(142,'a2000005-0000-4000-8000-0000a2000005','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(143,'a2000005-0000-4000-8000-0000a2000005','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(144,'a2000006-0000-4000-8000-0000a2000006','a1000015-0000-4000-8000-0000a1000015',200.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(145,'a2000006-0000-4000-8000-0000a2000006','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(146,'a2000006-0000-4000-8000-0000a2000006','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(147,'a2000007-0000-4000-8000-0000a2000007','a1000015-0000-4000-8000-0000a1000015',100.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(148,'a2000007-0000-4000-8000-0000a2000007','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(149,'a2000007-0000-4000-8000-0000a2000007','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(150,'a2000008-0000-4000-8000-0000a2000008','a1000015-0000-4000-8000-0000a1000015',250.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(151,'a2000008-0000-4000-8000-0000a2000008','a100001d-0000-4000-8000-0000a100001d',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0),(152,'a2000008-0000-4000-8000-0000a2000008','a100001f-0000-4000-8000-0000a100001f',1.0000,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410',0,NULL,0);
/*!40000 ALTER TABLE `ProductVariantBomLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductVariants`
--

DROP TABLE IF EXISTS `ProductVariants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductVariants` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Barcode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VariantName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OptionValuesJson` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CostPrice` decimal(18,2) NOT NULL,
  `RetailPrice` decimal(18,2) NOT NULL,
  `MinStock` int DEFAULT NULL,
  `MaxStock` int DEFAULT NULL,
  `IsSellable` tinyint(1) NOT NULL DEFAULT '1',
  `AllowRewardPoints` tinyint(1) NOT NULL DEFAULT '1',
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `ImageUrl` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `SyncedToStoreAt` datetime(6) DEFAULT NULL,
  `WeightInGrams` int NOT NULL DEFAULT '0',
  `BaseVariantId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ConversionRate` decimal(18,4) NOT NULL DEFAULT '1.0000',
  `IsAutoGeneratedSku` tinyint(1) NOT NULL DEFAULT '0',
  `IsBaseUnitVariant` tinyint(1) NOT NULL DEFAULT '0',
  `UnitName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IsPurchasable` tinyint(1) NOT NULL DEFAULT '0',
  `CanBeBomComponent` tinyint(1) NOT NULL DEFAULT '0',
  `CanUseInCustom` tinyint(1) NOT NULL DEFAULT '0',
  `CanHaveBom` tinyint(1) NOT NULL DEFAULT '0',
  `TotalApprovedInboundQuantity` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `TotalApprovedInboundValue` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `CostBasisReconciledAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductVariants_SkuCode` (`SkuCode`),
  UNIQUE KEY `IX_ProductVariants_Barcode` (`Barcode`),
  KEY `IX_ProductVariants_ProductId` (`ProductId`),
  KEY `IX_ProductVariants_BaseVariantId` (`BaseVariantId`),
  CONSTRAINT `FK_ProductVariants_Products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `Products` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductVariants_ProductVariants_BaseVariantId` FOREIGN KEY (`BaseVariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductVariants`
--

LOCK TABLES `ProductVariants` WRITE;
/*!40000 ALTER TABLE `ProductVariants` DISABLE KEYS */;
INSERT INTO `ProductVariants` VALUES ('02575cb5-719e-43e2-a4fd-c70f1c1860f1','7fc81df1-c32f-4e93-8846-eb114c51275b','BAO-BI-DONG-GOI-CAI',NULL,'Bao Bì Đóng Gói - cái','{}',0.00,5000.00,50,1000,1,1,1,NULL,'2026-07-21 02:53:19.035978','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526',0,NULL,1.0000,1,1,'cái',1,1,0,0,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000001','a1000001-0000-4000-8000-0000a1000001','OLD-20000000-TRA-SEN-100G',NULL,'Gói 100g','{\"Khối lượng\":\"100g\"}',95000.00,185000.00,5,300,1,1,0,NULL,'2026-01-01 00:00:00.000000','2026-07-30 17:26:41.285559',1,'2026-07-30 17:14:39.050148',100,NULL,1.0000,0,0,NULL,1,0,0,1,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000002','a1000001-0000-4000-8000-0000a1000001','OLD-20000000-TRA-SEN-250G',NULL,'Gói 250g','{\"Khối lượng\":\"250g\"}',220000.00,420000.00,5,300,1,1,0,NULL,'2026-01-01 00:00:00.000000','2026-07-30 17:26:41.285559',1,'2026-07-30 17:14:39.050148',250,NULL,1.0000,0,0,NULL,1,0,0,1,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000003','a1000002-0000-4000-8000-0000a1000002','OLD-20000000-TRA-OL-100G',NULL,'Gói 100g','{\"Khối lượng\":\"100g\"}',78000.00,155000.00,5,300,1,1,0,NULL,'2026-01-01 00:00:00.000000','2026-07-30 17:26:41.285559',1,'2026-07-30 17:14:39.050148',100,NULL,1.0000,0,0,NULL,1,0,0,1,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000004','a1000002-0000-4000-8000-0000a1000002','OLD-20000000-TRA-OL-250G',NULL,'Gói 250g','{\"Khối lượng\":\"250g\"}',175000.00,335000.00,5,300,1,1,0,NULL,'2026-01-01 00:00:00.000000','2026-07-30 17:26:41.285559',1,'2026-07-30 17:14:39.050148',250,NULL,1.0000,0,0,NULL,1,0,0,1,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000005','a1000003-0000-4000-8000-0000a1000003','OLD-20000000-HTRA-DHB-100G',NULL,'Gói 100g','{\"Khối lượng\":\"100g\"}',120000.00,245000.00,5,300,1,1,0,NULL,'2026-01-01 00:00:00.000000','2026-07-30 17:26:41.285559',1,'2026-07-30 17:14:39.050148',100,NULL,1.0000,0,0,NULL,1,0,0,1,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000011','a1000015-0000-4000-8000-0000a1000015','OLD-20000000-NL-TRAXANH-1KG',NULL,'1kg','{\"Khối lượng\":\"1kg\"}',125.00,180.00,20000,2000000,0,0,0,NULL,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.459895',1,NULL,1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000012','a1000017-0000-4000-8000-0000a1000017','OLD-20000000-NL-HOASEN-1KG',NULL,'1kg','{\"Khối lượng\":\"1kg\"}',360.00,520.00,20000,2000000,0,0,0,NULL,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.459895',1,NULL,1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('20000000-0000-0000-0000-000000000013','a1000016-0000-4000-8000-0000a1000016','OLD-20000000-NL-OLONG-1KG',NULL,'1kg','{\"Khối lượng\":\"1kg\"}',98.00,150.00,20000,2000000,0,0,0,NULL,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.459895',1,NULL,1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','272e081d-b3cd-4e65-86fc-6b44498619a1','NGUYEN-LIEU-G',NULL,'Nguyên Liệu - g','{}',10000.00,12000.00,0,NULL,1,1,1,NULL,'2026-07-21 03:25:24.204142','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526',0,NULL,1.0000,1,1,'g',1,1,0,0,0.0000,0.0000,NULL),('953f58df-3312-4217-b1a1-47bf7b830619','2de6bc81-18e9-471e-947e-21c9e7939197','BAO-BI-CAI',NULL,'Bao Bì - cái','{}',5000.00,6000.00,0,NULL,1,1,1,NULL,'2026-07-21 03:25:24.192136','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526',0,NULL,1.0000,1,1,'cái',1,1,0,0,0.0000,0.0000,NULL),('a2000001-0000-4000-8000-0000a2000001','a1000001-0000-4000-8000-0000a1000001','HVT-SEN-100G','8934673200001','Gói 100g','{\"sku\":\"HVT-SEN-100G\"}',95000.00,185000.00,5,300,1,1,1,NULL,'2026-07-30 17:26:41.285559','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000002-0000-4000-8000-0000a2000002','a1000001-0000-4000-8000-0000a1000001','HVT-SEN-250G','8934673200002','Gói 250g','{\"sku\":\"HVT-SEN-250G\"}',220000.00,420000.00,5,300,1,1,1,NULL,'2026-07-30 17:26:41.285559','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000003-0000-4000-8000-0000a2000003','a1000002-0000-4000-8000-0000a1000002','HVT-OLONG-100G','8934673200003','Gói 100g','{\"sku\":\"HVT-OLONG-100G\"}',78000.00,155000.00,5,300,1,1,1,NULL,'2026-07-30 17:26:41.285559','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000004-0000-4000-8000-0000a2000004','a1000002-0000-4000-8000-0000a1000002','HVT-OLONG-250G','8934673200004','Gói 250g','{\"sku\":\"HVT-OLONG-250G\"}',175000.00,335000.00,5,300,1,1,1,NULL,'2026-07-30 17:26:41.285559','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000005-0000-4000-8000-0000a2000005','a1000003-0000-4000-8000-0000a1000003','HVT-SHAN-100G','8934673200005','Gói 100g','{\"sku\":\"HVT-SHAN-100G\"}',120000.00,245000.00,5,300,1,1,1,NULL,'2026-07-30 17:26:41.285559','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000006-0000-4000-8000-0000a2000006','a1000003-0000-4000-8000-0000a1000003','HVT-SHAN-200G','8934673200006','Gói 200g','{\"sku\":\"HVT-SHAN-200G\"}',210000.00,430000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000007-0000-4000-8000-0000a2000007','a1000004-0000-4000-8000-0000a1000004','HVT-LAI-100G','8934673200007','Gói 100g','{\"sku\":\"HVT-LAI-100G\"}',65000.00,135000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000008-0000-4000-8000-0000a2000008','a1000004-0000-4000-8000-0000a1000004','HVT-LAI-250G','8934673200008','Gói 250g','{\"sku\":\"HVT-LAI-250G\"}',145000.00,285000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000009-0000-4000-8000-0000a2000009','a1000005-0000-4000-8000-0000a1000005','HVT-DHB-100G','8934673200009','Gói 100g','{\"sku\":\"HVT-DHB-100G\"}',110000.00,220000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000a-0000-4000-8000-0000a200000a','a1000005-0000-4000-8000-0000a1000005','HVT-DHB-200G','8934673200010','Gói 200g','{\"sku\":\"HVT-DHB-200G\"}',200000.00,395000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000b-0000-4000-8000-0000a200000b','a1000006-0000-4000-8000-0000a1000006','HVT-BACH-50G','8934673200011','Gói 50g','{\"sku\":\"HVT-BACH-50G\"}',140000.00,280000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',50,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000c-0000-4000-8000-0000a200000c','a1000006-0000-4000-8000-0000a1000006','HVT-BACH-100G','8934673200012','Gói 100g','{\"sku\":\"HVT-BACH-100G\"}',260000.00,520000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000d-0000-4000-8000-0000a200000d','a1000007-0000-4000-8000-0000a1000007','HVT-PHUNHI-100G','8934673200013','Gói 100g','{\"sku\":\"HVT-PHUNHI-100G\"}',90000.00,180000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000e-0000-4000-8000-0000a200000e','a1000007-0000-4000-8000-0000a1000007','HVT-PHUNHI-357G','8934673200014','Gói 357g','{\"sku\":\"HVT-PHUNHI-357G\"}',280000.00,560000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',357,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200000f-0000-4000-8000-0000a200000f','a1000008-0000-4000-8000-0000a1000008','HVT-ATISO-100G','8934673200015','Gói 100g','{\"sku\":\"HVT-ATISO-100G\"}',45000.00,95000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000010-0000-4000-8000-0000a2000010','a1000008-0000-4000-8000-0000a1000008','HVT-ATISO-200G','8934673200016','Gói 200g','{\"sku\":\"HVT-ATISO-200G\"}',80000.00,165000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000011-0000-4000-8000-0000a2000011','a1000009-0000-4000-8000-0000a1000009','HVT-CUC-50G','8934673200017','Gói 50g','{\"sku\":\"HVT-CUC-50G\"}',35000.00,75000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',50,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000012-0000-4000-8000-0000a2000012','a1000009-0000-4000-8000-0000a1000009','HVT-CUC-100G','8934673200018','Gói 100g','{\"sku\":\"HVT-CUC-100G\"}',65000.00,135000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000013-0000-4000-8000-0000a2000013','a100000a-0000-4000-8000-0000a100000a','HVT-GUNG-100G','8934673200019','Gói 100g','{\"sku\":\"HVT-GUNG-100G\"}',40000.00,85000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000014-0000-4000-8000-0000a2000014','a100000a-0000-4000-8000-0000a100000a','HVT-GUNG-200G','8934673200020','Gói 200g','{\"sku\":\"HVT-GUNG-200G\"}',72000.00,155000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000015-0000-4000-8000-0000a2000015','a100000b-0000-4000-8000-0000a100000b','HVT-MATCHA-50G','8934673200021','Gói 50g','{\"sku\":\"HVT-MATCHA-50G\"}',180000.00,360000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',50,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000016-0000-4000-8000-0000a2000016','a100000b-0000-4000-8000-0000a100000b','HVT-MATCHA-100G','8934673200022','Gói 100g','{\"sku\":\"HVT-MATCHA-100G\"}',340000.00,680000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000017-0000-4000-8000-0000a2000017','a100000c-0000-4000-8000-0000a100000c','HVT-EARL-100G','8934673200023','Gói 100g','{\"sku\":\"HVT-EARL-100G\"}',70000.00,145000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000018-0000-4000-8000-0000a2000018','a100000c-0000-4000-8000-0000a100000c','HVT-EARL-200G','8934673200024','Gói 200g','{\"sku\":\"HVT-EARL-200G\"}',130000.00,270000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000019-0000-4000-8000-0000a2000019','a100000d-0000-4000-8000-0000a100000d','HVT-DAO-100G','8934673200025','Gói 100g','{\"sku\":\"HVT-DAO-100G\"}',55000.00,115000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001a-0000-4000-8000-0000a200001a','a100000d-0000-4000-8000-0000a100000d','HVT-DAO-250G','8934673200026','Gói 250g','{\"sku\":\"HVT-DAO-250G\"}',120000.00,245000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001b-0000-4000-8000-0000a200001b','a100000e-0000-4000-8000-0000a100000e','HVT-CEYLON-100G','8934673200027','Gói 100g','{\"sku\":\"HVT-CEYLON-100G\"}',60000.00,125000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001c-0000-4000-8000-0000a200001c','a100000e-0000-4000-8000-0000a100000e','HVT-CEYLON-250G','8934673200028','Gói 250g','{\"sku\":\"HVT-CEYLON-250G\"}',135000.00,265000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001d-0000-4000-8000-0000a200001d','a100000f-0000-4000-8000-0000a100000f','HVT-NHAI-100G','8934673200029','Gói 100g','{\"sku\":\"HVT-NHAI-100G\"}',70000.00,145000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001e-0000-4000-8000-0000a200001e','a100000f-0000-4000-8000-0000a100000f','HVT-NHAI-250G','8934673200030','Gói 250g','{\"sku\":\"HVT-NHAI-250G\"}',155000.00,305000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a200001f-0000-4000-8000-0000a200001f','a1000010-0000-4000-8000-0000a1000010','HVT-SET-TQ','8934673200031','1 cái','{\"sku\":\"HVT-SET-TQ\"}',320000.00,590000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',0,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000020-0000-4000-8000-0000a2000020','a1000011-0000-4000-8000-0000a1000011','HVT-AM-TUSA','8934673200032','1 cái','{\"sku\":\"HVT-AM-TUSA\"}',180000.00,350000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',0,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000021-0000-4000-8000-0000a2000021','a1000012-0000-4000-8000-0000a1000012','HVT-LY-NGOC','8934673200033','1 cái','{\"sku\":\"HVT-LY-NGOC\"}',45000.00,95000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',0,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000022-0000-4000-8000-0000a2000022','a1000012-0000-4000-8000-0000a1000012','HVT-LY-NGOC-2','8934673200034','2 cái','{\"sku\":\"HVT-LY-NGOC-2\"}',80000.00,165000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',0,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000023-0000-4000-8000-0000a2000023','a1000013-0000-4000-8000-0000a1000013','HVT-OL-NS-100G','8934673200035','Gói 100g','{\"sku\":\"HVT-OL-NS-100G\"}',150000.00,295000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000024-0000-4000-8000-0000a2000024','a1000013-0000-4000-8000-0000a1000013','HVT-OL-NS-200G','8934673200036','Gói 200g','{\"sku\":\"HVT-OL-NS-200G\"}',280000.00,545000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',200,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000025-0000-4000-8000-0000a2000025','a1000014-0000-4000-8000-0000a1000014','HVT-TN-DB-100G','8934673200037','Gói 100g','{\"sku\":\"HVT-TN-DB-100G\"}',85000.00,170000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',100,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000026-0000-4000-8000-0000a2000026','a1000014-0000-4000-8000-0000a1000014','HVT-TN-DB-250G','8934673200038','Gói 250g','{\"sku\":\"HVT-TN-DB-250G\"}',190000.00,365000.00,5,300,1,1,1,NULL,'2026-07-30 17:11:06.639633','2026-07-30 17:56:54.149021',0,'2026-07-30 17:30:24.948410',250,NULL,1.0000,0,0,NULL,1,0,0,0,0.0000,0.0000,NULL),('a2000027-0000-4000-8000-0000a2000027','a1000015-0000-4000-8000-0000a1000015','NL-TRAXANH-1KG','8934673300039','1kg','{\"sku\":\"NL-TRAXANH-1KG\"}',125.00,180.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:26:41.285559','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000028-0000-4000-8000-0000a2000028','a1000016-0000-4000-8000-0000a1000016','NL-OLONG-1KG','8934673300040','1kg','{\"sku\":\"NL-OLONG-1KG\"}',98.00,150.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:26:41.285559','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000029-0000-4000-8000-0000a2000029','a1000017-0000-4000-8000-0000a1000017','NL-HOASEN-1KG','8934673300041','1kg','{\"sku\":\"NL-HOASEN-1KG\"}',360.00,520.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:26:41.285559','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002a-0000-4000-8000-0000a200002a','a1000018-0000-4000-8000-0000a1000018','NL-HOALAI-1KG','8934673300042','1kg','{\"sku\":\"NL-HOALAI-1KG\"}',280.00,400.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002b-0000-4000-8000-0000a200002b','a1000019-0000-4000-8000-0000a1000019','NL-DUONGPHEN-1KG','8934673300043','1kg','{\"sku\":\"NL-DUONGPHEN-1KG\"}',28.00,45.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002c-0000-4000-8000-0000a200002c','a100001a-0000-4000-8000-0000a100001a','NL-ATISO-1KG','8934673300044','1kg','{\"sku\":\"NL-ATISO-1KG\"}',85.00,130.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002d-0000-4000-8000-0000a200002d','a100001b-0000-4000-8000-0000a100001b','NL-SHAN-1KG','8934673300045','1kg','{\"sku\":\"NL-SHAN-1KG\"}',210.00,300.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002e-0000-4000-8000-0000a200002e','a100001c-0000-4000-8000-0000a100001c','NL-PHUNHI-1KG','8934673300046','1kg','{\"sku\":\"NL-PHUNHI-1KG\"}',75.00,110.00,20000,2000000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.459895',0,'2026-08-02 20:55:50.779867',1,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a200002f-0000-4000-8000-0000a200002f','a100001d-0000-4000-8000-0000a100001d','BB-ZIP-100','8934673400047','Theo chiếc','{\"sku\":\"BB-ZIP-100\"}',800.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000030-0000-4000-8000-0000a2000030','a100001e-0000-4000-8000-0000a100001e','BB-ZIP-250','8934673400048','Theo chiếc','{\"sku\":\"BB-ZIP-250\"}',1200.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000031-0000-4000-8000-0000a2000031','a100001f-0000-4000-8000-0000a100001f','BB-HOP-NHO','8934673400049','Theo chiếc','{\"sku\":\"BB-HOP-NHO\"}',3500.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000032-0000-4000-8000-0000a2000032','a1000020-0000-4000-8000-0000a1000020','BB-TEM','8934673400050','Theo chiếc','{\"sku\":\"BB-TEM\"}',200.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000033-0000-4000-8000-0000a2000033','a1000021-0000-4000-8000-0000a1000021','BB-NILON','8934673400051','Theo chiếc','{\"sku\":\"BB-NILON\"}',150.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('a2000034-0000-4000-8000-0000a2000034','a1000022-0000-4000-8000-0000a1000022','BB-HOP-LON','8934673400052','Theo chiếc','{\"sku\":\"BB-HOP-LON\"}',12000.00,0.00,50,5000,0,0,1,NULL,'2026-07-30 17:11:06.639633','2026-08-03 01:40:04.000000',0,'2026-08-02 20:55:50.779867',0,NULL,1.0000,0,0,NULL,1,1,0,0,0.0000,0.0000,NULL),('c6250087-30f0-47e7-a925-0416589a1bb8','a91fae7b-989b-41e4-9668-2283d720a9b7','NGUYEN-LIEU-SAN-XUAT-G',NULL,'Nguyên Liệu Sản Xuất - g','{}',0.00,10000.00,50,NULL,1,1,1,NULL,'2026-07-21 02:53:19.080373','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526',0,NULL,1.0000,1,1,'g',1,1,0,0,0.0000,0.0000,NULL),('f4bceb36-e146-4ef1-a9e3-45a70036d3ff','1fd9ce79-a91c-4a07-8049-8774d962a769','TRA-HOA-NHAI-001-HOP',NULL,'Trà Hoa Nhài 001 - hộp','{}',0.00,500000.00,0,NULL,1,1,1,NULL,'2026-07-21 03:59:29.247532','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526',0,NULL,1.0000,1,1,'hộp',1,0,0,1,0.0000,0.0000,NULL);
/*!40000 ALTER TABLE `ProductVariants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Products`
--

DROP TABLE IF EXISTS `Products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Products` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CategoryId` int NOT NULL,
  `Name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Origin` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `FlavorProfile` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `BrewingGuide` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `Description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `SyncedToStoreAt` datetime(6) DEFAULT NULL,
  `BaseUnit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'unit',
  `IsVariantParent` tinyint(1) NOT NULL DEFAULT '0',
  `WeightUnit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `WeightValue` decimal(18,4) DEFAULT NULL,
  `ProductType` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'THANH_PHAM',
  `InventoryUnit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Piece',
  PRIMARY KEY (`Id`),
  KEY `IX_Products_CategoryId` (`CategoryId`),
  CONSTRAINT `FK_Products_Categories_CategoryId` FOREIGN KEY (`CategoryId`) REFERENCES `Categories` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Products`
--

LOCK TABLES `Products` WRITE;
/*!40000 ALTER TABLE `Products` DISABLE KEYS */;
INSERT INTO `Products` VALUES ('10000000-0000-0000-0000-000000000001',1,'Trà Sen Tây Hồ','Việt Nam','Thanh tao, hương sen dịu',NULL,'Trà xanh ướp hoa sen Tây Hồ theo phương pháp thủ công truyền thống.',1,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,'2026-07-21 02:25:16.314685','Gói',1,'g',100.0000,'THANH_PHAM','Piece'),('10000000-0000-0000-0000-000000000002',1,'Trà Ô Long Cao Sơn','Việt Nam','Ngọt hậu, hương hoa quả',NULL,'Trà ô long trồng ở vùng núi cao, sao thủ công giữ trọn hương vị.',1,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,'2026-07-21 02:25:16.314685','Gói',1,'g',100.0000,'THANH_PHAM','Piece'),('10000000-0000-0000-0000-000000000003',1,'Hồng Trà Đại Hồng Bào','Trung Quốc','Đậm đà, hậu vị mật ong',NULL,'Hồng trà cao cấp Đại Hồng Bào, vị đậm ấm, thích hợp thưởng thức mùa lạnh.',1,'2026-01-01 00:00:00.000000','2026-07-21 02:25:16.314685',0,'2026-07-21 02:25:16.314685','Gói',0,'g',100.0000,'THANH_PHAM','Piece'),('10000000-0000-0000-0000-000000000011',4,'Trà xanh thô','Thái Nguyên',NULL,NULL,'Búp trà xanh khô nguyên liệu từ vùng chè Thái Nguyên.',0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.461011',1,'2026-07-21 02:25:16.314685','g',0,'kg',1.0000,'NGUYEN_LIEU','Gram'),('10000000-0000-0000-0000-000000000012',5,'Hoa sen khô','Việt Nam',NULL,NULL,'Gạo sen và cánh sen khô dùng ướp hương trà sen.',0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.461011',1,'2026-07-21 02:25:16.314685','g',0,'kg',1.0000,'NGUYEN_LIEU','Gram'),('10000000-0000-0000-0000-000000000013',4,'Lá trà ô long thô','Lâm Đồng',NULL,NULL,'Lá trà ô long thô đã sao sơ, dùng sản xuất trà ô long thành phẩm.',0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.461011',1,'2026-07-21 02:25:16.314685','g',0,'kg',1.0000,'NGUYEN_LIEU','Gram'),('1fd9ce79-a91c-4a07-8049-8774d962a769',1,'Trà Hoa Nhài 001',NULL,NULL,NULL,NULL,1,'2026-07-21 03:59:29.246863','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('272e081d-b3cd-4e65-86fc-6b44498619a1',3,'Nguyên Liệu',NULL,NULL,NULL,NULL,1,'2026-07-21 03:25:24.203041','2026-08-03 01:40:04.000000',0,'2026-07-21 04:23:10.014526','g',1,NULL,NULL,'NGUYEN_LIEU','Gram'),('2de6bc81-18e9-471e-947e-21c9e7939197',6,'Bao Bì',NULL,NULL,NULL,NULL,1,'2026-07-21 03:25:24.191609','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526','cái',1,NULL,NULL,'BAO_BI','Piece'),('7fc81df1-c32f-4e93-8846-eb114c51275b',6,'Bao Bì Đóng Gói',NULL,NULL,NULL,NULL,1,'2026-07-21 02:53:19.029926','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526','cái',1,NULL,NULL,'BAO_BI','Piece'),('a1000001-0000-4000-8000-0000a1000001',9101,'Trà Sen Tây Hồ','Hà Nội','Thanh tao, hương sen',NULL,'Trà xanh ướp hoa sen Tây Hồ thủ công.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000002-0000-4000-8000-0000a1000002',9101,'Trà Ô Long Cao Sơn','Lâm Đồng','Ngọt hậu, hương hoa quả',NULL,'Ô long vùng cao sao thủ công.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000003-0000-4000-8000-0000a1000003',9101,'Trà Shan Tuyết Lào Cai','Lào Cai','Hậu vị ngọt, vị núi',NULL,'Shan tuyết cổ thụ vùng biên.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000004-0000-4000-8000-0000a1000004',9101,'Trà Lài Thái Nguyên','Thái Nguyên','Thơm hoa lài',NULL,'Trà xanh ướp hoa lài tươi.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000005-0000-4000-8000-0000a1000005',9101,'Hồng Trà Đại Hồng Bào','Phúc Kiến','Đậm đà, mật ong',NULL,'Hồng trà cao cấp Đại Hồng Bào.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000006-0000-4000-8000-0000a1000006',9101,'Bạch Trà Bạch Hào Ngân Châm','Phúc Châu','Nhẹ, thanh',NULL,'Bạch trà bạc kim châm.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000007-0000-4000-8000-0000a1000007',9101,'Phổ Nhĩ Chín 2019','Vân Nam','Êm, gỗ già',NULL,'Phổ nhĩ chín lên men 2019.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000008-0000-4000-8000-0000a1000008',9102,'Trà Atiso Đà Lạt','Lâm Đồng','Mát, thảo mộc',NULL,'Atiso sấy lạnh Đà Lạt.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000009-0000-4000-8000-0000a1000009',9102,'Trà Hoa Cúc Chi','Việt Nam','Thơm nhẹ, dịu',NULL,'Hoa cúc chi sấy khô.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000a-0000-4000-8000-0000a100000a',9102,'Trà Gừng Mật Ong','Việt Nam','Ấm, ngọt',NULL,'Gừng sấy phối mật ong.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000b-0000-4000-8000-0000a100000b',9101,'Matcha Uji Grade A','Nhật Bản','Umami, xanh',NULL,'Matcha nghiền đá grade A.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000c-0000-4000-8000-0000a100000c',9101,'Earl Grey Classic','Sri Lanka','Bergamot',NULL,'Trà đen ướp tinh dầu bergamot.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000d-0000-4000-8000-0000a100000d',9101,'Trà Đào Đà Lạt','Lâm Đồng','Đào chín',NULL,'Trà xanh ướp đào Đà Lạt.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000e-0000-4000-8000-0000a100000e',9101,'Trà Đen Ceylon OP','Sri Lanka','Đậm, chát nhẹ',NULL,'Ceylon Orange Pekoe.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a100000f-0000-4000-8000-0000a100000f',9101,'Trà Nhài Long Châu','Việt Nam','Hoa nhài nồng',NULL,'Trà nhài ướp nhiều lần.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000010-0000-4000-8000-0000a1000010',9103,'Set Quà Trà Tứ Quý','Việt Nam',NULL,NULL,'Set 4 loại trà hộp quà.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','cái',0,NULL,NULL,'THANH_PHAM','Piece'),('a1000011-0000-4000-8000-0000a1000011',9104,'Ấm Tử Sa Mini 150ml','Nghi Hưng',NULL,NULL,'Ấm tử sa nhỏ pha trà đơn.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','cái',0,NULL,NULL,'THANH_PHAM','Piece'),('a1000012-0000-4000-8000-0000a1000012',9104,'Ly Sứ Men Ngọc','Việt Nam',NULL,NULL,'Ly sứ men ngọc.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','cái',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000013-0000-4000-8000-0000a1000013',9101,'Trà Ô Long Nhân Sâm','Đài Loan','Nhân sâm, ngọt',NULL,'Ô long phối nhân sâm.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000014-0000-4000-8000-0000a1000014',9101,'Trà Xanh Thái Nguyên Đặc Biệt','Thái Nguyên','Chát nhẹ, hậu ngọt',NULL,'Búp một tôm hai lá.',1,'2026-07-30 17:11:06.639633','2026-07-30 17:30:24.948410',0,'2026-07-30 17:30:24.948410','hộp',1,NULL,NULL,'THANH_PHAM','Piece'),('a1000015-0000-4000-8000-0000a1000015',9106,'Trà xanh thô Thái Nguyên','Thái Nguyên',NULL,NULL,'Búp trà xanh nguyên liệu.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a1000016-0000-4000-8000-0000a1000016',9106,'Lá ô long thô Lâm Đồng','Lâm Đồng',NULL,NULL,'Ô long sao sơ nguyên liệu.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a1000017-0000-4000-8000-0000a1000017',9107,'Hoa sen khô Tây Hồ','Hà Nội',NULL,NULL,'Cánh sen khô ướp trà.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a1000018-0000-4000-8000-0000a1000018',9107,'Hoa lài khô','Việt Nam',NULL,NULL,'Hoa lài sấy dùng ướp.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a1000019-0000-4000-8000-0000a1000019',9107,'Đường phèn hạt','Việt Nam',NULL,NULL,'Đường phèn phụ gia.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a100001a-0000-4000-8000-0000a100001a',9106,'Atiso khô cánh','Đà Lạt',NULL,NULL,'Cánh atiso sấy.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a100001b-0000-4000-8000-0000a100001b',9106,'Búp trà shan tuyết','Lào Cai',NULL,NULL,'Búp shan nguyên liệu.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a100001c-0000-4000-8000-0000a100001c',9106,'Lá phổ nhĩ thô','Vân Nam',NULL,NULL,'Lá phổ nhĩ lên men.',1,'2026-07-30 17:11:06.639633','2026-08-03 02:24:45.461011',0,'2026-08-02 20:55:50.779867','g',0,'g',1000.0000,'NGUYEN_LIEU','Gram'),('a100001d-0000-4000-8000-0000a100001d',9108,'Túi zip kraft 100g',NULL,NULL,NULL,'Túi kraft có zipper.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a100001e-0000-4000-8000-0000a100001e',9108,'Túi zip kraft 250g',NULL,NULL,NULL,'Túi kraft 250g.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a100001f-0000-4000-8000-0000a100001f',9108,'Hộp giấy cứng nhỏ',NULL,NULL,NULL,'Hộp giấy in logo HVT.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a1000020-0000-4000-8000-0000a1000020',9108,'Tem chống giả HVT',NULL,NULL,NULL,'Tem hologram.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a1000021-0000-4000-8000-0000a1000021',9108,'Túi nilon thực phẩm',NULL,NULL,NULL,'Túi lót trong.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a1000022-0000-4000-8000-0000a1000022',9108,'Hộp quà cứng lớn',NULL,NULL,NULL,'Hộp set quà.',1,'2026-07-30 17:11:06.639633','2026-08-02 20:55:50.779867',0,'2026-08-02 20:55:50.779867','cái',0,'cái',1.0000,'BAO_BI','Piece'),('a91fae7b-989b-41e4-9668-2283d720a9b7',3,'Nguyên Liệu Sản Xuất',NULL,NULL,NULL,NULL,1,'2026-07-21 02:53:19.079792','2026-07-21 04:23:10.014526',0,'2026-07-21 04:23:10.014526','g',1,NULL,NULL,'NGUYEN_LIEU','Gram');
/*!40000 ALTER TABLE `Products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `RetailPriceChangeRequests`
--

DROP TABLE IF EXISTS `RetailPriceChangeRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RetailPriceChangeRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `VariantName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CurrentRetailPrice` decimal(18,2) NOT NULL,
  `RequestedRetailPrice` decimal(18,2) NOT NULL,
  `AverageCostPriceAtRequest` decimal(18,2) DEFAULT NULL,
  `Reason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `AdminNote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `RejectReason` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AppliedRetailPrice` decimal(18,2) DEFAULT NULL,
  `AppliedAt` datetime(6) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_RetailPriceChangeRequests_RequestCode` (`RequestCode`),
  KEY `IX_RetailPriceChangeRequests_Status` (`Status`),
  KEY `IX_RetailPriceChangeRequests_SkuId_Status` (`SkuId`,`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `RetailPriceChangeRequests`
--

LOCK TABLES `RetailPriceChangeRequests` WRITE;
/*!40000 ALTER TABLE `RetailPriceChangeRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `RetailPriceChangeRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `__EFMigrationsHistory`
--

DROP TABLE IF EXISTS `__EFMigrationsHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__EFMigrationsHistory` (
  `MigrationId` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductVersion` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`MigrationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__EFMigrationsHistory`
--

LOCK TABLES `__EFMigrationsHistory` WRITE;
/*!40000 ALTER TABLE `__EFMigrationsHistory` DISABLE KEYS */;
INSERT INTO `__EFMigrationsHistory` VALUES ('20260607064136_InitialCreate','8.0.0'),('20260609150000_AddCategoryIsActive','8.0.0'),('20260610120000_AddStoreCatalogSync','8.0.0'),('20260611153640_AddProductManagementSchema','8.0.0'),('20260614092529_AddBrandAttributeNameProductTypeBomLines','8.0.0'),('20260628000000_RemoveProductSkusAddVariantSyncFields','8.0.0'),('20260712120000_AddNewProductApprovalRequests','8.0.0'),('20260717100000_AddInventoryUnitToProducts','8.0.0'),('20260717110000_AddProductCreationRequests','8.0.0'),('20260717120000_AddProductDeletionRequests','8.0.0'),('20260719120000_AddSkuUnitBomComponentAndProductAttributes','8.0.0'),('20260720100000_AddRequiredBaseComponentFlagToBomLines','8.0.0'),('20260728110000_AddProductVariantCapabilities','8.0.0'),('20260729153000_AddSupplierReceiptCostHistory','8.0.0'),('20260729170000_AddRetailPriceHistoryAndCostSequence','8.0.0'),('20260730110000_AddWeightedAverageCostBasis','8.0.0'),('20260730160000_AddRetailPriceChangeRequestsAndNotifications','8.0.0');
/*!40000 ALTER TABLE `__EFMigrationsHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Current Database: `hvt_inventory_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `hvt_inventory_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `hvt_inventory_db`;

--
-- Table structure for table `InventoryLedgerEntries`
--

DROP TABLE IF EXISTS `InventoryLedgerEntries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InventoryLedgerEntries` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `TransactionGroupId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OccurredAtUtc` datetime(6) NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuNameSnapshot` varchar(255) NOT NULL,
  `ProductTypeSnapshot` varchar(30) DEFAULT NULL,
  `InventoryUnitSnapshot` varchar(20) DEFAULT NULL,
  `Location` varchar(20) NOT NULL,
  `QuantityBefore` int NOT NULL,
  `QuantityDelta` int NOT NULL,
  `QuantityAfter` int NOT NULL,
  `TransactionType` varchar(50) NOT NULL,
  `SourceLocation` varchar(20) DEFAULT NULL,
  `DestinationLocation` varchar(20) DEFAULT NULL,
  `ReferenceType` varchar(50) DEFAULT NULL,
  `ReferenceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReferenceCode` varchar(50) DEFAULT NULL,
  `BatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `LotCode` varchar(50) DEFAULT NULL,
  `ActorId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ActorName` varchar(255) DEFAULT NULL,
  `ActorRole` varchar(100) DEFAULT NULL,
  `Reason` varchar(500) DEFAULT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `CorrelationId` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_InventoryLedgerEntries_ActorId` (`ActorId`),
  KEY `IX_InventoryLedgerEntries_BatchId` (`BatchId`),
  KEY `IX_InventoryLedgerEntries_CorrelationId` (`CorrelationId`),
  KEY `IX_InventoryLedgerEntries_Location` (`Location`),
  KEY `IX_InventoryLedgerEntries_OccurredAtUtc` (`OccurredAtUtc`),
  KEY `IX_InventoryLedgerEntries_ReferenceCode` (`ReferenceCode`),
  KEY `IX_InventoryLedgerEntries_SkuCode` (`SkuCode`),
  KEY `IX_InventoryLedgerEntries_SkuId` (`SkuId`),
  KEY `IX_InventoryLedgerEntries_TransactionGroupId` (`TransactionGroupId`),
  KEY `IX_InventoryLedgerEntries_TransactionType` (`TransactionType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InventoryLedgerEntries`
--

LOCK TABLES `InventoryLedgerEntries` WRITE;
/*!40000 ALTER TABLE `InventoryLedgerEntries` DISABLE KEYS */;
INSERT INTO `InventoryLedgerEntries` VALUES ('12f935f3-a2af-40a9-ac7e-00edfa44b2a1','d6161acb-6292-4f41-9cb2-1176d89e22c4','2026-07-31 01:02:06.875431','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt — Gói 100g',NULL,NULL,'Shelf',27,-1,26,'POS_SALE','Shelf',NULL,'Order','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','HVT-260731-001','a300002d-0000-4000-8000-0000a300002d','HVT-SHELF-HVT-ATISO-100G','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','Ban POS HVT-260731-001','Trừ tồn quầy ngay cho đơn hàng HVT-260731-001','f7599a2f-02a7-4eae-9dbe-7a7c4a442726'),('1858bfd0-b274-4a96-9967-5f65407b3ad7','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP','THANH_PHAM','Piece','Warehouse',128,15,143,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','32a35341-b941-4223-9a98-8c7b595efe6c','NCC-LOT-024','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('2860a8a0-a874-4fc9-a1b3-c5dedde6f397','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô','NGUYEN_LIEU','Gram','Warehouse',100000,500000,600000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','83cfba1d-6ec8-4836-9005-f864b75a6d1f','NCC-LOT-006','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('41557bc7-80b2-41e0-9b80-e90347cd838b','14674f26-edd7-4bcf-833a-acebb9bf5446','2026-08-03 03:37:11.179088','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ','BAO_BI','Piece','Warehouse',644,12,656,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','5fa422bf-ab75-4174-8e25-ac5ef4467038','NCC-20260803-0003','5b5002ca-831e-4783-8e0c-f13a12dfe33f','34534534564','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse',NULL,NULL,'5fa422bf-ab75-4174-8e25-ac5ef4467038'),('42e65b95-03fa-4b07-b85f-b84c78b3d26d','892621d1-7d44-464c-a661-357b19feadf7','2026-08-03 04:56:55.065609','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml — 1 cái',NULL,NULL,'Shelf',28,-1,27,'POS_SALE','Shelf',NULL,'Order','a33da7ea-d424-4896-b22f-af6eee19b548','HVT-260803-001','a3000060-0000-4000-8000-0000a3000060','HVT-SHELF-HVT-AM-TUSA','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','Ban POS HVT-260803-001','Trừ tồn quầy ngay cho đơn hàng HVT-260803-001','a33da7ea-d424-4896-b22f-af6eee19b548'),('43be651c-6fa5-4472-9dda-514431c2ece6','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece','Warehouse',144,20,164,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','cc9ba807-8010-40af-a837-1e5adc363bc7','NCC-LOT-023','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('4591690f-adee-45a0-9869-42091d05bd81','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng','NGUYEN_LIEU','Gram','Warehouse',94000,800000,894000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','4ccf9679-9bf4-4d14-9ea3-c544de4bf656','NCC-LOT-005','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('497d8e95-e8e3-4ecb-a1f0-c88be4592fe6','35abc4e2-5cfb-4403-8138-818669f9df5f','2026-08-03 03:34:46.026935','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì','BAO_BI','cái','Warehouse',0,12,12,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','10906710-ce7b-4800-b774-51fb54780366','NCC-20260803-0002','75f542f6-62d4-4dbc-8c3d-9c7a86b48126','4645456','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse',NULL,NULL,'10906710-ce7b-4800-b774-51fb54780366'),('4d9318ee-fcc2-48c7-93ee-5635eb6caee6','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g','BAO_BI','Piece','Warehouse',640,20,660,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','af0a2cae-52c6-49f3-9766-ea880d26cc35','NCC-LOT-016','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('535c3f71-2151-4568-bced-51314c65a94e','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt','THANH_PHAM','Piece','Warehouse',140,12,152,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','dc74dc60-6298-420b-a506-ae65ec764efc','NCC-LOT-020','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('6146012b-0fab-4661-9310-385b5ba4c03b','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt','THANH_PHAM','Piece','Warehouse',140,8,148,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','e926c252-4091-41c2-98c3-33f84457b158','NCC-LOT-021','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('631e3dd1-df0c-4eef-8862-1533ad1a0ec0','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết','NGUYEN_LIEU','Gram','Warehouse',100000,1000000,1100000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','d9e33535-c11c-4183-b4f5-0991cf999f51','NCC-LOT-007','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('65a34259-4bc3-43e2-8fe2-d06d98f4b8f3','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece','Warehouse',144,10,154,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','2ff8a597-ea32-4293-ab76-3156fbe91376','NCC-LOT-022','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('69d4b37b-6584-4ab3-9bc9-dfaf1c74343d','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT','BAO_BI','Piece','Warehouse',650,8,658,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','3a9381e1-5393-4dfb-8db5-32694adcf014','NCC-LOT-014','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('6eabfe4b-e1b5-4293-8ba6-ca5610e3c839','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm','BAO_BI','Piece','Warehouse',654,12,666,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','7936c2fe-19c6-4571-93cc-f65e80f1956d','NCC-LOT-013','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('724e17d9-f3e6-47ea-a611-7026ca5db51e','93397147-4888-4763-896c-6ea998702e6a','2026-07-21 02:45:48.893304','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','Trà xanh thô',NULL,NULL,'Warehouse',150000,-9000,141000,'PRODUCTION_MATERIAL_EXPORT','Warehouse',NULL,'ProductionOrder','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001',NULL,NULL,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','Xuất nguyên liệu cho lệnh sản xuất SX-20260721-0001','Lệnh sản xuất SX-20260721-0001 [quy doi kg->g 2026-08-03]','e01b64fc-25d8-49d5-a598-2784a448e1aa'),('75fcb9ec-ea92-41ae-9980-f61fb8643272','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô','NGUYEN_LIEU','Gram','Warehouse',96000,2000000,2096000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','fb1421db-060b-46e7-bb70-5814d5a3b746','NCC-LOT-003','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('78b3f77f-5543-445b-ae47-b53a4ab2224d','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml','THANH_PHAM','Piece','Warehouse',124,25,149,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','9f89929a-a697-4cde-a8c0-3cd896d47a01','NCC-LOT-019','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('8d974c9d-522f-4b09-b79e-3a870afc295e','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ','NGUYEN_LIEU','Gram','Warehouse',96000,1500000,1596000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','d6fafaec-4724-4195-a6ea-7f63fa0c90a4','NCC-LOT-004','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất','Đạt có ghi chú: hơi ẩm nhẹ, đã kiểm tra cảm quan','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('9f53f507-af5f-45fa-8389-7de9a5efa272','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ','BAO_BI','Piece','Warehouse',656,25,681,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','166f6753-cae7-4058-8f91-748c79c6ac98','NCC-LOT-012','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('a0bf23c1-1ba2-4ec0-bede-d93d6bfed3f4','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn','BAO_BI','Piece','Warehouse',660,30,690,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','095adead-a995-4b82-8b5b-76856897bc5e','NCC-LOT-011','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('af4c9d3e-8ff7-4f90-bcc6-a7a253b6f112','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g','BAO_BI','Piece','Warehouse',634,10,644,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','a752280d-39b5-4dd4-9613-7f9e2f2f3450','NCC-LOT-015','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('ba185f57-009a-4ef3-878b-6fdd3877f23f','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi','THANH_PHAM','Piece','Warehouse',138,12,150,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','872a2b71-c8c9-4a11-a46d-4499ff5274b2','NCC-LOT-027','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('c08540a6-c433-4702-aec6-f433f83b9a82','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên','NGUYEN_LIEU','Gram','Warehouse',94000,2000000,2094000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','d01ce800-fb9c-4876-a6b2-5d1ad063f00b','NCC-LOT-008','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('c1f09bce-c642-49c6-9ed6-1781b4521091','93397147-4888-4763-896c-6ea998702e6a','2026-07-21 02:45:48.932413','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ',NULL,NULL,'Shelf',40,100,100,'PRODUCTION_FINISHED_RECEIPT',NULL,'Shelf','ProductionOrder','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001','302b784c-d847-4d26-b6cb-a8ba34f628d9','SX-20260721024548-01-E01B64','eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','Nhập thành phẩm từ lệnh sản xuất SX-20260721-0001','TRA-SEN-100G','e01b64fc-25d8-49d5-a598-2784a448e1aa'),('cc75976b-44b8-4551-a8a3-ecb7cabeb12f','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt','NGUYEN_LIEU','Gram','Warehouse',98000,1000000,1098000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','395e419f-4fdb-4f4f-bdf6-406bffb45380','NCC-LOT-002','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('ccce56c7-9ee5-40e4-a435-25881ff3d4fe','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP','THANH_PHAM','Piece','Warehouse',128,30,158,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','5cab4e6e-6a97-43ad-97ed-05045a4cef08','NCC-LOT-025','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('d4022209-f9d8-4c49-87b2-8354e5cc253f','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh','NGUYEN_LIEU','Gram','Warehouse',98000,500000,598000,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','693a0e5a-d3b4-4116-b559-c5f89d713ae0','NCC-LOT-001','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất','Đạt — bao bì nguyên vẹn','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('d9bce1f7-3c66-44ff-9ceb-dda95d4e18d2','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt','THANH_PHAM','Piece','Warehouse',130,8,138,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','bcbc5c0f-e433-4588-a479-f0cea01bc204','NCC-LOT-028','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('dfc0667a-6f77-475c-b782-f15ff12985f2','8467fd9f-c28b-4e51-8a61-990f96e6b721','2026-08-03 04:48:29.588034','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi','THANH_PHAM','Piece','Warehouse',138,25,163,'SUPPLIER_RECEIPT','Supplier','Warehouse','SupplierReceipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','61dfb76a-1419-498d-895d-22ef24b89d48','NCC-LOT-026','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất',NULL,'c6be8d6a-1d9b-4f62-9890-9e22bd637c3f'),('e4c2acfb-d4a6-4d37-99af-95246e5d5b2b','71c5a8c7-5a68-4373-a01d-f5597fbb205e','2026-08-03 04:52:26.586974','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml','THANH_PHAM','Piece','Shelf',29,-1,28,'STOCKTAKE_ADJUSTMENT',NULL,NULL,'Stocktake','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','KK-20260803-0001','a3000060-0000-4000-8000-0000a3000060','HVT-SHELF-HVT-AM-TUSA','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','Tran Thi Manager','Manager','Duyệt kiểm kê','PX-20260803-0001','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8'),('e50b46b3-f610-4f1c-9e51-fc31cc9995d4','93397147-4888-4763-896c-6ea998702e6a','2026-07-21 02:45:48.884346','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','Hoa sen khô',NULL,NULL,'Warehouse',60000,-2000,58000,'PRODUCTION_MATERIAL_EXPORT','Warehouse',NULL,'ProductionOrder','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001',NULL,NULL,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','Xuất nguyên liệu cho lệnh sản xuất SX-20260721-0001','Lệnh sản xuất SX-20260721-0001 [quy doi kg->g 2026-08-03]','e01b64fc-25d8-49d5-a598-2784a448e1aa');
/*!40000 ALTER TABLE `InventoryLedgerEntries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `InventoryOutboxMessages`
--

DROP TABLE IF EXISTS `InventoryOutboxMessages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InventoryOutboxMessages` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `EventType` varchar(200) NOT NULL,
  `AggregateId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(20) NOT NULL DEFAULT 'Pending',
  `RetryCount` int NOT NULL DEFAULT '0',
  `OccurredAtUtc` datetime(6) NOT NULL,
  `LastAttemptAtUtc` datetime(6) DEFAULT NULL,
  `NextAttemptAtUtc` datetime(6) NOT NULL,
  `LockedUntilUtc` datetime(6) DEFAULT NULL,
  `LockedBy` varchar(200) DEFAULT NULL,
  `PublishedAtUtc` datetime(6) DEFAULT NULL,
  `LastError` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_InventoryOutboxMessages_EventType_SourceId` (`EventType`,`SourceId`),
  KEY `IX_InventoryOutboxMessages_AggregateId_EventType` (`AggregateId`,`EventType`),
  KEY `IX_InventoryOutboxMessages_LockedUntilUtc` (`LockedUntilUtc`),
  KEY `IX_InventoryOutboxMessages_OccurredAtUtc` (`OccurredAtUtc`),
  KEY `IX_InventoryOutboxMessages_Status_NextAttemptAtUtc` (`Status`,`NextAttemptAtUtc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InventoryOutboxMessages`
--

LOCK TABLES `InventoryOutboxMessages` WRITE;
/*!40000 ALTER TABLE `InventoryOutboxMessages` DISABLE KEYS */;
INSERT INTO `InventoryOutboxMessages` VALUES ('0c65a9d0-38db-4295-adae-5e3d3c333b72','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','cafa2f16-e36c-4dc8-ab4c-48c9f1a1e2af','{\"eventId\":\"0c65a9d0-38db-4295-adae-5e3d3c333b72\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"cafa2f16-e36c-4dc8-ab4c-48c9f1a1e2af\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200000b-0000-4000-8000-0000a200000b\",\"skuCode\":\"HVT-BACH-50G\",\"actualQuantity\":20,\"unitCost\":75000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991775','2026-08-03 04:48:30.951100','2026-08-03 04:48:29.991775',NULL,NULL,'2026-08-03 04:48:30.951100',NULL),('0c71d9f6-c4bf-4f31-b4a6-0e20ecb63b6d','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','0302cb29-6996-44a6-b0cc-34fd6eb3eafe','{\"eventId\":\"0c71d9f6-c4bf-4f31-b4a6-0e20ecb63b6d\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"0302cb29-6996-44a6-b0cc-34fd6eb3eafe\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000034-0000-4000-8000-0000a2000034\",\"skuCode\":\"BB-HOP-LON\",\"actualQuantity\":30,\"unitCost\":3500,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991717','2026-08-03 04:48:30.769396','2026-08-03 04:48:29.991717',NULL,NULL,'2026-08-03 04:48:30.769396',NULL),('12542cc9-4a00-4115-8ebe-f88b3f8b989f','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','10906710-ce7b-4800-b774-51fb54780366','e28548b1-82ee-456a-8441-6fabe2220deb','{\"eventId\":\"12542cc9-4a00-4115-8ebe-f88b3f8b989f\",\"supplierReceiptId\":\"10906710-ce7b-4800-b774-51fb54780366\",\"supplierReceiptLineId\":\"e28548b1-82ee-456a-8441-6fabe2220deb\",\"receiptCode\":\"NCC-20260803-0002\",\"approvedAt\":\"2026-08-03T03:34:46.0269357Z\",\"skuId\":\"953f58df-3312-4217-b1a1-47bf7b830619\",\"skuCode\":\"BAO-BI-CAI\",\"actualQuantity\":12,\"unitCost\":10000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 03:34:46.332191','2026-08-03 03:34:47.312613','2026-08-03 03:34:46.332191',NULL,NULL,'2026-08-03 03:34:47.312613',NULL),('1a8e476f-cf76-4c7d-bab3-745a590fca17','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','7f5af7ea-a3e7-4bf2-bb18-0bd402504d91','{\"eventId\":\"1a8e476f-cf76-4c7d-bab3-745a590fca17\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"7f5af7ea-a3e7-4bf2-bb18-0bd402504d91\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000030-0000-4000-8000-0000a2000030\",\"skuCode\":\"BB-ZIP-250\",\"actualQuantity\":20,\"unitCost\":500,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991748','2026-08-03 04:48:30.865568','2026-08-03 04:48:29.991748',NULL,NULL,'2026-08-03 04:48:30.865568',NULL),('2d2ba9eb-75a9-4e9e-b5b7-18b8575d75ae','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','e9f3d2a3-7c36-4b92-9da0-3f8501d67ecf','{\"eventId\":\"2d2ba9eb-75a9-4e9e-b5b7-18b8575d75ae\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"e9f3d2a3-7c36-4b92-9da0-3f8501d67ecf\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002f-0000-4000-8000-0000a200002f\",\"skuCode\":\"BB-ZIP-100\",\"actualQuantity\":10,\"unitCost\":1500,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991744','2026-08-03 04:48:30.850490','2026-08-03 04:48:29.991744',NULL,NULL,'2026-08-03 04:48:30.850490',NULL),('2d8e9877-fec7-4643-8327-07ae9563552f','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','5fa422bf-ab75-4174-8e25-ac5ef4467038','90890d51-8910-41ae-b6c2-4bfec96d9fae','{\"eventId\":\"2d8e9877-fec7-4643-8327-07ae9563552f\",\"supplierReceiptId\":\"5fa422bf-ab75-4174-8e25-ac5ef4467038\",\"supplierReceiptLineId\":\"90890d51-8910-41ae-b6c2-4bfec96d9fae\",\"receiptCode\":\"NCC-20260803-0003\",\"approvedAt\":\"2026-08-03T03:37:11.1790881Z\",\"skuId\":\"a2000031-0000-4000-8000-0000a2000031\",\"skuCode\":\"BB-HOP-NHO\",\"actualQuantity\":12,\"unitCost\":12,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 03:37:11.195838','2026-08-03 03:37:11.492257','2026-08-03 03:37:11.195838',NULL,NULL,'2026-08-03 03:37:11.492257',NULL),('3207dda2-42e7-4084-99c2-c3a192d7be46','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','5967018b-5dd6-4c8b-b78e-31b9493f0822','{\"eventId\":\"3207dda2-42e7-4084-99c2-c3a192d7be46\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"5967018b-5dd6-4c8b-b78e-31b9493f0822\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000011-0000-4000-8000-0000a2000011\",\"skuCode\":\"HVT-CUC-50G\",\"actualQuantity\":12,\"unitCost\":95000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991793','2026-08-03 04:48:31.015574','2026-08-03 04:48:29.991793',NULL,NULL,'2026-08-03 04:48:31.015574',NULL),('3e6ac2b1-1fdc-41a1-98e6-d4b084a3ca60','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','ef0e8e96-9b01-499e-ae6d-8e157e3b59a7','{\"eventId\":\"3e6ac2b1-1fdc-41a1-98e6-d4b084a3ca60\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"ef0e8e96-9b01-499e-ae6d-8e157e3b59a7\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000028-0000-4000-8000-0000a2000028\",\"skuCode\":\"NL-OLONG-1KG\",\"actualQuantity\":800,\"unitCost\":90,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991697','2026-08-03 04:48:30.689162','2026-08-03 04:48:29.991697',NULL,NULL,'2026-08-03 04:48:30.689162',NULL),('42a373df-ca1f-4451-929a-658767fdb500','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','89e63cb2-8ba4-4cf4-b347-724cc6cc5172','{\"eventId\":\"42a373df-ca1f-4451-929a-658767fdb500\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"89e63cb2-8ba4-4cf4-b347-724cc6cc5172\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000027-0000-4000-8000-0000a2000027\",\"skuCode\":\"NL-TRAXANH-1KG\",\"actualQuantity\":2000,\"unitCost\":150,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991713','2026-08-03 04:48:30.749163','2026-08-03 04:48:29.991713',NULL,NULL,'2026-08-03 04:48:30.749163',NULL),('4535692b-cf39-4131-ab9e-a4199767b3b9','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','2fe5ef63-246e-413a-aa13-540cf6bf69c9','{\"eventId\":\"4535692b-cf39-4131-ab9e-a4199767b3b9\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"2fe5ef63-246e-413a-aa13-540cf6bf69c9\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200001c-0000-4000-8000-0000a200001c\",\"skuCode\":\"HVT-CEYLON-250G\",\"actualQuantity\":30,\"unitCost\":85000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991783','2026-08-03 04:48:30.988461','2026-08-03 04:48:29.991783',NULL,NULL,'2026-08-03 04:48:30.988461',NULL),('60fb58df-80af-412d-8b7a-f39d6a7aa760','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','dc740d0e-92f1-4115-bddc-bc6ff2fa5143','{\"eventId\":\"60fb58df-80af-412d-8b7a-f39d6a7aa760\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"dc740d0e-92f1-4115-bddc-bc6ff2fa5143\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200000c-0000-4000-8000-0000a200000c\",\"skuCode\":\"HVT-BACH-100G\",\"actualQuantity\":10,\"unitCost\":150000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991766','2026-08-03 04:48:30.930194','2026-08-03 04:48:29.991766',NULL,NULL,'2026-08-03 04:48:30.930194',NULL),('63468102-2cdd-4110-ad1d-b552d656a963','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','c216ccff-42ef-4965-b284-49153577cd35','{\"eventId\":\"63468102-2cdd-4110-ad1d-b552d656a963\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"c216ccff-42ef-4965-b284-49153577cd35\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000010-0000-4000-8000-0000a2000010\",\"skuCode\":\"HVT-ATISO-200G\",\"actualQuantity\":8,\"unitCost\":95000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991762','2026-08-03 04:48:30.913792','2026-08-03 04:48:29.991762',NULL,NULL,'2026-08-03 04:48:30.913792',NULL),('685480fe-0b8f-48fa-aada-a9f9a219d0a4','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','5dee5cf5-94fe-43f4-b9dd-26008cb1886d','{\"eventId\":\"685480fe-0b8f-48fa-aada-a9f9a219d0a4\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"5dee5cf5-94fe-43f4-b9dd-26008cb1886d\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000020-0000-4000-8000-0000a2000020\",\"skuCode\":\"HVT-AM-TUSA\",\"actualQuantity\":25,\"unitCost\":85000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991754','2026-08-03 04:48:30.882308','2026-08-03 04:48:29.991754',NULL,NULL,'2026-08-03 04:48:30.882308',NULL),('722d9998-7a0f-48d9-b76f-3adf9c45a1d5','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','12641583-ef99-4912-b85a-a64751496ae3','{\"eventId\":\"722d9998-7a0f-48d9-b76f-3adf9c45a1d5\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"12641583-ef99-4912-b85a-a64751496ae3\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002b-0000-4000-8000-0000a200002b\",\"skuCode\":\"NL-DUONGPHEN-1KG\",\"actualQuantity\":1000,\"unitCost\":220,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991558','2026-08-03 04:48:30.646728','2026-08-03 04:48:29.991558',NULL,NULL,'2026-08-03 04:48:30.646728',NULL),('83a18dea-def7-4c9c-819b-4bd6e78b01e1','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','8e7868c9-200d-487e-939e-e18e9de498ed','{\"eventId\":\"83a18dea-def7-4c9c-819b-4bd6e78b01e1\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"8e7868c9-200d-487e-939e-e18e9de498ed\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000012-0000-4000-8000-0000a2000012\",\"skuCode\":\"HVT-CUC-100G\",\"actualQuantity\":25,\"unitCost\":120000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991789','2026-08-03 04:48:31.001472','2026-08-03 04:48:29.991789',NULL,NULL,'2026-08-03 04:48:31.001472',NULL),('9e0061ba-4d52-46f1-a2d1-d526149d18b9','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','9d0b0870-1586-4ccf-a0ee-7615a621af98','{\"eventId\":\"9e0061ba-4d52-46f1-a2d1-d526149d18b9\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"9d0b0870-1586-4ccf-a0ee-7615a621af98\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002c-0000-4000-8000-0000a200002c\",\"skuCode\":\"NL-ATISO-1KG\",\"actualQuantity\":500,\"unitCost\":180,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.977466','2026-08-03 04:48:30.631213','2026-08-03 04:48:29.977466',NULL,NULL,'2026-08-03 04:48:30.631213',NULL),('a33b585c-bafc-475f-b49d-fac760bc9b15','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','1515e560-1465-4317-b211-96f774e28a3b','{\"eventId\":\"a33b585c-bafc-475f-b49d-fac760bc9b15\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"1515e560-1465-4317-b211-96f774e28a3b\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000029-0000-4000-8000-0000a2000029\",\"skuCode\":\"NL-HOASEN-1KG\",\"actualQuantity\":1500,\"unitCost\":350,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991686','2026-08-03 04:48:30.673993','2026-08-03 04:48:29.991686',NULL,NULL,'2026-08-03 04:48:30.673993',NULL),('a693e475-d575-4f47-bc40-41195da75704','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a958863e-9961-4784-b3d1-8718c81908f9','{\"eventId\":\"a693e475-d575-4f47-bc40-41195da75704\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"a958863e-9961-4784-b3d1-8718c81908f9\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000031-0000-4000-8000-0000a2000031\",\"skuCode\":\"BB-HOP-NHO\",\"actualQuantity\":25,\"unitCost\":4500,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991727','2026-08-03 04:48:30.790478','2026-08-03 04:48:29.991727',NULL,NULL,'2026-08-03 04:48:30.790478',NULL),('baf8d505-11b7-48ee-9862-6bb182c60637','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','aacb736d-ee8d-410f-85c7-dda29e71eaa3','{\"eventId\":\"baf8d505-11b7-48ee-9862-6bb182c60637\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"aacb736d-ee8d-410f-85c7-dda29e71eaa3\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000019-0000-4000-8000-0000a2000019\",\"skuCode\":\"HVT-DAO-100G\",\"actualQuantity\":8,\"unitCost\":150000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991799','2026-08-03 04:48:31.029408','2026-08-03 04:48:29.991799',NULL,NULL,'2026-08-03 04:48:31.029408',NULL),('bbd374b3-3632-43ea-b96a-8ffc94ffabd4','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','44fac655-8ecd-44df-a83a-d2d349a3cc9f','{\"eventId\":\"bbd374b3-3632-43ea-b96a-8ffc94ffabd4\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"44fac655-8ecd-44df-a83a-d2d349a3cc9f\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002d-0000-4000-8000-0000a200002d\",\"skuCode\":\"NL-SHAN-1KG\",\"actualQuantity\":1000,\"unitCost\":220,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991708','2026-08-03 04:48:30.731809','2026-08-03 04:48:29.991708',NULL,NULL,'2026-08-03 04:48:30.731809',NULL),('d88f954e-1bfa-4b0b-9643-1bda6cc89700','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','4f7168f0-2fa3-4843-9f1e-8987da0d8153','{\"eventId\":\"d88f954e-1bfa-4b0b-9643-1bda6cc89700\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"4f7168f0-2fa3-4843-9f1e-8987da0d8153\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000033-0000-4000-8000-0000a2000033\",\"skuCode\":\"BB-NILON\",\"actualQuantity\":12,\"unitCost\":2500,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991732','2026-08-03 04:48:30.814175','2026-08-03 04:48:29.991732',NULL,NULL,'2026-08-03 04:48:30.814175',NULL),('dcbead7b-3197-46ae-9f42-b051eda16e52','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','da0aa638-d1d7-4942-a9b7-d767b23a999f','{\"eventId\":\"dcbead7b-3197-46ae-9f42-b051eda16e52\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"da0aa638-d1d7-4942-a9b7-d767b23a999f\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200001b-0000-4000-8000-0000a200001b\",\"skuCode\":\"HVT-CEYLON-100G\",\"actualQuantity\":15,\"unitCost\":210000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991779','2026-08-03 04:48:30.966161','2026-08-03 04:48:29.991779',NULL,NULL,'2026-08-03 04:48:30.966161',NULL),('e1580afc-a821-4018-97da-e5ca58e51ee0','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','c953b48c-fbeb-4d7f-a9d8-0e76e70a25a0','{\"eventId\":\"e1580afc-a821-4018-97da-e5ca58e51ee0\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"c953b48c-fbeb-4d7f-a9d8-0e76e70a25a0\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002a-0000-4000-8000-0000a200002a\",\"skuCode\":\"NL-HOALAI-1KG\",\"actualQuantity\":2000,\"unitCost\":150,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991671','2026-08-03 04:48:30.661328','2026-08-03 04:48:29.991671',NULL,NULL,'2026-08-03 04:48:30.661328',NULL),('e80a1594-d253-4876-91a3-b13cd121fa01','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','29fc7729-2fe7-4159-8529-35a3a1b3cf78','{\"eventId\":\"e80a1594-d253-4876-91a3-b13cd121fa01\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"29fc7729-2fe7-4159-8529-35a3a1b3cf78\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200000f-0000-4000-8000-0000a200000f\",\"skuCode\":\"HVT-ATISO-100G\",\"actualQuantity\":12,\"unitCost\":120000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991758','2026-08-03 04:48:30.898365','2026-08-03 04:48:29.991758',NULL,NULL,'2026-08-03 04:48:30.898365',NULL),('ebfeacc5-f8a6-4df8-904a-f7127ca27a63','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','3971f49d-6f97-4686-8a27-7a2f24a1786e','{\"eventId\":\"ebfeacc5-f8a6-4df8-904a-f7127ca27a63\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"3971f49d-6f97-4686-8a27-7a2f24a1786e\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a200002e-0000-4000-8000-0000a200002e\",\"skuCode\":\"NL-PHUNHI-1KG\",\"actualQuantity\":500,\"unitCost\":180,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991702','2026-08-03 04:48:30.706101','2026-08-03 04:48:29.991702',NULL,NULL,'2026-08-03 04:48:30.706101',NULL),('ee2f2c22-c8d0-46bd-be7d-e65d4ad4b800','HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','f32018bd-9531-4ccb-a365-9f928bdc3625','{\"eventId\":\"ee2f2c22-c8d0-46bd-be7d-e65d4ad4b800\",\"supplierReceiptId\":\"c6be8d6a-1d9b-4f62-9890-9e22bd637c3f\",\"supplierReceiptLineId\":\"f32018bd-9531-4ccb-a365-9f928bdc3625\",\"receiptCode\":\"NCC-20260803-0004\",\"approvedAt\":\"2026-08-03T04:48:29.5880342Z\",\"skuId\":\"a2000032-0000-4000-8000-0000a2000032\",\"skuCode\":\"BB-TEM\",\"actualQuantity\":8,\"unitCost\":8000,\"receiptLineOrder\":1,\"receiptSkuLineCount\":1}','Published',0,'2026-08-03 04:48:29.991739','2026-08-03 04:48:30.833702','2026-08-03 04:48:29.991739',NULL,NULL,'2026-08-03 04:48:30.833702',NULL);
/*!40000 ALTER TABLE `InventoryOutboxMessages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProcessedIntegrationEvents`
--

DROP TABLE IF EXISTS `ProcessedIntegrationEvents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProcessedIntegrationEvents` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `EventType` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CorrelationId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProcessedAt` datetime(6) NOT NULL,
  `EventId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProcessedIntegrationEvents_EventType_CorrelationId` (`EventType`,`CorrelationId`),
  UNIQUE KEY `IX_ProcessedIntegrationEvents_EventId` (`EventId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProcessedIntegrationEvents`
--

LOCK TABLES `ProcessedIntegrationEvents` WRITE;
/*!40000 ALTER TABLE `ProcessedIntegrationEvents` DISABLE KEYS */;
INSERT INTO `ProcessedIntegrationEvents` VALUES ('149a57d5-0313-459f-a561-70eac573a6b4','SkuCreated','f4bceb36-e146-4ef1-a9e3-45a70036d3ff','2026-07-21 04:23:10.091906',NULL),('1760978f-6744-4934-be85-99d2b2b960d0','SkuCreated','20000000-0000-0000-0000-000000000012','2026-07-21 02:25:16.806598',NULL),('1beb73b0-f564-4553-b585-bc9a8f13d7bf','OrderPlaced','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','2026-07-26 14:22:11.013296',NULL),('1e008b7b-20ca-4865-baa2-17e591ef6652','SkuCreated','a2000028-0000-4000-8000-0000a2000028','2026-08-02 20:55:51.303154',NULL),('27a88a7a-ed44-4278-bdbc-ee0c2bc7d0fc','SkuCreated','a2000033-0000-4000-8000-0000a2000033','2026-08-02 20:55:51.303255',NULL),('36a11102-c6bf-4f6b-922f-6c0cc35904d3','SkuCreated','a200002b-0000-4000-8000-0000a200002b','2026-08-02 20:55:51.303179',NULL),('39dda972-9322-4511-a9dd-46059a76fe2e','SkuCreated','a200002d-0000-4000-8000-0000a200002d','2026-08-02 20:55:51.303262',NULL),('45d5b4ea-13cf-4064-b577-8b1314089034','SkuCreated','a200002f-0000-4000-8000-0000a200002f','2026-08-02 20:55:51.303207',NULL),('5398d326-241c-4611-97a3-11222252832f','SkuCreated','20000000-0000-0000-0000-000000000013','2026-07-21 02:25:16.829765',NULL),('63d886a9-2ac4-4d96-be28-4cedaa76490a','SkuCreated','953f58df-3312-4217-b1a1-47bf7b830619','2026-07-21 04:23:10.091885',NULL),('6f971988-0707-4941-9f31-d3b9bc4cf89f','SkuCreated','a200002c-0000-4000-8000-0000a200002c','2026-08-02 20:55:51.303188',NULL),('7d574ae8-d9b1-47fe-b236-08e37cea9fed','SkuCreated','c6250087-30f0-47e7-a925-0416589a1bb8','2026-07-21 04:23:10.091865',NULL),('915ddc38-e912-426a-85c7-9f3c2aa58632','OrderCancelled','03fef9d3-67a3-4d00-aacd-80188845ba0e','2026-07-31 01:02:30.508117','a88c1cd4-6e30-4fbc-b676-aaf386052bdc'),('9fafae77-72c2-4577-b8a0-e5ad7381de1b','SkuCreated','02575cb5-719e-43e2-a4fd-c70f1c1860f1','2026-07-21 04:23:10.091896',NULL),('a1505e24-ba49-427c-a878-08f0f2c709ff','SkuCreated','6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','2026-07-21 04:23:10.091865',NULL),('a6d67671-1c44-47ff-93a6-55f35c33d6a0','SkuCreated','a2000029-0000-4000-8000-0000a2000029','2026-08-02 20:55:51.303210',NULL),('ab2bbe98-8dc9-4001-9ca1-db6390a05ae7','SkuCreated','a2000030-0000-4000-8000-0000a2000030','2026-08-02 20:55:51.303162',NULL),('b04fe4ad-ae63-48fa-b55d-d38c39d1dd2d','SkuCreated','20000000-0000-0000-0000-000000000011','2026-07-21 02:25:16.830153',NULL),('bc6e376e-67ab-4605-9fb3-bd957caa5c09','OrderCancelled','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','2026-07-31 01:51:59.564260','0855f122-83eb-4f24-af7a-241a4c164444'),('c688d726-1a67-446a-86c4-24b973e8caee','SkuCreated','a2000032-0000-4000-8000-0000a2000032','2026-08-02 20:55:51.303222',NULL),('ca7bc9f3-de3a-44c9-8f53-11a555fef510','OrderCancelled','7f27c059-1415-4802-b831-fcc243a6098f','2026-07-31 01:55:45.749273','89fe5ca5-ee52-4b94-8ec0-352e0ae847b9'),('d18e4784-0129-48bf-8903-e62bb95557af','SkuCreated','a2000027-0000-4000-8000-0000a2000027','2026-08-02 20:55:51.303155',NULL),('e1ae76aa-e4c7-4d04-8248-110e57941413','SkuCreated','a2000034-0000-4000-8000-0000a2000034','2026-08-02 20:55:51.303160',NULL),('e83ca14a-4f52-461f-bfb5-89c68111e269','SkuCreated','a200002e-0000-4000-8000-0000a200002e','2026-08-02 20:55:51.303140',NULL),('eab9a432-8697-4325-86cb-69aab19cd89e','SkuCreated','a200002a-0000-4000-8000-0000a200002a','2026-08-02 20:55:51.303176',NULL),('ee58c610-ed0c-4905-b30e-e0489cfe6c1c','SkuCreated','a2000031-0000-4000-8000-0000a2000031','2026-08-02 20:55:51.303153',NULL);
/*!40000 ALTER TABLE `ProcessedIntegrationEvents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductionOrderLines`
--

DROP TABLE IF EXISTS `ProductionOrderLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductionOrderLines` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductionOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `MaterialSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PlannedQuantity` int NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ProductionOrderLines_ProductionOrderId` (`ProductionOrderId`),
  KEY `IX_ProductionOrderLines_MaterialSkuId` (`MaterialSkuId`),
  CONSTRAINT `FK_ProductionOrderLines_ProductionOrders_ProductionOrderId` FOREIGN KEY (`ProductionOrderId`) REFERENCES `ProductionOrders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductionOrderLines`
--

LOCK TABLES `ProductionOrderLines` WRITE;
/*!40000 ALTER TABLE `ProductionOrderLines` DISABLE KEYS */;
INSERT INTO `ProductionOrderLines` VALUES ('08515f12-baa3-4d0d-9802-49d926f34348','7855bdd6-9e04-4ca9-bb83-234a3ba5dad6','c6250087-30f0-47e7-a925-0416589a1bb8','NGUYEN-LIEU-SAN-XUAT-G','Nguyên Liệu Sản Xuất - g',500,'2026-08-03 04:14:21.639625'),('4f148c46-8cd2-4ade-ac6f-8309d0ca62b7','e01b64fc-25d8-49d5-a598-2784a448e1aa','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','Hoa sen khô',2000,'2026-07-21 02:44:31.773146'),('7d5e9c36-5269-4383-a896-8e4823d716a5','e01b64fc-25d8-49d5-a598-2784a448e1aa','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','Trà xanh thô',9000,'2026-07-21 02:44:31.773146'),('c4d89cf1-e147-46d0-b4f0-7c50f17e548e','7855bdd6-9e04-4ca9-bb83-234a3ba5dad6','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì - cái',5,'2026-08-03 04:14:21.639625');
/*!40000 ALTER TABLE `ProductionOrderLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductionOrderOutputLines`
--

DROP TABLE IF EXISTS `ProductionOrderOutputLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductionOrderOutputLines` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductionOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `FinishedSkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `FinishedSkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `FinishedSkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PlannedQuantity` int NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `ExpiresAt` datetime(6) DEFAULT NULL,
  `DestinationLocation` varchar(20) NOT NULL DEFAULT 'Warehouse',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductionOrderOutputLines_ProductionOrderId_FinishedSkuId` (`ProductionOrderId`,`FinishedSkuId`),
  KEY `IX_ProductionOrderOutputLines_FinishedSkuId` (`FinishedSkuId`),
  KEY `IX_ProductionOrderOutputLines_ProductionOrderId` (`ProductionOrderId`),
  KEY `IX_ProductionOrderOutputLines_WarehouseBatchId` (`WarehouseBatchId`),
  KEY `IX_ProductionOrderOutputLines_DestinationLocation` (`DestinationLocation`),
  CONSTRAINT `FK_ProductionOrderOutputLines_ProductionOrders_ProductionOrderId` FOREIGN KEY (`ProductionOrderId`) REFERENCES `ProductionOrders` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProductionOrderOutputLines_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductionOrderOutputLines`
--

LOCK TABLES `ProductionOrderOutputLines` WRITE;
/*!40000 ALTER TABLE `ProductionOrderOutputLines` DISABLE KEYS */;
INSERT INTO `ProductionOrderOutputLines` VALUES ('2be06e01-84ab-4d95-bf10-39f2c7ee65c7','7855bdd6-9e04-4ca9-bb83-234a3ba5dad6','f4bceb36-e146-4ef1-a9e3-45a70036d3ff','TRA-HOA-NHAI-001-HOP','Trà Hoa Nhài 001',5,NULL,NULL,'2026-08-03 04:14:21.639625',NULL,'Warehouse'),('9176127d-f940-4bd0-ab73-d7fcfcc4ee05','e01b64fc-25d8-49d5-a598-2784a448e1aa','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ',100,'302b784c-d847-4d26-b6cb-a8ba34f628d9','SX-20260721024548-01-E01B64','2026-07-21 02:44:31.773146',NULL,'Shelf');
/*!40000 ALTER TABLE `ProductionOrderOutputLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductionOrders`
--

DROP TABLE IF EXISTS `ProductionOrders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductionOrders` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ProductionCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `CompletedAt` datetime(6) DEFAULT NULL,
  `CreatedByName` varchar(255) DEFAULT NULL,
  `CreatedByRoleName` varchar(100) DEFAULT NULL,
  `SubmittedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `ReviewNote` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ProductionOrders_ProductionCode` (`ProductionCode`),
  KEY `IX_ProductionOrders_Status` (`Status`),
  KEY `IX_ProductionOrders_CreatedAt` (`CreatedAt`),
  KEY `IX_ProductionOrders_SubmittedAt` (`SubmittedAt`),
  KEY `IX_ProductionOrders_ReviewedBy` (`ReviewedBy`),
  KEY `IX_ProductionOrders_ReviewedAt` (`ReviewedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductionOrders`
--

LOCK TABLES `ProductionOrders` WRITE;
/*!40000 ALTER TABLE `ProductionOrders` DISABLE KEYS */;
INSERT INTO `ProductionOrders` VALUES ('7855bdd6-9e04-4ca9-bb83-234a3ba5dad6','SX-20260803-0001',NULL,'Approved','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:14:21.639625','2026-08-03 04:15:10.242218',NULL,'Thủ kho','Warehouse','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:14:21.875419','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','Tran Thi Manager','Manager','2026-08-03 04:15:10.242218',NULL),('e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001',NULL,'Completed','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-07-21 02:44:31.773146','2026-07-21 02:45:48.867836','2026-07-21 02:45:48.867836','inventory','Warehouse','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-07-21 02:44:31.939453','0143485c-c41c-4d24-b3f5-48c850200733','Thủ Kho 2','Warehouse','2026-07-21 02:45:42.011165',NULL);
/*!40000 ALTER TABLE `ProductionOrders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ReturnInspections`
--

DROP TABLE IF EXISTS `ReturnInspections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ReturnInspections` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReturnId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReturnCode` varchar(30) NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderCode` varchar(30) NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuSnapshotName` varchar(255) NOT NULL,
  `Quantity` int NOT NULL,
  `Disposition` varchar(30) NOT NULL,
  `QuarantineBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `RestockBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `InspectedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `InspectedAt` datetime(6) DEFAULT NULL,
  `InspectionNote` varchar(500) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ReturnInspections_CreatedAt` (`CreatedAt`),
  KEY `IX_ReturnInspections_Disposition` (`Disposition`),
  KEY `IX_ReturnInspections_OrderId` (`OrderId`),
  KEY `IX_ReturnInspections_QuarantineBatchId` (`QuarantineBatchId`),
  KEY `IX_ReturnInspections_ReturnId` (`ReturnId`),
  KEY `IX_ReturnInspections_ReturnId_SkuId` (`ReturnId`,`SkuId`),
  KEY `IX_ReturnInspections_SkuId` (`SkuId`),
  CONSTRAINT `FK_ReturnInspections_WarehouseBatches_QuarantineBatchId` FOREIGN KEY (`QuarantineBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ReturnInspections`
--

LOCK TABLES `ReturnInspections` WRITE;
/*!40000 ALTER TABLE `ReturnInspections` DISABLE KEYS */;
/*!40000 ALTER TABLE `ReturnInspections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShelfReplenishmentSuggestionItems`
--

DROP TABLE IF EXISTS `ShelfReplenishmentSuggestionItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShelfReplenishmentSuggestionItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SuggestionId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuSnapshotName` varchar(255) NOT NULL,
  `InventoryUnitSnapshot` varchar(20) DEFAULT NULL,
  `ShelfQuantityAtStocktake` int NOT NULL,
  `ShelfReservedAtStocktake` int NOT NULL,
  `ShelfLowStockThreshold` int NOT NULL,
  `WarehouseQuantityAtStocktake` int NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ShelfReplenishmentSuggestionItems_SuggestionId_SkuId` (`SuggestionId`,`SkuId`),
  KEY `IX_ShelfReplenishmentSuggestionItems_SuggestionId` (`SuggestionId`),
  KEY `IX_ShelfReplenishmentSuggestionItems_SkuId` (`SkuId`),
  CONSTRAINT `FK_ShelfReplenishmentSuggestionItems_ShelfReplenishmentSuggestio` FOREIGN KEY (`SuggestionId`) REFERENCES `ShelfReplenishmentSuggestions` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShelfReplenishmentSuggestionItems`
--

LOCK TABLES `ShelfReplenishmentSuggestionItems` WRITE;
/*!40000 ALTER TABLE `ShelfReplenishmentSuggestionItems` DISABLE KEYS */;
/*!40000 ALTER TABLE `ShelfReplenishmentSuggestionItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShelfReplenishmentSuggestions`
--

DROP TABLE IF EXISTS `ShelfReplenishmentSuggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShelfReplenishmentSuggestions` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SuggestionCode` varchar(30) NOT NULL,
  `SourceStocktakeRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceStocktakeCode` varchar(30) NOT NULL,
  `Status` varchar(20) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `HandledBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `HandledByName` varchar(255) DEFAULT NULL,
  `HandledByRoleName` varchar(100) DEFAULT NULL,
  `HandledAt` datetime(6) DEFAULT NULL,
  `HandledNote` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ShelfReplenishmentSuggestions_SuggestionCode` (`SuggestionCode`),
  UNIQUE KEY `IX_ShelfReplenishmentSuggestions_SourceStocktakeRequestId` (`SourceStocktakeRequestId`),
  KEY `IX_ShelfReplenishmentSuggestions_Status` (`Status`),
  KEY `IX_ShelfReplenishmentSuggestions_CreatedAt` (`CreatedAt`),
  CONSTRAINT `FK_ShelfReplenishmentSuggestions_StocktakeRequests_SourceStockta` FOREIGN KEY (`SourceStocktakeRequestId`) REFERENCES `StocktakeRequests` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShelfReplenishmentSuggestions`
--

LOCK TABLES `ShelfReplenishmentSuggestions` WRITE;
/*!40000 ALTER TABLE `ShelfReplenishmentSuggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ShelfReplenishmentSuggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SkuStocks`
--

DROP TABLE IF EXISTS `SkuStocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SkuStocks` (
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `WeightInGrams` int NOT NULL,
  `QuantityOnHand` int NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `WarehouseQuantityOnHand` int NOT NULL DEFAULT '0',
  `LowStockThreshold` int NOT NULL DEFAULT '5',
  `WarehouseLowStockThreshold` int NOT NULL DEFAULT '0',
  `ShelfLowStockThreshold` int NOT NULL DEFAULT '0',
  `ReservedQuantity` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`SkuId`),
  KEY `IX_SkuStocks_SkuCode` (`SkuCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SkuStocks`
--

LOCK TABLES `SkuStocks` WRITE;
/*!40000 ALTER TABLE `SkuStocks` DISABLE KEYS */;
INSERT INTO `SkuStocks` VALUES ('02575cb5-719e-43e2-a4fd-c70f1c1860f1','BAO-BI-DONG-GOI-CAI',0,0,'2026-07-21 04:23:10.087141','2026-07-21 04:23:10.087141',0,5,0,0,0),('20000000-0000-0000-0000-000000000001','TRA-SEN-100G',100,100,'2026-01-01 00:00:00.000000','2026-07-21 02:45:48.929293',180,15,30,10,0),('20000000-0000-0000-0000-000000000002','TRA-SEN-250G',250,25,'2026-01-01 00:00:00.000000','2026-01-01 00:00:00.000000',90,10,20,8,0),('20000000-0000-0000-0000-000000000003','TRA-OL-100G',100,60,'2026-01-01 00:00:00.000000','2026-01-01 00:00:00.000000',250,20,40,15,0),('20000000-0000-0000-0000-000000000004','TRA-OL-250G',250,35,'2026-01-01 00:00:00.000000','2026-01-01 00:00:00.000000',120,15,25,10,0),('20000000-0000-0000-0000-000000000005','HTRA-DHB-100G',100,30,'2026-01-01 00:00:00.000000','2026-01-01 00:00:00.000000',140,15,25,10,0),('20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG',1,0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.453017',141000,50000,50000,0,0),('20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG',1,0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.453017',58000,20000,20000,0,0),('20000000-0000-0000-0000-000000000013','NL-OLONG-1KG',1,0,'2026-01-01 00:00:00.000000','2026-08-03 02:24:45.453017',120000,40000,40000,0,0),('6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','NGUYEN-LIEU-G',0,0,'2026-07-21 04:23:10.087597','2026-07-21 04:23:10.087597',0,5,0,0,0),('953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI',0,0,'2026-07-21 04:23:10.084138','2026-08-03 03:34:46.212705',12,5,0,0,0),('a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G',100,41,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',154,10,30,10,0),('a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G',250,40,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',154,10,30,10,0),('a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G',100,39,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',152,10,30,10,0),('a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G',250,38,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',152,10,30,10,0),('a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G',100,37,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',150,10,30,10,0),('a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G',200,36,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',150,10,30,10,0),('a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G',100,35,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',148,10,30,10,0),('a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G',250,34,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',148,10,30,10,0),('a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G',100,33,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',146,10,30,10,0),('a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G',200,32,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',146,10,30,10,0),('a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G',50,31,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.761096',164,10,30,10,0),('a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G',100,30,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.753995',154,10,30,10,0),('a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G',100,29,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',142,10,30,10,0),('a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G',357,28,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',142,10,30,10,0),('a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G',100,26,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.739478',152,10,30,10,0),('a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G',200,26,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.746891',148,10,30,10,0),('a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G',50,25,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.790818',150,10,30,10,0),('a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G',100,24,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.783411',163,10,30,10,0),('a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G',100,42,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',136,10,30,10,0),('a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G',200,41,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',136,10,30,10,0),('a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G',50,40,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',134,10,30,10,0),('a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G',100,39,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',134,10,30,10,0),('a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G',100,38,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',132,10,30,10,0),('a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G',200,37,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',132,10,30,10,0),('a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G',100,36,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.801936',138,10,30,10,0),('a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G',250,35,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',130,10,30,10,0),('a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G',100,34,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.768169',143,10,30,10,0),('a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G',250,33,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.775253',158,10,30,10,0),('a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G',100,32,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',126,10,30,10,0),('a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G',250,31,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',126,10,30,10,0),('a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ',0,30,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',124,10,30,10,0),('a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA',0,27,'2026-07-30 17:26:41.285559','2026-08-03 04:56:55.057120',149,10,30,10,0),('a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC',0,28,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',122,10,30,10,0),('a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2',0,27,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',122,10,30,10,0),('a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G',100,26,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',120,10,30,10,0),('a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G',200,25,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',120,10,30,10,0),('a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G',100,24,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',156,10,30,10,0),('a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G',250,42,'2026-07-30 17:26:41.285559','2026-07-30 17:30:45.783005',154,10,30,10,0),('a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.869346',2094000,10000,30000,10000,0),('a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.843604',894000,10000,30000,10000,0),('a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.835252',1596000,10000,30000,10000,0),('a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.826819',2096000,10000,30000,10000,0),('a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.819061',1098000,10000,30000,10000,0),('a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.811021',598000,10000,30000,10000,0),('a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.860882',1100000,10000,30000,10000,0),('a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG',1,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.852712',600000,10000,30000,10000,0),('a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.716332',644,10,30,10,0),('a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.724578',660,10,30,10,0),('a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.688175',681,10,30,10,0),('a2000032-0000-4000-8000-0000a2000032','BB-TEM',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.708103',658,10,30,10,0),('a2000033-0000-4000-8000-0000a2000033','BB-NILON',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.698326',666,10,30,10,0),('a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON',0,0,'2026-07-30 17:26:41.285559','2026-08-03 04:48:29.672304',690,10,30,10,0),('c6250087-30f0-47e7-a925-0416589a1bb8','NGUYEN-LIEU-SAN-XUAT-G',0,0,'2026-07-21 04:23:10.087599','2026-07-21 04:23:10.087599',0,5,0,0,0),('f4bceb36-e146-4ef1-a9e3-45a70036d3ff','TRA-HOA-NHAI-001-HOP',0,0,'2026-07-21 04:23:10.084133','2026-07-21 04:23:10.084277',0,5,0,0,0);
/*!40000 ALTER TABLE `SkuStocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockAdjustmentRequestItems`
--

DROP TABLE IF EXISTS `StockAdjustmentRequestItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockAdjustmentRequestItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `QuantityDelta` int NOT NULL,
  `QuantityOnHandSnapshot` int NOT NULL,
  `QuantityOnHandAfter` int DEFAULT NULL,
  `WarehouseQuantityOnHandAfter` int DEFAULT NULL,
  `ExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ApprovedQuantity` int NOT NULL DEFAULT '0',
  `FulfilledQuantity` int NOT NULL DEFAULT '0',
  `RejectedQuantity` int NOT NULL DEFAULT '0',
  `Status` varchar(20) NOT NULL DEFAULT 'Pending',
  `ReviewNote` varchar(500) DEFAULT NULL,
  `RejectionReason` varchar(500) DEFAULT NULL,
  `ClosedReason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockAdjustmentRequestItems_ExportSlipId` (`ExportSlipId`),
  KEY `IX_StockAdjustmentRequestItems_RequestId` (`RequestId`),
  KEY `IX_StockAdjustmentRequestItems_SkuId` (`SkuId`),
  KEY `IX_StockAdjustmentRequestItems_Status` (`Status`),
  CONSTRAINT `FK_StockAdjustmentRequestItems_StockAdjustmentRequests_RequestId` FOREIGN KEY (`RequestId`) REFERENCES `StockAdjustmentRequests` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_StockAdjustmentRequestItems_StockExportSlips_ExportSlipId` FOREIGN KEY (`ExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockAdjustmentRequestItems`
--

LOCK TABLES `StockAdjustmentRequestItems` WRITE;
/*!40000 ALTER TABLE `StockAdjustmentRequestItems` DISABLE KEYS */;
/*!40000 ALTER TABLE `StockAdjustmentRequestItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockAdjustmentRequests`
--

DROP TABLE IF EXISTS `StockAdjustmentRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockAdjustmentRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `RequestedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestedAt` datetime(6) NOT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `ReviewNote` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `RequestedByName` varchar(255) DEFAULT NULL,
  `RequestedByRoleName` varchar(100) DEFAULT NULL,
  `ReviewedByName` varchar(255) DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockAdjustmentRequests_RequestCode` (`RequestCode`),
  KEY `IX_StockAdjustmentRequests_RequestedAt` (`RequestedAt`),
  KEY `IX_StockAdjustmentRequests_RequestedBy` (`RequestedBy`),
  KEY `IX_StockAdjustmentRequests_Status` (`Status`),
  KEY `IX_StockAdjustmentRequests_RequestedByRoleName` (`RequestedByRoleName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockAdjustmentRequests`
--

LOCK TABLES `StockAdjustmentRequests` WRITE;
/*!40000 ALTER TABLE `StockAdjustmentRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `StockAdjustmentRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockDeductQueueItems`
--

DROP TABLE IF EXISTS `StockDeductQueueItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockDeductQueueItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `QueueId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuSnapshotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Quantity` int NOT NULL,
  `OrderedQuantity` int DEFAULT NULL,
  `FinishedDeductedQuantity` int DEFAULT NULL,
  `PendingBomQuantity` int DEFAULT NULL,
  `MaterialRequirementSnapshotJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `StockHandlingMode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReservationStatus` varchar(20) NOT NULL DEFAULT 'None',
  `ReservedQuantity` int NOT NULL DEFAULT '0',
  `ReservedAt` datetime(6) DEFAULT NULL,
  `ReleasedAt` datetime(6) DEFAULT NULL,
  `DeductedAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockDeductQueueItems_QueueId` (`QueueId`),
  KEY `IX_StockDeductQueueItems_SkuId` (`SkuId`),
  KEY `IX_StockDeductQueueItems_SkuId_ReservationStatus` (`SkuId`,`ReservationStatus`),
  CONSTRAINT `FK_StockDeductQueueItems_StockDeductQueues_QueueId` FOREIGN KEY (`QueueId`) REFERENCES `StockDeductQueues` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockDeductQueueItems`
--

LOCK TABLES `StockDeductQueueItems` WRITE;
/*!40000 ALTER TABLE `StockDeductQueueItems` DISABLE KEYS */;
INSERT INTO `StockDeductQueueItems` VALUES ('268e3fa3-bff7-46ec-b1ca-23875f1f1cb8','ac9aaea0-48cd-49bd-b33a-9a1bc8487664','20000000-0000-0000-0000-000000000003','Trà Ô Long Cao Sơn — Trà Ô Long Cao Sơn 100g','TRA-OL-100G',1,1,0,1,'[{\"materialProductId\":\"10000000-0000-0000-0000-000000000013\",\"materialSkuId\":\"20000000-0000-0000-0000-000000000013\",\"materialSkuCode\":\"NL-OLONG-1KG\",\"materialName\":\"L\\u00E1 tr\\u00E0 \\u00F4 long th\\u00F4\",\"unitName\":\"c\\u00E1i\",\"requiredQuantity\":1,\"availableAtCheckout\":120,\"reservedByOtherPendingAtCheckout\":0}]','FullBomPending','None',0,NULL,NULL,NULL),('abb7f78b-8354-4c6a-b94f-8f8b18ccdb07','c4f7df20-494a-4a84-b50b-0e6e00877c1d','20000000-0000-0000-0000-000000000004','Trà Ô Long Cao Sơn — Trà Ô Long Cao Sơn 250g','TRA-OL-250G',1,1,0,1,'[{\"materialProductId\":\"10000000-0000-0000-0000-000000000013\",\"materialSkuId\":\"20000000-0000-0000-0000-000000000013\",\"materialSkuCode\":\"NL-OLONG-1KG\",\"materialName\":\"L\\u00E1 tr\\u00E0 \\u00F4 long th\\u00F4\",\"unitName\":\"c\\u00E1i\",\"requiredQuantity\":1,\"availableAtCheckout\":120,\"reservedByOtherPendingAtCheckout\":1}]','FullBomPending','None',0,NULL,NULL,NULL),('c1e11a09-379c-4e98-8e55-401fae0b03cb','d6ff44ef-2a36-40d5-9ceb-60d7a5d25101','953f58df-3312-4217-b1a1-47bf7b830619','Bao Bì — Bao Bì - cái','BAO-BI-CAI',4,NULL,NULL,NULL,NULL,NULL,'None',0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `StockDeductQueueItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockDeductQueues`
--

DROP TABLE IF EXISTS `StockDeductQueues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockDeductQueues` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OrderPaymentStatus` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OrderStockStatus` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `QueueStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TotalAmount` decimal(18,2) NOT NULL,
  `IsDeducted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `ConfirmedAt` datetime(6) DEFAULT NULL,
  `ConfirmedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ConfirmedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ConfirmedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelledAt` datetime(6) DEFAULT NULL,
  `CancelledBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CancelledByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelledByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CancelReason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `LastAttemptAt` datetime(6) DEFAULT NULL,
  `LastShortageReason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IsReserved` tinyint(1) NOT NULL DEFAULT '0',
  `CustomerSnapshotName` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockDeductQueues_OrderId` (`OrderId`),
  KEY `IX_StockDeductQueues_CancelledBy` (`CancelledBy`),
  KEY `IX_StockDeductQueues_ConfirmedBy` (`ConfirmedBy`),
  KEY `IX_StockDeductQueues_QueueStatus` (`QueueStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockDeductQueues`
--

LOCK TABLES `StockDeductQueues` WRITE;
/*!40000 ALTER TABLE `StockDeductQueues` DISABLE KEYS */;
INSERT INTO `StockDeductQueues` VALUES ('ac9aaea0-48cd-49bd-b33a-9a1bc8487664','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','HVT-260722-001','completed','pending_bom_reconciliation','Waiting',145000.00,0,'2026-07-22 14:53:50.010938',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL),('c4f7df20-494a-4a84-b50b-0e6e00877c1d','51b17789-8017-4ef3-97dd-045418706f1d','HVT-260722-002','completed','pending_bom_reconciliation','Waiting',330000.00,0,'2026-07-22 14:56:07.814036',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL),('d6ff44ef-2a36-40d5-9ceb-60d7a5d25101','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','HVT-260726-001','pendingpayment','pending_deduct','Waiting',24000.00,0,'2026-07-26 14:22:10.912522',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL);
/*!40000 ALTER TABLE `StockDeductQueues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockExportBatchAllocations`
--

DROP TABLE IF EXISTS `StockExportBatchAllocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockExportBatchAllocations` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `LotCode` varchar(50) NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseBatchItemId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `StockExportSlipLineId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockExportBatchAllocations_StockExportSlipId` (`StockExportSlipId`),
  KEY `IX_StockExportBatchAllocations_WarehouseBatchId` (`WarehouseBatchId`),
  KEY `IX_StockExportBatchAllocations_WarehouseBatchItemId` (`WarehouseBatchItemId`),
  KEY `IX_StockExportBatchAllocations_StockExportSlipLineId` (`StockExportSlipLineId`),
  CONSTRAINT `FK_StockExportBatchAllocations_StockExportSlipLines_StockExportS` FOREIGN KEY (`StockExportSlipLineId`) REFERENCES `StockExportSlipLines` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StockExportBatchAllocations_StockExportSlips_StockExportSlipI` FOREIGN KEY (`StockExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_StockExportBatchAllocations_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockExportBatchAllocations_WarehouseBatchItems_WarehouseBatc` FOREIGN KEY (`WarehouseBatchItemId`) REFERENCES `WarehouseBatchItems` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockExportBatchAllocations`
--

LOCK TABLES `StockExportBatchAllocations` WRITE;
/*!40000 ALTER TABLE `StockExportBatchAllocations` DISABLE KEYS */;
INSERT INTO `StockExportBatchAllocations` VALUES ('7c1a8bf8-c8cd-4f7e-894d-ad7874f22c66','e74fdbc5-44b6-48f7-80c7-601dc4ddbf4a','a300002d-0000-4000-8000-0000a300002d','HVT-SHELF-HVT-ATISO-100G',1,'a350002d-0000-4000-8000-0000a350002d','HVT-ATISO-100G','6fe02f62-1232-46ea-a6bc-e6989253a17e'),('a0b50dd5-64d6-4a85-8c3d-13e2848e69a1','10f27cfe-e92d-418f-bca6-0a5b5210737f','60000000-0000-0000-0000-000000000001','LOT-20260101',9000,'70000000-0000-0000-0000-000000000006','NL-TRAXANH-1KG','3a6d0e5a-450c-4c65-a780-595326c314dc'),('d516d377-63e2-4f62-a2b2-c5267c8db1fa','2568fe64-2f60-4466-bb86-b049012dd647','a3000060-0000-4000-8000-0000a3000060','HVT-SHELF-HVT-AM-TUSA',1,'a3500060-0000-4000-8000-0000a3500060','HVT-AM-TUSA','baac1a64-d589-457e-896f-7bf649f8ef18'),('eef19eec-64b0-4b14-969d-acb2ab45f8f2','10f27cfe-e92d-418f-bca6-0a5b5210737f','60000000-0000-0000-0000-000000000001','LOT-20260101',2000,'70000000-0000-0000-0000-000000000007','NL-HOASEN-1KG','0f5613e4-2c1a-49e6-afa8-f7b5a9670ffc'),('f074f885-ae06-4258-b936-acfe84fbeb1b','739c708a-75c8-4941-9477-9d579478e503','a3000060-0000-4000-8000-0000a3000060','HVT-SHELF-HVT-AM-TUSA',1,'a3500060-0000-4000-8000-0000a3500060','HVT-AM-TUSA','f4c89afe-0b59-45e7-bef7-4b65d778ac86');
/*!40000 ALTER TABLE `StockExportBatchAllocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockExportSlipLines`
--

DROP TABLE IF EXISTS `StockExportSlipLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockExportSlipLines` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseQtyBefore` int NOT NULL,
  `WarehouseQtyAfter` int NOT NULL,
  `StoreQtyBefore` int NOT NULL,
  `StoreQtyAfter` int NOT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockExportSlipLines_SkuId` (`SkuId`),
  KEY `IX_StockExportSlipLines_StockExportSlipId` (`StockExportSlipId`),
  CONSTRAINT `FK_StockExportSlipLines_StockExportSlips_StockExportSlipId` FOREIGN KEY (`StockExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockExportSlipLines`
--

LOCK TABLES `StockExportSlipLines` WRITE;
/*!40000 ALTER TABLE `StockExportSlipLines` DISABLE KEYS */;
INSERT INTO `StockExportSlipLines` VALUES ('0f5613e4-2c1a-49e6-afa8-f7b5a9670ffc','10f27cfe-e92d-418f-bca6-0a5b5210737f','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','Hoa sen khô',2000,60000,58000,0,0,'Lệnh sản xuất SX-20260721-0001','2026-07-21 02:45:48.867836'),('3a6d0e5a-450c-4c65-a780-595326c314dc','10f27cfe-e92d-418f-bca6-0a5b5210737f','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','Trà xanh thô',9000,150000,141000,0,0,'Lệnh sản xuất SX-20260721-0001','2026-07-21 02:45:48.867836'),('6fe02f62-1232-46ea-a6bc-e6989253a17e','e74fdbc5-44b6-48f7-80c7-601dc4ddbf4a','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt — Gói 100g',1,140,140,27,26,'Trừ tồn quầy ngay cho đơn hàng HVT-260731-001','2026-07-31 01:02:06.814336'),('baac1a64-d589-457e-896f-7bf649f8ef18','2568fe64-2f60-4466-bb86-b049012dd647','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',1,149,149,29,28,'đầu ngày: hệ thống=29, thực tế=28','2026-08-03 04:52:26.512990'),('f4c89afe-0b59-45e7-bef7-4b65d778ac86','739c708a-75c8-4941-9477-9d579478e503','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml — 1 cái',1,149,149,28,27,'Trừ tồn quầy ngay cho đơn hàng HVT-260803-001','2026-08-03 04:56:55.057120');
/*!40000 ALTER TABLE `StockExportSlipLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockExportSlips`
--

DROP TABLE IF EXISTS `StockExportSlips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockExportSlips` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ExportCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ExportType` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `StockAdjustmentRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseQtyBefore` int NOT NULL,
  `WarehouseQtyAfter` int NOT NULL,
  `StoreQtyBefore` int NOT NULL,
  `StoreQtyAfter` int NOT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `ProductionOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ProductionCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedById` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReferenceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReferenceType` varchar(50) DEFAULT NULL,
  `ReferenceCode` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockExportSlips_ExportCode` (`ExportCode`),
  KEY `IX_StockExportSlips_CreatedAt` (`CreatedAt`),
  KEY `IX_StockExportSlips_StockAdjustmentRequestId` (`StockAdjustmentRequestId`),
  KEY `IX_StockExportSlips_ProductionOrderId` (`ProductionOrderId`),
  KEY `IX_StockExportSlips_ProductionCode` (`ProductionCode`),
  KEY `IX_StockExportSlips_ReferenceCode` (`ReferenceCode`),
  KEY `IX_StockExportSlips_ReferenceId` (`ReferenceId`),
  CONSTRAINT `FK_StockExportSlips_ProductionOrders_ProductionOrderId` FOREIGN KEY (`ProductionOrderId`) REFERENCES `ProductionOrders` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockExportSlips`
--

LOCK TABLES `StockExportSlips` WRITE;
/*!40000 ALTER TABLE `StockExportSlips` DISABLE KEYS */;
INSERT INTO `StockExportSlips` VALUES ('10f27cfe-e92d-418f-bca6-0a5b5210737f','PX-20260721-0001','production',NULL,'00000000-0000-0000-0000-000000000000','MULTI','2 dòng nguyên liệu',11000,210000,199000,0,0,'Xuất nguyên liệu cho lệnh sản xuất SX-20260721-0001','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-07-21 02:45:48.867836','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001','eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse','e01b64fc-25d8-49d5-a598-2784a448e1aa','ProductionOrder','SX-20260721-0001'),('2568fe64-2f60-4466-bb86-b049012dd647','PX-20260803-0001','stocktake_adjustment',NULL,'a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',1,149,149,29,28,'Duyệt kiểm kê','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','2026-08-03 04:52:26.512990',NULL,NULL,'8edcf23b-5dc6-45d2-a55a-214b7e2c636c','Tran Thi Manager','Manager','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','Stocktake','KK-20260803-0001'),('739c708a-75c8-4941-9477-9d579478e503','PX-20260803-0002','pos_finished_goods_sale',NULL,'a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml — 1 cái',1,149,149,28,27,'Trừ tồn quầy ngay cho đơn hàng HVT-260803-001','ed9f2604-1baf-43d9-b074-0035e2cb4961','2026-08-03 04:56:55.057120',NULL,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','a33da7ea-d424-4896-b22f-af6eee19b548','Order','HVT-260803-001'),('e74fdbc5-44b6-48f7-80c7-601dc4ddbf4a','PX-20260731-0001','pos_finished_goods_sale',NULL,'a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt — Gói 100g',1,140,140,27,26,'Trừ tồn quầy ngay cho đơn hàng HVT-260731-001','ed9f2604-1baf-43d9-b074-0035e2cb4961','2026-07-31 01:02:06.814336',NULL,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','Order','HVT-260731-001');
/*!40000 ALTER TABLE `StockExportSlips` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockImportSlipLines`
--

DROP TABLE IF EXISTS `StockImportSlipLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockImportSlipLines` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockImportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseQtyBefore` int NOT NULL,
  `WarehouseQtyAfter` int NOT NULL,
  `StoreQtyBefore` int NOT NULL,
  `StoreQtyAfter` int NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ProductionOrderOutputLineId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `DestinationLocation` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockImportSlipLines_CreatedAt` (`CreatedAt`),
  KEY `IX_StockImportSlipLines_ProductionOrderOutputLineId` (`ProductionOrderOutputLineId`),
  KEY `IX_StockImportSlipLines_SkuId` (`SkuId`),
  KEY `IX_StockImportSlipLines_StockImportSlipId` (`StockImportSlipId`),
  KEY `IX_StockImportSlipLines_WarehouseBatchId` (`WarehouseBatchId`),
  CONSTRAINT `FK_StockImportSlipLines_ProductionOrderOutputLines_ProductionOrd` FOREIGN KEY (`ProductionOrderOutputLineId`) REFERENCES `ProductionOrderOutputLines` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StockImportSlipLines_StockImportSlips_StockImportSlipId` FOREIGN KEY (`StockImportSlipId`) REFERENCES `StockImportSlips` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_StockImportSlipLines_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockImportSlipLines`
--

LOCK TABLES `StockImportSlipLines` WRITE;
/*!40000 ALTER TABLE `StockImportSlipLines` DISABLE KEYS */;
INSERT INTO `StockImportSlipLines` VALUES ('01c17665-e741-44b7-b06e-278991da9fbc','31045aeb-2b87-469e-af01-c26d102ee925','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô',2000000,96000,2096000,0,0,'fb1421db-060b-46e7-bb70-5814d5a3b746','SR-C953B48CFBEB4D7FA9D80E76E70A25A0',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('038604bf-9375-4b9b-bac9-9de36bfd5ebd','31045aeb-2b87-469e-af01-c26d102ee925','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',15,128,143,34,34,'32a35341-b941-4223-9a98-8c7b595efe6c','SR-DA0AA638D1D74942A9B7D767B23A999F',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('0b35119c-3e04-43de-afa0-dd23194f6467','9140b444-2149-4c23-89dd-23ffcbd8e489','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì',12,0,12,0,0,'75f542f6-62d4-4dbc-8c3d-9c7a86b48126','SR-E28548B182EE456A84416FABE2220DEB',NULL,NULL,'2026-08-03 03:34:46.026935','Warehouse'),('1dd919a6-61ab-4c1d-a1b2-4f415934fa89','31045aeb-2b87-469e-af01-c26d102ee925','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',12,140,152,26,26,'dc74dc60-6298-420b-a506-ae65ec764efc','SR-29FC77292FE74159852935A3A1B3CF78',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('2319614a-4514-4ba6-a159-ab8ab587d3e9','f782f59c-5bd7-42c6-9868-04c808756404','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',12,644,656,0,0,'5b5002ca-831e-4783-8e0c-f13a12dfe33f','SR-90890D51891041AEB6C24BFEC96D9FAE',NULL,NULL,'2026-08-03 03:37:11.179088','Warehouse'),('26388c4e-15fc-402c-9630-ba437b661281','31045aeb-2b87-469e-af01-c26d102ee925','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',8,140,148,26,26,'e926c252-4091-41c2-98c3-33f84457b158','SR-C216CCFF42EF4965B28449153577CD35',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('26dde44e-2cfa-48b2-a0f1-52d19f25bac1','31045aeb-2b87-469e-af01-c26d102ee925','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',25,124,149,29,29,'9f89929a-a697-4cde-a8c0-3cd896d47a01','SR-5DEE5CF594FE43F4B9DD26008CB1886D',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('3b163528-d505-4455-b212-32496ffb26ba','bf79ac7a-18e0-41cd-b3e2-a68c9328e3f8','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ',100,180,180,40,100,'302b784c-d847-4d26-b6cb-a8ba34f628d9','SX-20260721024548-01-E01B64','9176127d-f940-4bd0-ab73-d7fcfcc4ee05','Nhập thành phẩm từ lệnh SX-20260721-0001','2026-07-21 02:45:48.867836','Shelf'),('428cb0a4-32bc-4f37-b506-eca22ee4fba5','31045aeb-2b87-469e-af01-c26d102ee925','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',30,128,158,33,33,'5cab4e6e-6a97-43ad-97ed-05045a4cef08','SR-2FE5EF63246E413AAA13540CF6BF69C9',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('48e583e7-c062-453a-878b-6c825f62b591','31045aeb-2b87-469e-af01-c26d102ee925','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên',2000000,94000,2094000,0,0,'d01ce800-fb9c-4876-a6b2-5d1ad063f00b','SR-89E63CB28BA44CF4B347724CC6CC5172',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('5c69d0ca-fc71-458a-a6cd-8976737662eb','31045aeb-2b87-469e-af01-c26d102ee925','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',25,138,163,24,24,'61dfb76a-1419-498d-895d-22ef24b89d48','SR-8E7868C9200D487E939EE18E9DE498ED',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('7429cc1b-c3b1-4720-8879-536179760bb5','31045aeb-2b87-469e-af01-c26d102ee925','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt',1000000,98000,1098000,0,0,'395e419f-4fdb-4f4f-bdf6-406bffb45380','SR-12641583EF994912B85AA64751496AE3',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('90a5f770-8f7c-45c4-b5cc-288b6d3d7c54','31045aeb-2b87-469e-af01-c26d102ee925','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',25,656,681,0,0,'166f6753-cae7-4058-8f91-748c79c6ac98','SR-A958863E99614784B3D18718C81908F9',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('9591a496-eaf6-4bf0-a85d-fa451aa465e8','31045aeb-2b87-469e-af01-c26d102ee925','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng',800000,94000,894000,0,0,'4ccf9679-9bf4-4d14-9ea3-c544de4bf656','SR-EF0E8E969B01499EAE6D8E157E3B59A7',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('9f65c725-8618-455d-b48a-5c180effcbb7','31045aeb-2b87-469e-af01-c26d102ee925','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g',10,634,644,0,0,'a752280d-39b5-4dd4-9613-7f9e2f2f3450','SR-E9F3D2A37C364B929DA03F8501D67ECF',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('a0f8ae55-115f-4e49-831f-2a27eb551377','31045aeb-2b87-469e-af01-c26d102ee925','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm',12,654,666,0,0,'7936c2fe-19c6-4571-93cc-f65e80f1956d','SR-4F7168F02FA348439F1E8987DA0D8153',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('b0b625b3-3cea-4ea7-9017-0611b2b01af8','31045aeb-2b87-469e-af01-c26d102ee925','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g',20,640,660,0,0,'af0a2cae-52c6-49f3-9766-ea880d26cc35','SR-7F5AF7EAA3E74BF2BB180BD402504D91',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('b4099fcf-e312-43bc-a5df-1a19e095d26c','31045aeb-2b87-469e-af01-c26d102ee925','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',12,138,150,25,25,'872a2b71-c8c9-4a11-a46d-4499ff5274b2','SR-5967018B5DD64C8BB78E31B9493F0822',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('b70ad946-6e32-4008-a629-542ed30aa472','31045aeb-2b87-469e-af01-c26d102ee925','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô',500000,100000,600000,0,0,'83cfba1d-6ec8-4836-9005-f864b75a6d1f','SR-3971F49D6F9746868A277A2F24A1786E',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('cc3e5f54-e435-4622-8eca-4b10fd084e46','31045aeb-2b87-469e-af01-c26d102ee925','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',10,144,154,30,30,'2ff8a597-ea32-4293-ab76-3156fbe91376','SR-DC740D0E92F14115BDDCBC6FF2FA5143',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('ce27f6aa-27bd-487e-9430-8663c1537af5','31045aeb-2b87-469e-af01-c26d102ee925','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn',30,660,690,0,0,'095adead-a995-4b82-8b5b-76856897bc5e','SR-0302CB29699644A6B0CC34FD6EB3EAFE',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('cf63db30-7e1e-49c3-bc2a-7a2e662ac95d','31045aeb-2b87-469e-af01-c26d102ee925','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh',500000,98000,598000,0,0,'693a0e5a-d3b4-4116-b559-c5f89d713ae0','SR-9D0B087015864CCFA0EE7615A621AF98',NULL,'Đạt — bao bì nguyên vẹn','2026-08-03 04:48:29.588034','Warehouse'),('db62c6c2-b1be-4dce-bff8-857568e4b212','31045aeb-2b87-469e-af01-c26d102ee925','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',8,130,138,36,36,'bcbc5c0f-e433-4588-a479-f0cea01bc204','SR-AACB736DEE8D410F85C7DDA29E71EAA3',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('e35f6ca7-04b9-40bf-8ce0-a9e55da2b1c4','31045aeb-2b87-469e-af01-c26d102ee925','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ',1500000,96000,1596000,0,0,'d6fafaec-4724-4195-a6ea-7f63fa0c90a4','SR-1515E56014654317B21196F774E28A3B',NULL,'Đạt có ghi chú: hơi ẩm nhẹ, đã kiểm tra cảm quan','2026-08-03 04:48:29.588034','Warehouse'),('e49669f3-765e-4828-9590-5f5763a076f3','31045aeb-2b87-469e-af01-c26d102ee925','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết',1000000,100000,1100000,0,0,'d9e33535-c11c-4183-b4f5-0991cf999f51','SR-44FAC6558ECD44DFA83AD2D349A3CC9F',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('f6c58104-67f1-45c2-afd8-5921823a0e2b','31045aeb-2b87-469e-af01-c26d102ee925','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',20,144,164,31,31,'cc9ba807-8010-40af-a837-1e5adc363bc7','SR-CAFA2F16E36C4DC8AB4C48C9F1A1E2AF',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse'),('fc5e30a5-16ed-49ba-bd57-a3dc9314a947','31045aeb-2b87-469e-af01-c26d102ee925','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT',8,650,658,0,0,'3a9381e1-5393-4dfb-8db5-32694adcf014','SR-F32018BD95314CCBA3659F928BDC3625',NULL,NULL,'2026-08-03 04:48:29.588034','Warehouse');
/*!40000 ALTER TABLE `StockImportSlipLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockImportSlips`
--

DROP TABLE IF EXISTS `StockImportSlips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockImportSlips` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ImportCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ImportType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseQtyBefore` int NOT NULL,
  `WarehouseQtyAfter` int NOT NULL,
  `StoreQtyBefore` int NOT NULL,
  `StoreQtyAfter` int NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ProductionOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ProductionCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `CreatedById` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CreatedByName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedByRoleName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SupplierReceiptId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SupplierReceiptCode` varchar(30) DEFAULT NULL,
  `ReferenceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReferenceType` varchar(50) DEFAULT NULL,
  `ReferenceCode` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockImportSlips_ImportCode` (`ImportCode`),
  KEY `IX_StockImportSlips_CreatedAt` (`CreatedAt`),
  KEY `IX_StockImportSlips_ImportType` (`ImportType`),
  KEY `IX_StockImportSlips_ProductionCode` (`ProductionCode`),
  KEY `IX_StockImportSlips_ProductionOrderId` (`ProductionOrderId`),
  KEY `IX_StockImportSlips_SkuId` (`SkuId`),
  KEY `IX_StockImportSlips_WarehouseBatchId` (`WarehouseBatchId`),
  KEY `IX_StockImportSlips_SupplierReceiptCode` (`SupplierReceiptCode`),
  KEY `IX_StockImportSlips_SupplierReceiptId` (`SupplierReceiptId`),
  KEY `IX_StockImportSlips_ReferenceCode` (`ReferenceCode`),
  KEY `IX_StockImportSlips_ReferenceId` (`ReferenceId`),
  CONSTRAINT `FK_StockImportSlips_ProductionOrders_ProductionOrderId` FOREIGN KEY (`ProductionOrderId`) REFERENCES `ProductionOrders` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StockImportSlips_SupplierReceipts_SupplierReceiptId` FOREIGN KEY (`SupplierReceiptId`) REFERENCES `SupplierReceipts` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StockImportSlips_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockImportSlips`
--

LOCK TABLES `StockImportSlips` WRITE;
/*!40000 ALTER TABLE `StockImportSlips` DISABLE KEYS */;
INSERT INTO `StockImportSlips` VALUES ('31045aeb-2b87-469e-af01-c26d102ee925','PN-20260803-0003','supplier_receipt','00000000-0000-0000-0000-000000000000','MULTI','24 dòng nhập từ nhà cung cấp',9300270,781248,10081518,294,294,NULL,NULL,NULL,NULL,'Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.588034','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004',NULL,NULL,NULL),('9140b444-2149-4c23-89dd-23ffcbd8e489','PN-20260803-0001','supplier_receipt','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì',12,0,12,0,0,'75f542f6-62d4-4dbc-8c3d-9c7a86b48126','SR-E28548B182EE456A84416FABE2220DEB',NULL,NULL,NULL,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:34:46.026935','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','10906710-ce7b-4800-b774-51fb54780366','NCC-20260803-0002',NULL,NULL,NULL),('bf79ac7a-18e0-41cd-b3e2-a68c9328e3f8','PN-20260721-0001','production_finished_goods_receipt','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ',100,180,180,40,100,'302b784c-d847-4d26-b6cb-a8ba34f628d9','SX-20260721024548-01-E01B64','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001','Nhập thành phẩm từ lệnh SX-20260721-0001','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-07-21 02:45:48.867836','eeb2c541-38fe-4e73-8784-4381bae0f5c6','inventory','Warehouse',NULL,NULL,'e01b64fc-25d8-49d5-a598-2784a448e1aa','ProductionOrder','SX-20260721-0001'),('f782f59c-5bd7-42c6-9868-04c808756404','PN-20260803-0002','supplier_receipt','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',12,644,656,0,0,'5b5002ca-831e-4783-8e0c-f13a12dfe33f','SR-90890D51891041AEB6C24BFEC96D9FAE',NULL,NULL,NULL,'eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:37:11.179088','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','5fa422bf-ab75-4174-8e25-ac5ef4467038','NCC-20260803-0003',NULL,NULL,NULL);
/*!40000 ALTER TABLE `StockImportSlips` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockTransferBatchAllocations`
--

DROP TABLE IF EXISTS `StockTransferBatchAllocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockTransferBatchAllocations` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockTransferId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockTransferLineId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceWarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceWarehouseBatchItemId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `DestinationWarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `DestinationWarehouseBatchItemId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Quantity` int NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StockTransferBatchAllocations_DestinationWarehouseBatchId` (`DestinationWarehouseBatchId`),
  KEY `IX_StockTransferBatchAllocations_DestinationWarehouseBatchItemId` (`DestinationWarehouseBatchItemId`),
  KEY `IX_StockTransferBatchAllocations_SourceWarehouseBatchId` (`SourceWarehouseBatchId`),
  KEY `IX_StockTransferBatchAllocations_SourceWarehouseBatchItemId` (`SourceWarehouseBatchItemId`),
  KEY `IX_StockTransferBatchAllocations_StockTransferId` (`StockTransferId`),
  KEY `IX_StockTransferBatchAllocations_StockTransferLineId` (`StockTransferLineId`),
  CONSTRAINT `FK_StockTransferBatchAllocations_StockTransferLines_StockTransfe` FOREIGN KEY (`StockTransferLineId`) REFERENCES `StockTransferLines` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransferBatchAllocations_StockTransfers_StockTransferId` FOREIGN KEY (`StockTransferId`) REFERENCES `StockTransfers` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_StockTransferBatchAllocations_WarehouseBatches_DestinationWar` FOREIGN KEY (`DestinationWarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransferBatchAllocations_WarehouseBatches_SourceWarehous` FOREIGN KEY (`SourceWarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransferBatchAllocations_WarehouseBatchItems_Destination` FOREIGN KEY (`DestinationWarehouseBatchItemId`) REFERENCES `WarehouseBatchItems` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransferBatchAllocations_WarehouseBatchItems_SourceWareh` FOREIGN KEY (`SourceWarehouseBatchItemId`) REFERENCES `WarehouseBatchItems` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockTransferBatchAllocations`
--

LOCK TABLES `StockTransferBatchAllocations` WRITE;
/*!40000 ALTER TABLE `StockTransferBatchAllocations` DISABLE KEYS */;
/*!40000 ALTER TABLE `StockTransferBatchAllocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockTransferLines`
--

DROP TABLE IF EXISTS `StockTransferLines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockTransferLines` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StockTransferId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuNameSnapshot` varchar(255) NOT NULL,
  `UnitNameSnapshot` varchar(30) DEFAULT NULL,
  `Quantity` int NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `SourceRequestLineId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockTransferLines_StockTransferId_SkuId` (`StockTransferId`,`SkuId`),
  KEY `IX_StockTransferLines_SkuId` (`SkuId`),
  KEY `IX_StockTransferLines_StockTransferId` (`StockTransferId`),
  KEY `IX_StockTransferLines_SourceRequestLineId` (`SourceRequestLineId`),
  CONSTRAINT `FK_StockTransferLines_StockAdjustmentRequestItems_SourceRequestL` FOREIGN KEY (`SourceRequestLineId`) REFERENCES `StockAdjustmentRequestItems` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransferLines_StockTransfers_StockTransferId` FOREIGN KEY (`StockTransferId`) REFERENCES `StockTransfers` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockTransferLines`
--

LOCK TABLES `StockTransferLines` WRITE;
/*!40000 ALTER TABLE `StockTransferLines` DISABLE KEYS */;
/*!40000 ALTER TABLE `StockTransferLines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StockTransfers`
--

DROP TABLE IF EXISTS `StockTransfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StockTransfers` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `TransferCode` varchar(30) NOT NULL,
  `SourceLocation` varchar(20) NOT NULL,
  `DestinationLocation` varchar(20) NOT NULL,
  `Status` varchar(20) NOT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedByName` varchar(255) DEFAULT NULL,
  `CreatedByRoleName` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `CompletedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CompletedByName` varchar(255) DEFAULT NULL,
  `CompletedByRoleName` varchar(100) DEFAULT NULL,
  `CompletedAt` datetime(6) DEFAULT NULL,
  `CancelledBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CancelledAt` datetime(6) DEFAULT NULL,
  `CancellationReason` varchar(500) DEFAULT NULL,
  `ExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ImportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SourceRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SourceSuggestionId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StockTransfers_TransferCode` (`TransferCode`),
  KEY `IX_StockTransfers_CompletedAt` (`CompletedAt`),
  KEY `IX_StockTransfers_CreatedAt` (`CreatedAt`),
  KEY `IX_StockTransfers_CreatedBy` (`CreatedBy`),
  KEY `IX_StockTransfers_ExportSlipId` (`ExportSlipId`),
  KEY `IX_StockTransfers_ImportSlipId` (`ImportSlipId`),
  KEY `IX_StockTransfers_Status` (`Status`),
  KEY `IX_StockTransfers_SourceRequestId` (`SourceRequestId`),
  KEY `IX_StockTransfers_SourceSuggestionId` (`SourceSuggestionId`),
  CONSTRAINT `FK_StockTransfers_ShelfReplenishmentSuggestions_SourceSuggestion` FOREIGN KEY (`SourceSuggestionId`) REFERENCES `ShelfReplenishmentSuggestions` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransfers_StockAdjustmentRequests_SourceRequestId` FOREIGN KEY (`SourceRequestId`) REFERENCES `StockAdjustmentRequests` (`Id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_StockTransfers_StockExportSlips_ExportSlipId` FOREIGN KEY (`ExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StockTransfers_StockImportSlips_ImportSlipId` FOREIGN KEY (`ImportSlipId`) REFERENCES `StockImportSlips` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StockTransfers`
--

LOCK TABLES `StockTransfers` WRITE;
/*!40000 ALTER TABLE `StockTransfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `StockTransfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StocktakeRequestItems`
--

DROP TABLE IF EXISTS `StocktakeRequestItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StocktakeRequestItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StocktakeRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuSnapshotName` varchar(255) NOT NULL,
  `ProductTypeSnapshot` varchar(30) DEFAULT NULL,
  `InventoryUnitSnapshot` varchar(20) DEFAULT NULL,
  `SystemQuantitySnapshot` int NOT NULL,
  `ActualQuantity` int NOT NULL,
  `Variance` int NOT NULL,
  `ReasonCode` varchar(50) NOT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `WarehouseQtyBefore` int DEFAULT NULL,
  `WarehouseQtyAfter` int DEFAULT NULL,
  `ShelfQtyBefore` int DEFAULT NULL,
  `ShelfQtyAfter` int DEFAULT NULL,
  `StockExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `StockExportSlipCode` varchar(30) DEFAULT NULL,
  `StockImportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `StockImportSlipCode` varchar(30) DEFAULT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_StocktakeRequestItems_SkuId` (`SkuId`),
  KEY `IX_StocktakeRequestItems_StockExportSlipId` (`StockExportSlipId`),
  KEY `IX_StocktakeRequestItems_StockImportSlipId` (`StockImportSlipId`),
  KEY `IX_StocktakeRequestItems_StocktakeRequestId` (`StocktakeRequestId`),
  KEY `IX_StocktakeRequestItems_WarehouseBatchId` (`WarehouseBatchId`),
  CONSTRAINT `FK_StocktakeRequestItems_StockExportSlips_StockExportSlipId` FOREIGN KEY (`StockExportSlipId`) REFERENCES `StockExportSlips` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StocktakeRequestItems_StockImportSlips_StockImportSlipId` FOREIGN KEY (`StockImportSlipId`) REFERENCES `StockImportSlips` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_StocktakeRequestItems_StocktakeRequests_StocktakeRequestId` FOREIGN KEY (`StocktakeRequestId`) REFERENCES `StocktakeRequests` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_StocktakeRequestItems_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StocktakeRequestItems`
--

LOCK TABLES `StocktakeRequestItems` WRITE;
/*!40000 ALTER TABLE `StocktakeRequestItems` DISABLE KEYS */;
INSERT INTO `StocktakeRequestItems` VALUES ('025e1e32-61cc-4a18-bd59-89e930adab2e','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G','Trà Ô Long Cao Sơn','THANH_PHAM','Piece',38,38,0,'OTHER','Khớp đầu ngày',NULL,NULL,38,38,NULL,NULL,NULL,NULL,NULL,NULL),('0262a7a4-30ef-4a46-8751-675c3d9ccd95','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G','Earl Grey Classic',NULL,NULL,37,37,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('02dd24a2-fbd3-48ad-a1e0-2a86d3d3f4bc','73e7f72f-1b16-4755-9ca0-59bed50fb45a','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('0ad9be59-3a66-40bd-9453-efd77697fdc0','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('0bfb7890-72be-4076-b286-50ddaf119d38','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G','Trà Gừng Mật Ong',NULL,NULL,41,41,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('0db989a3-6287-4034-a42d-122d3c67e439','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt','THANH_PHAM','Piece',26,26,0,'OTHER','Khớp đầu ngày',NULL,NULL,26,26,NULL,NULL,NULL,NULL,NULL,NULL),('0e72289f-b641-4786-b4ce-dd32bbe97940','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','NL-HOASEN-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('0f26aa0c-782e-4d97-9b5c-6c2711e034f8','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','BB-HOP-NHO',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('10bdd973-d8a5-4b82-b7d6-4c6dc891ed0f','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000004','TRA-OL-250G','TRA-OL-250G',NULL,NULL,35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('1542125f-ba5b-4091-818b-675610238b02','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('175a3055-1c75-4ec6-9426-d4217d1305d4','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('17d91b45-5920-4391-bd9e-0107aa67d80a','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2','Ly Sứ Men Ngọc',NULL,NULL,27,27,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('18323165-b764-4cb0-b32c-fa4d2090f743','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G','Trà Lài Thái Nguyên',NULL,NULL,34,34,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('19a26012-a704-4852-8778-047bee6ad773','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000003','TRA-OL-100G','TRA-OL-100G',NULL,NULL,60,60,0,'OTHER','Khớp đầu ngày',NULL,NULL,60,60,NULL,NULL,NULL,NULL,NULL,NULL),('1b416104-41f6-44bd-8f19-b8a7d3c53358','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP','THANH_PHAM','Piece',33,33,0,'OTHER','Khớp đầu ngày',NULL,NULL,33,33,NULL,NULL,NULL,NULL,NULL,NULL),('1bba6f7d-818a-45a5-aa31-1982732b179b','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G','Trà Nhài Long Châu','THANH_PHAM','Piece',32,32,0,'OTHER','Khớp đầu ngày',NULL,NULL,32,32,NULL,NULL,NULL,NULL,NULL,NULL),('1db2f5eb-2a40-4b81-84ce-d65a8f034213','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('1f2e6a1e-fac2-4643-afe8-450782c8fae4','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','NL-OLONG-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('2069aafc-e13d-4ff2-b581-26ab4d0c1f94','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('218076db-0669-4ce2-94cc-0eaacad574fd','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G','Trà Shan Tuyết Lào Cai',NULL,NULL,36,36,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('25b30dd6-2175-4c97-a4b4-f8a1a3de34ed','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000002','TRA-SEN-250G','TRA-SEN-250G',NULL,NULL,25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,25,25,NULL,NULL,NULL,NULL,NULL,NULL),('26ca140e-4c76-4dc4-b5ed-ef0d3e9fee00','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000005','HTRA-DHB-100G','HTRA-DHB-100G',NULL,NULL,30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('283d4c55-22f0-4965-a161-d15c684f495b','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt','THANH_PHAM','Piece',36,36,0,'OTHER','Khớp đầu ngày',NULL,NULL,36,36,NULL,NULL,NULL,NULL,NULL,NULL),('29be472a-ac8b-413a-a714-96c1d74083c5','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G','Trà Xanh Thái Nguyên Đặc Biệt','THANH_PHAM','Piece',42,42,0,'OTHER','Khớp đầu ngày',NULL,NULL,42,42,NULL,NULL,NULL,NULL,NULL,NULL),('2a827775-4144-4444-ad29-dab1b4917f6c','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','NL-DUONGPHEN-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('33de56ee-79de-4f40-ab6d-3cc141782f47','73e7f72f-1b16-4755-9ca0-59bed50fb45a','c6250087-30f0-47e7-a925-0416589a1bb8','NGUYEN-LIEU-SAN-XUAT-G','Nguyên Liệu Sản Xuất',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('36b3c492-e5dc-4ec8-9e6b-bbcf9677dbd5','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','NL-HOASEN-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('3a87b569-6619-49cb-8785-ba6e62874a88','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('3c877779-c04d-469b-8df9-179b54ad67c1','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',NULL,NULL,27,27,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('3cf81f06-b11c-44d2-8b27-a72d4961db8b','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G','Trà Ô Long Nhân Sâm','THANH_PHAM','Piece',25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,25,25,NULL,NULL,NULL,NULL,NULL,NULL),('3ef9a214-1085-430c-b473-2b3738d1b927','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G','Trà Xanh Thái Nguyên Đặc Biệt','THANH_PHAM','Piece',24,24,0,'OTHER','Khớp đầu ngày',NULL,NULL,24,24,NULL,NULL,NULL,NULL,NULL,NULL),('3f8b2c16-a19d-4488-b8e5-513c6bb4de0e','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G','Trà Xanh Thái Nguyên Đặc Biệt',NULL,NULL,24,24,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('4303ff66-a66e-41a3-82d0-29314dc9a54e','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G','Earl Grey Classic','THANH_PHAM','Piece',38,38,0,'OTHER','Khớp đầu ngày',NULL,NULL,38,38,NULL,NULL,NULL,NULL,NULL,NULL),('48a13e3e-bdcd-496c-bbf1-e83b80e99ec9','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','BB-ZIP-100',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('4b7ff3a1-a1eb-482c-ba73-0688976702be','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','NL-ATISO-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('4eab0886-5205-4f6b-80d3-9901b3a9b549','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',NULL,NULL,33,33,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('4f893f71-c9ad-4abb-9967-3a129a509c72','73e7f72f-1b16-4755-9ca0-59bed50fb45a','02575cb5-719e-43e2-a4fd-c70f1c1860f1','BAO-BI-DONG-GOI-CAI','Bao Bì Đóng Gói',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('4f9535cb-b090-4b44-9c7e-938acc021550','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G','Trà Lài Thái Nguyên','THANH_PHAM','Piece',34,34,0,'OTHER','Khớp đầu ngày',NULL,NULL,34,34,NULL,NULL,NULL,NULL,NULL,NULL),('50b76aad-2bc1-439d-a0fb-59b95fb02e29','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G','Trà Nhài Long Châu','THANH_PHAM','Piece',31,31,0,'OTHER','Khớp đầu ngày',NULL,NULL,31,31,NULL,NULL,NULL,NULL,NULL,NULL),('51fe00cd-24ef-4e9e-9658-776a238f62f8','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G','Trà Ô Long Cao Sơn',NULL,NULL,38,38,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('52dd4c44-dcf3-4eb3-abcb-7f574beed666','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G','Matcha Uji Grade A','THANH_PHAM','Piece',40,40,0,'OTHER','Khớp đầu ngày',NULL,NULL,40,40,NULL,NULL,NULL,NULL,NULL,NULL),('5346a169-e7e6-48e5-9011-4025170369b7','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece',31,31,0,'OTHER','Khớp đầu ngày',NULL,NULL,31,31,NULL,NULL,NULL,NULL,NULL,NULL),('539f23cc-e4a3-401c-965c-ffc6a3421b43','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G','Phổ Nhĩ Chín 2019','THANH_PHAM','Piece',29,29,0,'OTHER','Khớp đầu ngày',NULL,NULL,29,29,NULL,NULL,NULL,NULL,NULL,NULL),('566df16d-4bb8-46e9-8ea8-28a71c7386a2','73e7f72f-1b16-4755-9ca0-59bed50fb45a','f4bceb36-e146-4ef1-a9e3-45a70036d3ff','TRA-HOA-NHAI-001-HOP','Trà Hoa Nhài 001',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('56884e0c-d9c7-4097-9e57-969abea931a3','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC','Ly Sứ Men Ngọc','THANH_PHAM','Piece',28,28,0,'OTHER','Khớp đầu ngày',NULL,NULL,28,28,NULL,NULL,NULL,NULL,NULL,NULL),('56da3c84-2be4-4d73-9f09-21df6a7f79ba','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G','Trà Lài Thái Nguyên',NULL,NULL,35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('588bccd0-7423-43a9-8aa1-8fc814156451','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G','Trà Gừng Mật Ong',NULL,NULL,42,42,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('5be7e1c9-933b-43ad-984b-e72b5e690af8','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','TRA-SEN-100G',NULL,NULL,100,100,0,'OTHER','Khớp đầu ngày',NULL,NULL,100,100,NULL,NULL,NULL,NULL,NULL,NULL),('5d95be0c-7074-4234-bbb8-0df9fbf8c6f0','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','BB-ZIP-250',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('60025bc8-81ae-4c78-919a-6a89ef5c4daf','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ','Set Quà Trà Tứ Quý',NULL,NULL,30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('605f097b-6ed9-478f-b69c-0fff07f9ec79','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',NULL,NULL,36,36,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6a5ec97c-3195-4e65-bd55-85f69ee4ba43','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G','Trà Đào Đà Lạt','THANH_PHAM','Piece',35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,35,35,NULL,NULL,NULL,NULL,NULL,NULL),('6c652906-b815-4b82-b789-2a7057e87fda','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('6d00f3be-5a4b-4f56-9a8a-0fe0593b3037','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml','THANH_PHAM','Piece',29,28,-1,'DATA_ENTRY_ERROR','đầu ngày: hệ thống=29, thực tế=28',NULL,NULL,29,28,'2568fe64-2f60-4466-bb86-b049012dd647','PX-20260803-0001',NULL,NULL,NULL,NULL),('6d609663-851d-45a4-ae97-435e9f4220a7','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','f4bceb36-e146-4ef1-a9e3-45a70036d3ff','TRA-HOA-NHAI-001-HOP','Trà Hoa Nhài 001','THANH_PHAM','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('7232e3e2-86e7-4ce5-876b-9abbce021b97','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','02575cb5-719e-43e2-a4fd-c70f1c1860f1','BAO-BI-DONG-GOI-CAI','Bao Bì Đóng Gói','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('73556bd7-9ae5-44a3-8218-4656f8130acd','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','NL-PHUNHI-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('7b6f80f7-818b-4f7e-8a67-d307aca9a3a2','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('7d376487-1e47-4e14-811e-cef07542fede','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G','Trà Sen Tây Hồ','THANH_PHAM','Piece',40,40,0,'OTHER','Khớp đầu ngày',NULL,NULL,40,40,NULL,NULL,NULL,NULL,NULL,NULL),('7e79ea86-8243-42b7-ab0a-177f39916933','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G','Trà Gừng Mật Ong','THANH_PHAM','Piece',42,42,0,'OTHER','Khớp đầu ngày',NULL,NULL,42,42,NULL,NULL,NULL,NULL,NULL,NULL),('7ecf05b1-d6a7-4637-a1e6-88b89238f653','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('80ad76cb-01c0-49c6-98da-b24e6363080b','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','NGUYEN-LIEU-G','Nguyên Liệu','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('8165e3ba-0e13-45c2-a0a0-e7c4182eb1e6','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G','Hồng Trà Đại Hồng Bào','THANH_PHAM','Piece',32,32,0,'OTHER','Khớp đầu ngày',NULL,NULL,32,32,NULL,NULL,NULL,NULL,NULL,NULL),('81f6e024-1e0e-484b-b8ce-f72289761257','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000002','TRA-SEN-250G','TRA-SEN-250G',NULL,NULL,25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('8603b4f9-54bb-40cf-9948-82ffb03e29ad','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000032-0000-4000-8000-0000a2000032','BB-TEM','BB-TEM',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('87d0b9e9-d9e1-4598-8355-fa1af00cb155','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G','Trà Ô Long Nhân Sâm',NULL,NULL,26,26,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('894d8aa0-2628-4e03-8cf9-ceac85395f7f','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G','Trà Sen Tây Hồ','THANH_PHAM','Piece',41,41,0,'OTHER','Khớp đầu ngày',NULL,NULL,41,41,NULL,NULL,NULL,NULL,NULL,NULL),('8a3753ad-ec09-4be1-a727-ab29ea3ba72c','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi','THANH_PHAM','Piece',24,24,0,'OTHER','Khớp đầu ngày',NULL,NULL,24,24,NULL,NULL,NULL,NULL,NULL,NULL),('8f9e24b4-57a2-40a3-8259-2e97781cd213','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','NL-HOASEN-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('8fa82450-764f-4e58-b0f8-42b5c83482d2','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G','Trà Shan Tuyết Lào Cai','THANH_PHAM','Piece',36,36,0,'OTHER','Khớp đầu ngày',NULL,NULL,36,36,NULL,NULL,NULL,NULL,NULL,NULL),('90759f32-dbb7-4a2a-880e-f8861080c020','73e7f72f-1b16-4755-9ca0-59bed50fb45a','6a9570a1-b7ee-4add-bc23-e6cb42a1eb7c','NGUYEN-LIEU-G','Nguyên Liệu',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('950d2d8e-ba73-4378-94c4-904752791363','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi','THANH_PHAM','Piece',25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,25,25,NULL,NULL,NULL,NULL,NULL,NULL),('97a342e1-0cc9-492b-8bb6-6c45561bc814','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G','Trà Shan Tuyết Lào Cai','THANH_PHAM','Piece',37,37,0,'OTHER','Khớp đầu ngày',NULL,NULL,37,37,NULL,NULL,NULL,NULL,NULL,NULL),('99109944-5a26-4dd6-8483-a0246e442ac6','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G','Phổ Nhĩ Chín 2019',NULL,NULL,28,28,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('996deabd-5f86-4767-834f-7118ead12553','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','BB-HOP-LON',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('99a2b4f6-b02a-4169-94f8-176e472db8a2','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','NL-TRAXANH-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('9bcc979d-61b8-4011-a67a-ba980bb8ac4a','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('9bee40d4-9e61-4a52-a693-c18fa8c6e5c9','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','NL-TRAXANH-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('9d3de6ba-dbb5-4719-b3a8-8c337ade3ee1','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000005','HTRA-DHB-100G','HTRA-DHB-100G',NULL,NULL,30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,30,30,NULL,NULL,NULL,NULL,NULL,NULL),('9da0b1b3-639a-4f5f-90e3-c55134da78e6','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt','THANH_PHAM','Piece',26,26,0,'OTHER','Khớp đầu ngày',NULL,NULL,26,26,NULL,NULL,NULL,NULL,NULL,NULL),('a3e6aa8d-7bbf-477c-83a3-74881c4309a4','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G','Trà Ô Long Cao Sơn',NULL,NULL,39,39,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('a80c0ce2-928b-42eb-b1a5-d3c601818a3a','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('a94d8b6f-ab41-41a8-8a77-94b23b1dd4bf','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G','Matcha Uji Grade A',NULL,NULL,39,39,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('ab29b01d-f072-45f9-a010-0b7b3d96377c','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G','Trà Sen Tây Hồ',NULL,NULL,40,40,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('abd2111d-ac28-4193-8d23-fe6c8488da24','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',NULL,NULL,24,24,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('b2946b73-8f65-4a1d-bbcd-f9d13c57e5fd','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G','Matcha Uji Grade A','THANH_PHAM','Piece',39,39,0,'OTHER','Khớp đầu ngày',NULL,NULL,39,39,NULL,NULL,NULL,NULL,NULL,NULL),('b6abf973-3890-4fb2-8597-e335c66dc010','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',NULL,NULL,31,31,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('b8fc011d-71d1-4827-a81f-d9e0dfd50b8d','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G','Trà Ô Long Cao Sơn','THANH_PHAM','Piece',39,39,0,'OTHER','Khớp đầu ngày',NULL,NULL,39,39,NULL,NULL,NULL,NULL,NULL,NULL),('baa86eb2-66ad-4e4e-b98c-a085e14c7a45','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000033-0000-4000-8000-0000a2000033','BB-NILON','BB-NILON',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('bad35509-e5f2-4962-9655-ad57f7422a32','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G','Trà Nhài Long Châu',NULL,NULL,31,31,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('bb1ee0c0-85d9-4f54-b8de-52917a6cf131','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000013','NL-OLONG-1KG','NL-OLONG-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('bbe7a3c6-70c6-436f-abd8-f51700a486fe','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000003','TRA-OL-100G','TRA-OL-100G',NULL,NULL,60,60,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('bc2373b4-1b35-4c81-bb4a-fb565237fdcd','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('bc3837e2-af2f-4aa6-90f6-eaff62ebe1c0','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G','Hồng Trà Đại Hồng Bào',NULL,NULL,32,32,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('bd46c356-e03a-4104-9470-4e8ecd351dc5','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2','Ly Sứ Men Ngọc','THANH_PHAM','Piece',27,27,0,'OTHER','Khớp đầu ngày',NULL,NULL,27,27,NULL,NULL,NULL,NULL,NULL,NULL),('be5aa11b-21db-4c99-8d25-157ed2cbdf08','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G','Trà Lài Thái Nguyên','THANH_PHAM','Piece',35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,35,35,NULL,NULL,NULL,NULL,NULL,NULL),('beba6905-4bdd-4c3e-b2b7-64066979b312','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G','Trà Đào Đà Lạt',NULL,NULL,35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('bf833a88-95d8-443b-81b4-d35acb7b9d41','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ','Set Quà Trà Tứ Quý','THANH_PHAM','Piece',30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,30,30,NULL,NULL,NULL,NULL,NULL,NULL),('c05c274a-8c5b-458a-ab87-b7b060a89ed4','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',NULL,NULL,30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('c30d8030-13a1-45f3-b744-407c80a252c3','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G','Trà Ô Long Nhân Sâm',NULL,NULL,25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('c326e83b-fff8-41c4-8d8c-4a873b964c95','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G','Phổ Nhĩ Chín 2019','THANH_PHAM','Piece',28,28,0,'OTHER','Khớp đầu ngày',NULL,NULL,28,28,NULL,NULL,NULL,NULL,NULL,NULL),('c435753c-c6f3-48aa-a7e4-4e090914b835','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G','Earl Grey Classic',NULL,NULL,38,38,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('c6429869-e274-4ced-8c8b-55e5ad8a9f8a','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G','Hồng Trà Đại Hồng Bào','THANH_PHAM','Piece',33,33,0,'OTHER','Khớp đầu ngày',NULL,NULL,33,33,NULL,NULL,NULL,NULL,NULL,NULL),('c74acd0c-6314-478c-a88b-4cd64ed8c48f','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',NULL,NULL,25,25,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('cd9f05e4-fa2f-4f8e-9811-00b9496071d9','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','NL-SHAN-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('cfc4f9d2-6a91-4218-952f-db0eef3430c9','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC','Ly Sứ Men Ngọc',NULL,NULL,28,28,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('d2756be7-c18d-4bf7-8a40-027bda4c9cfe','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G','Trà Sen Tây Hồ',NULL,NULL,41,41,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('d3a453bd-c830-4268-8355-75e60bdb7f5c','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G','Phổ Nhĩ Chín 2019',NULL,NULL,29,29,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('d403a546-038e-4c5f-bb8e-1d9b767e1058','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G','Trà Nhài Long Châu',NULL,NULL,32,32,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('d517be79-01c0-4ebd-9eb0-5ca7aa8eaa5c','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',NULL,NULL,26,26,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('d94f3a9b-61ca-41e7-9fed-378aa86dcdfe','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT','BAO_BI','Piece',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('da405640-c049-4241-8c1b-879a05092a99','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP','THANH_PHAM','Piece',34,34,0,'OTHER','Khớp đầu ngày',NULL,NULL,34,34,NULL,NULL,NULL,NULL,NULL,NULL),('da5cf8a2-9a71-4e04-ae6a-88dccab63ce5','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G','Trà Shan Tuyết Lào Cai',NULL,NULL,37,37,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('dd9ac802-da0b-46bc-aaf9-911ea1c39b08','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G','Trà Ô Long Nhân Sâm','THANH_PHAM','Piece',26,26,0,'OTHER','Khớp đầu ngày',NULL,NULL,26,26,NULL,NULL,NULL,NULL,NULL,NULL),('e71f8b67-b45f-4183-891c-c12e3f69482b','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G','Hồng Trà Đại Hồng Bào',NULL,NULL,33,33,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('e7a0203c-f202-41e9-a38e-783bb330a5f2','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',NULL,NULL,29,29,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('eb362cff-8f0a-40c4-974b-550bd9e9a6e8','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G','Trà Xanh Thái Nguyên Đặc Biệt',NULL,NULL,42,42,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('ebdfb1cf-8935-4a58-a1fa-cc5bba7d15c1','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','NL-TRAXANH-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('ecbb9b85-9863-4843-9104-903badd6dcc9','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('edf2ff1e-e632-4188-a224-daec17994b8a','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G','Trà Gừng Mật Ong','THANH_PHAM','Piece',41,41,0,'OTHER','Khớp đầu ngày',NULL,NULL,41,41,NULL,NULL,NULL,NULL,NULL,NULL),('ee16c187-6d29-44b7-a9e6-05babac905fa','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G','Matcha Uji Grade A',NULL,NULL,40,40,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('f35d797e-f028-48ec-9acb-05ad1a410a3c','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G','Earl Grey Classic','THANH_PHAM','Piece',37,37,0,'OTHER','Khớp đầu ngày',NULL,NULL,37,37,NULL,NULL,NULL,NULL,NULL,NULL),('f3811e96-5d68-4d44-bc5d-628e154a1dab','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece',30,30,0,'OTHER','Khớp đầu ngày',NULL,NULL,30,30,NULL,NULL,NULL,NULL,NULL,NULL),('f5f99a16-98f5-4b86-b197-c71b196106be','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','c6250087-30f0-47e7-a925-0416589a1bb8','NGUYEN-LIEU-SAN-XUAT-G','Nguyên Liệu Sản Xuất','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('f6f62ab2-d733-48ed-aed9-7af2ccc3fb80','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','20000000-0000-0000-0000-000000000004','TRA-OL-250G','TRA-OL-250G',NULL,NULL,35,35,0,'OTHER','Khớp đầu ngày',NULL,NULL,35,35,NULL,NULL,NULL,NULL,NULL,NULL),('fb9c1cd8-2450-4239-8aaa-255ebd3cc68e','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000013','NL-OLONG-1KG','NL-OLONG-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('fc9ee1d5-ad2d-40dd-a5fa-c197d0eaad92','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','NL-HOALAI-1KG',NULL,NULL,0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('fcbbdeb3-d254-4722-a54a-3a0c90ddadd3','6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết','NGUYEN_LIEU','Gram',0,0,0,'OTHER','Khớp đầu ngày',NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL),('fdac8a85-5ed2-4816-8579-b1660554bdc6','73e7f72f-1b16-4755-9ca0-59bed50fb45a','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',NULL,NULL,34,34,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('ff36961b-9682-42bc-af2d-4aa3526202bd','73e7f72f-1b16-4755-9ca0-59bed50fb45a','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','TRA-SEN-100G',NULL,NULL,100,100,0,'OTHER','Khớp đầu ngày',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `StocktakeRequestItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StocktakeRequests`
--

DROP TABLE IF EXISTS `StocktakeRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StocktakeRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `RequestCode` varchar(30) NOT NULL,
  `Location` varchar(20) NOT NULL,
  `CountDate` datetime(6) NOT NULL,
  `Reason` varchar(500) DEFAULT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `Status` varchar(30) NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedByName` varchar(255) DEFAULT NULL,
  `CreatedByRoleName` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `SubmittedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `ReviewNote` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_StocktakeRequests_RequestCode` (`RequestCode`),
  KEY `IX_StocktakeRequests_CountDate` (`CountDate`),
  KEY `IX_StocktakeRequests_CreatedAt` (`CreatedAt`),
  KEY `IX_StocktakeRequests_CreatedBy` (`CreatedBy`),
  KEY `IX_StocktakeRequests_Location` (`Location`),
  KEY `IX_StocktakeRequests_ReviewedAt` (`ReviewedAt`),
  KEY `IX_StocktakeRequests_Status` (`Status`),
  KEY `IX_StocktakeRequests_SubmittedAt` (`SubmittedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StocktakeRequests`
--

LOCK TABLES `StocktakeRequests` WRITE;
/*!40000 ALTER TABLE `StocktakeRequests` DISABLE KEYS */;
INSERT INTO `StocktakeRequests` VALUES ('6c5e31af-8cbd-42e2-b9ae-b74a73e00fd8','KK-20260803-0001','Shelf','2026-08-03 00:00:00.000000','Kiểm kệ đầu ngày','Tự động tạo khi Sale kiểm kệ đầu ngày POS. Ca: Ca sáng quầy','Completed','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','2026-08-03 04:51:37.288212','2026-08-03 04:52:26.587024','ed9f2604-1baf-43d9-b074-0035e2cb4961','2026-08-03 04:51:37.429757','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','Tran Thi Manager','Manager','2026-08-03 04:52:26.587023','Duyệt kiểm kê'),('73e7f72f-1b16-4755-9ca0-59bed50fb45a','KK-20260731-0001','Shelf','2026-07-31 00:00:00.000000','Kiểm kệ đầu ngày','Tự động tạo khi Sale kiểm kệ đầu ngày POS. Ca: Ca sáng quầy','PendingApproval','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','SalePos','2026-07-31 00:58:13.050671','2026-07-31 00:58:13.239853','ed9f2604-1baf-43d9-b074-0035e2cb4961','2026-07-31 00:58:13.239836',NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `StocktakeRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierProductPriceHistories`
--

DROP TABLE IF EXISTS `SupplierProductPriceHistories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierProductPriceHistories` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierProductId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OldPrice` decimal(18,2) DEFAULT NULL,
  `NewPrice` decimal(18,2) DEFAULT NULL,
  `EffectiveDate` datetime(6) NOT NULL,
  `ChangedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ChangedByName` varchar(255) DEFAULT NULL,
  `ChangedAt` datetime(6) NOT NULL,
  `Reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_SupplierProductPriceHistories_SupplierProductId` (`SupplierProductId`),
  KEY `IX_SupplierProductPriceHistories_SkuId_ChangedAt` (`SkuId`,`ChangedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierProductPriceHistories`
--

LOCK TABLES `SupplierProductPriceHistories` WRITE;
/*!40000 ALTER TABLE `SupplierProductPriceHistories` DISABLE KEYS */;
INSERT INTO `SupplierProductPriceHistories` VALUES ('028b1457-ea91-4bda-a400-91fadc1ee03e','7b6ec62a-9102-479f-a384-684a28e2fa89','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000034-0000-4000-8000-0000a2000034',NULL,18000.00,'2026-07-30 19:38:33.477250','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.477468',NULL),('02e3c7fd-077f-4324-af6a-d1556e8a9646','738fcb22-7a03-457e-a83d-d9c63229ae7e','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002b-0000-4000-8000-0000a200002b',NULL,45000.00,'2026-07-30 19:17:00.766712','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.767893',NULL),('0460d721-5d91-4fd4-836b-5d3403fefeda','8e2c8857-a8bf-48ed-a03b-12f51dce3b34','6a72e704-fa71-4cd8-92b2-1aee24150660','20000000-0000-0000-0000-000000000011',NULL,15000.00,'2026-07-30 17:02:50.214603','07540ee9-1a90-498b-a315-87dc197eeddd','Le Thi Ke Toan','2026-07-30 17:02:50.259515',NULL),('06c0dc12-5115-458c-b372-f1f0ad8ea471','e8d49645-1a08-4393-87e8-e57277693e19','6a72e704-fa71-4cd8-92b2-1aee24150660','953f58df-3312-4217-b1a1-47bf7b830619',NULL,1200.00,'2026-07-30 19:45:37.446297','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.446514',NULL),('070f7784-ef5b-4471-9383-d23e6b0bfb8d','2a113a1f-6f86-4701-a77e-cca0fb05fee6','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000029-0000-4000-8000-0000a2000029',NULL,380000.00,'2026-07-30 19:45:37.416744','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.416929',NULL),('09d0968d-f4bf-46d2-b73f-b603898c7d4b','71b81036-caa5-4677-a62f-b47738208b35','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000028-0000-4000-8000-0000a2000028',NULL,290000.00,'2026-07-30 19:17:00.792913','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.793059',NULL),('1c03469e-dc17-4b35-8af1-af44ccaef247','203400f9-b2c2-463b-a06a-03ce0634cb41','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002e-0000-4000-8000-0000a200002e',NULL,175000.00,'2026-07-30 19:45:37.436386','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.436557',NULL),('1f68659d-75e1-44bd-8c46-32234481ec3b','83466624-4863-4f59-933f-33f498216dfe','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000031-0000-4000-8000-0000a2000031',NULL,5500.00,'2026-07-30 19:38:33.470306','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.470433',NULL),('26fa60d0-15fd-456b-833f-9c42350ab712','ca169bef-5fa5-4fc2-980d-6caed17a71e9','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','953f58df-3312-4217-b1a1-47bf7b830619',NULL,8000.00,'2026-07-31 00:46:32.836282','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-31 00:46:32.865360',NULL),('2d8036eb-fdca-4d96-aac8-e59593cbfc31','80934362-d7e4-4d45-b12c-bd69e9e3f9e8','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002d-0000-4000-8000-0000a200002d',NULL,320000.00,'2026-07-30 19:38:33.402428','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.402574',NULL),('2e5d644f-d13f-43bc-8918-3568709bab88','bc3ca278-3082-4906-8f32-067344cb62b2','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002b-0000-4000-8000-0000a200002b',NULL,45000.00,'2026-07-30 19:38:33.410693','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.410949',NULL),('47c29a48-bc88-4d07-984d-af62ff3d6d08','5dfe59b2-1fb5-4cf8-be4c-1da28daddf0c','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002c-0000-4000-8000-0000a200002c',NULL,85000.00,'2026-07-30 19:38:33.390435','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.391022',NULL),('537fdd08-97c7-4756-ad6e-bbc094dfae0f','a34bd7e0-69cc-4b24-a42a-58da193bc714','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002c-0000-4000-8000-0000a200002c',NULL,85000.00,'2026-07-30 19:45:37.194976','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.239178',NULL),('547f3de2-e89d-4f46-b1be-413a92dc70f0','69496567-8e07-4bfc-b300-5e2cd402eb17','6a72e704-fa71-4cd8-92b2-1aee24150660','953f58df-3312-4217-b1a1-47bf7b830619',NULL,1200.00,'2026-07-30 19:38:33.453841','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.454000',NULL),('5d1d51e5-fee8-4052-a416-00fd9f0280c6','2010c8d7-6479-4117-939b-3b7d1c82dc03','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000028-0000-4000-8000-0000a2000028',NULL,290000.00,'2026-07-30 19:38:33.437419','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.437600',NULL),('5d4d36c5-ee53-443d-a87a-9807a0af80b8','61b856bc-e1a2-4ebe-9dce-26953a46e2b4','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002c-0000-4000-8000-0000a200002c',NULL,85000.00,'2026-07-30 19:17:00.595290','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.636568',NULL),('66ccadc7-0536-4dc5-a239-e4664f5b0b9d','14d35e86-d3a6-411a-aa16-5f04ffce0957','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002d-0000-4000-8000-0000a200002d',NULL,320000.00,'2026-07-30 19:17:00.757155','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.757695',NULL),('681abac8-42f2-447e-a5ed-1d14a4453e8c','873945c8-624b-4a14-bc2e-ac35a6615efb','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002a-0000-4000-8000-0000a200002a',NULL,210000.00,'2026-07-30 19:38:33.420824','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.420976',NULL),('69491bee-14e6-4728-90d8-3a119e924998','83441e79-0bcb-48d8-8630-4389b650bba0','6a72e704-fa71-4cd8-92b2-1aee24150660','02575cb5-719e-43e2-a4fd-c70f1c1860f1',NULL,800.00,'2026-07-30 19:17:00.816291','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.816470',NULL),('77483811-b18c-4593-b269-6253444e5dfe','0e6e03f2-0c69-489d-8d74-1351749c3257','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000029-0000-4000-8000-0000a2000029',NULL,380000.00,'2026-07-30 19:38:33.428665','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.428781',NULL),('835d189d-5d0c-45d8-bf64-2102c3635a77','d415e5c0-4033-4466-9248-cd8ae39ed1e0','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000031-0000-4000-8000-0000a2000031',NULL,5500.00,'2026-07-30 19:17:00.824604','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.824879',NULL),('8be8435e-60a4-4da6-ac5c-982b136da655','3f4cf7a7-ce5f-4cca-809c-f8912cd9d8a4','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002a-0000-4000-8000-0000a200002a',NULL,210000.00,'2026-07-30 19:45:37.407381','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.407560',NULL),('a905007f-10ad-4464-80be-35649c7d9319','bd897a1e-b630-426e-b8c0-027a8b69f104','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','a200002f-0000-4000-8000-0000a200002f',NULL,10000.00,'2026-07-31 00:47:40.636045','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-31 00:47:40.636343',NULL),('b1d57d4a-a55e-49e9-bd68-b76755c9c11f','dca83e1f-1ccd-4c20-9e69-b2147aca51f5','6a72e704-fa71-4cd8-92b2-1aee24150660','953f58df-3312-4217-b1a1-47bf7b830619',NULL,1200.00,'2026-07-30 19:17:00.807095','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.807247',NULL),('b264a24e-a832-4325-92f2-5730f7975c08','9003cc98-d781-4d61-b542-9055e15bd594','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002a-0000-4000-8000-0000a200002a',NULL,210000.00,'2026-07-30 19:17:00.778261','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.778439',NULL),('b43380b5-514f-489c-b86f-b0d49fd86297','ca169bef-5fa5-4fc2-980d-6caed17a71e9','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','953f58df-3312-4217-b1a1-47bf7b830619',8000.00,10000.00,'2026-07-31 00:00:00.000000','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-31 00:49:26.313984','nhà cung cấp báo giá mới'),('b4a306c7-eb8f-46ae-aa89-1373b66260ea','335d45c0-2268-41f9-8aad-ffaabc750d32','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002e-0000-4000-8000-0000a200002e',NULL,175000.00,'2026-07-30 19:17:00.799731','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.799850',NULL),('b5cfabf3-e453-45f1-84b2-3713834f9366','369ff725-78a8-4edf-9679-f09f45d0c2a9','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002b-0000-4000-8000-0000a200002b',NULL,45000.00,'2026-07-30 19:45:37.395205','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.396876',NULL),('ce9f19e9-5729-4331-8342-76c48530f455','bf2bf751-15d1-4afd-a30a-14c94d32037d','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000034-0000-4000-8000-0000a2000034',NULL,18000.00,'2026-07-30 19:45:37.477062','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.477235',NULL),('cfa7ddff-c603-45c4-9b80-f6925581558d','7ac32894-e4a1-40b8-a5a2-dbc6ab9ce8e6','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000029-0000-4000-8000-0000a2000029',NULL,380000.00,'2026-07-30 19:17:00.785716','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.785886',NULL),('d2c0ece2-90db-460c-8b79-def90d3727f5','d16471f3-f767-46ae-997a-dbef3b550fd5','6a72e704-fa71-4cd8-92b2-1aee24150660','02575cb5-719e-43e2-a4fd-c70f1c1860f1',NULL,800.00,'2026-07-30 19:45:37.456864','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.457033',NULL),('df84251c-61e4-4c3a-a711-b49167e766a4','359f2f23-0679-4a87-be07-32a3c183821a','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000034-0000-4000-8000-0000a2000034',NULL,18000.00,'2026-07-30 19:17:00.834437','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:17:00.834601',NULL),('ea52849a-41bd-41e4-93a9-c2ec4a253b32','d50b5999-cd5d-43f9-b7f5-a38aac8c3c24','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002e-0000-4000-8000-0000a200002e',NULL,175000.00,'2026-07-30 19:38:33.446400','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.446560',NULL),('eb7cce11-5a9d-4417-95d5-c50162b64f96','c8bd1db4-6246-40f8-bf9d-e937e0ee0d08','6a72e704-fa71-4cd8-92b2-1aee24150660','02575cb5-719e-43e2-a4fd-c70f1c1860f1',NULL,800.00,'2026-07-30 19:38:33.461513','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:38:33.461722',NULL),('fc1118cf-099f-40a7-b78e-268f9d588efb','b66ebe9a-7bde-4155-b166-251c422c5a7f','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002d-0000-4000-8000-0000a200002d',NULL,320000.00,'2026-07-30 19:45:37.382893','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.383302',NULL),('fc2c0f6c-6ed8-4950-9377-b741d33409e2','ab5dc844-682e-480e-9d42-12d09ad78416','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','a200002b-0000-4000-8000-0000a200002b',NULL,18000.00,'2026-08-03 02:50:45.834403','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-08-03 02:50:45.871118',NULL),('fd40fc26-d173-45ec-96b7-2b5502e7a1f1','98a385fd-63cf-4e4a-8284-5a57038cf5bd','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000031-0000-4000-8000-0000a2000031',NULL,5500.00,'2026-07-30 19:45:37.466265','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.466449',NULL),('fdb3a99b-bb34-4436-8696-ce5c661343c8','86312be9-999e-4c66-a358-0560cf69e605','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000028-0000-4000-8000-0000a2000028',NULL,290000.00,'2026-07-30 19:45:37.426400','32169d95-7a63-4fc9-9ac6-fae527bb4cd9','Kế toán','2026-07-30 19:45:37.426592',NULL);
/*!40000 ALTER TABLE `SupplierProductPriceHistories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierProducts`
--

DROP TABLE IF EXISTS `SupplierProducts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierProducts` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCodeSnapshot` varchar(50) NOT NULL,
  `SkuNameSnapshot` varchar(255) NOT NULL,
  `ProductTypeSnapshot` varchar(50) NOT NULL,
  `InventoryUnitSnapshot` varchar(50) NOT NULL,
  `SupplierItemCode` varchar(50) DEFAULT NULL,
  `NormalizedSupplierItemCode` varchar(50) DEFAULT NULL,
  `SupplierItemName` varchar(255) DEFAULT NULL,
  `QuotedPrice` decimal(18,2) DEFAULT NULL,
  `MinimumOrderQuantity` int DEFAULT NULL,
  `LeadTimeDays` int DEFAULT NULL,
  `IsPrimarySource` tinyint(1) NOT NULL DEFAULT '0',
  `Note` varchar(1000) DEFAULT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_SupplierProducts_SupplierId_SkuId` (`SupplierId`,`SkuId`),
  UNIQUE KEY `IX_SupplierProducts_SupplierId_NormalizedSupplierItemCode` (`SupplierId`,`NormalizedSupplierItemCode`),
  KEY `IX_SupplierProducts_SkuId` (`SkuId`),
  KEY `IX_SupplierProducts_IsActive` (`IsActive`),
  CONSTRAINT `FK_SupplierProducts_Suppliers_SupplierId` FOREIGN KEY (`SupplierId`) REFERENCES `Suppliers` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierProducts`
--

LOCK TABLES `SupplierProducts` WRITE;
/*!40000 ALTER TABLE `SupplierProducts` DISABLE KEYS */;
INSERT INTO `SupplierProducts` VALUES ('ab5dc844-682e-480e-9d42-12d09ad78416','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt - 1kg','NGUYEN_LIEU','Gram','NCC-093923','NCC-093923','Đường Phèn',18000.00,NULL,NULL,0,NULL,1,'2026-08-03 02:50:45.834403','2026-08-03 02:50:45.834403'),('bd897a1e-b630-426e-b8c0-027a8b69f104','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g - Theo chiếc','BAO_BI','Piece','NCC-32323','NCC-32323','Túi zip',10000.00,NULL,NULL,0,NULL,1,'2026-07-31 00:47:40.636045','2026-07-31 00:47:40.636045'),('ca169bef-5fa5-4fc2-980d-6caed17a71e9','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì - cái','BAO_BI','Piece','NCC-9329332','NCC-9329332','Bao bì cái',10000.00,NULL,NULL,0,NULL,1,'2026-07-31 00:46:32.836282','2026-07-31 00:49:26.313924');
/*!40000 ALTER TABLE `SupplierProducts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierReceiptItems`
--

DROP TABLE IF EXISTS `SupplierReceiptItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierReceiptItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierReceiptId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuNameSnapshot` varchar(255) NOT NULL,
  `ProductTypeSnapshot` varchar(30) NOT NULL,
  `InventoryUnitSnapshot` varchar(20) NOT NULL,
  `SubmittedUnit` varchar(20) DEFAULT NULL,
  `SubmittedQuantity` decimal(18,3) NOT NULL,
  `Quantity` int NOT NULL,
  `UnitCost` decimal(18,2) DEFAULT NULL,
  `LotCode` varchar(50) NOT NULL,
  `ManufacturedAt` datetime(6) DEFAULT NULL,
  `ExpiresAt` datetime(6) DEFAULT NULL,
  `ActualReceivedQuantity` int NOT NULL,
  `QualityNote` varchar(500) DEFAULT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) DEFAULT NULL,
  `WarehouseQtyBefore` int DEFAULT NULL,
  `WarehouseQtyAfter` int DEFAULT NULL,
  `ShelfQtyBefore` int DEFAULT NULL,
  `ShelfQtyAfter` int DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `DocumentQuantity` decimal(18,3) NOT NULL DEFAULT '0.000',
  `LineAmount` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_SupplierReceiptItems_LotCode` (`LotCode`),
  KEY `IX_SupplierReceiptItems_SkuId` (`SkuId`),
  KEY `IX_SupplierReceiptItems_SupplierReceiptId` (`SupplierReceiptId`),
  KEY `IX_SupplierReceiptItems_WarehouseBatchId` (`WarehouseBatchId`),
  CONSTRAINT `FK_SupplierReceiptItems_SupplierReceipts_SupplierReceiptId` FOREIGN KEY (`SupplierReceiptId`) REFERENCES `SupplierReceipts` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierReceiptItems_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierReceiptItems`
--

LOCK TABLES `SupplierReceiptItems` WRITE;
/*!40000 ALTER TABLE `SupplierReceiptItems` DISABLE KEYS */;
INSERT INTO `SupplierReceiptItems` VALUES ('0302cb29-6996-44a6-b0cc-34fd6eb3eafe','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn','BAO_BI','Piece','piece',30.000,30,3500.00,'NCC-LOT-011','2026-01-14 00:00:00.000000','2027-01-14 00:00:00.000000',30,NULL,'095adead-a995-4b82-8b5b-76856897bc5e','SR-0302CB29699644A6B0CC34FD6EB3EAFE',660,690,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',30.000,105000.00),('12641583-ef99-4912-b85a-a64751496ae3','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt','NGUYEN_LIEU','Gram','kg',1000.000,1000000,220.00,'NCC-LOT-002','2026-01-05 00:00:00.000000','2027-01-05 00:00:00.000000',1000000,NULL,'395e419f-4fdb-4f4f-bdf6-406bffb45380','SR-12641583EF994912B85AA64751496AE3',98000,1098000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',1000.000,220000.00),('1515e560-1465-4317-b211-96f774e28a3b','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ','NGUYEN_LIEU','Gram','kg',1500.000,1500000,350.00,'NCC-LOT-004','2026-01-07 00:00:00.000000','2027-01-07 00:00:00.000000',1500000,'Đạt có ghi chú: hơi ẩm nhẹ, đã kiểm tra cảm quan','d6fafaec-4724-4195-a6ea-7f63fa0c90a4','SR-1515E56014654317B21196F774E28A3B',96000,1596000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',1500.000,525000.00),('29fc7729-2fe7-4159-8529-35a3a1b3cf78','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt','THANH_PHAM','Piece','piece',12.000,12,120000.00,'NCC-LOT-020','2026-01-23 00:00:00.000000','2027-01-23 00:00:00.000000',12,NULL,'dc74dc60-6298-420b-a506-ae65ec764efc','SR-29FC77292FE74159852935A3A1B3CF78',140,152,26,26,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',12.000,1440000.00),('2fe5ef63-246e-413a-aa13-540cf6bf69c9','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP','THANH_PHAM','Piece','piece',30.000,30,85000.00,'NCC-LOT-025','2026-01-08 00:00:00.000000','2027-01-08 00:00:00.000000',30,NULL,'5cab4e6e-6a97-43ad-97ed-05045a4cef08','SR-2FE5EF63246E413AAA13540CF6BF69C9',128,158,33,33,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',30.000,2550000.00),('3971f49d-6f97-4686-8a27-7a2f24a1786e','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô','NGUYEN_LIEU','Gram','kg',500.000,500000,180.00,'NCC-LOT-006','2026-01-09 00:00:00.000000','2027-01-09 00:00:00.000000',500000,NULL,'83cfba1d-6ec8-4836-9005-f864b75a6d1f','SR-3971F49D6F9746868A277A2F24A1786E',100000,600000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',500.000,90000.00),('44fac655-8ecd-44df-a83a-d2d349a3cc9f','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết','NGUYEN_LIEU','Gram','kg',1000.000,1000000,220.00,'NCC-LOT-007','2026-01-10 00:00:00.000000','2027-01-10 00:00:00.000000',1000000,NULL,'d9e33535-c11c-4183-b4f5-0991cf999f51','SR-44FAC6558ECD44DFA83AD2D349A3CC9F',100000,1100000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',1000.000,220000.00),('4f7168f0-2fa3-4843-9f1e-8987da0d8153','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm','BAO_BI','Piece','piece',12.000,12,2500.00,'NCC-LOT-013','2026-01-16 00:00:00.000000','2027-01-16 00:00:00.000000',12,NULL,'7936c2fe-19c6-4571-93cc-f65e80f1956d','SR-4F7168F02FA348439F1E8987DA0D8153',654,666,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',12.000,30000.00),('5967018b-5dd6-4c8b-b78e-31b9493f0822','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi','THANH_PHAM','Piece','piece',12.000,12,95000.00,'NCC-LOT-027','2026-01-10 00:00:00.000000','2027-01-10 00:00:00.000000',12,NULL,'872a2b71-c8c9-4a11-a46d-4499ff5274b2','SR-5967018B5DD64C8BB78E31B9493F0822',138,150,25,25,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',12.000,1140000.00),('5dee5cf5-94fe-43f4-b9dd-26008cb1886d','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml','THANH_PHAM','Piece','piece',25.000,25,85000.00,'NCC-LOT-019','2026-01-22 00:00:00.000000','2027-01-22 00:00:00.000000',25,NULL,'9f89929a-a697-4cde-a8c0-3cd896d47a01','SR-5DEE5CF594FE43F4B9DD26008CB1886D',124,149,29,29,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',25.000,2125000.00),('7197b46b-483b-417d-874d-74f4de12a608','043a492a-e720-4aa2-b566-07f86b18c8aa','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt','NGUYEN_LIEU','Gram','kg',10.000,10000,18000.00,'75575957957','2026-08-01 00:00:00.000000','2026-08-26 00:00:00.000000',10000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-03 02:55:44.214704','2026-08-03 02:55:44.214704',10.000,180000.00),('7f5af7ea-a3e7-4bf2-bb18-0bd402504d91','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g','BAO_BI','Piece','piece',20.000,20,500.00,'NCC-LOT-016','2026-01-19 00:00:00.000000','2027-01-19 00:00:00.000000',20,NULL,'af0a2cae-52c6-49f3-9766-ea880d26cc35','SR-7F5AF7EAA3E74BF2BB180BD402504D91',640,660,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',20.000,10000.00),('89e63cb2-8ba4-4cf4-b347-724cc6cc5172','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên','NGUYEN_LIEU','Gram','kg',2000.000,2000000,150.00,'NCC-LOT-008','2026-01-11 00:00:00.000000','2027-01-11 00:00:00.000000',2000000,NULL,'d01ce800-fb9c-4876-a6b2-5d1ad063f00b','SR-89E63CB28BA44CF4B347724CC6CC5172',94000,2094000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',2000.000,300000.00),('8e7868c9-200d-487e-939e-e18e9de498ed','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi','THANH_PHAM','Piece','piece',25.000,25,120000.00,'NCC-LOT-026','2026-01-09 00:00:00.000000','2027-01-09 00:00:00.000000',25,NULL,'61dfb76a-1419-498d-895d-22ef24b89d48','SR-8E7868C9200D487E939EE18E9DE498ED',138,163,24,24,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',25.000,3000000.00),('90890d51-8910-41ae-b6c2-4bfec96d9fae','5fa422bf-ab75-4174-8e25-ac5ef4467038','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ','BAO_BI','Piece','piece',12.000,12,12.00,'34534534564','2026-07-28 00:00:00.000000','2026-08-27 00:00:00.000000',12,NULL,'5b5002ca-831e-4783-8e0c-f13a12dfe33f','SR-90890D51891041AEB6C24BFEC96D9FAE',644,656,0,0,'2026-08-03 03:37:11.175844','2026-08-03 03:37:11.179088',12.000,144.00),('9d0b0870-1586-4ccf-a0ee-7615a621af98','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh','NGUYEN_LIEU','Gram','kg',500.000,500000,180.00,'NCC-LOT-001','2026-01-04 00:00:00.000000','2027-01-04 00:00:00.000000',500000,'Đạt — bao bì nguyên vẹn','693a0e5a-d3b4-4116-b559-c5f89d713ae0','SR-9D0B087015864CCFA0EE7615A621AF98',98000,598000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',500.000,90000.00),('a958863e-9961-4784-b3d1-8718c81908f9','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ','BAO_BI','Piece','piece',25.000,25,4500.00,'NCC-LOT-012','2026-01-15 00:00:00.000000','2027-01-15 00:00:00.000000',25,NULL,'166f6753-cae7-4058-8f91-748c79c6ac98','SR-A958863E99614784B3D18718C81908F9',656,681,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',25.000,112500.00),('aacb736d-ee8d-410f-85c7-dda29e71eaa3','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt','THANH_PHAM','Piece','piece',8.000,8,150000.00,'NCC-LOT-028','2026-01-11 00:00:00.000000','2027-01-11 00:00:00.000000',8,NULL,'bcbc5c0f-e433-4588-a479-f0cea01bc204','SR-AACB736DEE8D410F85C7DDA29E71EAA3',130,138,36,36,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',8.000,1200000.00),('c216ccff-42ef-4965-b284-49153577cd35','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt','THANH_PHAM','Piece','piece',8.000,8,95000.00,'NCC-LOT-021','2026-01-04 00:00:00.000000','2027-01-04 00:00:00.000000',8,NULL,'e926c252-4091-41c2-98c3-33f84457b158','SR-C216CCFF42EF4965B28449153577CD35',140,148,26,26,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',8.000,760000.00),('c953b48c-fbeb-4d7f-a9d8-0e76e70a25a0','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô','NGUYEN_LIEU','Gram','kg',2000.000,2000000,150.00,'NCC-LOT-003','2026-01-06 00:00:00.000000','2027-01-06 00:00:00.000000',2000000,NULL,'fb1421db-060b-46e7-bb70-5814d5a3b746','SR-C953B48CFBEB4D7FA9D80E76E70A25A0',96000,2096000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',2000.000,300000.00),('cafa2f16-e36c-4dc8-ab4c-48c9f1a1e2af','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece','piece',20.000,20,75000.00,'NCC-LOT-023','2026-01-06 00:00:00.000000','2027-01-06 00:00:00.000000',20,NULL,'cc9ba807-8010-40af-a837-1e5adc363bc7','SR-CAFA2F16E36C4DC8AB4C48C9F1A1E2AF',144,164,31,31,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',20.000,1500000.00),('da0aa638-d1d7-4942-a9b7-d767b23a999f','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP','THANH_PHAM','Piece','piece',15.000,15,210000.00,'NCC-LOT-024','2026-01-07 00:00:00.000000','2027-01-07 00:00:00.000000',15,NULL,'32a35341-b941-4223-9a98-8c7b595efe6c','SR-DA0AA638D1D74942A9B7D767B23A999F',128,143,34,34,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',15.000,3150000.00),('dc740d0e-92f1-4115-bddc-bc6ff2fa5143','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm','THANH_PHAM','Piece','piece',10.000,10,150000.00,'NCC-LOT-022','2026-01-05 00:00:00.000000','2027-01-05 00:00:00.000000',10,NULL,'2ff8a597-ea32-4293-ab76-3156fbe91376','SR-DC740D0E92F14115BDDCBC6FF2FA5143',144,154,30,30,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',10.000,1500000.00),('e28548b1-82ee-456a-8441-6fabe2220deb','10906710-ce7b-4800-b774-51fb54780366','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì','BAO_BI','cái','piece',12.000,12,10000.00,'4645456','2026-08-01 00:00:00.000000','2026-08-28 00:00:00.000000',12,NULL,'75f542f6-62d4-4dbc-8c3d-9c7a86b48126','SR-E28548B182EE456A84416FABE2220DEB',0,12,0,0,'2026-08-03 03:34:45.915675','2026-08-03 03:34:46.026935',12.000,120000.00),('e9f3d2a3-7c36-4b92-9da0-3f8501d67ecf','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g','BAO_BI','Piece','piece',10.000,10,1500.00,'NCC-LOT-015','2026-01-18 00:00:00.000000','2027-01-18 00:00:00.000000',10,NULL,'a752280d-39b5-4dd4-9613-7f9e2f2f3450','SR-E9F3D2A37C364B929DA03F8501D67ECF',634,644,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',10.000,15000.00),('ef0e8e96-9b01-499e-ae6d-8e157e3b59a7','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng','NGUYEN_LIEU','Gram','kg',800.000,800000,90.00,'NCC-LOT-005','2026-01-08 00:00:00.000000','2027-01-08 00:00:00.000000',800000,NULL,'4ccf9679-9bf4-4d14-9ea3-c544de4bf656','SR-EF0E8E969B01499EAE6D8E157E3B59A7',94000,894000,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',800.000,72000.00),('f32018bd-9531-4ccb-a365-9f928bdc3625','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT','BAO_BI','Piece','piece',8.000,8,8000.00,'NCC-LOT-014','2026-01-17 00:00:00.000000','2027-01-17 00:00:00.000000',8,NULL,'3a9381e1-5393-4dfb-8db5-32694adcf014','SR-F32018BD95314CCBA3659F928BDC3625',650,658,0,0,'2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034',8.000,64000.00);
/*!40000 ALTER TABLE `SupplierReceiptItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierReceipts`
--

DROP TABLE IF EXISTS `SupplierReceipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierReceipts` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReceiptCode` varchar(30) NOT NULL,
  `SupplierName` varchar(255) DEFAULT NULL,
  `SupplierReference` varchar(100) DEFAULT NULL,
  `SupplierDocumentNumber` varchar(100) DEFAULT NULL,
  `SupplierDocumentDate` datetime(6) DEFAULT NULL,
  `ReceivedDate` datetime(6) NOT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `Status` varchar(30) NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedByName` varchar(255) DEFAULT NULL,
  `CreatedByRoleName` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `SubmittedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SubmittedAt` datetime(6) DEFAULT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `ReviewNote` varchar(500) DEFAULT NULL,
  `StockImportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `StockImportSlipCode` varchar(30) DEFAULT NULL,
  `SupplierId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `DeliveredByName` varchar(255) DEFAULT NULL,
  `OriginalDocumentReference` varchar(500) DEFAULT NULL,
  `TotalAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `SupplierNameSnapshot` varchar(255) DEFAULT NULL,
  `SupplierCodeSnapshot` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_SupplierReceipts_ReceiptCode` (`ReceiptCode`),
  KEY `IX_SupplierReceipts_CreatedAt` (`CreatedAt`),
  KEY `IX_SupplierReceipts_CreatedBy` (`CreatedBy`),
  KEY `IX_SupplierReceipts_ReceivedDate` (`ReceivedDate`),
  KEY `IX_SupplierReceipts_Status` (`Status`),
  KEY `IX_SupplierReceipts_StockImportSlipId` (`StockImportSlipId`),
  KEY `IX_SupplierReceipts_SupplierName` (`SupplierName`),
  KEY `IX_SupplierReceipts_SupplierId` (`SupplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierReceipts`
--

LOCK TABLES `SupplierReceipts` WRITE;
/*!40000 ALTER TABLE `SupplierReceipts` DISABLE KEYS */;
INSERT INTO `SupplierReceipts` VALUES ('043a492a-e720-4aa2-b566-07f86b18c8aa','NCC-20260803-0001','Công ty TNHH bao bì việt nam',NULL,'12312312312314','2026-08-02 17:00:00.000000','2026-08-02 00:00:00.000000',NULL,'PendingApproval','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 02:55:44.214704','2026-08-03 02:55:44.376269','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 02:55:44.376255',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'54a0287b-aa65-47b5-9cab-2c4c649bcbb2',NULL,NULL,180000.00,'Công ty TNHH bao bì việt nam','NCC-000002'),('10906710-ce7b-4800-b774-51fb54780366','NCC-20260803-0002','Công ty TNHH bao bì việt nam',NULL,'435645456453645654','2026-08-02 17:00:00.000000','2026-08-02 00:00:00.000000',NULL,'Completed','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 03:34:45.915675','2026-08-03 03:34:46.026935','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:34:45.915675','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 03:34:46.026935',NULL,'9140b444-2149-4c23-89dd-23ffcbd8e489','PN-20260803-0001','54a0287b-aa65-47b5-9cab-2c4c649bcbb2',NULL,NULL,120000.00,'Công ty TNHH bao bì việt nam','NCC-000002'),('5fa422bf-ab75-4174-8e25-ac5ef4467038','NCC-20260803-0003','Công ty TNHH bao bì việt nam',NULL,'4364554355476','2026-08-02 17:00:00.000000','2026-08-02 00:00:00.000000',NULL,'Completed','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 03:37:11.175844','2026-08-03 03:37:11.179088','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:37:11.175844','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 03:37:11.179088',NULL,'f782f59c-5bd7-42c6-9868-04c808756404','PN-20260803-0002','54a0287b-aa65-47b5-9cab-2c4c649bcbb2',NULL,NULL,144.00,'Công ty TNHH bao bì việt nam','NCC-000002'),('c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Công ty TNHH trà đạo việt nam','PN-HVT-2026-0729','HD-NCC-8842','2026-07-27 17:00:00.000000','2026-07-28 00:00:00.000000','Nhập theo hóa đơn HD-NCC-8842 — hàng đủ số lượng, ưu tiên FEFO khi xuất','Completed','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 04:48:29.500336','2026-08-03 04:48:29.588034','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.500336','eeb2c541-38fe-4e73-8784-4381bae0f5c6','Thủ kho','Warehouse','2026-08-03 04:48:29.588034',NULL,'31045aeb-2b87-469e-af01-c26d102ee925','PN-20260803-0003','6a72e704-fa71-4cd8-92b2-1aee24150660','Nguyễn Văn Minh','Theo hóa đơn số HD-NCC-8842 ngày 28 tháng 07 năm 2026 của Công ty TNHH Nguyên liệu Tây Bắc',20518500.00,'Công ty TNHH trà đạo việt nam','NCC-000001');
/*!40000 ALTER TABLE `SupplierReceipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierReturnEvidenceImages`
--

DROP TABLE IF EXISTS `SupplierReturnEvidenceImages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierReturnEvidenceImages` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierReturnRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ImageUrl` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SortOrder` int NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_SupplierReturnEvidenceImages_SupplierReturnRequestId` (`SupplierReturnRequestId`),
  CONSTRAINT `FK_SupplierReturnEvidenceImages_SupplierReturnRequests_Supplier~` FOREIGN KEY (`SupplierReturnRequestId`) REFERENCES `SupplierReturnRequests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierReturnEvidenceImages`
--

LOCK TABLES `SupplierReturnEvidenceImages` WRITE;
/*!40000 ALTER TABLE `SupplierReturnEvidenceImages` DISABLE KEYS */;
/*!40000 ALTER TABLE `SupplierReturnEvidenceImages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierReturnRequestItems`
--

DROP TABLE IF EXISTS `SupplierReturnRequestItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierReturnRequestItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SupplierReturnRequestId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `SkuSnapshotName` varchar(255) NOT NULL,
  `Quantity` int NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `WarehouseBatchLotCode` varchar(50) DEFAULT NULL,
  `WarehouseQtyBefore` int DEFAULT NULL,
  `WarehouseQtyAfter` int DEFAULT NULL,
  `ShelfQtyBefore` int DEFAULT NULL,
  `ShelfQtyAfter` int DEFAULT NULL,
  `StockExportSlipId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `StockExportSlipCode` varchar(30) DEFAULT NULL,
  `Note` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_SupplierReturnRequestItems_SkuId` (`SkuId`),
  KEY `IX_SupplierReturnRequestItems_StockExportSlipId` (`StockExportSlipId`),
  KEY `IX_SupplierReturnRequestItems_SupplierReturnRequestId` (`SupplierReturnRequestId`),
  KEY `IX_SupplierReturnRequestItems_WarehouseBatchId` (`WarehouseBatchId`),
  CONSTRAINT `FK_SupplierReturnRequestItems_SupplierReturnRequests_SupplierRet` FOREIGN KEY (`SupplierReturnRequestId`) REFERENCES `SupplierReturnRequests` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_SupplierReturnRequestItems_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierReturnRequestItems`
--

LOCK TABLES `SupplierReturnRequestItems` WRITE;
/*!40000 ALTER TABLE `SupplierReturnRequestItems` DISABLE KEYS */;
/*!40000 ALTER TABLE `SupplierReturnRequestItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SupplierReturnRequests`
--

DROP TABLE IF EXISTS `SupplierReturnRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SupplierReturnRequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReturnCode` varchar(30) NOT NULL,
  `SupplierReceiptId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SupplierReceiptCode` varchar(30) DEFAULT NULL,
  `SupplierName` varchar(255) DEFAULT NULL,
  `SupplierReference` varchar(100) DEFAULT NULL,
  `Reason` varchar(500) DEFAULT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `Status` varchar(30) NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedByName` varchar(255) DEFAULT NULL,
  `CreatedByRoleName` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `ReviewedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ReviewedByName` varchar(255) DEFAULT NULL,
  `ReviewedByRoleName` varchar(100) DEFAULT NULL,
  `ReviewedAt` datetime(6) DEFAULT NULL,
  `ReviewNote` varchar(500) DEFAULT NULL,
  `DefectReasonCode` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `OperationId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_SupplierReturnRequests_ReturnCode` (`ReturnCode`),
  UNIQUE KEY `IX_SupplierReturnRequests_OperationId` (`OperationId`),
  KEY `IX_SupplierReturnRequests_CreatedAt` (`CreatedAt`),
  KEY `IX_SupplierReturnRequests_CreatedBy` (`CreatedBy`),
  KEY `IX_SupplierReturnRequests_Status` (`Status`),
  KEY `IX_SupplierReturnRequests_SupplierReceiptCode` (`SupplierReceiptCode`),
  KEY `IX_SupplierReturnRequests_SupplierReceiptId` (`SupplierReceiptId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SupplierReturnRequests`
--

LOCK TABLES `SupplierReturnRequests` WRITE;
/*!40000 ALTER TABLE `SupplierReturnRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `SupplierReturnRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Suppliers`
--

DROP TABLE IF EXISTS `Suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Suppliers` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Name` varchar(255) NOT NULL,
  `Phone` varchar(20) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Address` varchar(500) DEFAULT NULL,
  `Note` varchar(1000) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `SupplierCode` varchar(50) NOT NULL,
  `NormalizedSupplierCode` varchar(50) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_Suppliers_NormalizedSupplierCode` (`NormalizedSupplierCode`),
  KEY `IX_Suppliers_IsDeleted` (`IsDeleted`),
  KEY `IX_Suppliers_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Suppliers`
--

LOCK TABLES `Suppliers` WRITE;
/*!40000 ALTER TABLE `Suppliers` DISABLE KEYS */;
INSERT INTO `Suppliers` VALUES ('54a0287b-aa65-47b5-9cab-2c4c649bcbb2','Công ty TNHH bao bì việt nam','0948393238','huyasus2852@gmail.com','59 trịnh công sơn',NULL,0,'2026-07-31 00:46:12.502829','2026-07-31 00:46:12.502829','NCC-000002','NCC-000002'),('6a72e704-fa71-4cd8-92b2-1aee24150660','Công ty TNHH trà đạo việt nam','0966808596','huyasus2852@gmail.com','63 trường tộ thành phố vinh nghệ an','Nhà cung cấp nguyên liệu trà',0,'2026-07-22 13:25:55.482540','2026-07-30 20:13:27.803111','NCC-000001','NCC-000001');
/*!40000 ALTER TABLE `Suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WarehouseBatchItems`
--

DROP TABLE IF EXISTS `WarehouseBatchItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WarehouseBatchItems` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `WarehouseBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuCode` varchar(50) NOT NULL,
  `ProductSnapshotName` varchar(255) DEFAULT NULL,
  `QuantityOnHand` int NOT NULL,
  `InitialQuantity` int NOT NULL,
  `UnitCost` decimal(18,2) DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_WarehouseBatchItems_WarehouseBatchId_SkuId` (`WarehouseBatchId`,`SkuId`),
  KEY `IX_WarehouseBatchItems_SkuId` (`SkuId`),
  KEY `IX_WarehouseBatchItems_WarehouseBatchId` (`WarehouseBatchId`),
  CONSTRAINT `FK_WarehouseBatchItems_WarehouseBatches_WarehouseBatchId` FOREIGN KEY (`WarehouseBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WarehouseBatchItems`
--

LOCK TABLES `WarehouseBatchItems` WRITE;
/*!40000 ALTER TABLE `WarehouseBatchItems` DISABLE KEYS */;
INSERT INTO `WarehouseBatchItems` VALUES ('0972d825-d560-401b-ad06-5f185a5ba6fe','32a35341-b941-4223-9a98-8c7b595efe6c','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',15,15,NULL,'2026-08-03 04:48:29.764310','2026-08-03 04:48:29.764310'),('111da268-43f2-4ac1-9181-60df81b0ec44','75f542f6-62d4-4dbc-8c3d-9c7a86b48126','953f58df-3312-4217-b1a1-47bf7b830619','BAO-BI-CAI','Bao Bì',12,12,NULL,'2026-08-03 03:34:46.047072','2026-08-03 03:34:46.047072'),('1524cc28-169e-4eba-ab0d-3a1c6bd62269','4ccf9679-9bf4-4d14-9ea3-c544de4bf656','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng',800000,800000,NULL,'2026-08-03 04:48:29.839000','2026-08-03 04:48:29.839000'),('16e878ff-24a8-45e1-85a4-7da3112b6310','095adead-a995-4b82-8b5b-76856897bc5e','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn',30,30,NULL,'2026-08-03 04:48:29.602716','2026-08-03 04:48:29.602716'),('21dc7a7d-fe08-4427-a3b8-6b5397b20b99','3a9381e1-5393-4dfb-8db5-32694adcf014','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT',8,8,NULL,'2026-08-03 04:48:29.703131','2026-08-03 04:48:29.703131'),('279336a2-f393-4f1a-ae43-f0f9ba0dd8c7','395e419f-4fdb-4f4f-bdf6-406bffb45380','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt',1000000,1000000,NULL,'2026-08-03 04:48:29.814862','2026-08-03 04:48:29.814862'),('30861194-4c7f-4df1-86a2-603db42ba678','5b5002ca-831e-4783-8e0c-f13a12dfe33f','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',12,12,NULL,'2026-08-03 03:37:11.180522','2026-08-03 03:37:11.180522'),('30868b95-996e-4d55-85f1-28ce528189fa','83cfba1d-6ec8-4836-9005-f864b75a6d1f','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô',500000,500000,NULL,'2026-08-03 04:48:29.847898','2026-08-03 04:48:29.847898'),('3121d055-ec20-468f-a956-b9b78ff52243','e926c252-4091-41c2-98c3-33f84457b158','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',8,8,NULL,'2026-08-03 04:48:29.743050','2026-08-03 04:48:29.743050'),('3e92404b-0665-4508-9cff-cb87f964b31b','cc9ba807-8010-40af-a837-1e5adc363bc7','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',20,20,NULL,'2026-08-03 04:48:29.757490','2026-08-03 04:48:29.757490'),('45513165-3408-4ac3-9c3a-ceccf24c23bd','d6fafaec-4724-4195-a6ea-7f63fa0c90a4','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ',1500000,1500000,NULL,'2026-08-03 04:48:29.830790','2026-08-03 04:48:29.830790'),('51e2ee79-fb4f-4044-ab79-6034de7c2cbb','d9e33535-c11c-4183-b4f5-0991cf999f51','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết',1000000,1000000,NULL,'2026-08-03 04:48:29.856419','2026-08-03 04:48:29.856419'),('5794b7ff-3d94-4a28-bc49-b73a7ed28181','d01ce800-fb9c-4876-a6b2-5d1ad063f00b','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên',2000000,2000000,NULL,'2026-08-03 04:48:29.864878','2026-08-03 04:48:29.864878'),('6683b0aa-b37e-490b-9050-12a3efbf05b9','302b784c-d847-4d26-b6cb-a8ba34f628d9','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ',100,100,NULL,'2026-07-21 02:45:48.918171','2026-07-21 02:45:48.918171'),('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ 100g',120,200,90000.00,'2026-01-01 08:00:00.000000','2026-01-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','TRA-SEN-250G','Trà Sen Tây Hồ 250g',90,150,210000.00,'2026-01-01 08:00:00.000000','2026-01-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','TRA-OL-100G','Trà Ô Long Cao Sơn 100g',150,250,70000.00,'2026-01-01 08:00:00.000000','2026-01-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','TRA-OL-250G','Trà Ô Long Cao Sơn 250g',120,180,165000.00,'2026-01-01 08:00:00.000000','2026-01-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000005','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','HTRA-DHB-100G','Hồng Trà Đại Hồng Bào 100g',140,200,110000.00,'2026-01-01 08:00:00.000000','2026-01-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000006','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000011','NL-TRAXANH-1KG','Trà xanh thô 1kg',141000,200000,120.00,'2026-01-01 08:00:00.000000','2026-08-03 02:24:45.455858'),('70000000-0000-0000-0000-000000000007','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000012','NL-HOASEN-1KG','Hoa sen khô 1kg',58000,100000,350.00,'2026-01-01 08:00:00.000000','2026-08-03 02:24:45.455858'),('70000000-0000-0000-0000-000000000008','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000013','NL-OLONG-1KG','Lá trà ô long thô 1kg',120000,180000,140.00,'2026-01-01 08:00:00.000000','2026-08-03 02:24:45.455858'),('70000000-0000-0000-0000-000000000009','60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','TRA-SEN-100G','Trà Sen Tây Hồ 100g',60,60,92000.00,'2026-06-01 08:00:00.000000','2026-06-01 08:00:00.000000'),('70000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','TRA-OL-100G','Trà Ô Long Cao Sơn 100g',100,100,72000.00,'2026-06-01 08:00:00.000000','2026-06-01 08:00:00.000000'),('77beb334-45d6-421c-8703-90fe78b14b1d','693a0e5a-d3b4-4116-b559-c5f89d713ae0','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh',500000,500000,NULL,'2026-08-03 04:48:29.806696','2026-08-03 04:48:29.806696'),('794dd668-1bf6-4ccf-af93-8e6849a57d6c','5cab4e6e-6a97-43ad-97ed-05045a4cef08','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',30,30,NULL,'2026-08-03 04:48:29.771684','2026-08-03 04:48:29.771684'),('7ae3f9ed-d0a7-43ee-ad13-6e0e6a0a636e','7936c2fe-19c6-4571-93cc-f65e80f1956d','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm',12,12,NULL,'2026-08-03 04:48:29.693874','2026-08-03 04:48:29.693874'),('807ce11e-42c7-471c-a494-0bee62e493f0','2ff8a597-ea32-4293-ab76-3156fbe91376','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',10,10,NULL,'2026-08-03 04:48:29.750304','2026-08-03 04:48:29.750304'),('826ad6f4-696f-447d-a7a6-944b0ace7666','9f89929a-a697-4cde-a8c0-3cd896d47a01','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',25,25,NULL,'2026-08-03 04:48:29.728268','2026-08-03 04:48:29.728268'),('844470a2-fd6c-47ad-819f-18ed8f3125ea','bcbc5c0f-e433-4588-a479-f0cea01bc204','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',8,8,NULL,'2026-08-03 04:48:29.794262','2026-08-03 04:48:29.794262'),('9a24fd0a-7bb6-4771-aa0c-c5c2f73bd423','fb1421db-060b-46e7-bb70-5814d5a3b746','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô',2000000,2000000,NULL,'2026-08-03 04:48:29.823075','2026-08-03 04:48:29.823075'),('a3500001-0000-4000-8000-0000a3500001','a3000001-0000-4000-8000-0000a3000001','a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G','Trà Sen Tây Hồ',79,79,95000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500002-0000-4000-8000-0000a3500002','a3000002-0000-4000-8000-0000a3000002','a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G','Trà Sen Tây Hồ',75,75,95000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500003-0000-4000-8000-0000a3500003','a3000003-0000-4000-8000-0000a3000003','a2000001-0000-4000-8000-0000a2000001','HVT-SEN-100G','Trà Sen Tây Hồ',41,41,95000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500004-0000-4000-8000-0000a3500004','a3000004-0000-4000-8000-0000a3000004','a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G','Trà Sen Tây Hồ',79,79,220000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500005-0000-4000-8000-0000a3500005','a3000005-0000-4000-8000-0000a3000005','a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G','Trà Sen Tây Hồ',75,75,220000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500006-0000-4000-8000-0000a3500006','a3000006-0000-4000-8000-0000a3000006','a2000002-0000-4000-8000-0000a2000002','HVT-SEN-250G','Trà Sen Tây Hồ',40,40,220000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500007-0000-4000-8000-0000a3500007','a3000007-0000-4000-8000-0000a3000007','a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G','Trà Ô Long Cao Sơn',78,78,78000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500008-0000-4000-8000-0000a3500008','a3000008-0000-4000-8000-0000a3000008','a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G','Trà Ô Long Cao Sơn',74,74,78000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500009-0000-4000-8000-0000a3500009','a3000009-0000-4000-8000-0000a3000009','a2000003-0000-4000-8000-0000a2000003','HVT-OLONG-100G','Trà Ô Long Cao Sơn',39,39,78000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000a-0000-4000-8000-0000a350000a','a300000a-0000-4000-8000-0000a300000a','a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G','Trà Ô Long Cao Sơn',78,78,175000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000b-0000-4000-8000-0000a350000b','a300000b-0000-4000-8000-0000a300000b','a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G','Trà Ô Long Cao Sơn',74,74,175000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000c-0000-4000-8000-0000a350000c','a300000c-0000-4000-8000-0000a300000c','a2000004-0000-4000-8000-0000a2000004','HVT-OLONG-250G','Trà Ô Long Cao Sơn',38,38,175000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000d-0000-4000-8000-0000a350000d','a300000d-0000-4000-8000-0000a300000d','a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G','Trà Shan Tuyết Lào Cai',77,77,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000e-0000-4000-8000-0000a350000e','a300000e-0000-4000-8000-0000a300000e','a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G','Trà Shan Tuyết Lào Cai',73,73,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350000f-0000-4000-8000-0000a350000f','a300000f-0000-4000-8000-0000a300000f','a2000005-0000-4000-8000-0000a2000005','HVT-SHAN-100G','Trà Shan Tuyết Lào Cai',37,37,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500010-0000-4000-8000-0000a3500010','a3000010-0000-4000-8000-0000a3000010','a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G','Trà Shan Tuyết Lào Cai',77,77,210000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500011-0000-4000-8000-0000a3500011','a3000011-0000-4000-8000-0000a3000011','a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G','Trà Shan Tuyết Lào Cai',73,73,210000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500012-0000-4000-8000-0000a3500012','a3000012-0000-4000-8000-0000a3000012','a2000006-0000-4000-8000-0000a2000006','HVT-SHAN-200G','Trà Shan Tuyết Lào Cai',36,36,210000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500013-0000-4000-8000-0000a3500013','a3000013-0000-4000-8000-0000a3000013','a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G','Trà Lài Thái Nguyên',76,76,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500014-0000-4000-8000-0000a3500014','a3000014-0000-4000-8000-0000a3000014','a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G','Trà Lài Thái Nguyên',72,72,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500015-0000-4000-8000-0000a3500015','a3000015-0000-4000-8000-0000a3000015','a2000007-0000-4000-8000-0000a2000007','HVT-LAI-100G','Trà Lài Thái Nguyên',35,35,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500016-0000-4000-8000-0000a3500016','a3000016-0000-4000-8000-0000a3000016','a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G','Trà Lài Thái Nguyên',76,76,145000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500017-0000-4000-8000-0000a3500017','a3000017-0000-4000-8000-0000a3000017','a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G','Trà Lài Thái Nguyên',72,72,145000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500018-0000-4000-8000-0000a3500018','a3000018-0000-4000-8000-0000a3000018','a2000008-0000-4000-8000-0000a2000008','HVT-LAI-250G','Trà Lài Thái Nguyên',34,34,145000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500019-0000-4000-8000-0000a3500019','a3000019-0000-4000-8000-0000a3000019','a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G','Hồng Trà Đại Hồng Bào',75,75,110000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001a-0000-4000-8000-0000a350001a','a300001a-0000-4000-8000-0000a300001a','a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G','Hồng Trà Đại Hồng Bào',71,71,110000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001b-0000-4000-8000-0000a350001b','a300001b-0000-4000-8000-0000a300001b','a2000009-0000-4000-8000-0000a2000009','HVT-DHB-100G','Hồng Trà Đại Hồng Bào',33,33,110000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001c-0000-4000-8000-0000a350001c','a300001c-0000-4000-8000-0000a300001c','a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G','Hồng Trà Đại Hồng Bào',75,75,200000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001d-0000-4000-8000-0000a350001d','a300001d-0000-4000-8000-0000a300001d','a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G','Hồng Trà Đại Hồng Bào',71,71,200000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001e-0000-4000-8000-0000a350001e','a300001e-0000-4000-8000-0000a300001e','a200000a-0000-4000-8000-0000a200000a','HVT-DHB-200G','Hồng Trà Đại Hồng Bào',32,32,200000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350001f-0000-4000-8000-0000a350001f','a300001f-0000-4000-8000-0000a300001f','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',74,74,140000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500020-0000-4000-8000-0000a3500020','a3000020-0000-4000-8000-0000a3000020','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',70,70,140000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500021-0000-4000-8000-0000a3500021','a3000021-0000-4000-8000-0000a3000021','a200000b-0000-4000-8000-0000a200000b','HVT-BACH-50G','Bạch Trà Bạch Hào Ngân Châm',31,31,140000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500022-0000-4000-8000-0000a3500022','a3000022-0000-4000-8000-0000a3000022','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',74,74,260000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500023-0000-4000-8000-0000a3500023','a3000023-0000-4000-8000-0000a3000023','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',70,70,260000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500024-0000-4000-8000-0000a3500024','a3000024-0000-4000-8000-0000a3000024','a200000c-0000-4000-8000-0000a200000c','HVT-BACH-100G','Bạch Trà Bạch Hào Ngân Châm',30,30,260000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500025-0000-4000-8000-0000a3500025','a3000025-0000-4000-8000-0000a3000025','a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G','Phổ Nhĩ Chín 2019',73,73,90000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500026-0000-4000-8000-0000a3500026','a3000026-0000-4000-8000-0000a3000026','a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G','Phổ Nhĩ Chín 2019',69,69,90000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500027-0000-4000-8000-0000a3500027','a3000027-0000-4000-8000-0000a3000027','a200000d-0000-4000-8000-0000a200000d','HVT-PHUNHI-100G','Phổ Nhĩ Chín 2019',29,29,90000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500028-0000-4000-8000-0000a3500028','a3000028-0000-4000-8000-0000a3000028','a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G','Phổ Nhĩ Chín 2019',73,73,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500029-0000-4000-8000-0000a3500029','a3000029-0000-4000-8000-0000a3000029','a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G','Phổ Nhĩ Chín 2019',69,69,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350002a-0000-4000-8000-0000a350002a','a300002a-0000-4000-8000-0000a300002a','a200000e-0000-4000-8000-0000a200000e','HVT-PHUNHI-357G','Phổ Nhĩ Chín 2019',28,28,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350002b-0000-4000-8000-0000a350002b','a300002b-0000-4000-8000-0000a300002b','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',72,72,45000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350002c-0000-4000-8000-0000a350002c','a300002c-0000-4000-8000-0000a300002c','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',68,68,45000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350002d-0000-4000-8000-0000a350002d','a300002d-0000-4000-8000-0000a300002d','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',26,27,45000.00,'2026-07-30 17:30:24.948410','2026-07-31 01:02:06.835092'),('a350002e-0000-4000-8000-0000a350002e','a300002e-0000-4000-8000-0000a300002e','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',72,72,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350002f-0000-4000-8000-0000a350002f','a300002f-0000-4000-8000-0000a300002f','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',68,68,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500030-0000-4000-8000-0000a3500030','a3000030-0000-4000-8000-0000a3000030','a2000010-0000-4000-8000-0000a2000010','HVT-ATISO-200G','Trà Atiso Đà Lạt',26,26,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500031-0000-4000-8000-0000a3500031','a3000031-0000-4000-8000-0000a3000031','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',71,71,35000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500032-0000-4000-8000-0000a3500032','a3000032-0000-4000-8000-0000a3000032','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',67,67,35000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500033-0000-4000-8000-0000a3500033','a3000033-0000-4000-8000-0000a3000033','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',25,25,35000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500034-0000-4000-8000-0000a3500034','a3000034-0000-4000-8000-0000a3000034','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',71,71,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500035-0000-4000-8000-0000a3500035','a3000035-0000-4000-8000-0000a3000035','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',67,67,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500036-0000-4000-8000-0000a3500036','a3000036-0000-4000-8000-0000a3000036','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',24,24,65000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500037-0000-4000-8000-0000a3500037','a3000037-0000-4000-8000-0000a3000037','a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G','Trà Gừng Mật Ong',70,70,40000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500038-0000-4000-8000-0000a3500038','a3000038-0000-4000-8000-0000a3000038','a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G','Trà Gừng Mật Ong',66,66,40000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500039-0000-4000-8000-0000a3500039','a3000039-0000-4000-8000-0000a3000039','a2000013-0000-4000-8000-0000a2000013','HVT-GUNG-100G','Trà Gừng Mật Ong',42,42,40000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003a-0000-4000-8000-0000a350003a','a300003a-0000-4000-8000-0000a300003a','a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G','Trà Gừng Mật Ong',70,70,72000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003b-0000-4000-8000-0000a350003b','a300003b-0000-4000-8000-0000a300003b','a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G','Trà Gừng Mật Ong',66,66,72000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003c-0000-4000-8000-0000a350003c','a300003c-0000-4000-8000-0000a300003c','a2000014-0000-4000-8000-0000a2000014','HVT-GUNG-200G','Trà Gừng Mật Ong',41,41,72000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003d-0000-4000-8000-0000a350003d','a300003d-0000-4000-8000-0000a300003d','a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G','Matcha Uji Grade A',69,69,180000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003e-0000-4000-8000-0000a350003e','a300003e-0000-4000-8000-0000a300003e','a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G','Matcha Uji Grade A',65,65,180000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350003f-0000-4000-8000-0000a350003f','a300003f-0000-4000-8000-0000a300003f','a2000015-0000-4000-8000-0000a2000015','HVT-MATCHA-50G','Matcha Uji Grade A',40,40,180000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500040-0000-4000-8000-0000a3500040','a3000040-0000-4000-8000-0000a3000040','a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G','Matcha Uji Grade A',69,69,340000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500041-0000-4000-8000-0000a3500041','a3000041-0000-4000-8000-0000a3000041','a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G','Matcha Uji Grade A',65,65,340000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500042-0000-4000-8000-0000a3500042','a3000042-0000-4000-8000-0000a3000042','a2000016-0000-4000-8000-0000a2000016','HVT-MATCHA-100G','Matcha Uji Grade A',39,39,340000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500043-0000-4000-8000-0000a3500043','a3000043-0000-4000-8000-0000a3000043','a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G','Earl Grey Classic',68,68,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500044-0000-4000-8000-0000a3500044','a3000044-0000-4000-8000-0000a3000044','a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G','Earl Grey Classic',64,64,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500045-0000-4000-8000-0000a3500045','a3000045-0000-4000-8000-0000a3000045','a2000017-0000-4000-8000-0000a2000017','HVT-EARL-100G','Earl Grey Classic',38,38,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500046-0000-4000-8000-0000a3500046','a3000046-0000-4000-8000-0000a3000046','a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G','Earl Grey Classic',68,68,130000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500047-0000-4000-8000-0000a3500047','a3000047-0000-4000-8000-0000a3000047','a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G','Earl Grey Classic',64,64,130000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500048-0000-4000-8000-0000a3500048','a3000048-0000-4000-8000-0000a3000048','a2000018-0000-4000-8000-0000a2000018','HVT-EARL-200G','Earl Grey Classic',37,37,130000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500049-0000-4000-8000-0000a3500049','a3000049-0000-4000-8000-0000a3000049','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',67,67,55000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004a-0000-4000-8000-0000a350004a','a300004a-0000-4000-8000-0000a300004a','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',63,63,55000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004b-0000-4000-8000-0000a350004b','a300004b-0000-4000-8000-0000a300004b','a2000019-0000-4000-8000-0000a2000019','HVT-DAO-100G','Trà Đào Đà Lạt',36,36,55000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004c-0000-4000-8000-0000a350004c','a300004c-0000-4000-8000-0000a300004c','a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G','Trà Đào Đà Lạt',67,67,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004d-0000-4000-8000-0000a350004d','a300004d-0000-4000-8000-0000a300004d','a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G','Trà Đào Đà Lạt',63,63,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004e-0000-4000-8000-0000a350004e','a300004e-0000-4000-8000-0000a300004e','a200001a-0000-4000-8000-0000a200001a','HVT-DAO-250G','Trà Đào Đà Lạt',35,35,120000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350004f-0000-4000-8000-0000a350004f','a300004f-0000-4000-8000-0000a300004f','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',66,66,60000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500050-0000-4000-8000-0000a3500050','a3000050-0000-4000-8000-0000a3000050','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',62,62,60000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500051-0000-4000-8000-0000a3500051','a3000051-0000-4000-8000-0000a3000051','a200001b-0000-4000-8000-0000a200001b','HVT-CEYLON-100G','Trà Đen Ceylon OP',34,34,60000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500052-0000-4000-8000-0000a3500052','a3000052-0000-4000-8000-0000a3000052','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',66,66,135000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500053-0000-4000-8000-0000a3500053','a3000053-0000-4000-8000-0000a3000053','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',62,62,135000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500054-0000-4000-8000-0000a3500054','a3000054-0000-4000-8000-0000a3000054','a200001c-0000-4000-8000-0000a200001c','HVT-CEYLON-250G','Trà Đen Ceylon OP',33,33,135000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500055-0000-4000-8000-0000a3500055','a3000055-0000-4000-8000-0000a3000055','a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G','Trà Nhài Long Châu',65,65,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500056-0000-4000-8000-0000a3500056','a3000056-0000-4000-8000-0000a3000056','a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G','Trà Nhài Long Châu',61,61,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500057-0000-4000-8000-0000a3500057','a3000057-0000-4000-8000-0000a3000057','a200001d-0000-4000-8000-0000a200001d','HVT-NHAI-100G','Trà Nhài Long Châu',32,32,70000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500058-0000-4000-8000-0000a3500058','a3000058-0000-4000-8000-0000a3000058','a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G','Trà Nhài Long Châu',65,65,155000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500059-0000-4000-8000-0000a3500059','a3000059-0000-4000-8000-0000a3000059','a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G','Trà Nhài Long Châu',61,61,155000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005a-0000-4000-8000-0000a350005a','a300005a-0000-4000-8000-0000a300005a','a200001e-0000-4000-8000-0000a200001e','HVT-NHAI-250G','Trà Nhài Long Châu',31,31,155000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005b-0000-4000-8000-0000a350005b','a300005b-0000-4000-8000-0000a300005b','a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ','Set Quà Trà Tứ Quý',64,64,320000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005c-0000-4000-8000-0000a350005c','a300005c-0000-4000-8000-0000a300005c','a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ','Set Quà Trà Tứ Quý',60,60,320000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005d-0000-4000-8000-0000a350005d','a300005d-0000-4000-8000-0000a300005d','a200001f-0000-4000-8000-0000a200001f','HVT-SET-TQ','Set Quà Trà Tứ Quý',30,30,320000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005e-0000-4000-8000-0000a350005e','a300005e-0000-4000-8000-0000a300005e','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',64,64,180000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350005f-0000-4000-8000-0000a350005f','a300005f-0000-4000-8000-0000a300005f','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',60,60,180000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500060-0000-4000-8000-0000a3500060','a3000060-0000-4000-8000-0000a3000060','a2000020-0000-4000-8000-0000a2000020','HVT-AM-TUSA','Ấm Tử Sa Mini 150ml',27,29,180000.00,'2026-07-30 17:30:24.948410','2026-08-03 04:56:55.061363'),('a3500061-0000-4000-8000-0000a3500061','a3000061-0000-4000-8000-0000a3000061','a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC','Ly Sứ Men Ngọc',63,63,45000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500062-0000-4000-8000-0000a3500062','a3000062-0000-4000-8000-0000a3000062','a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC','Ly Sứ Men Ngọc',59,59,45000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500063-0000-4000-8000-0000a3500063','a3000063-0000-4000-8000-0000a3000063','a2000021-0000-4000-8000-0000a2000021','HVT-LY-NGOC','Ly Sứ Men Ngọc',28,28,45000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500064-0000-4000-8000-0000a3500064','a3000064-0000-4000-8000-0000a3000064','a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2','Ly Sứ Men Ngọc',63,63,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500065-0000-4000-8000-0000a3500065','a3000065-0000-4000-8000-0000a3000065','a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2','Ly Sứ Men Ngọc',59,59,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500066-0000-4000-8000-0000a3500066','a3000066-0000-4000-8000-0000a3000066','a2000022-0000-4000-8000-0000a2000022','HVT-LY-NGOC-2','Ly Sứ Men Ngọc',27,27,80000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500067-0000-4000-8000-0000a3500067','a3000067-0000-4000-8000-0000a3000067','a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G','Trà Ô Long Nhân Sâm',62,62,150000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500068-0000-4000-8000-0000a3500068','a3000068-0000-4000-8000-0000a3000068','a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G','Trà Ô Long Nhân Sâm',58,58,150000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500069-0000-4000-8000-0000a3500069','a3000069-0000-4000-8000-0000a3000069','a2000023-0000-4000-8000-0000a2000023','HVT-OL-NS-100G','Trà Ô Long Nhân Sâm',26,26,150000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006a-0000-4000-8000-0000a350006a','a300006a-0000-4000-8000-0000a300006a','a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G','Trà Ô Long Nhân Sâm',62,62,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006b-0000-4000-8000-0000a350006b','a300006b-0000-4000-8000-0000a300006b','a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G','Trà Ô Long Nhân Sâm',58,58,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006c-0000-4000-8000-0000a350006c','a300006c-0000-4000-8000-0000a300006c','a2000024-0000-4000-8000-0000a2000024','HVT-OL-NS-200G','Trà Ô Long Nhân Sâm',25,25,280000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006d-0000-4000-8000-0000a350006d','a300006d-0000-4000-8000-0000a300006d','a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G','Trà Xanh Thái Nguyên Đặc Biệt',80,80,85000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006e-0000-4000-8000-0000a350006e','a300006e-0000-4000-8000-0000a300006e','a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G','Trà Xanh Thái Nguyên Đặc Biệt',76,76,85000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350006f-0000-4000-8000-0000a350006f','a300006f-0000-4000-8000-0000a300006f','a2000025-0000-4000-8000-0000a2000025','HVT-TN-DB-100G','Trà Xanh Thái Nguyên Đặc Biệt',24,24,85000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500070-0000-4000-8000-0000a3500070','a3000070-0000-4000-8000-0000a3000070','a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G','Trà Xanh Thái Nguyên Đặc Biệt',79,79,190000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500071-0000-4000-8000-0000a3500071','a3000071-0000-4000-8000-0000a3000071','a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G','Trà Xanh Thái Nguyên Đặc Biệt',75,75,190000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500072-0000-4000-8000-0000a3500072','a3000072-0000-4000-8000-0000a3000072','a2000026-0000-4000-8000-0000a2000026','HVT-TN-DB-250G','Trà Xanh Thái Nguyên Đặc Biệt',42,42,190000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500073-0000-4000-8000-0000a3500073','a3000073-0000-4000-8000-0000a3000073','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên',47000,47000,125.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500074-0000-4000-8000-0000a3500074','a3000074-0000-4000-8000-0000a3000074','a2000027-0000-4000-8000-0000a2000027','NL-TRAXANH-1KG','Trà xanh thô Thái Nguyên',47000,47000,125.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500075-0000-4000-8000-0000a3500075','a3000075-0000-4000-8000-0000a3000075','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng',47000,47000,98.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500076-0000-4000-8000-0000a3500076','a3000076-0000-4000-8000-0000a3000076','a2000028-0000-4000-8000-0000a2000028','NL-OLONG-1KG','Lá ô long thô Lâm Đồng',47000,47000,98.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500077-0000-4000-8000-0000a3500077','a3000077-0000-4000-8000-0000a3000077','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ',48000,48000,360.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500078-0000-4000-8000-0000a3500078','a3000078-0000-4000-8000-0000a3000078','a2000029-0000-4000-8000-0000a2000029','NL-HOASEN-1KG','Hoa sen khô Tây Hồ',48000,48000,360.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500079-0000-4000-8000-0000a3500079','a3000079-0000-4000-8000-0000a3000079','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô',48000,48000,280.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007a-0000-4000-8000-0000a350007a','a300007a-0000-4000-8000-0000a300007a','a200002a-0000-4000-8000-0000a200002a','NL-HOALAI-1KG','Hoa lài khô',48000,48000,280.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007b-0000-4000-8000-0000a350007b','a300007b-0000-4000-8000-0000a300007b','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt',49000,49000,28.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007c-0000-4000-8000-0000a350007c','a300007c-0000-4000-8000-0000a300007c','a200002b-0000-4000-8000-0000a200002b','NL-DUONGPHEN-1KG','Đường phèn hạt',49000,49000,28.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007d-0000-4000-8000-0000a350007d','a300007d-0000-4000-8000-0000a300007d','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh',49000,49000,85.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007e-0000-4000-8000-0000a350007e','a300007e-0000-4000-8000-0000a300007e','a200002c-0000-4000-8000-0000a200002c','NL-ATISO-1KG','Atiso khô cánh',49000,49000,85.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a350007f-0000-4000-8000-0000a350007f','a300007f-0000-4000-8000-0000a300007f','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết',50000,50000,210.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500080-0000-4000-8000-0000a3500080','a3000080-0000-4000-8000-0000a3000080','a200002d-0000-4000-8000-0000a200002d','NL-SHAN-1KG','Búp trà shan tuyết',50000,50000,210.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500081-0000-4000-8000-0000a3500081','a3000081-0000-4000-8000-0000a3000081','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô',50000,50000,75.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500082-0000-4000-8000-0000a3500082','a3000082-0000-4000-8000-0000a3000082','a200002e-0000-4000-8000-0000a200002e','NL-PHUNHI-1KG','Lá phổ nhĩ thô',50000,50000,75.00,'2026-07-30 17:30:24.948410','2026-08-03 02:24:45.455858'),('a3500083-0000-4000-8000-0000a3500083','a3000083-0000-4000-8000-0000a3000083','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g',317,317,800.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500084-0000-4000-8000-0000a3500084','a3000084-0000-4000-8000-0000a3000084','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g',317,317,800.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500085-0000-4000-8000-0000a3500085','a3000085-0000-4000-8000-0000a3000085','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g',320,320,1200.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500086-0000-4000-8000-0000a3500086','a3000086-0000-4000-8000-0000a3000086','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g',320,320,1200.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500087-0000-4000-8000-0000a3500087','a3000087-0000-4000-8000-0000a3000087','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',322,322,3500.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500088-0000-4000-8000-0000a3500088','a3000088-0000-4000-8000-0000a3000088','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',322,322,3500.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a3500089-0000-4000-8000-0000a3500089','a3000089-0000-4000-8000-0000a3000089','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT',325,325,200.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350008a-0000-4000-8000-0000a350008a','a300008a-0000-4000-8000-0000a300008a','a2000032-0000-4000-8000-0000a2000032','BB-TEM','Tem chống giả HVT',325,325,200.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350008b-0000-4000-8000-0000a350008b','a300008b-0000-4000-8000-0000a300008b','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm',327,327,150.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350008c-0000-4000-8000-0000a350008c','a300008c-0000-4000-8000-0000a300008c','a2000033-0000-4000-8000-0000a2000033','BB-NILON','Túi nilon thực phẩm',327,327,150.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350008d-0000-4000-8000-0000a350008d','a300008d-0000-4000-8000-0000a300008d','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn',330,330,12000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('a350008e-0000-4000-8000-0000a350008e','a300008e-0000-4000-8000-0000a300008e','a2000034-0000-4000-8000-0000a2000034','BB-HOP-LON','Hộp quà cứng lớn',330,330,12000.00,'2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410'),('c6fd74b7-2966-4b4f-941c-f93c5dd6b157','166f6753-cae7-4058-8f91-748c79c6ac98','a2000031-0000-4000-8000-0000a2000031','BB-HOP-NHO','Hộp giấy cứng nhỏ',25,25,NULL,'2026-08-03 04:48:29.678044','2026-08-03 04:48:29.678044'),('cf5b81a8-9f7d-419a-b1b7-52efac54a274','af0a2cae-52c6-49f3-9766-ea880d26cc35','a2000030-0000-4000-8000-0000a2000030','BB-ZIP-250','Túi zip kraft 250g',20,20,NULL,'2026-08-03 04:48:29.719820','2026-08-03 04:48:29.719820'),('db57f76d-eb77-40c5-ab62-0c78139d8727','61dfb76a-1419-498d-895d-22ef24b89d48','a2000012-0000-4000-8000-0000a2000012','HVT-CUC-100G','Trà Hoa Cúc Chi',25,25,NULL,'2026-08-03 04:48:29.778708','2026-08-03 04:48:29.778708'),('e974e2e5-d0a5-49bd-941e-baa821a9224f','a752280d-39b5-4dd4-9613-7f9e2f2f3450','a200002f-0000-4000-8000-0000a200002f','BB-ZIP-100','Túi zip kraft 100g',10,10,NULL,'2026-08-03 04:48:29.711937','2026-08-03 04:48:29.711937'),('fafc94f4-0a88-44a0-b38b-dd8ec9107615','872a2b71-c8c9-4a11-a46d-4499ff5274b2','a2000011-0000-4000-8000-0000a2000011','HVT-CUC-50G','Trà Hoa Cúc Chi',12,12,NULL,'2026-08-03 04:48:29.786898','2026-08-03 04:48:29.786898'),('fe76023f-8bd5-45e9-9cbc-1f37167eba48','dc74dc60-6298-420b-a506-ae65ec764efc','a200000f-0000-4000-8000-0000a200000f','HVT-ATISO-100G','Trà Atiso Đà Lạt',12,12,NULL,'2026-08-03 04:48:29.735461','2026-08-03 04:48:29.735461');
/*!40000 ALTER TABLE `WarehouseBatchItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WarehouseBatches`
--

DROP TABLE IF EXISTS `WarehouseBatches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WarehouseBatches` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `LotCode` varchar(50) NOT NULL,
  `Supplier` varchar(200) DEFAULT NULL,
  `ExpiresAt` datetime(6) DEFAULT NULL,
  `Note` varchar(500) DEFAULT NULL,
  `Status` varchar(20) NOT NULL,
  `CreatedBy` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `SourceType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SourceReferenceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SourceReferenceCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Location` varchar(20) NOT NULL DEFAULT 'Warehouse',
  `ParentBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SourceBatchId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `BatchCode` varchar(50) NOT NULL,
  `SupplierId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `NormalizedSupplierLotCode` varchar(50) DEFAULT NULL,
  `ManufactureDate` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_WarehouseBatches_BatchCode` (`BatchCode`),
  UNIQUE KEY `IX_WarehouseBatches_SupplierLotIdentity` (`SupplierId`,`SkuId`,`NormalizedSupplierLotCode`),
  KEY `IX_WarehouseBatches_ExpiresAt` (`ExpiresAt`),
  KEY `IX_WarehouseBatches_CreatedAt` (`CreatedAt`),
  KEY `IX_WarehouseBatches_SourceReferenceId` (`SourceReferenceId`),
  KEY `IX_WarehouseBatches_SourceReferenceCode` (`SourceReferenceCode`),
  KEY `IX_WarehouseBatches_Location` (`Location`),
  KEY `IX_WarehouseBatches_ParentBatchId` (`ParentBatchId`),
  KEY `IX_WarehouseBatches_SourceBatchId` (`SourceBatchId`),
  KEY `IX_WarehouseBatches_LotCode` (`LotCode`),
  CONSTRAINT `FK_WarehouseBatches_WarehouseBatches_ParentBatchId` FOREIGN KEY (`ParentBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL,
  CONSTRAINT `FK_WarehouseBatches_WarehouseBatches_SourceBatchId` FOREIGN KEY (`SourceBatchId`) REFERENCES `WarehouseBatches` (`Id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WarehouseBatches`
--

LOCK TABLES `WarehouseBatches` WRITE;
/*!40000 ALTER TABLE `WarehouseBatches` DISABLE KEYS */;
INSERT INTO `WarehouseBatches` VALUES ('095adead-a995-4b82-8b5b-76856897bc5e','NCC-LOT-011','Công ty TNHH trà đạo việt nam','2027-01-14 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-011','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.602716','2026-08-03 04:48:29.602716','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-0302CB29699644A6B0CC34FD6EB3EAFE','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000034-0000-4000-8000-0000a2000034','NCC-LOT-011','2026-01-14 00:00:00.000000'),('166f6753-cae7-4058-8f91-748c79c6ac98','NCC-LOT-012','Công ty TNHH trà đạo việt nam','2027-01-15 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-012','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.678044','2026-08-03 04:48:29.678044','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-A958863E99614784B3D18718C81908F9','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000031-0000-4000-8000-0000a2000031','NCC-LOT-012','2026-01-15 00:00:00.000000'),('2ff8a597-ea32-4293-ab76-3156fbe91376','NCC-LOT-022','Công ty TNHH trà đạo việt nam','2027-01-05 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-022','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.750304','2026-08-03 04:48:29.750304','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-DC740D0E92F14115BDDCBC6FF2FA5143','6a72e704-fa71-4cd8-92b2-1aee24150660','a200000c-0000-4000-8000-0000a200000c','NCC-LOT-022','2026-01-05 00:00:00.000000'),('302b784c-d847-4d26-b6cb-a8ba34f628d9','SX-20260721024548-01-E01B64',NULL,NULL,'Lệnh sản xuất SX-20260721-0001 - TRA-SEN-100G','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-07-21 02:45:48.918171','2026-07-21 02:45:48.918171','production_finished_goods','e01b64fc-25d8-49d5-a598-2784a448e1aa','SX-20260721-0001','Shelf',NULL,NULL,'SX-20260721024548-01-E01B64',NULL,NULL,NULL,NULL),('32a35341-b941-4223-9a98-8c7b595efe6c','NCC-LOT-024','Công ty TNHH trà đạo việt nam','2027-01-07 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-024','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.764310','2026-08-03 04:48:29.764310','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-DA0AA638D1D74942A9B7D767B23A999F','6a72e704-fa71-4cd8-92b2-1aee24150660','a200001b-0000-4000-8000-0000a200001b','NCC-LOT-024','2026-01-07 00:00:00.000000'),('395e419f-4fdb-4f4f-bdf6-406bffb45380','NCC-LOT-002','Công ty TNHH trà đạo việt nam','2027-01-05 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-002','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.814862','2026-08-03 04:48:29.814862','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-12641583EF994912B85AA64751496AE3','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002b-0000-4000-8000-0000a200002b','NCC-LOT-002','2026-01-05 00:00:00.000000'),('3a9381e1-5393-4dfb-8db5-32694adcf014','NCC-LOT-014','Công ty TNHH trà đạo việt nam','2027-01-17 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-014','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.703131','2026-08-03 04:48:29.703131','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-F32018BD95314CCBA3659F928BDC3625','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000032-0000-4000-8000-0000a2000032','NCC-LOT-014','2026-01-17 00:00:00.000000'),('4ccf9679-9bf4-4d14-9ea3-c544de4bf656','NCC-LOT-005','Công ty TNHH trà đạo việt nam','2027-01-08 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-005','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.839000','2026-08-03 04:48:29.839000','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-EF0E8E969B01499EAE6D8E157E3B59A7','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000028-0000-4000-8000-0000a2000028','NCC-LOT-005','2026-01-08 00:00:00.000000'),('5b5002ca-831e-4783-8e0c-f13a12dfe33f','34534534564','Công ty TNHH bao bì việt nam','2026-08-27 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0003 - Công ty TNHH bao bì việt nam - Mã lô NCC: 34534534564','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:37:11.180522','2026-08-03 03:37:11.180522','supplier_receipt','5fa422bf-ab75-4174-8e25-ac5ef4467038','NCC-20260803-0003','Warehouse',NULL,NULL,'SR-90890D51891041AEB6C24BFEC96D9FAE','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','a2000031-0000-4000-8000-0000a2000031','34534534564','2026-07-28 00:00:00.000000'),('5cab4e6e-6a97-43ad-97ed-05045a4cef08','NCC-LOT-025','Công ty TNHH trà đạo việt nam','2027-01-08 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-025','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.771684','2026-08-03 04:48:29.771684','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-2FE5EF63246E413AAA13540CF6BF69C9','6a72e704-fa71-4cd8-92b2-1aee24150660','a200001c-0000-4000-8000-0000a200001c','NCC-LOT-025','2026-01-08 00:00:00.000000'),('60000000-0000-0000-0000-000000000001','LOT-20260101','Cty TNHH Trà Thái Nguyên','2027-01-01 00:00:00.000000','Lô nhập đầu năm 2026 — trà thành phẩm và nguyên liệu','active','00000000-0000-0000-0000-000000000001','2026-01-01 08:00:00.000000','2026-07-21 02:45:48.889366',NULL,NULL,NULL,'Warehouse',NULL,NULL,'LOT-20260101',NULL,NULL,NULL,NULL),('60000000-0000-0000-0000-000000000002','LOT-20260601','HTX Trà Ô Long Lâm Đồng','2027-06-01 00:00:00.000000','Lô nhập tháng 6 — bổ sung trà sen và ô long','active','00000000-0000-0000-0000-000000000001','2026-06-01 08:00:00.000000','2026-06-01 08:00:00.000000',NULL,NULL,NULL,'Warehouse',NULL,NULL,'LOT-20260601',NULL,NULL,NULL,NULL),('61dfb76a-1419-498d-895d-22ef24b89d48','NCC-LOT-026','Công ty TNHH trà đạo việt nam','2027-01-09 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-026','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.778708','2026-08-03 04:48:29.778708','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-8E7868C9200D487E939EE18E9DE498ED','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000012-0000-4000-8000-0000a2000012','NCC-LOT-026','2026-01-09 00:00:00.000000'),('693a0e5a-d3b4-4116-b559-c5f89d713ae0','NCC-LOT-001','Công ty TNHH trà đạo việt nam','2027-01-04 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-001 - Đạt — bao bì nguyên vẹn','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.806696','2026-08-03 04:48:29.806696','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-9D0B087015864CCFA0EE7615A621AF98','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002c-0000-4000-8000-0000a200002c','NCC-LOT-001','2026-01-04 00:00:00.000000'),('75f542f6-62d4-4dbc-8c3d-9c7a86b48126','4645456','Công ty TNHH bao bì việt nam','2026-08-28 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0002 - Công ty TNHH bao bì việt nam - Mã lô NCC: 4645456','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 03:34:46.047072','2026-08-03 03:34:46.047072','supplier_receipt','10906710-ce7b-4800-b774-51fb54780366','NCC-20260803-0002','Warehouse',NULL,NULL,'SR-E28548B182EE456A84416FABE2220DEB','54a0287b-aa65-47b5-9cab-2c4c649bcbb2','953f58df-3312-4217-b1a1-47bf7b830619','4645456','2026-08-01 00:00:00.000000'),('7936c2fe-19c6-4571-93cc-f65e80f1956d','NCC-LOT-013','Công ty TNHH trà đạo việt nam','2027-01-16 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-013','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.693874','2026-08-03 04:48:29.693874','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-4F7168F02FA348439F1E8987DA0D8153','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000033-0000-4000-8000-0000a2000033','NCC-LOT-013','2026-01-16 00:00:00.000000'),('83cfba1d-6ec8-4836-9005-f864b75a6d1f','NCC-LOT-006','Công ty TNHH trà đạo việt nam','2027-01-09 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-006','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.847898','2026-08-03 04:48:29.847898','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-3971F49D6F9746868A277A2F24A1786E','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002e-0000-4000-8000-0000a200002e','NCC-LOT-006','2026-01-09 00:00:00.000000'),('872a2b71-c8c9-4a11-a46d-4499ff5274b2','NCC-LOT-027','Công ty TNHH trà đạo việt nam','2027-01-10 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-027','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.786898','2026-08-03 04:48:29.786898','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-5967018B5DD64C8BB78E31B9493F0822','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000011-0000-4000-8000-0000a2000011','NCC-LOT-027','2026-01-10 00:00:00.000000'),('9f89929a-a697-4cde-a8c0-3cd896d47a01','NCC-LOT-019','Công ty TNHH trà đạo việt nam','2027-01-22 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-019','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.728268','2026-08-03 04:48:29.728268','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-5DEE5CF594FE43F4B9DD26008CB1886D','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000020-0000-4000-8000-0000a2000020','NCC-LOT-019','2026-01-22 00:00:00.000000'),('a3000001-0000-4000-8000-0000a3000001','HVT-LOT-HVT-SEN-100G-1','Công ty TNHH Sen Tây Hồ','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SEN-100G-1',NULL,NULL,NULL,NULL),('a3000002-0000-4000-8000-0000a3000002','HVT-LOT-HVT-SEN-100G-2','Đà Lạt Farm Atiso','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SEN-100G-2',NULL,NULL,NULL,NULL),('a3000003-0000-4000-8000-0000a3000003','HVT-SHELF-HVT-SEN-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-SEN-100G',NULL,NULL,NULL,NULL),('a3000004-0000-4000-8000-0000a3000004','HVT-LOT-HVT-SEN-250G-1','Import Tea Asia','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SEN-250G-1',NULL,NULL,NULL,NULL),('a3000005-0000-4000-8000-0000a3000005','HVT-LOT-HVT-SEN-250G-2','HTX Chè Thái Nguyên','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SEN-250G-2',NULL,NULL,NULL,NULL),('a3000006-0000-4000-8000-0000a3000006','HVT-SHELF-HVT-SEN-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-SEN-250G',NULL,NULL,NULL,NULL),('a3000007-0000-4000-8000-0000a3000007','HVT-LOT-HVT-OLONG-100G-1','Đà Lạt Farm Atiso','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OLONG-100G-1',NULL,NULL,NULL,NULL),('a3000008-0000-4000-8000-0000a3000008','HVT-LOT-HVT-OLONG-100G-2','Bao bì Minh Phát','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OLONG-100G-2',NULL,NULL,NULL,NULL),('a3000009-0000-4000-8000-0000a3000009','HVT-SHELF-HVT-OLONG-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-OLONG-100G',NULL,NULL,NULL,NULL),('a300000a-0000-4000-8000-0000a300000a','HVT-LOT-HVT-OLONG-250G-1','HTX Chè Thái Nguyên','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OLONG-250G-1',NULL,NULL,NULL,NULL),('a300000b-0000-4000-8000-0000a300000b','HVT-LOT-HVT-OLONG-250G-2','Công ty TNHH Sen Tây Hồ','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OLONG-250G-2',NULL,NULL,NULL,NULL),('a300000c-0000-4000-8000-0000a300000c','HVT-SHELF-HVT-OLONG-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-OLONG-250G',NULL,NULL,NULL,NULL),('a300000d-0000-4000-8000-0000a300000d','HVT-LOT-HVT-SHAN-100G-1','Bao bì Minh Phát','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SHAN-100G-1',NULL,NULL,NULL,NULL),('a300000e-0000-4000-8000-0000a300000e','HVT-LOT-HVT-SHAN-100G-2','Import Tea Asia','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SHAN-100G-2',NULL,NULL,NULL,NULL),('a300000f-0000-4000-8000-0000a300000f','HVT-SHELF-HVT-SHAN-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-SHAN-100G',NULL,NULL,NULL,NULL),('a3000010-0000-4000-8000-0000a3000010','HVT-LOT-HVT-SHAN-200G-1','Công ty TNHH Sen Tây Hồ','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SHAN-200G-1',NULL,NULL,NULL,NULL),('a3000011-0000-4000-8000-0000a3000011','HVT-LOT-HVT-SHAN-200G-2','Đà Lạt Farm Atiso','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SHAN-200G-2',NULL,NULL,NULL,NULL),('a3000012-0000-4000-8000-0000a3000012','HVT-SHELF-HVT-SHAN-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-SHAN-200G',NULL,NULL,NULL,NULL),('a3000013-0000-4000-8000-0000a3000013','HVT-LOT-HVT-LAI-100G-1','Import Tea Asia','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LAI-100G-1',NULL,NULL,NULL,NULL),('a3000014-0000-4000-8000-0000a3000014','HVT-LOT-HVT-LAI-100G-2','HTX Chè Thái Nguyên','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LAI-100G-2',NULL,NULL,NULL,NULL),('a3000015-0000-4000-8000-0000a3000015','HVT-SHELF-HVT-LAI-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-LAI-100G',NULL,NULL,NULL,NULL),('a3000016-0000-4000-8000-0000a3000016','HVT-LOT-HVT-LAI-250G-1','Đà Lạt Farm Atiso','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LAI-250G-1',NULL,NULL,NULL,NULL),('a3000017-0000-4000-8000-0000a3000017','HVT-LOT-HVT-LAI-250G-2','Bao bì Minh Phát','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LAI-250G-2',NULL,NULL,NULL,NULL),('a3000018-0000-4000-8000-0000a3000018','HVT-SHELF-HVT-LAI-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-LAI-250G',NULL,NULL,NULL,NULL),('a3000019-0000-4000-8000-0000a3000019','HVT-LOT-HVT-DHB-100G-1','HTX Chè Thái Nguyên','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DHB-100G-1',NULL,NULL,NULL,NULL),('a300001a-0000-4000-8000-0000a300001a','HVT-LOT-HVT-DHB-100G-2','Công ty TNHH Sen Tây Hồ','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DHB-100G-2',NULL,NULL,NULL,NULL),('a300001b-0000-4000-8000-0000a300001b','HVT-SHELF-HVT-DHB-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-DHB-100G',NULL,NULL,NULL,NULL),('a300001c-0000-4000-8000-0000a300001c','HVT-LOT-HVT-DHB-200G-1','Bao bì Minh Phát','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DHB-200G-1',NULL,NULL,NULL,NULL),('a300001d-0000-4000-8000-0000a300001d','HVT-LOT-HVT-DHB-200G-2','Import Tea Asia','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DHB-200G-2',NULL,NULL,NULL,NULL),('a300001e-0000-4000-8000-0000a300001e','HVT-SHELF-HVT-DHB-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-DHB-200G',NULL,NULL,NULL,NULL),('a300001f-0000-4000-8000-0000a300001f','HVT-LOT-HVT-BACH-50G-1','Công ty TNHH Sen Tây Hồ','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-BACH-50G-1',NULL,NULL,NULL,NULL),('a3000020-0000-4000-8000-0000a3000020','HVT-LOT-HVT-BACH-50G-2','Đà Lạt Farm Atiso','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-BACH-50G-2',NULL,NULL,NULL,NULL),('a3000021-0000-4000-8000-0000a3000021','HVT-SHELF-HVT-BACH-50G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-BACH-50G',NULL,NULL,NULL,NULL),('a3000022-0000-4000-8000-0000a3000022','HVT-LOT-HVT-BACH-100G-1','Import Tea Asia','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-BACH-100G-1',NULL,NULL,NULL,NULL),('a3000023-0000-4000-8000-0000a3000023','HVT-LOT-HVT-BACH-100G-2','HTX Chè Thái Nguyên','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-BACH-100G-2',NULL,NULL,NULL,NULL),('a3000024-0000-4000-8000-0000a3000024','HVT-SHELF-HVT-BACH-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-BACH-100G',NULL,NULL,NULL,NULL),('a3000025-0000-4000-8000-0000a3000025','HVT-LOT-HVT-PHUNHI-100G-1','Đà Lạt Farm Atiso','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-PHUNHI-100G-1',NULL,NULL,NULL,NULL),('a3000026-0000-4000-8000-0000a3000026','HVT-LOT-HVT-PHUNHI-100G-2','Bao bì Minh Phát','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-PHUNHI-100G-2',NULL,NULL,NULL,NULL),('a3000027-0000-4000-8000-0000a3000027','HVT-SHELF-HVT-PHUNHI-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-PHUNHI-100G',NULL,NULL,NULL,NULL),('a3000028-0000-4000-8000-0000a3000028','HVT-LOT-HVT-PHUNHI-357G-1','HTX Chè Thái Nguyên','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-PHUNHI-357G-1',NULL,NULL,NULL,NULL),('a3000029-0000-4000-8000-0000a3000029','HVT-LOT-HVT-PHUNHI-357G-2','Công ty TNHH Sen Tây Hồ','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-PHUNHI-357G-2',NULL,NULL,NULL,NULL),('a300002a-0000-4000-8000-0000a300002a','HVT-SHELF-HVT-PHUNHI-357G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-PHUNHI-357G',NULL,NULL,NULL,NULL),('a300002b-0000-4000-8000-0000a300002b','HVT-LOT-HVT-ATISO-100G-1','Bao bì Minh Phát','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-ATISO-100G-1',NULL,NULL,NULL,NULL),('a300002c-0000-4000-8000-0000a300002c','HVT-LOT-HVT-ATISO-100G-2','Import Tea Asia','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-ATISO-100G-2',NULL,NULL,NULL,NULL),('a300002d-0000-4000-8000-0000a300002d','HVT-SHELF-HVT-ATISO-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-31 01:02:06.870595','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-ATISO-100G',NULL,NULL,NULL,NULL),('a300002e-0000-4000-8000-0000a300002e','HVT-LOT-HVT-ATISO-200G-1','Công ty TNHH Sen Tây Hồ','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-ATISO-200G-1',NULL,NULL,NULL,NULL),('a300002f-0000-4000-8000-0000a300002f','HVT-LOT-HVT-ATISO-200G-2','Đà Lạt Farm Atiso','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-ATISO-200G-2',NULL,NULL,NULL,NULL),('a3000030-0000-4000-8000-0000a3000030','HVT-SHELF-HVT-ATISO-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-ATISO-200G',NULL,NULL,NULL,NULL),('a3000031-0000-4000-8000-0000a3000031','HVT-LOT-HVT-CUC-50G-1','Import Tea Asia','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CUC-50G-1',NULL,NULL,NULL,NULL),('a3000032-0000-4000-8000-0000a3000032','HVT-LOT-HVT-CUC-50G-2','HTX Chè Thái Nguyên','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CUC-50G-2',NULL,NULL,NULL,NULL),('a3000033-0000-4000-8000-0000a3000033','HVT-SHELF-HVT-CUC-50G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-CUC-50G',NULL,NULL,NULL,NULL),('a3000034-0000-4000-8000-0000a3000034','HVT-LOT-HVT-CUC-100G-1','Đà Lạt Farm Atiso','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CUC-100G-1',NULL,NULL,NULL,NULL),('a3000035-0000-4000-8000-0000a3000035','HVT-LOT-HVT-CUC-100G-2','Bao bì Minh Phát','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CUC-100G-2',NULL,NULL,NULL,NULL),('a3000036-0000-4000-8000-0000a3000036','HVT-SHELF-HVT-CUC-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-CUC-100G',NULL,NULL,NULL,NULL),('a3000037-0000-4000-8000-0000a3000037','HVT-LOT-HVT-GUNG-100G-1','HTX Chè Thái Nguyên','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-GUNG-100G-1',NULL,NULL,NULL,NULL),('a3000038-0000-4000-8000-0000a3000038','HVT-LOT-HVT-GUNG-100G-2','Công ty TNHH Sen Tây Hồ','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-GUNG-100G-2',NULL,NULL,NULL,NULL),('a3000039-0000-4000-8000-0000a3000039','HVT-SHELF-HVT-GUNG-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-GUNG-100G',NULL,NULL,NULL,NULL),('a300003a-0000-4000-8000-0000a300003a','HVT-LOT-HVT-GUNG-200G-1','Bao bì Minh Phát','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-GUNG-200G-1',NULL,NULL,NULL,NULL),('a300003b-0000-4000-8000-0000a300003b','HVT-LOT-HVT-GUNG-200G-2','Import Tea Asia','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-GUNG-200G-2',NULL,NULL,NULL,NULL),('a300003c-0000-4000-8000-0000a300003c','HVT-SHELF-HVT-GUNG-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-GUNG-200G',NULL,NULL,NULL,NULL),('a300003d-0000-4000-8000-0000a300003d','HVT-LOT-HVT-MATCHA-50G-1','Công ty TNHH Sen Tây Hồ','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-MATCHA-50G-1',NULL,NULL,NULL,NULL),('a300003e-0000-4000-8000-0000a300003e','HVT-LOT-HVT-MATCHA-50G-2','Đà Lạt Farm Atiso','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-MATCHA-50G-2',NULL,NULL,NULL,NULL),('a300003f-0000-4000-8000-0000a300003f','HVT-SHELF-HVT-MATCHA-50G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-MATCHA-50G',NULL,NULL,NULL,NULL),('a3000040-0000-4000-8000-0000a3000040','HVT-LOT-HVT-MATCHA-100G-1','Import Tea Asia','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-MATCHA-100G-1',NULL,NULL,NULL,NULL),('a3000041-0000-4000-8000-0000a3000041','HVT-LOT-HVT-MATCHA-100G-2','HTX Chè Thái Nguyên','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-MATCHA-100G-2',NULL,NULL,NULL,NULL),('a3000042-0000-4000-8000-0000a3000042','HVT-SHELF-HVT-MATCHA-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-MATCHA-100G',NULL,NULL,NULL,NULL),('a3000043-0000-4000-8000-0000a3000043','HVT-LOT-HVT-EARL-100G-1','Đà Lạt Farm Atiso','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-EARL-100G-1',NULL,NULL,NULL,NULL),('a3000044-0000-4000-8000-0000a3000044','HVT-LOT-HVT-EARL-100G-2','Bao bì Minh Phát','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-EARL-100G-2',NULL,NULL,NULL,NULL),('a3000045-0000-4000-8000-0000a3000045','HVT-SHELF-HVT-EARL-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-EARL-100G',NULL,NULL,NULL,NULL),('a3000046-0000-4000-8000-0000a3000046','HVT-LOT-HVT-EARL-200G-1','HTX Chè Thái Nguyên','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-EARL-200G-1',NULL,NULL,NULL,NULL),('a3000047-0000-4000-8000-0000a3000047','HVT-LOT-HVT-EARL-200G-2','Công ty TNHH Sen Tây Hồ','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-EARL-200G-2',NULL,NULL,NULL,NULL),('a3000048-0000-4000-8000-0000a3000048','HVT-SHELF-HVT-EARL-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-EARL-200G',NULL,NULL,NULL,NULL),('a3000049-0000-4000-8000-0000a3000049','HVT-LOT-HVT-DAO-100G-1','Bao bì Minh Phát','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DAO-100G-1',NULL,NULL,NULL,NULL),('a300004a-0000-4000-8000-0000a300004a','HVT-LOT-HVT-DAO-100G-2','Import Tea Asia','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DAO-100G-2',NULL,NULL,NULL,NULL),('a300004b-0000-4000-8000-0000a300004b','HVT-SHELF-HVT-DAO-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-DAO-100G',NULL,NULL,NULL,NULL),('a300004c-0000-4000-8000-0000a300004c','HVT-LOT-HVT-DAO-250G-1','Công ty TNHH Sen Tây Hồ','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DAO-250G-1',NULL,NULL,NULL,NULL),('a300004d-0000-4000-8000-0000a300004d','HVT-LOT-HVT-DAO-250G-2','Đà Lạt Farm Atiso','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-DAO-250G-2',NULL,NULL,NULL,NULL),('a300004e-0000-4000-8000-0000a300004e','HVT-SHELF-HVT-DAO-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-DAO-250G',NULL,NULL,NULL,NULL),('a300004f-0000-4000-8000-0000a300004f','HVT-LOT-HVT-CEYLON-100G-1','Import Tea Asia','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CEYLON-100G-1',NULL,NULL,NULL,NULL),('a3000050-0000-4000-8000-0000a3000050','HVT-LOT-HVT-CEYLON-100G-2','HTX Chè Thái Nguyên','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CEYLON-100G-2',NULL,NULL,NULL,NULL),('a3000051-0000-4000-8000-0000a3000051','HVT-SHELF-HVT-CEYLON-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-CEYLON-100G',NULL,NULL,NULL,NULL),('a3000052-0000-4000-8000-0000a3000052','HVT-LOT-HVT-CEYLON-250G-1','Đà Lạt Farm Atiso','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CEYLON-250G-1',NULL,NULL,NULL,NULL),('a3000053-0000-4000-8000-0000a3000053','HVT-LOT-HVT-CEYLON-250G-2','Bao bì Minh Phát','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-CEYLON-250G-2',NULL,NULL,NULL,NULL),('a3000054-0000-4000-8000-0000a3000054','HVT-SHELF-HVT-CEYLON-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-CEYLON-250G',NULL,NULL,NULL,NULL),('a3000055-0000-4000-8000-0000a3000055','HVT-LOT-HVT-NHAI-100G-1','HTX Chè Thái Nguyên','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-NHAI-100G-1',NULL,NULL,NULL,NULL),('a3000056-0000-4000-8000-0000a3000056','HVT-LOT-HVT-NHAI-100G-2','Công ty TNHH Sen Tây Hồ','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-NHAI-100G-2',NULL,NULL,NULL,NULL),('a3000057-0000-4000-8000-0000a3000057','HVT-SHELF-HVT-NHAI-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-NHAI-100G',NULL,NULL,NULL,NULL),('a3000058-0000-4000-8000-0000a3000058','HVT-LOT-HVT-NHAI-250G-1','Bao bì Minh Phát','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-NHAI-250G-1',NULL,NULL,NULL,NULL),('a3000059-0000-4000-8000-0000a3000059','HVT-LOT-HVT-NHAI-250G-2','Import Tea Asia','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-NHAI-250G-2',NULL,NULL,NULL,NULL),('a300005a-0000-4000-8000-0000a300005a','HVT-SHELF-HVT-NHAI-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-NHAI-250G',NULL,NULL,NULL,NULL),('a300005b-0000-4000-8000-0000a300005b','HVT-LOT-HVT-SET-TQ-1','Công ty TNHH Sen Tây Hồ','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SET-TQ-1',NULL,NULL,NULL,NULL),('a300005c-0000-4000-8000-0000a300005c','HVT-LOT-HVT-SET-TQ-2','Đà Lạt Farm Atiso','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-SET-TQ-2',NULL,NULL,NULL,NULL),('a300005d-0000-4000-8000-0000a300005d','HVT-SHELF-HVT-SET-TQ','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-SET-TQ',NULL,NULL,NULL,NULL),('a300005e-0000-4000-8000-0000a300005e','HVT-LOT-HVT-AM-TUSA-1','Import Tea Asia','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-AM-TUSA-1',NULL,NULL,NULL,NULL),('a300005f-0000-4000-8000-0000a300005f','HVT-LOT-HVT-AM-TUSA-2','HTX Chè Thái Nguyên','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-AM-TUSA-2',NULL,NULL,NULL,NULL),('a3000060-0000-4000-8000-0000a3000060','HVT-SHELF-HVT-AM-TUSA','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-08-03 04:56:55.063618','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-AM-TUSA',NULL,NULL,NULL,NULL),('a3000061-0000-4000-8000-0000a3000061','HVT-LOT-HVT-LY-NGOC-1','Đà Lạt Farm Atiso','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LY-NGOC-1',NULL,NULL,NULL,NULL),('a3000062-0000-4000-8000-0000a3000062','HVT-LOT-HVT-LY-NGOC-2','Bao bì Minh Phát','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LY-NGOC-2',NULL,NULL,NULL,NULL),('a3000063-0000-4000-8000-0000a3000063','HVT-SHELF-HVT-LY-NGOC','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-LY-NGOC',NULL,NULL,NULL,NULL),('a3000064-0000-4000-8000-0000a3000064','HVT-LOT-HVT-LY-NGOC-2-1','HTX Chè Thái Nguyên','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LY-NGOC-2-1',NULL,NULL,NULL,NULL),('a3000065-0000-4000-8000-0000a3000065','HVT-LOT-HVT-LY-NGOC-2-2','Công ty TNHH Sen Tây Hồ','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-LY-NGOC-2-2',NULL,NULL,NULL,NULL),('a3000066-0000-4000-8000-0000a3000066','HVT-SHELF-HVT-LY-NGOC-2','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-LY-NGOC-2',NULL,NULL,NULL,NULL),('a3000067-0000-4000-8000-0000a3000067','HVT-LOT-HVT-OL-NS-100G-1','Bao bì Minh Phát','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OL-NS-100G-1',NULL,NULL,NULL,NULL),('a3000068-0000-4000-8000-0000a3000068','HVT-LOT-HVT-OL-NS-100G-2','Import Tea Asia','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OL-NS-100G-2',NULL,NULL,NULL,NULL),('a3000069-0000-4000-8000-0000a3000069','HVT-SHELF-HVT-OL-NS-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-OL-NS-100G',NULL,NULL,NULL,NULL),('a300006a-0000-4000-8000-0000a300006a','HVT-LOT-HVT-OL-NS-200G-1','Công ty TNHH Sen Tây Hồ','2027-09-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OL-NS-200G-1',NULL,NULL,NULL,NULL),('a300006b-0000-4000-8000-0000a300006b','HVT-LOT-HVT-OL-NS-200G-2','Đà Lạt Farm Atiso','2027-02-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-OL-NS-200G-2',NULL,NULL,NULL,NULL),('a300006c-0000-4000-8000-0000a300006c','HVT-SHELF-HVT-OL-NS-200G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-OL-NS-200G',NULL,NULL,NULL,NULL),('a300006d-0000-4000-8000-0000a300006d','HVT-LOT-HVT-TN-DB-100G-1','Import Tea Asia','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-TN-DB-100G-1',NULL,NULL,NULL,NULL),('a300006e-0000-4000-8000-0000a300006e','HVT-LOT-HVT-TN-DB-100G-2','HTX Chè Thái Nguyên','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-TN-DB-100G-2',NULL,NULL,NULL,NULL),('a300006f-0000-4000-8000-0000a300006f','HVT-SHELF-HVT-TN-DB-100G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-TN-DB-100G',NULL,NULL,NULL,NULL),('a3000070-0000-4000-8000-0000a3000070','HVT-LOT-HVT-TN-DB-250G-1','Đà Lạt Farm Atiso','2027-03-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-TN-DB-250G-1',NULL,NULL,NULL,NULL),('a3000071-0000-4000-8000-0000a3000071','HVT-LOT-HVT-TN-DB-250G-2','Bao bì Minh Phát','2027-08-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-HVT-TN-DB-250G-2',NULL,NULL,NULL,NULL),('a3000072-0000-4000-8000-0000a3000072','HVT-SHELF-HVT-TN-DB-250G','Chuyển kệ nội bộ',NULL,'Seed HVT tồn kệ POS','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Shelf',NULL,NULL,'HVT-SHELF-HVT-TN-DB-250G',NULL,NULL,NULL,NULL),('a3000073-0000-4000-8000-0000a3000073','HVT-LOT-NL-TRAXANH-1KG-1','HTX Chè Thái Nguyên','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-TRAXANH-1KG-1',NULL,NULL,NULL,NULL),('a3000074-0000-4000-8000-0000a3000074','HVT-LOT-NL-TRAXANH-1KG-2','Công ty TNHH Sen Tây Hồ','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-TRAXANH-1KG-2',NULL,NULL,NULL,NULL),('a3000075-0000-4000-8000-0000a3000075','HVT-LOT-NL-OLONG-1KG-1','Đà Lạt Farm Atiso','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-OLONG-1KG-1',NULL,NULL,NULL,NULL),('a3000076-0000-4000-8000-0000a3000076','HVT-LOT-NL-OLONG-1KG-2','Bao bì Minh Phát','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-OLONG-1KG-2',NULL,NULL,NULL,NULL),('a3000077-0000-4000-8000-0000a3000077','HVT-LOT-NL-HOASEN-1KG-1','Import Tea Asia','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-HOASEN-1KG-1',NULL,NULL,NULL,NULL),('a3000078-0000-4000-8000-0000a3000078','HVT-LOT-NL-HOASEN-1KG-2','HTX Chè Thái Nguyên','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-HOASEN-1KG-2',NULL,NULL,NULL,NULL),('a3000079-0000-4000-8000-0000a3000079','HVT-LOT-NL-HOALAI-1KG-1','Công ty TNHH Sen Tây Hồ','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-HOALAI-1KG-1',NULL,NULL,NULL,NULL),('a300007a-0000-4000-8000-0000a300007a','HVT-LOT-NL-HOALAI-1KG-2','Đà Lạt Farm Atiso','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-HOALAI-1KG-2',NULL,NULL,NULL,NULL),('a300007b-0000-4000-8000-0000a300007b','HVT-LOT-NL-DUONGPHEN-1KG-1','Bao bì Minh Phát','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-DUONGPHEN-1KG-1',NULL,NULL,NULL,NULL),('a300007c-0000-4000-8000-0000a300007c','HVT-LOT-NL-DUONGPHEN-1KG-2','Import Tea Asia','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-DUONGPHEN-1KG-2',NULL,NULL,NULL,NULL),('a300007d-0000-4000-8000-0000a300007d','HVT-LOT-NL-ATISO-1KG-1','HTX Chè Thái Nguyên','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-ATISO-1KG-1',NULL,NULL,NULL,NULL),('a300007e-0000-4000-8000-0000a300007e','HVT-LOT-NL-ATISO-1KG-2','Công ty TNHH Sen Tây Hồ','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-ATISO-1KG-2',NULL,NULL,NULL,NULL),('a300007f-0000-4000-8000-0000a300007f','HVT-LOT-NL-SHAN-1KG-1','Đà Lạt Farm Atiso','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-SHAN-1KG-1',NULL,NULL,NULL,NULL),('a3000080-0000-4000-8000-0000a3000080','HVT-LOT-NL-SHAN-1KG-2','Bao bì Minh Phát','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-SHAN-1KG-2',NULL,NULL,NULL,NULL),('a3000081-0000-4000-8000-0000a3000081','HVT-LOT-NL-PHUNHI-1KG-1','Import Tea Asia','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-PHUNHI-1KG-1',NULL,NULL,NULL,NULL),('a3000082-0000-4000-8000-0000a3000082','HVT-LOT-NL-PHUNHI-1KG-2','HTX Chè Thái Nguyên','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-NL-PHUNHI-1KG-2',NULL,NULL,NULL,NULL),('a3000083-0000-4000-8000-0000a3000083','HVT-LOT-BB-ZIP-100-1','Công ty TNHH Sen Tây Hồ','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-ZIP-100-1',NULL,NULL,NULL,NULL),('a3000084-0000-4000-8000-0000a3000084','HVT-LOT-BB-ZIP-100-2','Đà Lạt Farm Atiso','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-ZIP-100-2',NULL,NULL,NULL,NULL),('a3000085-0000-4000-8000-0000a3000085','HVT-LOT-BB-ZIP-250-1','Bao bì Minh Phát','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-ZIP-250-1',NULL,NULL,NULL,NULL),('a3000086-0000-4000-8000-0000a3000086','HVT-LOT-BB-ZIP-250-2','Import Tea Asia','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-ZIP-250-2',NULL,NULL,NULL,NULL),('a3000087-0000-4000-8000-0000a3000087','HVT-LOT-BB-HOP-NHO-1','HTX Chè Thái Nguyên','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-HOP-NHO-1',NULL,NULL,NULL,NULL),('a3000088-0000-4000-8000-0000a3000088','HVT-LOT-BB-HOP-NHO-2','Công ty TNHH Sen Tây Hồ','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-HOP-NHO-2',NULL,NULL,NULL,NULL),('a3000089-0000-4000-8000-0000a3000089','HVT-LOT-BB-TEM-1','Đà Lạt Farm Atiso','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-TEM-1',NULL,NULL,NULL,NULL),('a300008a-0000-4000-8000-0000a300008a','HVT-LOT-BB-TEM-2','Bao bì Minh Phát','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-TEM-2',NULL,NULL,NULL,NULL),('a300008b-0000-4000-8000-0000a300008b','HVT-LOT-BB-NILON-1','Import Tea Asia','2026-12-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-NILON-1',NULL,NULL,NULL,NULL),('a300008c-0000-4000-8000-0000a300008c','HVT-LOT-BB-NILON-2','HTX Chè Thái Nguyên','2026-05-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-NILON-2',NULL,NULL,NULL,NULL),('a300008d-0000-4000-8000-0000a300008d','HVT-LOT-BB-HOP-LON-1','Công ty TNHH Sen Tây Hồ','2026-06-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-HOP-LON-1',NULL,NULL,NULL,NULL),('a300008e-0000-4000-8000-0000a300008e','HVT-LOT-BB-HOP-LON-2','Đà Lạt Farm Atiso','2026-11-28 00:00:00.000000','Seed HVT realistic kho','active','00000000-0000-0000-0000-000000000000','2026-07-30 17:30:24.948410','2026-07-30 17:30:24.948410','hvt_seed',NULL,'HVT-SEED','Warehouse',NULL,NULL,'HVT-LOT-BB-HOP-LON-2',NULL,NULL,NULL,NULL),('a752280d-39b5-4dd4-9613-7f9e2f2f3450','NCC-LOT-015','Công ty TNHH trà đạo việt nam','2027-01-18 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-015','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.711937','2026-08-03 04:48:29.711937','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-E9F3D2A37C364B929DA03F8501D67ECF','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002f-0000-4000-8000-0000a200002f','NCC-LOT-015','2026-01-18 00:00:00.000000'),('af0a2cae-52c6-49f3-9766-ea880d26cc35','NCC-LOT-016','Công ty TNHH trà đạo việt nam','2027-01-19 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-016','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.719820','2026-08-03 04:48:29.719820','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-7F5AF7EAA3E74BF2BB180BD402504D91','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000030-0000-4000-8000-0000a2000030','NCC-LOT-016','2026-01-19 00:00:00.000000'),('bcbc5c0f-e433-4588-a479-f0cea01bc204','NCC-LOT-028','Công ty TNHH trà đạo việt nam','2027-01-11 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-028','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.794262','2026-08-03 04:48:29.794262','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-AACB736DEE8D410F85C7DDA29E71EAA3','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000019-0000-4000-8000-0000a2000019','NCC-LOT-028','2026-01-11 00:00:00.000000'),('cc9ba807-8010-40af-a837-1e5adc363bc7','NCC-LOT-023','Công ty TNHH trà đạo việt nam','2027-01-06 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-023','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.757490','2026-08-03 04:48:29.757490','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-CAFA2F16E36C4DC8AB4C48C9F1A1E2AF','6a72e704-fa71-4cd8-92b2-1aee24150660','a200000b-0000-4000-8000-0000a200000b','NCC-LOT-023','2026-01-06 00:00:00.000000'),('d01ce800-fb9c-4876-a6b2-5d1ad063f00b','NCC-LOT-008','Công ty TNHH trà đạo việt nam','2027-01-11 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-008','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.864878','2026-08-03 04:48:29.864878','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-89E63CB28BA44CF4B347724CC6CC5172','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000027-0000-4000-8000-0000a2000027','NCC-LOT-008','2026-01-11 00:00:00.000000'),('d6fafaec-4724-4195-a6ea-7f63fa0c90a4','NCC-LOT-004','Công ty TNHH trà đạo việt nam','2027-01-07 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-004 - Đạt có ghi chú: hơi ẩm nhẹ, đã kiểm tra cảm quan','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.830790','2026-08-03 04:48:29.830790','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-1515E56014654317B21196F774E28A3B','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000029-0000-4000-8000-0000a2000029','NCC-LOT-004','2026-01-07 00:00:00.000000'),('d9e33535-c11c-4183-b4f5-0991cf999f51','NCC-LOT-007','Công ty TNHH trà đạo việt nam','2027-01-10 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-007','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.856419','2026-08-03 04:48:29.856419','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-44FAC6558ECD44DFA83AD2D349A3CC9F','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002d-0000-4000-8000-0000a200002d','NCC-LOT-007','2026-01-10 00:00:00.000000'),('dc74dc60-6298-420b-a506-ae65ec764efc','NCC-LOT-020','Công ty TNHH trà đạo việt nam','2027-01-23 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-020','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.735461','2026-08-03 04:48:29.735461','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-29FC77292FE74159852935A3A1B3CF78','6a72e704-fa71-4cd8-92b2-1aee24150660','a200000f-0000-4000-8000-0000a200000f','NCC-LOT-020','2026-01-23 00:00:00.000000'),('e926c252-4091-41c2-98c3-33f84457b158','NCC-LOT-021','Công ty TNHH trà đạo việt nam','2027-01-04 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-021','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.743050','2026-08-03 04:48:29.743050','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-C216CCFF42EF4965B28449153577CD35','6a72e704-fa71-4cd8-92b2-1aee24150660','a2000010-0000-4000-8000-0000a2000010','NCC-LOT-021','2026-01-04 00:00:00.000000'),('fb1421db-060b-46e7-bb70-5814d5a3b746','NCC-LOT-003','Công ty TNHH trà đạo việt nam','2027-01-06 00:00:00.000000','Phiếu nhập NCC NCC-20260803-0004 - Công ty TNHH trà đạo việt nam - Mã lô NCC: NCC-LOT-003','active','eeb2c541-38fe-4e73-8784-4381bae0f5c6','2026-08-03 04:48:29.823075','2026-08-03 04:48:29.823075','supplier_receipt','c6be8d6a-1d9b-4f62-9890-9e22bd637c3f','NCC-20260803-0004','Warehouse',NULL,NULL,'SR-C953B48CFBEB4D7FA9D80E76E70A25A0','6a72e704-fa71-4cd8-92b2-1aee24150660','a200002a-0000-4000-8000-0000a200002a','NCC-LOT-003','2026-01-06 00:00:00.000000');
/*!40000 ALTER TABLE `WarehouseBatches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WarehouseDailyReportSubmissions`
--

DROP TABLE IF EXISTS `WarehouseDailyReportSubmissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WarehouseDailyReportSubmissions` (
  `Id` char(36) NOT NULL,
  `BusinessDate` date NOT NULL,
  `SentAtUtc` datetime(6) NOT NULL,
  `SentBy` char(36) NOT NULL,
  `SentByName` varchar(255) NOT NULL,
  `SentByRoleName` varchar(100) DEFAULT NULL,
  `DoneTotal` int NOT NULL,
  `OpenCarryCount` int NOT NULL,
  `TotalWarehouseQuantity` int NOT NULL,
  `LowStockSkuCount` int NOT NULL,
  `ExpiringBatchCount30Days` int NOT NULL,
  `SnapshotJson` longtext NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_WarehouseDailyReportSubmissions_BusinessDate` (`BusinessDate`),
  KEY `IX_WarehouseDailyReportSubmissions_SentAtUtc` (`SentAtUtc`),
  KEY `IX_WarehouseDailyReportSubmissions_BusinessDate_SentAtUtc` (`BusinessDate`,`SentAtUtc`),
  KEY `IX_WarehouseDailyReportSubmissions_SentBy` (`SentBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WarehouseDailyReportSubmissions`
--

LOCK TABLES `WarehouseDailyReportSubmissions` WRITE;
/*!40000 ALTER TABLE `WarehouseDailyReportSubmissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `WarehouseDailyReportSubmissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `__EFMigrationsHistory`
--

DROP TABLE IF EXISTS `__EFMigrationsHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__EFMigrationsHistory` (
  `MigrationId` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductVersion` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`MigrationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__EFMigrationsHistory`
--

LOCK TABLES `__EFMigrationsHistory` WRITE;
/*!40000 ALTER TABLE `__EFMigrationsHistory` DISABLE KEYS */;
INSERT INTO `__EFMigrationsHistory` VALUES ('20260606160000_InitialCreate','8.0.0'),('20260608120000_AddStockAdjustmentRequests','8.0.0'),('20260609180000_AddWarehouseStockAndExportSlips','8.0.0'),('20260610150000_AddWarehouseBatches','8.0.0'),('20260610180000_RefactorWarehouseBatchMultiSku','8.0.0'),('20260615120000_StockAdjustmentRequestItems','8.0.0'),('20260619100000_AddLowStockThresholdToSkuStocks','8.0.0'),('20260626120000_AddProductionOrders','8.0.0'),('20260701090000_AddProductionTraceFields','8.0.0'),('20260701103000_AddStockImportSlips','8.0.0'),('20260701113000_AddStockExportSlipLines','8.0.0'),('20260701120000_AddProductionOrderOutputLines','8.0.0'),('20260701123000_AddStockImportSlipLines','8.0.0'),('20260702120000_AddSlipCreatorSnapshots','8.0.0'),('20260706120000_RefactorProductionOrdersToMultiOutput','8.0.0'),('20260706123000_AddProductionOrderOutputLineExpiry','8.0.0'),('20260712100000_AddStockDeductQueueAuditAndInsufficientStatus','8.0.0'),('20260715120000_AddPartialFinishedAndBomPendingFieldsToStockDeductQueue','8.0.0'),('20260717101000_AddSkuStockLocationThresholds','8.0.0'),('20260717140000_AddInventoryLedgerAndSupplierReceipts','8.0.0'),('20260717150000_AddInventoryReturnFlowsAndBatchLocations','8.0.0'),('20260717160000_AddProductionApprovalAndOutputDestination','8.0.0'),('20260717170000_AddStocktakeRequests','8.0.0'),('20260722100000_AddSuppliers','8.0.0'),('20260724120000_AddEventIdToProcessedIntegrationEvents','8.0.0'),('20260724140000_AddReservedQuantityToSkuStock','8.0.0'),('20260724160000_AddReturnInspections','8.0.0'),('20260725100000_AddCodReservationTraceability','8.0.0'),('20260729120000_AddStockTransfers','8.0.0'),('20260729150000_AddSupplierReceiptDocumentCostOutbox','8.0.0'),('20260729173000_AddWarehouseBatchCode','8.0.0'),('20260730100000_AddSupplierCodeAndSupplierLotIdentity','8.0.0'),('20260730140000_AddSupplierProducts','8.0.0'),('20260731090000_AddStockAdjustmentRequestFulfillment','8.0.0'),('20260731093000_AddStockTransferRequestLinks','8.0.0'),('20260731110000_AddStockAdjustmentRequestActorSnapshot','8.0.0'),('20260801090000_AddShelfReplenishmentSuggestions','8.0.0'),('20260802010000_AddWarehouseDailyReportSubmissions','8.0.0'),('20260802013000_UniqueWarehouseDailyReportSubmissionBusinessDate','8.0.0'),('20260802181701_DropShelfReturnRequestFlow','8.0.0'),('20260803010000_AddSupplierReturnDefectEvidenceAndOperationId','8.0.0'),('20260803020000_AddSupplierReturnEvidenceImages','8.0.0');
/*!40000 ALTER TABLE `__EFMigrationsHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Current Database: `hvt_order_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `hvt_order_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `hvt_order_db`;

--
-- Table structure for table `CustomBundleIngredients`
--

DROP TABLE IF EXISTS `CustomBundleIngredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CustomBundleIngredients` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `CustomBundleId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `MaterialSkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `MaterialSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Quantity` int NOT NULL,
  `UnitPrice` decimal(18,2) NOT NULL,
  `SubTotal` decimal(18,2) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_CustomBundleIngredients_CustomBundleId` (`CustomBundleId`),
  CONSTRAINT `FK_CustomBundleIngredients_CustomBundles_CustomBundleId` FOREIGN KEY (`CustomBundleId`) REFERENCES `CustomBundles` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CustomBundleIngredients`
--

LOCK TABLES `CustomBundleIngredients` WRITE;
/*!40000 ALTER TABLE `CustomBundleIngredients` DISABLE KEYS */;
INSERT INTO `CustomBundleIngredients` VALUES ('25097693-3e37-4ec4-ab0d-0e748f013a60','45d45283-929d-43d2-8c26-25ffb2a49a37','20000000-0000-0000-0000-000000000001','TRA-TQ-200G','Trà Tiết Quan',1,120000.00,120000.00,0,'2026-07-21 00:30:11.531466','2026-07-21 00:30:11.531466'),('3bb49285-d2be-40da-9eb9-ac478542f011','504a69d3-6849-49ab-8b73-80f3e2953295','20000000-0000-0000-0000-000000000011','NL-TRA-1KG','Trà xanh nguyên liệu',1,180000.00,180000.00,0,'2026-07-21 01:12:28.657184','2026-07-21 01:12:28.657184'),('7be3dab4-2930-43d2-a745-279031e9903e','3ab88b74-6a7a-43a4-96cc-36f393215d72','20000000-0000-0000-0000-000000000011','NL-TRA-1KG','Trà xanh nguyên liệu',1,180000.00,180000.00,0,'2026-07-21 01:07:28.221024','2026-07-21 01:07:28.221024'),('9b424dc5-289a-4879-bd70-1ab1de2940f6','45d45283-929d-43d2-8c26-25ffb2a49a37','20000000-0000-0000-0000-000000000005','TRA-OL-100G','Trà Ô Long đặc biệt',1,95000.00,95000.00,0,'2026-07-21 00:30:11.531466','2026-07-21 00:30:11.531466'),('a42ef2b0-90b9-4c5e-a9df-354d7bbeab2c','504a69d3-6849-49ab-8b73-80f3e2953295','20000000-0000-0000-0000-000000000012','NL-DUONG-1KG','Đường trắng tinh luyện',2,20000.00,40000.00,0,'2026-07-21 01:12:28.657184','2026-07-21 01:12:28.657184'),('de654042-6238-4dc4-91df-d60ea59faa7e','45d45283-929d-43d2-8c26-25ffb2a49a37','20000000-0000-0000-0000-000000000002','TRA-TQ-500G','Trà Tiết Quan',1,280000.00,280000.00,0,'2026-07-21 00:30:11.531466','2026-07-21 00:30:11.531466'),('f500319e-955d-4f78-b014-667606f135ad','3ab88b74-6a7a-43a4-96cc-36f393215d72','20000000-0000-0000-0000-000000000012','NL-DUONG-1KG','Đường trắng tinh luyện',1,20000.00,20000.00,0,'2026-07-21 01:07:28.221024','2026-07-21 01:07:28.221024');
/*!40000 ALTER TABLE `CustomBundleIngredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CustomBundles`
--

DROP TABLE IF EXISTS `CustomBundles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CustomBundles` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Label` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `TotalPrice` decimal(18,2) NOT NULL,
  `PackingStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PackedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_CustomBundles_OrderId` (`OrderId`),
  KEY `IX_CustomBundles_PackingStatus` (`PackingStatus`),
  CONSTRAINT `FK_CustomBundles_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CustomBundles`
--

LOCK TABLES `CustomBundles` WRITE;
/*!40000 ALTER TABLE `CustomBundles` DISABLE KEYS */;
INSERT INTO `CustomBundles` VALUES ('3ab88b74-6a7a-43a4-96cc-36f393215d72','bbcf794d-8dc2-4378-afd7-707651068770','Gói nguyên liệu cho khách TrangVN',NULL,200000.00,'Packed','2026-07-21 01:07:46.227902',0,'2026-07-21 01:07:28.221024','2026-07-21 01:07:46.227903'),('45d45283-929d-43d2-8c26-25ffb2a49a37','36bee2f6-8131-48d0-9498-d982f4f5b127','Gói trà cho khách HuyNQ',NULL,495000.00,'Packed','2026-07-21 00:31:19.127173',0,'2026-07-21 00:30:11.531466','2026-07-21 00:31:19.127201'),('504a69d3-6849-49ab-8b73-80f3e2953295','8d490359-dc56-4ec0-8d04-00aaa0b4cc89','Gói hàng cho khách TrangVN',NULL,220000.00,'Packed','2026-07-21 01:12:47.762731',0,'2026-07-21 01:12:28.657184','2026-07-21 01:12:47.762731');
/*!40000 ALTER TABLE `CustomBundles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OrderActivities`
--

DROP TABLE IF EXISTS `OrderActivities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderActivities` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ActivityType` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ActorId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ActorName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_OrderActivities_OrderId` (`OrderId`),
  CONSTRAINT `FK_OrderActivities_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OrderActivities`
--

LOCK TABLES `OrderActivities` WRITE;
/*!40000 ALTER TABLE `OrderActivities` DISABLE KEYS */;
INSERT INTO `OrderActivities` VALUES ('019aaa91-78bc-48ac-83c7-dab438b67214','0c614f8b-e621-49f6-a4a7-773953e90ffc','Returned','Trả hàng TH-260628-002: đổi/mua thêm, khách trả thêm 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:10:18.347461'),('029a065d-507b-431c-adf6-9cd3e3b1d383','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:49.036823'),('0901f9c7-4799-44b0-a9e2-f8edf0ac955b','a731dcd6-ab3b-4249-b049-191db7475747','Created','Tạo đơn HVT-260628-003 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:52:33.872389'),('09e0ffe0-d169-4cfa-8925-8659c234303c','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','Cancelled','Hủy thanh toán chuyển khoản và hoàn tác checkout POS đang chờ.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:51:58.235249'),('0bd5ea87-99db-4234-b8b4-fa431a63a31c','51d265b9-7faf-4759-ada2-33d5aef1a842','Completed','Hoàn tất đơn hàng.',NULL,'SePay Webhook','2026-06-27 23:08:14.119979'),('0bed7e0a-459e-4a4f-b3f1-29096397dc0f','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 21:41:07.576735'),('17258725-98a0-417e-bb02-d45212a49133','0c614f8b-e621-49f6-a4a7-773953e90ffc','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:06:03.609225'),('19e99748-8afb-4a71-9290-41f8b94ed045','bbcf794d-8dc2-4378-afd7-707651068770','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:07:28.224416'),('1ada3416-aa39-40d4-86cb-d99319c40028','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','PaymentPending','Chờ thanh toán qua COD.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:38:48.552863'),('2377daa7-ec7e-4385-bc62-86819153e439','4e11e7ae-47dc-4353-9a01-942df8ae5338','Created','Tạo đơn HVT-260628-001 qua kênh bán tại quầy. Thành tiền 180.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:28:03.409081'),('24497164-8bfc-4b30-97d3-bc65ab827e8d','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','Created','Tạo đơn HVT-260628-005 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:09:04.085098'),('252d40bf-9e3b-499a-91c0-b363e16e5122','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','InventorySynced','Đơn đã hoàn tất. 1 sản phẩm chờ đối soát/trừ nguyên liệu theo BOM.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:53:50.382900'),('26766dbb-658f-4e97-b61c-4ab700b7e927','f22d20f3-6930-46bf-a3d7-c8c87998e454','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:28:12.681746'),('275e96d2-6c84-4ea2-864b-7f7f74d86164','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:32:23.433485'),('28e00192-f183-45e0-b1f5-95be3a9a9bf1','03fef9d3-67a3-4d00-aacd-80188845ba0e','Cancelled','Hủy thanh toán chuyển khoản và hoàn tác checkout POS đang chờ.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:30.098768'),('2ca7cf51-23af-4bf0-85f8-99085a9204c4','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','Created','Tạo đơn HVT-260628-002 qua kênh COD. Thành tiền 20.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:38:48.552797'),('2ebaccbe-bb47-433b-af13-6c5ea2630ee8','bfbf1c5e-f73d-4a84-990d-b01b9c813715','Created','Tạo đơn HVT-260628-010 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:26:03.118147'),('3149a05f-01bd-4dc9-b03a-ffe0800fa14a','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','PaymentPending','Chờ thanh toán qua COD.','826b791f-6ec3-40bf-9555-557b01ef5979','sale_cod01','2026-07-26 14:22:10.434517'),('36a3dac1-9c7d-4e67-99ab-1fa66c11a0c4','23788224-5be8-4c26-bb91-5f5bbcfa8d54','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:31:36.267985'),('36a47732-923f-4ac0-8d95-a89a4706895f','b6cd848b-6972-42fd-9020-df8da11f672d','Created','Tạo đơn HVT-260628-008 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:59.271005'),('3765ec34-0420-4ad8-aee0-01f15828b1f4','51d265b9-7faf-4759-ada2-33d5aef1a842','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-27 23:08:14.155420'),('3b66d80b-10d8-4df0-a43c-c8f57702346c','23788224-5be8-4c26-bb91-5f5bbcfa8d54','Created','Tạo đơn HVT-260628-012 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:31:36.267894'),('40dba652-bb63-4211-862e-0ce43b51f762','51b17789-8017-4ef3-97dd-045418706f1d','Created','Tạo đơn HVT-260722-002 qua kênh bán tại quầy. Thành tiền 330.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:56:07.832602'),('40ff8c57-5af3-43e3-8cab-c18a9691cf06','a4039734-18f7-4cc9-9f8d-8166192ed6fd','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-27 23:02:26.797050'),('430b9710-ce87-48b0-a324-0d431f51bc32','d50ad779-2a83-4baf-aa05-6136d429f265','Created','Tạo đơn HVT-260731-005 qua kênh bán tại quầy. Thành tiền 92.150 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 02:12:55.887298'),('43828b0a-9bb5-4561-893e-352075b62773','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 06:09:04.164435'),('438a9416-a1d4-4a55-b0a4-a97f4ef1aa3f','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:32:23.433500'),('442336f4-2eb6-4122-8492-84537bf1f66b','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:09:04.085741'),('4727f9d6-0b53-4612-8cea-927ebc5cfefc','8d490359-dc56-4ec0-8d04-00aaa0b4cc89','Created','Tạo đơn HVT-260721-003 qua kênh bán tại quầy. Thành tiền 220.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:12:28.657909'),('486f3a31-30c1-4cb6-8b64-96679e2417ab','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:53:50.382836'),('543da92f-b76c-4e8a-af85-43844dcc536f','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','Cancelled','Hủy đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:12:06.154614'),('5550c759-3bdd-4b57-b707-d565dc156a17','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','CodVerified','Xác nhận thu COD 20.000 ₫.','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','manager01','2026-06-28 04:45:42.690461'),('55d7046c-c5a1-43ba-8216-70f60afe093c','a731dcd6-ab3b-4249-b049-191db7475747','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 04:52:34.573458'),('5b4b9c7c-5c4a-4a19-9193-58ced92096dd','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','CodVerified','Xác nhận thu COD 50.000 ₫ (đơn 24.000 ₫, thừa 26.000 ₫).','826b791f-6ec3-40bf-9555-557b01ef5979','sale_cod01','2026-07-26 14:26:00.164158'),('61567dce-dde6-4bed-b54c-3bd9523b500d','a33da7ea-d424-4896-b22f-af6eee19b548','InventorySynced','Đơn đã hoàn tất. Đã trừ tồn quầy POS mặc định ngay khi checkout.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-08-03 04:56:55.101296'),('63215c1d-ac8d-48ca-ac65-9cac014f3e71','36bee2f6-8131-48d0-9498-d982f4f5b127','Created','Tạo đơn HVT-260721-001 qua kênh bán tại quầy. Thành tiền 495.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 00:30:11.591767'),('67535235-0feb-497a-b947-ed07a3d078f0','d50ad779-2a83-4baf-aa05-6136d429f265','Completed','Hoàn tất đơn hàng.',NULL,'SePay Webhook','2026-07-31 02:13:17.961054'),('6975e561-5b5d-4cf4-a127-cff03dc6f67c','f22d20f3-6930-46bf-a3d7-c8c87998e454','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:28:12.681766'),('69de1cd0-c17b-4d75-91e0-49950f9299a5','7f27c059-1415-4802-b831-fcc243a6098f','PaymentPending','Chờ 92.150 ₫ qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:52:24.630185'),('6be4e722-71b8-4a33-b14b-d8c204a32031','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','Created','Tạo đơn đổi hàng HVT-DOI-260628-001. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:10:18.370065'),('6d5c95cf-2132-45cd-9471-c0810060e713','a4039734-18f7-4cc9-9f8d-8166192ed6fd','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-27 23:02:26.797229'),('6ee41a42-9111-42cf-8370-e85100c97e9c','f22d20f3-6930-46bf-a3d7-c8c87998e454','Created','Tạo đơn HVT-260628-011 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:28:12.681619'),('7467dd45-5888-4f36-b087-55d89fae480d','b6cd848b-6972-42fd-9020-df8da11f672d','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 06:11:59.320439'),('75799c1a-b2b2-4fa8-96cf-91bc76359d13','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:41:07.502886'),('760ac276-f2f3-4424-8c7d-ff003ec00825','4e11e7ae-47dc-4353-9a01-942df8ae5338','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:28:03.417998'),('771f471a-3155-419f-bab9-bbe1f36c39c7','d50ad779-2a83-4baf-aa05-6136d429f265','PaymentPending','Chờ 92.150 ₫ qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 02:12:55.896996'),('799bdc69-f899-4745-9547-8fa730a33270','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','Completed','Hoàn tất đơn hàng sau khi xác nhận thu COD.','8edcf23b-5dc6-45d2-a55a-214b7e2c636c','manager01','2026-06-28 04:45:42.690579'),('7d3d972e-aa7e-4533-ba5d-e7d423795915','7068f5f1-568e-4242-9025-5cf188cfcdfc','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:12:13.401280'),('7d68cf9d-0b2a-4be9-b240-0297ff9ebaea','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','PaymentReceived','Đã thu 50.000 ₫ qua tiền mặt. Còn nợ 45.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:09:04.085631'),('7ed447ea-dde6-4587-b7a7-68f9a35e3be2','a33da7ea-d424-4896-b22f-af6eee19b548','Created','Tạo đơn HVT-260803-001 qua kênh bán tại quầy. Thành tiền 350.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-08-03 04:56:55.088070'),('81638670-6676-466a-846c-0033ec33452a','bbcf794d-8dc2-4378-afd7-707651068770','PaymentReceived','Đã thanh toán 200.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:07:28.224395'),('818f97ac-71b8-424b-9a76-0c5081f3f7da','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','PaymentPending','Chờ 92.150 ₫ qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:51:28.010036'),('829bb68e-4922-4de4-8f5d-2f98ab17d6ec','51d265b9-7faf-4759-ada2-33d5aef1a842','PaymentReceived','Đã thanh toán 9.000 ₫ qua VietQR. Mã GD: b65ca814-c33a-48f0-a06c-29d5b2a00169.',NULL,'SePay Webhook','2026-06-27 23:08:14.119853'),('84993204-3792-43ae-91c8-094554bf1f99','a875cfb1-2738-45db-a9a4-9412e98463aa','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:53.526624'),('88cdb622-50f8-4316-a799-1fa899eed55c','a4039734-18f7-4cc9-9f8d-8166192ed6fd','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-27 23:02:27.570362'),('8c4d3816-e0c6-426d-8dac-81195bf4af8b','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','Created','Tạo đơn HVT-260722-001 qua kênh bán tại quầy. Thành tiền 145.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:53:50.367547'),('8d839048-e59b-4bb1-845c-53439be6bf82','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','Shipped','Chuyển sang trạng thái đang giao hàng.','826b791f-6ec3-40bf-9555-557b01ef5979','sale_cod01','2026-07-26 14:25:52.577070'),('8f3c8feb-6d85-4075-9dbb-c65b26dfd933','7f27c059-1415-4802-b831-fcc243a6098f','Created','Tạo đơn HVT-260731-004 qua kênh bán tại quầy. Thành tiền 92.150 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:52:24.630080'),('8fb228e8-9bc5-4963-9648-36bc288b86b4','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','PaymentReceived','Đã thanh toán 145.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:53:50.382669'),('9019b70b-bbe7-4258-8d29-36dbb616cd5f','51d265b9-7faf-4759-ada2-33d5aef1a842','Created','Tạo đơn HVT-260627-002 qua kênh bán tại quầy. Thành tiền 9.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-27 23:06:38.651352'),('94c0c2be-0041-4a11-8755-8cfbba47a4ee','7f27c059-1415-4802-b831-fcc243a6098f','Cancelled','Hủy thanh toán chuyển khoản và hoàn tác checkout POS đang chờ.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:55:45.373155'),('9522182f-147e-4e13-914f-6ba1fc92aeec','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','PaymentPending','Chờ thanh toán qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:10:18.370118'),('957c1d57-8a08-41cc-8d00-9ecd15d8b3c2','b6cd848b-6972-42fd-9020-df8da11f672d','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:59.271075'),('970c8a56-d268-45f8-a7b3-d1c09af54108','7068f5f1-568e-4242-9025-5cf188cfcdfc','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:12:13.401265'),('99b0cbe6-c2ed-43e2-bf17-cae3f3e18be8','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','InventorySynced','Đơn đã hoàn tất. Đã trừ tồn quầy POS mặc định ngay khi checkout.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:07.033041'),('9acfbf9f-b025-44a9-8f68-13ec4cbf6593','a731dcd6-ab3b-4249-b049-191db7475747','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:52:33.874334'),('9ad2ae06-74f0-4eef-a28c-726687e3d612','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 21:32:23.489341'),('9c80bdf4-1d65-491d-b163-dc4b88eb6200','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 06:11:49.093886'),('9c8df7c4-0309-42be-a72e-a8d1e7c6c31e','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','Created','Tạo đơn HVT-260628-013 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:32:23.433434'),('9db11b73-574c-4ee0-8247-7b4ee10c514e','bfbf1c5e-f73d-4a84-990d-b01b9c813715','PaymentPending','Chờ thanh toán qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:26:03.120699'),('9eb7154e-47da-4cad-bdfd-322961ab13b1','a731dcd6-ab3b-4249-b049-191db7475747','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:52:33.874254'),('a10d5ae3-a8dc-4d09-84f1-f2409691b7f9','a875cfb1-2738-45db-a9a4-9412e98463aa','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:53.526612'),('a44653cd-1294-4b5d-9a1e-d93a5de3618a','0c614f8b-e621-49f6-a4a7-773953e90ffc','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 05:06:03.653831'),('a57bffd1-4ff2-4893-80f3-76c85fe9c91e','4e11e7ae-47dc-4353-9a01-942df8ae5338','PaymentReceived','Đã thanh toán 180.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 04:28:03.417900'),('a847968b-b85c-479b-972f-7b21a49c9c59','51b17789-8017-4ef3-97dd-045418706f1d','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:56:07.832697'),('a9945f33-d646-46c4-aa7c-0b833c6c038b','f22d20f3-6930-46bf-a3d7-c8c87998e454','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 21:28:12.737269'),('a9ac9438-52ce-40ca-8f2c-83f5b549bf21','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','Created','Tạo đơn HVT-260731-001 qua kênh bán tại quầy. Thành tiền 92.150 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:07.019678'),('ab7b2b00-2e38-4383-9846-40e06e460855','51b17789-8017-4ef3-97dd-045418706f1d','PaymentReceived','Đã thanh toán 330.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:56:07.832683'),('ac97c8c1-4d04-4056-8c00-eb45d1d0155c','23788224-5be8-4c26-bb91-5f5bbcfa8d54','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:31:36.267966'),('b0355cc3-2919-4751-aa7b-e262d167d4d0','a875cfb1-2738-45db-a9a4-9412e98463aa','Created','Tạo đơn HVT-260628-007 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:53.526561'),('b195afad-1edf-4383-95d5-64791701566d','bfbf1c5e-f73d-4a84-990d-b01b9c813715','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 21:26:03.622317'),('b23c64cb-9464-4392-a7b8-807873bb932f','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','Created','Tạo đơn HVT-260628-006 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:49.036521'),('b4fec47d-7f08-4590-8f4f-2a586e8bb882','a875cfb1-2738-45db-a9a4-9412e98463aa','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 06:11:53.566840'),('b538454e-4911-43c9-90a5-29b19b4efd68','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','Created','Tạo đơn HVT-260726-001 qua kênh COD. Thành tiền 24.000 ₫.','826b791f-6ec3-40bf-9555-557b01ef5979','sale_cod01','2026-07-26 14:22:10.423847'),('b6624a87-a52f-4361-9cae-5ca5d6748549','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:49.036769'),('bbc2dd95-d443-427c-bd9f-22bd2841d0c4','0c614f8b-e621-49f6-a4a7-773953e90ffc','Created','Tạo đơn HVT-260628-004 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:06:03.609188'),('be822acc-f86d-49b5-bfa0-62e07f1fb635','51d265b9-7faf-4759-ada2-33d5aef1a842','PaymentPending','Chờ thanh toán qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-27 23:06:38.651449'),('c11fb868-51f0-429d-b604-a102b29c0553','36bee2f6-8131-48d0-9498-d982f4f5b127','PaymentReceived','Đã thanh toán 495.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 00:30:11.601790'),('c16f26ef-a772-45a3-aac8-738038de505d','23788224-5be8-4c26-bb91-5f5bbcfa8d54','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 21:31:36.343095'),('c2f8bcec-ed9a-479f-888b-29af4158ecc3','bbcf794d-8dc2-4378-afd7-707651068770','Created','Tạo đơn HVT-260721-002 qua kênh bán tại quầy. Thành tiền 200.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:07:28.224225'),('c473c303-cae9-4535-86f9-f1bfd6d462d5','51b17789-8017-4ef3-97dd-045418706f1d','InventorySynced','Đơn đã hoàn tất. 1 sản phẩm chờ đối soát/trừ nguyên liệu theo BOM.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-22 14:56:07.832705'),('c80873e3-b227-4741-a167-b94a819a1822','b6cd848b-6972-42fd-9020-df8da11f672d','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:11:59.271064'),('cbdc4d43-8672-4e6e-9856-57aee096480a','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','Completed','Hoàn tất đơn hàng sau khi xác nhận thu COD.','826b791f-6ec3-40bf-9555-557b01ef5979','sale_cod01','2026-07-26 14:26:00.164289'),('ce744a51-de25-4408-8593-1db7a12b9ab7','a731dcd6-ab3b-4249-b049-191db7475747','Returned','Trả hàng TH-260628-001: hoàn 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:04:41.704833'),('d0fc7bd5-cabf-4ef4-9ca7-086357e7066a','8d490359-dc56-4ec0-8d04-00aaa0b4cc89','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:12:28.658104'),('d2ae07a8-548e-4945-8406-5cc33fcba604','7068f5f1-568e-4242-9025-5cf188cfcdfc','Created','Tạo đơn HVT-260628-009 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 06:12:13.401167'),('d333dc70-3ca7-442f-a234-7e204ae569dd','bfbf1c5e-f73d-4a84-990d-b01b9c813715','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:26:03.120794'),('d75cc179-f774-4817-bb6d-31925aade056','36bee2f6-8131-48d0-9498-d982f4f5b127','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 00:30:11.601924'),('da50225a-9110-43f0-9af2-834c1458ee75','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','Created','Tạo đơn HVT-260628-014 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:41:07.502697'),('e02410be-dbd4-475d-bc09-e81d40ca45a0','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','Created','Tạo đơn HVT-260731-003 qua kênh bán tại quầy. Thành tiền 92.150 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-07-31 01:51:27.999481'),('e5363472-f180-4dd4-917e-65cdba4f9e8c','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','PaymentReceived','Đã ghi nhận 92.150 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:07.032851'),('e591032e-d548-4ee5-8413-f6f0f484680d','a4039734-18f7-4cc9-9f8d-8166192ed6fd','Created','Tạo đơn HVT-260627-001 qua kênh bán tại quầy. Thành tiền 95.000 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-27 23:02:26.788705'),('e5e6a2a7-87fe-4047-b912-1895b6db8ef1','a33da7ea-d424-4896-b22f-af6eee19b548','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-08-03 04:56:55.101212'),('e76d9847-fc1e-4b46-95fb-24089ea11fd3','8d490359-dc56-4ec0-8d04-00aaa0b4cc89','PaymentReceived','Đã thanh toán 220.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-21 01:12:28.658018'),('f09a4950-9d38-4586-a683-716a8e908cc2','0c614f8b-e621-49f6-a4a7-773953e90ffc','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 05:06:03.609215'),('f159376f-e2d1-4f23-9c01-76c2663d7d56','03fef9d3-67a3-4d00-aacd-80188845ba0e','Created','Tạo đơn HVT-260731-002 qua kênh bán tại quầy. Thành tiền 92.150 ₫.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:24.443870'),('f360ff35-5f4d-4af7-998d-b58b48be362a','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','Completed','Hoàn tất đơn hàng.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:07.032987'),('f3f7a77d-5830-4184-837e-2a7d7b441a5e','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','PaymentReceived','Đã thanh toán 95.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-06-28 21:41:07.502858'),('f4c2ece9-c807-4d03-b7bc-37c12c59e9ff','7068f5f1-568e-4242-9025-5cf188cfcdfc','InventorySynced','Đã trừ tồn kho thành công.',NULL,'Hệ thống','2026-06-28 06:12:13.458389'),('f6bcaa85-21a2-47fb-8ee4-d6df49514a55','a33da7ea-d424-4896-b22f-af6eee19b548','PaymentReceived','Đã ghi nhận 350.000 ₫ qua tiền mặt.','ed9f2604-1baf-43d9-b074-0035e2cb4961','Nguyen Van Sale','2026-08-03 04:56:55.101083'),('f920549f-3a4f-49f0-9f4f-0a9dce3bc7a4','03fef9d3-67a3-4d00-aacd-80188845ba0e','PaymentPending','Chờ 92.150 ₫ qua VietQR.','ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-07-31 01:02:24.443984'),('fa541751-df98-4135-82c2-fd7220d07302','d50ad779-2a83-4baf-aa05-6136d429f265','PaymentReceived','Đã thanh toán 92.150 ₫ qua VietQR. Mã GD: e41a55b3-a87e-4a74-98b2-5486631b86e2.',NULL,'SePay Webhook','2026-07-31 02:13:17.960858');
/*!40000 ALTER TABLE `OrderActivities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OrderDetails`
--

DROP TABLE IF EXISTS `OrderDetails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderDetails` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuSnapshotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CategorySnapshotName` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `Quantity` int NOT NULL,
  `CostPrice` decimal(65,30) NOT NULL,
  `ReturnedQuantity` int NOT NULL DEFAULT '0',
  `UnitPrice` decimal(18,2) NOT NULL,
  `SubTotal` decimal(18,2) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `IsGift` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`),
  KEY `IX_OrderDetails_OrderId` (`OrderId`),
  CONSTRAINT `FK_OrderDetails_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OrderDetails`
--

LOCK TABLES `OrderDetails` WRITE;
/*!40000 ALTER TABLE `OrderDetails` DISABLE KEYS */;
INSERT INTO `OrderDetails` VALUES ('05a9a318-8c50-43dd-a439-45a344d88f99','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','953f58df-3312-4217-b1a1-47bf7b830619','Bao Bì — Bao Bì - cái','BAO-BI-CAI','Bao bì',4,5000.000000000000000000000000000000,0,6000.00,24000.00,'2026-07-26 14:22:10.396882','2026-07-26 14:22:10.396882',0,0),('0623de93-3215-418e-a917-75e8f1af9184','0c614f8b-e621-49f6-a4a7-773953e90ffc','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,1,95000.00,95000.00,'2026-06-28 05:06:03.608903','2026-06-28 05:10:18.346896',0,0),('066d6738-2d96-4a86-bc3b-7af242a4408c','a731dcd6-ab3b-4249-b049-191db7475747','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,1,95000.00,95000.00,'2026-06-28 04:52:33.854356','2026-06-28 05:04:41.676479',0,0),('06bf4e3b-f3b7-4d76-8cc4-ed810b16dd52','f22d20f3-6930-46bf-a3d7-c8c87998e454','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 21:28:12.680883','2026-06-28 21:28:12.680883',0,0),('1338239a-54a5-4ca9-9eca-e2998e2ade17','b6cd848b-6972-42fd-9020-df8da11f672d','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 06:11:59.270466','2026-06-28 06:11:59.270466',0,0),('1b1c3390-5e3f-48c4-b716-8d1ff87f67e2','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G',NULL,1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 21:32:23.433078','2026-06-28 21:32:23.433079',0,0),('2281bd97-2b6a-446d-b492-f3d98f98f32f','7f27c059-1415-4802-b831-fcc243a6098f','a200000f-0000-4000-8000-0000a200000f','Trà Atiso Đà Lạt — Gói 100g','HVT-ATISO-100G','Trà thảo mộc',1,45000.000000000000000000000000000000,0,95000.00,95000.00,'2026-07-31 01:52:24.619735','2026-07-31 01:52:24.619735',0,0),('23f738d8-e12a-4833-8f4c-e34c84ef683a','4e11e7ae-47dc-4353-9a01-942df8ae5338','20000000-0000-0000-0000-000000000011','Trà xanh nguyên liệu — Trà xanh nguyên liệu 1kg','NL-TRA-1KG','Trà nguyên liệu',1,0.000000000000000000000000000000,0,180000.00,180000.00,'2026-06-28 04:28:03.391648','2026-06-28 04:28:03.391648',0,0),('35d2eedc-b81b-4908-880b-621b7977bcf4','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','20000000-0000-0000-0000-000000000003','Trà Ô Long Cao Sơn — Trà Ô Long Cao Sơn 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,145000.00,145000.00,'2026-07-22 14:53:49.506727','2026-07-22 14:53:49.506728',0,0),('6b9fae7b-1806-40ea-b3df-ed13bb3fc6c1','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 21:41:07.501285','2026-06-28 21:41:07.501285',0,0),('72b8af20-bd2a-4f5d-8fb2-374a12e5c989','a33da7ea-d424-4896-b22f-af6eee19b548','a2000020-0000-4000-8000-0000a2000020','Ấm Tử Sa Mini 150ml — 1 cái','HVT-AM-TUSA','Dụng cụ pha trà',1,0.000000000000000000000000000000,0,350000.00,350000.00,'2026-08-03 04:56:54.937185','2026-08-03 04:56:54.937186',0,0),('75c2a4c1-f598-4c62-a741-1db51d46e4c5','a875cfb1-2738-45db-a9a4-9412e98463aa','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 06:11:53.526103','2026-06-28 06:11:53.526103',0,0),('8543d183-a242-4e71-8159-6f23e14a9aa7','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G',NULL,2,0.000000000000000000000000000000,0,95000.00,190000.00,'2026-06-28 05:10:18.369494','2026-06-28 05:10:18.369494',0,0),('8a3d2532-e732-4a02-906d-60a63ff41c72','03fef9d3-67a3-4d00-aacd-80188845ba0e','a200000f-0000-4000-8000-0000a200000f','Trà Atiso Đà Lạt — Gói 100g','HVT-ATISO-100G','Trà thảo mộc',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-07-31 01:02:24.432103','2026-07-31 01:02:24.432103',0,0),('958a7870-2e3a-4d54-adeb-9285cb45aa21','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 06:11:49.035422','2026-06-28 06:11:49.035422',0,0),('97ff3194-894e-4b88-9c11-ad06bc055b0f','a4039734-18f7-4cc9-9f8d-8166192ed6fd','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-27 23:02:26.687248','2026-06-27 23:02:26.687248',0,0),('aca1f1a5-b3d8-402b-a9fa-a8163252250a','51b17789-8017-4ef3-97dd-045418706f1d','20000000-0000-0000-0000-000000000004','Trà Ô Long Cao Sơn — Trà Ô Long Cao Sơn 250g','TRA-OL-250G','Trà thành phẩm',1,0.000000000000000000000000000000,0,330000.00,330000.00,'2026-07-22 14:56:07.777476','2026-07-22 14:56:07.777476',0,0),('b2a007bb-b03d-4d7d-b46b-f6a29e837438','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 06:09:04.083084','2026-06-28 06:09:04.083084',0,0),('bbb85d47-f52f-4021-b488-9288926deb46','d50ad779-2a83-4baf-aa05-6136d429f265','a200000f-0000-4000-8000-0000a200000f','Trà Atiso Đà Lạt — Gói 100g','HVT-ATISO-100G','Trà thảo mộc',1,45000.000000000000000000000000000000,0,95000.00,95000.00,'2026-07-31 02:12:55.748837','2026-07-31 02:12:55.748837',0,0),('bd8a6f81-4fa9-4d03-8c29-d82abeafdf52','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','20000000-0000-0000-0000-000000000012','Đường trắng tinh luyện — Đường trắng tinh luyện 1kg','NL-DUONG-1KG','Nguyên liệu phụ',1,0.000000000000000000000000000000,0,20000.00,20000.00,'2026-06-28 04:38:48.552195','2026-06-28 04:38:48.552195',0,0),('ce91a936-9fda-494d-891e-6e6e53400851','51d265b9-7faf-4759-ada2-33d5aef1a842','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-27 23:06:38.650594','2026-06-27 23:06:38.650595',0,0),('d07707bf-5975-4239-962a-82c7f4edbad5','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','a200000f-0000-4000-8000-0000a200000f','Trà Atiso Đà Lạt — Gói 100g','HVT-ATISO-100G','Trà thảo mộc',1,45000.000000000000000000000000000000,0,95000.00,95000.00,'2026-07-31 01:51:27.855143','2026-07-31 01:51:27.855143',0,0),('e131a078-68e8-4baa-b9a5-fbd9b0b6f019','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','a200000f-0000-4000-8000-0000a200000f','Trà Atiso Đà Lạt — Gói 100g','HVT-ATISO-100G','Trà thảo mộc',1,45000.000000000000000000000000000000,0,95000.00,95000.00,'2026-07-31 01:02:06.583219','2026-07-31 01:02:06.583220',0,0),('e7a84747-c642-4348-a4aa-c59d59d1dccb','7068f5f1-568e-4242-9025-5cf188cfcdfc','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 06:12:13.400862','2026-06-28 06:12:13.400862',0,0),('f06406b6-55d5-429e-aee5-1c9d292d69de','bfbf1c5e-f73d-4a84-990d-b01b9c813715','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G','Trà thành phẩm',1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 21:26:03.095262','2026-06-28 21:26:03.095262',0,0),('fe32fce3-baa7-472d-b882-fbc5850a69f6','23788224-5be8-4c26-bb91-5f5bbcfa8d54','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G',NULL,1,0.000000000000000000000000000000,0,95000.00,95000.00,'2026-06-28 21:31:36.267491','2026-06-28 21:31:36.267491',0,0);
/*!40000 ALTER TABLE `OrderDetails` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OrderReceiptPrintLogs`
--

DROP TABLE IF EXISTS `OrderReceiptPrintLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderReceiptPrintLogs` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PrintedByUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `PrintedByName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ReprintNumber` int NOT NULL,
  `IdempotencyKey` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PrintedAt` datetime(6) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_OrderReceiptPrintLogs_OrderId_ReprintNumber` (`OrderId`,`ReprintNumber`),
  UNIQUE KEY `IX_OrderReceiptPrintLogs_IdempotencyKey` (`IdempotencyKey`),
  KEY `IX_OrderReceiptPrintLogs_OrderId` (`OrderId`),
  CONSTRAINT `FK_OrderReceiptPrintLogs_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OrderReceiptPrintLogs`
--

LOCK TABLES `OrderReceiptPrintLogs` WRITE;
/*!40000 ALTER TABLE `OrderReceiptPrintLogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `OrderReceiptPrintLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Orders`
--

DROP TABLE IF EXISTS `Orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Orders` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CustomerId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CustomerSnapshotName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `EmployeeId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `OrderChannel` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OrderKind` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Sale',
  `OrderStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `InventorySyncStatus` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TotalAmount` decimal(18,2) NOT NULL,
  `DiscountAmount` decimal(18,2) NOT NULL,
  `PromotionId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `PromotionCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PromotionDiscountAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `FinalAmount` decimal(18,2) NOT NULL,
  `ShippingAddress` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `IdempotencyKey` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ContractCodeSnapshot` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ContractDiscountPercentSnapshot` decimal(5,2) DEFAULT NULL,
  `ContractId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ContractPaymentTermDaysSnapshot` int DEFAULT NULL,
  `DueDate` datetime(6) DEFAULT NULL,
  `EmployeeSnapshotName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_Orders_OrderCode` (`OrderCode`),
  UNIQUE KEY `IX_Orders_IdempotencyKey` (`IdempotencyKey`),
  KEY `IX_Orders_CustomerId` (`CustomerId`),
  KEY `IX_Orders_OrderKind` (`OrderKind`),
  KEY `IX_Orders_PromotionId` (`PromotionId`),
  KEY `IX_Orders_ContractId` (`ContractId`),
  KEY `IX_Orders_DueDate` (`DueDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Orders`
--

LOCK TABLES `Orders` WRITE;
/*!40000 ALTER TABLE `Orders` DISABLE KEYS */;
INSERT INTO `Orders` VALUES ('03fef9d3-67a3-4d00-aacd-80188845ba0e','HVT-260731-002','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Cancelled','Cancelled',95000.00,2850.00,NULL,NULL,0.00,92150.00,NULL,NULL,'2026-07-31 01:02:24.432067','2026-07-31 01:02:30.098716',0,'ed9f26041baf43d9b0740035e2cb4961:28da21eef41f4bf9b98deb59bc31ff12',NULL,NULL,NULL,NULL,NULL,'sale01'),('0c614f8b-e621-49f6-a4a7-773953e90ffc','HVT-260628-004','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 05:06:03.608898','2026-06-28 05:06:03.653824',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('23788224-5be8-4c26-bb91-5f5bbcfa8d54','HVT-260628-012','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 21:31:36.267487','2026-06-28 21:31:36.343084',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('2a6e3e79-25a7-4ba7-847b-28a2106cb41c','HVT-260628-002','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','COD','Sale','Completed','PendingDeduction',20000.00,0.00,NULL,NULL,0.00,20000.00,'FPT Hà Nội',NULL,'2026-06-28 04:38:48.552180','2026-06-28 04:45:42.689737',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('36bee2f6-8131-48d0-9498-d982f4f5b127','HVT-260721-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingDeduction',495000.00,0.00,NULL,NULL,0.00,495000.00,NULL,NULL,'2026-07-21 00:30:11.531254','2026-07-21 00:30:11.531265',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','HVT-260731-003','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Cancelled','Cancelled',95000.00,2850.00,NULL,NULL,0.00,92150.00,NULL,NULL,'2026-07-31 01:51:27.854707','2026-07-31 01:51:58.235201',0,'ed9f26041baf43d9b0740035e2cb4961:36e272ed08594841a630d672051b8375',NULL,NULL,NULL,NULL,NULL,'Nguyen Van Sale'),('4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','HVT-260628-014','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 21:41:07.501267','2026-06-28 21:41:07.576723',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('4e11e7ae-47dc-4353-9a01-942df8ae5338','HVT-260628-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingDeduction',180000.00,0.00,NULL,NULL,0.00,180000.00,NULL,NULL,'2026-06-28 04:28:03.391309','2026-06-28 04:28:03.391318',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('51b17789-8017-4ef3-97dd-045418706f1d','HVT-260722-002','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingReconciliation',330000.00,0.00,NULL,NULL,0.00,330000.00,NULL,NULL,'2026-07-22 14:56:07.777470','2026-07-22 14:56:07.777470',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('51d265b9-7faf-4759-ada2-33d5aef1a842','HVT-260627-002','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,86000.00,'3bd391f7-9479-4ef2-99f3-f529f19e6990','SALE90',86000.00,9000.00,NULL,NULL,'2026-06-27 23:06:38.650587','2026-06-27 23:08:14.155406',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','HVT-260628-005','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 06:09:04.083003','2026-06-28 06:09:04.164425',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('7068f5f1-568e-4242-9025-5cf188cfcdfc','HVT-260628-009','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 06:12:13.400859','2026-06-28 06:12:13.458370',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('7f27c059-1415-4802-b831-fcc243a6098f','HVT-260731-004','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Cancelled','Cancelled',95000.00,2850.00,NULL,NULL,0.00,92150.00,NULL,NULL,'2026-07-31 01:52:24.619714','2026-07-31 01:55:45.373142',0,'ed9f26041baf43d9b0740035e2cb4961:f8dedfb09c1a4bf5a40e6d8b49b72f4b',NULL,NULL,NULL,NULL,NULL,'Nguyen Van Sale'),('8d490359-dc56-4ec0-8d04-00aaa0b4cc89','HVT-260721-003','4fb6a654-4fac-42e7-b6f7-7a35286b7152','Vũ Ngọc Trang · KH000002','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingDeduction',220000.00,0.00,NULL,NULL,0.00,220000.00,NULL,NULL,'2026-07-21 01:12:28.657171','2026-07-21 01:12:28.657171',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','HVT-260726-001','b89e0b9d-48f2-4008-bb35-94fdf1509efd','dung · KH000003','826b791f-6ec3-40bf-9555-557b01ef5979','COD','Sale','Completed','PendingDeduction',24000.00,0.00,NULL,NULL,0.00,24000.00,'Chưa có địa chỉ giao hàng',NULL,'2026-07-26 14:22:10.396299','2026-07-26 14:26:00.163283',0,'436bbec0-f605-4b59-83ea-130c3b8b5d22',NULL,NULL,NULL,NULL,NULL,'sale_cod01'),('a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','HVT-DOI-260628-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Exchange','Cancelled','Cancelled',190000.00,95000.00,NULL,NULL,0.00,95000.00,NULL,'Đổi hàng từ HVT-260628-004 (TH-260628-002)','2026-06-28 05:10:18.369491','2026-06-28 05:12:06.154587',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('a33da7ea-d424-4896-b22f-af6eee19b548','HVT-260803-001',NULL,'Khách lẻ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',350000.00,0.00,NULL,NULL,0.00,350000.00,NULL,NULL,'2026-08-03 04:56:54.936653','2026-08-03 04:56:54.936654',0,'ed9f26041baf43d9b0740035e2cb4961:02c79fa5e4ad4e13988b3f68162f0f88',NULL,NULL,NULL,NULL,NULL,'Nguyen Van Sale'),('a4039734-18f7-4cc9-9f8d-8166192ed6fd','HVT-260627-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-27 23:02:26.686864','2026-06-27 23:02:27.570352',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('a731dcd6-ab3b-4249-b049-191db7475747','HVT-260628-003','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 04:52:33.853927','2026-06-28 04:52:34.573450',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('a875cfb1-2738-45db-a9a4-9412e98463aa','HVT-260628-007','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 06:11:53.526099','2026-06-28 06:11:53.566831',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','HVT-260628-013','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 21:32:23.433076','2026-06-28 21:32:23.489331',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('b6cd848b-6972-42fd-9020-df8da11f672d','HVT-260628-008','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 06:11:59.270443','2026-06-28 06:11:59.320426',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('bbcf794d-8dc2-4378-afd7-707651068770','HVT-260721-002','4fb6a654-4fac-42e7-b6f7-7a35286b7152','Vũ Ngọc Trang · KH000002','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingDeduction',200000.00,0.00,NULL,NULL,0.00,200000.00,NULL,NULL,'2026-07-21 01:07:28.221005','2026-07-21 01:07:28.221005',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('bfbf1c5e-f73d-4a84-990d-b01b9c813715','HVT-260628-010','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 21:26:03.094928','2026-06-28 21:26:03.622309',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('d50ad779-2a83-4baf-aa05-6136d429f265','HVT-260731-005','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingDeduction',95000.00,2850.00,NULL,NULL,0.00,92150.00,NULL,NULL,'2026-07-31 02:12:55.748422','2026-07-31 02:13:17.960667',0,'ed9f26041baf43d9b0740035e2cb4961:2fc394ed658241afa0b7616ae75bc76c',NULL,NULL,NULL,NULL,NULL,'Nguyen Van Sale'),('d9b40141-7bb4-4614-ac1a-e73b79ebfc59','HVT-260722-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','PendingReconciliation',145000.00,0.00,NULL,NULL,0.00,145000.00,NULL,NULL,'2026-07-22 14:53:49.506236','2026-07-22 14:53:49.506245',0,'cce63b9d-fbd7-4385-b372-c6f6a6f11903',NULL,NULL,NULL,NULL,NULL,'sale01'),('ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','HVT-260628-006','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 06:11:49.035411','2026-06-28 06:11:49.093879',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('f22d20f3-6930-46bf-a3d7-c8c87998e454','HVT-260628-011','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,0.00,NULL,NULL,0.00,95000.00,NULL,NULL,'2026-06-28 21:28:12.680858','2026-06-28 21:28:12.737261',0,NULL,NULL,NULL,NULL,NULL,NULL,'sale01'),('f7599a2f-02a7-4eae-9dbe-7a7c4a442726','HVT-260731-001','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001','ed9f2604-1baf-43d9-b074-0035e2cb4961','POS','Sale','Completed','Synced',95000.00,2850.00,NULL,NULL,0.00,92150.00,NULL,NULL,'2026-07-31 01:02:06.582766','2026-07-31 01:02:06.582768',0,'ed9f26041baf43d9b0740035e2cb4961:6d77d686bfc145baa70cee1dd2e98f4e',NULL,NULL,NULL,NULL,NULL,'sale01');
/*!40000 ALTER TABLE `Orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OutboxMessages`
--

DROP TABLE IF EXISTS `OutboxMessages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OutboxMessages` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `EventType` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `AggregateId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Pending',
  `RetryCount` int NOT NULL DEFAULT '0',
  `OccurredAtUtc` datetime(6) NOT NULL,
  `LastAttemptAtUtc` datetime(6) DEFAULT NULL,
  `NextAttemptAtUtc` datetime(6) NOT NULL,
  `LockedUntilUtc` datetime(6) DEFAULT NULL,
  `LockedBy` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PublishedAtUtc` datetime(6) DEFAULT NULL,
  `LastError` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`Id`),
  KEY `IX_OutboxMessages_AggregateId_EventType` (`AggregateId`,`EventType`),
  KEY `IX_OutboxMessages_LockedUntilUtc` (`LockedUntilUtc`),
  KEY `IX_OutboxMessages_OccurredAtUtc` (`OccurredAtUtc`),
  KEY `IX_OutboxMessages_Status_NextAttemptAtUtc` (`Status`,`NextAttemptAtUtc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OutboxMessages`
--

LOCK TABLES `OutboxMessages` WRITE;
/*!40000 ALTER TABLE `OutboxMessages` DISABLE KEYS */;
INSERT INTO `OutboxMessages` VALUES ('0855f122-83eb-4f24-af7a-241a4c164444','HuongVanTra.Shared.Messages.OrderCancelledEvent','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','{\"eventId\":\"0855f122-83eb-4f24-af7a-241a4c164444\",\"occurredAtUtc\":\"2026-07-31T01:51:58.2372597Z\",\"orderId\":\"3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd\",\"orderCode\":\"HVT-260731-003\",\"previousOrderStatus\":\"PendingPayment\",\"items\":[{\"skuId\":\"a200000f-0000-4000-8000-0000a200000f\",\"skuName\":null,\"skuCode\":null,\"quantity\":1}]}','Published',0,'2026-07-31 01:51:58.239199','2026-07-31 01:51:59.522731','2026-07-31 01:51:58.239199',NULL,NULL,'2026-07-31 01:51:59.522731',NULL),('3b97f228-ab86-40d8-82d2-2b8b4cd469df','HuongVanTra.Shared.Messages.OrderCompletedEvent','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','{\"eventId\":\"3b97f228-ab86-40d8-82d2-2b8b4cd469df\",\"occurredAtUtc\":\"2026-07-31T01:02:07.0353459Z\",\"orderId\":\"f7599a2f-02a7-4eae-9dbe-7a7c4a442726\",\"orderCode\":\"HVT-260731-001\",\"customerId\":\"4d4c5698-2f6d-4148-b6e9-100dec20363e\",\"totalAmount\":92150,\"debtAmount\":0,\"items\":[{\"skuId\":\"a200000f-0000-4000-8000-0000a200000f\",\"skuName\":null,\"skuCode\":null,\"quantity\":1}],\"codDebtSettlementJson\":\"{\\u0022payDebtsEnabled\\u0022:true,\\u0022allocatedAmount\\u0022:45000,\\u0022allocations\\u0022:[{\\u0022orderId\\u0022:\\u00226e43b8e7-6db7-42f3-94d3-b0be7ad3c13a\\u0022,\\u0022amount\\u0022:45000}],\\u0022creditToCustomer\\u0022:62850,\\u0022paymentMethod\\u0022:\\u0022CASH\\u0022}\"}','Published',0,'2026-07-31 01:02:07.038205','2026-07-31 01:02:08.309843','2026-07-31 01:02:07.038205',NULL,NULL,'2026-07-31 01:02:08.309843',NULL),('89fe5ca5-ee52-4b94-8ec0-352e0ae847b9','HuongVanTra.Shared.Messages.OrderCancelledEvent','7f27c059-1415-4802-b831-fcc243a6098f','{\"eventId\":\"89fe5ca5-ee52-4b94-8ec0-352e0ae847b9\",\"occurredAtUtc\":\"2026-07-31T01:55:45.3735048Z\",\"orderId\":\"7f27c059-1415-4802-b831-fcc243a6098f\",\"orderCode\":\"HVT-260731-004\",\"previousOrderStatus\":\"PendingPayment\",\"items\":[{\"skuId\":\"a200000f-0000-4000-8000-0000a200000f\",\"skuName\":null,\"skuCode\":null,\"quantity\":1}]}','Published',0,'2026-07-31 01:55:45.373526','2026-07-31 01:55:45.741176','2026-07-31 01:55:45.373526',NULL,NULL,'2026-07-31 01:55:45.741176',NULL),('a88c1cd4-6e30-4fbc-b676-aaf386052bdc','HuongVanTra.Shared.Messages.OrderCancelledEvent','03fef9d3-67a3-4d00-aacd-80188845ba0e','{\"eventId\":\"a88c1cd4-6e30-4fbc-b676-aaf386052bdc\",\"occurredAtUtc\":\"2026-07-31T01:02:30.0996327Z\",\"orderId\":\"03fef9d3-67a3-4d00-aacd-80188845ba0e\",\"orderCode\":\"HVT-260731-002\",\"previousOrderStatus\":\"PendingPayment\",\"items\":[{\"skuId\":\"a200000f-0000-4000-8000-0000a200000f\",\"skuName\":null,\"skuCode\":null,\"quantity\":1}]}','Published',0,'2026-07-31 01:02:30.100101','2026-07-31 01:02:30.398853','2026-07-31 01:02:30.100101',NULL,NULL,'2026-07-31 01:02:30.398853',NULL);
/*!40000 ALTER TABLE `OutboxMessages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Payments`
--

DROP TABLE IF EXISTS `Payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Payments` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PaymentMethod` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Amount` decimal(18,2) NOT NULL,
  `PaymentStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TransactionRef` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IsCodVerified` tinyint(1) NOT NULL,
  `CodWarningDate` datetime(6) DEFAULT NULL,
  `PaidAt` datetime(6) DEFAULT NULL,
  `TransferQrExpiresAtUtc` datetime(6) DEFAULT NULL,
  `CodDebtSettlementJson` varchar(4000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Payments_OrderId` (`OrderId`),
  CONSTRAINT `FK_Payments_Orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Payments`
--

LOCK TABLES `Payments` WRITE;
/*!40000 ALTER TABLE `Payments` DISABLE KEYS */;
INSERT INTO `Payments` VALUES ('04c07d30-7ede-4672-b4d1-b4b5310df74c','f22d20f3-6930-46bf-a3d7-c8c87998e454','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 21:28:12.680885',NULL,NULL,'2026-06-28 21:28:12.680885','2026-06-28 21:28:12.680885',0),('07a1abb4-ddd2-4471-949c-91bc922bdb25','f7599a2f-02a7-4eae-9dbe-7a7c4a442726','Cash',92150.00,'Success',NULL,0,NULL,'2026-07-31 01:02:06.583576',NULL,'{\"payDebtsEnabled\":true,\"allocatedAmount\":45000,\"allocations\":[{\"orderId\":\"6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a\",\"amount\":45000}],\"creditToCustomer\":62850,\"paymentMethod\":\"CASH\"}','2026-07-31 01:02:06.583576','2026-07-31 01:02:06.583576',0),('0c1214a0-0cb8-4536-af1c-0eae948caa26','8d490359-dc56-4ec0-8d04-00aaa0b4cc89','Cash',220000.00,'Success',NULL,0,NULL,'2026-07-21 01:12:28.657207',NULL,NULL,'2026-07-21 01:12:28.657207','2026-07-21 01:12:28.657207',0),('1d868ea1-6dd1-408c-8bdd-51cf8331af21','23788224-5be8-4c26-bb91-5f5bbcfa8d54','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 21:31:36.267493',NULL,NULL,'2026-06-28 21:31:36.267493','2026-06-28 21:31:36.267493',0),('23366675-ceb9-4d59-90c4-819592861571','6e43b8e7-6db7-42f3-94d3-b0be7ad3c13a','Cash',50000.00,'Success',NULL,0,NULL,'2026-06-28 06:09:04.083190',NULL,NULL,'2026-06-28 06:09:04.083189','2026-06-28 06:09:04.083189',0),('37b91a7c-7ad7-48f9-b42a-25f7201fca50','b6cd848b-6972-42fd-9020-df8da11f672d','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 06:11:59.270477',NULL,NULL,'2026-06-28 06:11:59.270470','2026-06-28 06:11:59.270470',0),('4d25c4c8-a158-48ed-90aa-7653a65205e5','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','VietQR',95000.00,'Failed',NULL,0,NULL,NULL,'2026-06-28 05:15:18.369711',NULL,'2026-06-28 05:10:18.369514','2026-06-28 05:12:06.154604',0),('54fe6b54-cd98-4a3b-8c76-f413e5ebe077','a731dcd6-ab3b-4249-b049-191db7475747','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 04:52:33.854453',NULL,NULL,'2026-06-28 04:52:33.854453','2026-06-28 04:52:33.854453',0),('57a3677b-946f-4539-8b6f-0a4d656ad770','4e11e7ae-47dc-4353-9a01-942df8ae5338','Cash',180000.00,'Success',NULL,0,NULL,'2026-06-28 04:28:03.391782',NULL,NULL,'2026-06-28 04:28:03.391774','2026-06-28 04:28:03.391774',0),('6b4da472-232d-46c2-bc48-4314b8f17a26','d50ad779-2a83-4baf-aa05-6136d429f265','VietQR',92150.00,'Success','e41a55b3-a87e-4a74-98b2-5486631b86e2',0,NULL,'2026-07-31 02:13:17.960813','2026-07-31 02:17:55.749081',NULL,'2026-07-31 02:12:55.749081','2026-07-31 02:13:17.960815',0),('7a9fc210-880a-44dd-8c67-b930a1e03c0b','3dbc1d63-f5b4-4ac5-a618-e2455f53c4bd','VietQR',92150.00,'Failed',NULL,0,NULL,NULL,'2026-07-31 01:56:27.855422',NULL,'2026-07-31 01:51:27.855422','2026-07-31 01:51:58.235233',0),('814da908-4bc1-4404-a627-4f23d2cabff7','a33da7ea-d424-4896-b22f-af6eee19b548','Cash',350000.00,'Success',NULL,0,NULL,'2026-08-03 04:56:54.937517',NULL,NULL,'2026-08-03 04:56:54.937517','2026-08-03 04:56:54.937517',0),('ad612a1f-dbc2-431d-a8a9-659e94f4eb45','ed63f6b0-f6c1-4de9-a02b-fef3b223a8d2','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 06:11:49.035439',NULL,NULL,'2026-06-28 06:11:49.035439','2026-06-28 06:11:49.035439',0),('af2e11c8-2098-4b39-8601-1f83529c7b9a','03fef9d3-67a3-4d00-aacd-80188845ba0e','VietQR',92150.00,'Failed',NULL,0,NULL,NULL,'2026-07-31 01:07:24.432126',NULL,'2026-07-31 01:02:24.432126','2026-07-31 01:02:30.098750',0),('b1821962-6e24-4fb7-a49b-9be8c6677b95','36bee2f6-8131-48d0-9498-d982f4f5b127','Cash',495000.00,'Success',NULL,0,NULL,'2026-07-21 00:30:11.532437',NULL,NULL,'2026-07-21 00:30:11.532421','2026-07-21 00:30:11.532421',0),('b403a452-9524-443d-a626-2777dd739c67','51b17789-8017-4ef3-97dd-045418706f1d','Cash',330000.00,'Success',NULL,0,NULL,'2026-07-22 14:56:07.777483',NULL,NULL,'2026-07-22 14:56:07.777483','2026-07-22 14:56:07.777483',0),('bd79c50e-331a-4d78-8331-8af37c0b5e9b','a875cfb1-2738-45db-a9a4-9412e98463aa','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 06:11:53.526105',NULL,NULL,'2026-06-28 06:11:53.526105','2026-06-28 06:11:53.526105',0),('c2991ff0-632d-45ed-abd9-e33538e5892e','7f27c059-1415-4802-b831-fcc243a6098f','VietQR',92150.00,'Failed',NULL,0,NULL,NULL,'2026-07-31 01:57:24.619758',NULL,'2026-07-31 01:52:24.619758','2026-07-31 01:55:45.373145',0),('c54d8843-ba8a-40c2-9fc0-f8def69ccb6a','bbcf794d-8dc2-4378-afd7-707651068770','Cash',200000.00,'Success',NULL,0,NULL,'2026-07-21 01:07:28.221142',NULL,NULL,'2026-07-21 01:07:28.221142','2026-07-21 01:07:28.221142',0),('c56a6f44-5bb6-4102-87da-4bcd5ba8e6c3','4a2b5b4c-de54-46a3-a1f5-f277a75bc9ce','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 21:41:07.501290',NULL,NULL,'2026-06-28 21:41:07.501289','2026-06-28 21:41:07.501289',0),('cace292c-b870-41a8-8f0a-b6d9da0bfbe8','bfbf1c5e-f73d-4a84-990d-b01b9c813715','Cash',0.00,'Pending',NULL,0,NULL,NULL,NULL,NULL,'2026-06-28 21:26:03.095380','2026-06-28 21:26:03.095380',0),('caeb2713-d2d3-4079-aeca-56eb088947e1','a9e5cc8f-5cf2-48f9-92e4-8a4b3fbaee64','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 21:32:23.433090',NULL,NULL,'2026-06-28 21:32:23.433080','2026-06-28 21:32:23.433080',0),('d1fe400c-bd1b-4339-8e74-c045cf9b7ad2','7068f5f1-568e-4242-9025-5cf188cfcdfc','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 06:12:13.400880',NULL,NULL,'2026-06-28 06:12:13.400877','2026-06-28 06:12:13.400877',0),('da6ee9e0-f862-4a86-8f1b-8e037a51a1f2','d9b40141-7bb4-4614-ac1a-e73b79ebfc59','Cash',145000.00,'Success',NULL,0,NULL,'2026-07-22 14:53:49.507032',NULL,NULL,'2026-07-22 14:53:49.507021','2026-07-22 14:53:49.507021',0),('e4ec20da-6c98-4311-9929-c5bb17e9c44c','0c614f8b-e621-49f6-a4a7-773953e90ffc','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-28 05:06:03.608905',NULL,NULL,'2026-06-28 05:06:03.608905','2026-06-28 05:06:03.608905',0),('e8b77286-9a5c-4cf6-9a80-fb147a2f8271','988f44ce-26bf-45f2-bfa7-1c0d12d8cb8c','COD',50000.00,'Success',NULL,1,'2026-08-02 14:22:10.397116','2026-07-26 14:26:00.163281',NULL,NULL,'2026-07-26 14:22:10.397207','2026-07-26 14:22:10.397207',0),('f04d8062-fdc0-4f66-ba92-09b8aeb098cb','2a6e3e79-25a7-4ba7-847b-28a2106cb41c','COD',20000.00,'Success',NULL,1,'2026-07-05 04:38:48.552197','2026-06-28 04:45:42.689736',NULL,NULL,'2026-06-28 04:38:48.552204','2026-06-28 04:38:48.552204',0),('f472a69a-8291-47c7-a55c-a729fc1db6ba','a4039734-18f7-4cc9-9f8d-8166192ed6fd','Cash',95000.00,'Success',NULL,0,NULL,'2026-06-27 23:02:26.687350',NULL,NULL,'2026-06-27 23:02:26.687342','2026-06-27 23:02:26.687342',0),('f9b78fd6-059f-42c7-a7eb-b1211832d06f','51d265b9-7faf-4759-ada2-33d5aef1a842','VietQR',9000.00,'Success','b65ca814-c33a-48f0-a06c-29d5b2a00169',0,NULL,'2026-06-27 23:08:14.119832','2026-06-27 23:11:38.650665',NULL,'2026-06-27 23:06:38.650604','2026-06-27 23:08:14.119832',0);
/*!40000 ALTER TABLE `Payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PosCashSessions`
--

DROP TABLE IF EXISTS `PosCashSessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PosCashSessions` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `Status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OpeningCash` decimal(18,2) NOT NULL,
  `CashSalesTotal` decimal(18,2) NOT NULL DEFAULT '0.00',
  `CashRefundTotal` decimal(18,2) NOT NULL DEFAULT '0.00',
  `OrderCount` int NOT NULL DEFAULT '0',
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `OpenedByUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `OpenedByName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `OpenedByRole` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ShiftSlotId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ShiftLabel` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `OpenedAt` datetime(6) NOT NULL,
  `CountedCash` decimal(18,2) DEFAULT NULL,
  `ExpectedCash` decimal(18,2) DEFAULT NULL,
  `Variance` decimal(18,2) DEFAULT NULL,
  `VarianceNote` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ClosedByUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ClosedByName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ClosedAt` datetime(6) DEFAULT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_PosCashSessions_Status` (`Status`),
  KEY `IX_PosCashSessions_OpenedByUserId` (`OpenedByUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PosCashSessions`
--

LOCK TABLES `PosCashSessions` WRITE;
/*!40000 ALTER TABLE `PosCashSessions` DISABLE KEYS */;
INSERT INTO `PosCashSessions` VALUES ('2a5036c2-1085-47d8-a757-133164d97a3c','Closed',500000.00,350000.00,0.00,1,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','SalePos','042800be-3d7c-4f69-9986-4f1b53e991eb','Ca chiều quầy','2026-08-03 04:56:45.481053',850000.00,850000.00,0.00,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-08-03 04:57:05.531064',0,'2026-08-03 04:56:45.481053','2026-08-03 04:57:05.531064'),('7294cb97-752f-47c9-9290-c12b475b649c','Closed',500000.00,92150.00,0.00,1,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','SalePos','22516435-6d11-4752-a7c8-6046ee642654','Ca sáng quầy','2026-07-31 00:58:21.926120',592150.00,592150.00,0.00,NULL,'ed9f2604-1baf-43d9-b074-0035e2cb4961','sale01','2026-08-03 04:53:09.937670',0,'2026-07-31 00:58:21.926120','2026-08-03 04:53:09.937692');
/*!40000 ALTER TABLE `PosCashSessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PromotionCustomerTierScopes`
--

DROP TABLE IF EXISTS `PromotionCustomerTierScopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PromotionCustomerTierScopes` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PromotionId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `TierId` int NOT NULL,
  `TierSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_PromotionCustomerTierScopes_PromotionId` (`PromotionId`),
  KEY `IX_PromotionCustomerTierScopes_TierId` (`TierId`),
  CONSTRAINT `FK_PromotionCustomerTierScopes_Promotions_PromotionId` FOREIGN KEY (`PromotionId`) REFERENCES `Promotions` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PromotionCustomerTierScopes`
--

LOCK TABLES `PromotionCustomerTierScopes` WRITE;
/*!40000 ALTER TABLE `PromotionCustomerTierScopes` DISABLE KEYS */;
/*!40000 ALTER TABLE `PromotionCustomerTierScopes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PromotionScopes`
--

DROP TABLE IF EXISTS `PromotionScopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PromotionScopes` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PromotionId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ScopeType` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `SkuCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  `CategoryId` int DEFAULT NULL,
  `CategorySnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_PromotionScopes_PromotionId` (`PromotionId`),
  KEY `IX_PromotionScopes_SkuId` (`SkuId`),
  KEY `IX_PromotionScopes_CategoryId` (`CategoryId`),
  CONSTRAINT `FK_PromotionScopes_Promotions_PromotionId` FOREIGN KEY (`PromotionId`) REFERENCES `Promotions` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PromotionScopes`
--

LOCK TABLES `PromotionScopes` WRITE;
/*!40000 ALTER TABLE `PromotionScopes` DISABLE KEYS */;
/*!40000 ALTER TABLE `PromotionScopes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Promotions`
--

DROP TABLE IF EXISTS `Promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Promotions` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `PromoCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NormalizedPromoCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `DiscountType` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `DiscountValue` decimal(18,2) NOT NULL,
  `MaxDiscountAmount` decimal(18,2) DEFAULT NULL,
  `MinimumOrderAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `UsageLimitTotal` int DEFAULT NULL,
  `UsageLimitPerCustomer` int DEFAULT NULL,
  `ScopeType` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ORDER',
  `ValidFromUtc` datetime(6) DEFAULT NULL,
  `ValidToUtc` datetime(6) DEFAULT NULL,
  `IsActive` tinyint(1) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_Promotions_NormalizedPromoCode` (`NormalizedPromoCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Promotions`
--

LOCK TABLES `Promotions` WRITE;
/*!40000 ALTER TABLE `Promotions` DISABLE KEYS */;
INSERT INTO `Promotions` VALUES ('3bd391f7-9479-4ef2-99f3-f529f19e6990','SALE90','SALE90','PERCENTAGE',90.00,100000.00,0.00,NULL,1,'ORDER','2026-06-27 23:03:43.734883',NULL,1,'2026-06-27 23:03:43.734883','2026-06-27 23:03:43.734883',0);
/*!40000 ALTER TABLE `Promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ReturnOrderDetails`
--

DROP TABLE IF EXISTS `ReturnOrderDetails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ReturnOrderDetails` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReturnOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceOrderDetailId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SkuSnapshotName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SkuSnapshotCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReturnQuantity` int NOT NULL,
  `UnitPrice` decimal(18,2) NOT NULL,
  `SubTotal` decimal(18,2) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_ReturnOrderDetails_ReturnOrderId` (`ReturnOrderId`),
  CONSTRAINT `FK_ReturnOrderDetails_ReturnOrders_ReturnOrderId` FOREIGN KEY (`ReturnOrderId`) REFERENCES `ReturnOrders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ReturnOrderDetails`
--

LOCK TABLES `ReturnOrderDetails` WRITE;
/*!40000 ALTER TABLE `ReturnOrderDetails` DISABLE KEYS */;
INSERT INTO `ReturnOrderDetails` VALUES ('11c08d41-7fa7-48d8-877c-c80bd358f871','be4030ae-33cf-48ee-ad9c-2ef7a671173a','0623de93-3215-418e-a917-75e8f1af9184','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G',1,95000.00,95000.00,'2026-06-28 05:10:18.346896','2026-06-28 05:10:18.346896',0),('1dae681e-451d-49aa-b04d-12e0de0b6868','87c32213-de09-4a2e-b331-e3bb7f0acf78','066d6738-2d96-4a86-bc3b-7af242a4408c','20000000-0000-0000-0000-000000000005','Trà Ô Long đặc biệt — Trà Ô Long đặc biệt 100g','TRA-OL-100G',1,95000.00,95000.00,'2026-06-28 05:04:41.676479','2026-06-28 05:04:41.676479',0);
/*!40000 ALTER TABLE `ReturnOrderDetails` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ReturnOrders`
--

DROP TABLE IF EXISTS `ReturnOrders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ReturnOrders` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ReturnCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SourceOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `SourceOrderCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CustomerId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `CustomerSnapshotName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ReturnAmount` decimal(18,2) NOT NULL,
  `ExchangeAmount` decimal(18,2) NOT NULL,
  `NetCustomerPays` decimal(18,2) NOT NULL,
  `RefundAmount` decimal(18,2) NOT NULL,
  `CustomerPaidAmount` decimal(18,2) NOT NULL,
  `RefundMethod` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ExchangeOrderId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `Note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `UpdatedAt` datetime(6) NOT NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_ReturnOrders_ReturnCode` (`ReturnCode`),
  KEY `IX_ReturnOrders_SourceOrderId` (`SourceOrderId`),
  CONSTRAINT `FK_ReturnOrders_Orders_SourceOrderId` FOREIGN KEY (`SourceOrderId`) REFERENCES `Orders` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ReturnOrders`
--

LOCK TABLES `ReturnOrders` WRITE;
/*!40000 ALTER TABLE `ReturnOrders` DISABLE KEYS */;
INSERT INTO `ReturnOrders` VALUES ('87c32213-de09-4a2e-b331-e3bb7f0acf78','TH-260628-001','a731dcd6-ab3b-4249-b049-191db7475747','HVT-260628-003','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001',95000.00,0.00,-95000.00,95000.00,0.00,'Cash',NULL,'Lý do: Sản phẩm bị lỗi / hư hỏng','2026-06-28 05:04:41.676479','2026-06-28 05:04:41.676479',0),('be4030ae-33cf-48ee-ad9c-2ef7a671173a','TH-260628-002','0c614f8b-e621-49f6-a4a7-773953e90ffc','HVT-260628-004','4d4c5698-2f6d-4148-b6e9-100dec20363e','HuyNQ · KH000001',95000.00,190000.00,95000.00,0.00,0.00,'VietQR','a0359fb2-a29e-4223-8ae6-dfe4cdb86cad','Lý do: Sản phẩm bị lỗi / hư hỏng','2026-06-28 05:10:18.346896','2026-06-28 05:10:18.391300',0);
/*!40000 ALTER TABLE `ReturnOrders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `__EFMigrationsHistory`
--

DROP TABLE IF EXISTS `__EFMigrationsHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__EFMigrationsHistory` (
  `MigrationId` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductVersion` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`MigrationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__EFMigrationsHistory`
--

LOCK TABLES `__EFMigrationsHistory` WRITE;
/*!40000 ALTER TABLE `__EFMigrationsHistory` DISABLE KEYS */;
INSERT INTO `__EFMigrationsHistory` VALUES ('20260613101635_InitialCreate','8.0.0'),('20260613120000_AddPromotionCategoryScopes','8.0.0'),('20260613130000_AddPromotionCustomerTierScopes','8.0.0'),('20260613163000_AddOrderDetailIsGift','8.0.0'),('20260613170000_AddOrderDetailReportingColumns','8.0.0'),('20260628215806_AddOrderIdempotencyKey','8.0.0'),('20260629120000_AddCustomBundles','8.0.0'),('20260723153000_AddPosCashSessions','8.0.0'),('20260723192707_AddOrderOutboxMessages','8.0.0'),('20260724195511_AddOrderReceiptPrintLogs','8.0.0'),('20260730150926_AddContractSnapshotToOrders','8.0.0'),('20260730161856_AddOrderEmployeeSnapshotName','8.0.0');
/*!40000 ALTER TABLE `__EFMigrationsHistory` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-03  6:14:23
