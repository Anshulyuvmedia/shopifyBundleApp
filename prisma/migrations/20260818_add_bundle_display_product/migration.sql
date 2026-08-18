-- AlterTable: Add display product fields to Bundle table
ALTER TABLE "Bundle" ADD COLUMN "displayProductId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bundle" ADD COLUMN "displayProductTitle" TEXT NOT NULL DEFAULT '';
