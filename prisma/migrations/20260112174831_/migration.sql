/*
  Warnings:

  - Added the required column `publicId` to the `imagemproduto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `imagemproduto` ADD COLUMN `publicId` VARCHAR(191) NOT NULL;
