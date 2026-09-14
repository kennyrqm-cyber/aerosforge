-- CreateTable
CREATE TABLE "CheckrideBaseline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificateTrack" TEXT NOT NULL DEFAULT 'PRIVATE_HELICOPTER',
    "standardCode" TEXT NOT NULL,
    "standardEdition" TEXT NOT NULL,
    "instrumentVersion" INTEGER NOT NULL DEFAULT 1,
    "ratings" JSONB NOT NULL,
    "confidenceTotal" INTEGER NOT NULL,
    "focusAreas" JSONB NOT NULL,
    "reflection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckrideBaseline_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckrideBaseline_confidenceTotal_check" CHECK ("confidenceTotal" BETWEEN 10 AND 50)
);

-- CreateIndex
CREATE INDEX "CheckrideBaseline_userId_createdAt_idx" ON "CheckrideBaseline"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CheckrideBaseline" ADD CONSTRAINT "CheckrideBaseline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
