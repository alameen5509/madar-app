-- إنشاء جدول جهات الاتصال
CREATE TABLE IF NOT EXISTS `Contacts` (
    `Id` CHAR(36) NOT NULL,
    `OwnerId` CHAR(36) NOT NULL,
    `Name` VARCHAR(200) NOT NULL,
    `Phone` VARCHAR(30) NOT NULL,
    `Notes` VARCHAR(500) NULL,
    `CreatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`Id`),
    UNIQUE INDEX `IX_Contacts_OwnerId_Phone` (`OwnerId`, `Phone`),
    CONSTRAINT `FK_Contacts_AspNetUsers_OwnerId` FOREIGN KEY (`OwnerId`)
        REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET = utf8mb4;

-- إضافة عمود ContactId في جدول المهام
ALTER TABLE `SmartTasks` ADD COLUMN `ContactId` CHAR(36) NULL;
ALTER TABLE `SmartTasks` ADD CONSTRAINT `FK_SmartTasks_Contacts_ContactId`
    FOREIGN KEY (`ContactId`) REFERENCES `Contacts` (`Id`) ON DELETE SET NULL;
CREATE INDEX `IX_SmartTasks_ContactId` ON `SmartTasks` (`ContactId`);
