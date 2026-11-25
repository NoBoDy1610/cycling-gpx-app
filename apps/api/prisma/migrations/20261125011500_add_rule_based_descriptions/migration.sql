-- CreateEnum
CREATE TYPE "DescriptionMethod" AS ENUM ('RULE_BASED', 'AI');

-- CreateEnum
CREATE TYPE "DescriptionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'INTERRUPTED');

-- CreateTable
CREATE TABLE "description_comparisons" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "inputSchemaVersion" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "description_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "description_runs" (
    "id" UUID NOT NULL,
    "comparisonId" UUID NOT NULL,
    "method" "DescriptionMethod" NOT NULL,
    "status" "DescriptionStatus" NOT NULL,
    "outputText" TEXT,
    "durationMs" DOUBLE PRECISION,
    "generatorVersion" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "description_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "description_comparisons_analysisId_createdAt_idx" ON "description_comparisons"("analysisId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "description_runs_comparisonId_method_key" ON "description_runs"("comparisonId", "method");

-- AddForeignKey
ALTER TABLE "description_comparisons" ADD CONSTRAINT "description_comparisons_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "route_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "description_runs" ADD CONSTRAINT "description_runs_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "description_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
