/*
  Warnings:

  - Made the column `publicId` on table `imagemproduto` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `imagemproduto` MODIFY `publicId` VARCHAR(191) NOT NULL DEFAULT '';
