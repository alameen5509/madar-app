-- ═══ Finance Module Tables ═══

CREATE TABLE IF NOT EXISTS `FinAccounts` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `Name` VARCHAR(200) NOT NULL, `Icon` VARCHAR(10) DEFAULT '🏦',
    `Balance` DECIMAL(18,2) DEFAULT 0, `DisplayOrder` INT DEFAULT 0,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinAccounts_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinAccounts_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinPockets` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `Name` VARCHAR(200) NOT NULL, `Icon` VARCHAR(10) DEFAULT '👤',
    `Type` INT DEFAULT 0, `DisplayOrder` INT DEFAULT 0,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinPockets_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinPockets_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `PocketCommitments` (
    `Id` CHAR(36) NOT NULL, `PocketId` CHAR(36) NOT NULL,
    `Title` VARCHAR(300) NOT NULL, `MonthlyAmount` DECIMAL(18,2) DEFAULT 0,
    `TotalAmount` DECIMAL(18,2) NULL, `PaidSoFar` DECIMAL(18,2) DEFAULT 0, `DueDay` INT DEFAULT 1,
    PRIMARY KEY (`Id`),
    CONSTRAINT `FK_PocketCommitments_Pockets` FOREIGN KEY (`PocketId`) REFERENCES `FinPockets`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinTransactions` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `Title` VARCHAR(500) NOT NULL, `Amount` DECIMAL(18,2) NOT NULL,
    `Type` INT DEFAULT 0, `Category` VARCHAR(100) DEFAULT 'أخرى',
    `ExpenseClass` INT NULL, `AccountId` CHAR(36) NULL, `PocketId` CHAR(36) NULL,
    `Date` DATETIME(6) NOT NULL, `ApprovedAt` DATETIME(6) NULL,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinTx_Owner_Date` (`OwnerId`, `Date`),
    CONSTRAINT `FK_FinTx_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_FinTx_Accounts` FOREIGN KEY (`AccountId`) REFERENCES `FinAccounts`(`Id`) ON DELETE SET NULL,
    CONSTRAINT `FK_FinTx_Pockets` FOREIGN KEY (`PocketId`) REFERENCES `FinPockets`(`Id`) ON DELETE SET NULL
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinDebts` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `CreditorName` VARCHAR(200) NOT NULL, `CreditorPhone` VARCHAR(30) NULL,
    `OriginalAmount` DECIMAL(18,2) DEFAULT 0, `PaidSoFar` DECIMAL(18,2) DEFAULT 0,
    `MonthlyPayment` DECIMAL(18,2) DEFAULT 0, `Notes` VARCHAR(500) NULL,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinDebts_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinDebts_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinRecurringDues` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `Title` VARCHAR(300) NOT NULL, `Amount` DECIMAL(18,2) DEFAULT 0,
    `Type` INT DEFAULT 0, `Frequency` INT DEFAULT 0,
    `DueDay` INT DEFAULT 1, `DueMonth` INT NULL,
    `AccountId` CHAR(36) NULL, `PocketId` CHAR(36) NULL,
    `Category` VARCHAR(100) NULL, `IsActive` TINYINT(1) DEFAULT 1,
    `LastConfirmedDate` DATETIME(6) NULL,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinDues_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinDues_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinGoals` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `Title` VARCHAR(300) NOT NULL, `Description` VARCHAR(1000) NULL,
    `TargetAmount` DECIMAL(18,2) DEFAULT 0, `SavedSoFar` DECIMAL(18,2) DEFAULT 0,
    `Deadline` DATETIME(6) NULL,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), INDEX `IX_FinGoals_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinGoals_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinGoalItems` (
    `Id` CHAR(36) NOT NULL, `GoalId` CHAR(36) NOT NULL,
    `Name` VARCHAR(300) NOT NULL, `Cost` DECIMAL(18,2) DEFAULT 0,
    PRIMARY KEY (`Id`),
    CONSTRAINT `FK_FinGoalItems_Goals` FOREIGN KEY (`GoalId`) REFERENCES `FinGoals`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `ZakatProfiles` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `HawalDate` VARCHAR(20) NULL, `GoldGrams` DECIMAL(10,4) DEFAULT 0,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`), UNIQUE INDEX `IX_Zakat_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_Zakat_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `GoldPurchases` (
    `Id` CHAR(36) NOT NULL, `ZakatProfileId` CHAR(36) NOT NULL,
    `Grams` DECIMAL(10,4) DEFAULT 0, `PricePerGram` DECIMAL(18,2) DEFAULT 0,
    `TotalCost` DECIMAL(18,2) DEFAULT 0, `Date` DATETIME(6) NOT NULL,
    `Notes` VARCHAR(300) NULL,
    PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Gold_Zakat` FOREIGN KEY (`ZakatProfileId`) REFERENCES `ZakatProfiles`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

CREATE TABLE IF NOT EXISTS `FinSettings` (
    `Id` CHAR(36) NOT NULL, `OwnerId` CHAR(36) NOT NULL,
    `DebtPercent` INT DEFAULT 10, `SavingsPercent` INT DEFAULT 10,
    `ExpenseCategoriesJson` TEXT, `IncomeCategoriesJson` TEXT,
    PRIMARY KEY (`Id`), UNIQUE INDEX `IX_FinSettings_OwnerId` (`OwnerId`),
    CONSTRAINT `FK_FinSettings_Users` FOREIGN KEY (`OwnerId`) REFERENCES `AspNetUsers`(`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;
