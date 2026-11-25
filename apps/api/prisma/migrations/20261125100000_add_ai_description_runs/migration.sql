-- AlterEnum
ALTER TYPE "DescriptionStatus" ADD VALUE 'RUNNING';

-- AlterTable
ALTER TABLE "description_runs" ADD COLUMN     "deadlineAt" TIMESTAMPTZ(3),
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "modelRevision" TEXT,
ADD COLUMN     "parameters" JSONB,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "provider" TEXT;

-- CreateIndex
CREATE INDEX "description_runs_status_deadlineAt_idx" ON "description_runs"("status", "deadlineAt");
