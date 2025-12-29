-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `foto` VARCHAR(191) NULL,
    ADD COLUMN `resetToken` VARCHAR(191) NULL,
    ADD COLUMN `resetTokenExpiry` DATETIME(3) NULL;
