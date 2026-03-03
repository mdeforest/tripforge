-- AlterTable
ALTER TABLE "days" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "stops" ADD COLUMN     "options" JSONB;
