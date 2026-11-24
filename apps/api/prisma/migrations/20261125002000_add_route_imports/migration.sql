-- CreateTable
CREATE TABLE "route_imports" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gpxVersion" TEXT NOT NULL,
    "warnings" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "trackIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "geometryVersion" INTEGER NOT NULL,
    "pointCount" INTEGER NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_analyses" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "elevationGainM" DOUBLE PRECISION,
    "elevationLossM" DOUBLE PRECISION,
    "elapsedDurationS" DOUBLE PRECISION,
    "averageSpeedMps" DOUBLE PRECISION,
    "qualityFlags" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_imports_userId_createdAt_id_idx" ON "route_imports"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_importId_trackIndex_key" ON "routes"("importId", "trackIndex");

-- CreateIndex
CREATE INDEX "route_analyses_routeId_createdAt_idx" ON "route_analyses"("routeId", "createdAt");

-- AddForeignKey
ALTER TABLE "route_imports" ADD CONSTRAINT "route_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_importId_fkey" FOREIGN KEY ("importId") REFERENCES "route_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_analyses" ADD CONSTRAINT "route_analyses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
