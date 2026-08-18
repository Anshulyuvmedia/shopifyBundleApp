-- AlterTable: Add display order to Bundle table
ALTER TABLE "Bundle" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;