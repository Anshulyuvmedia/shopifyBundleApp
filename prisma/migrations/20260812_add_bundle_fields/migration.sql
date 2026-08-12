-- AlterTable: Add new fields to Bundle table
ALTER TABLE "Bundle" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bundle" ADD COLUMN "freeShippingText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bundle" ADD COLUMN "freeGiftText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bundle" ADD COLUMN "cardImageUrl" TEXT NOT NULL DEFAULT '';
