CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "codec" TEXT,
    "frameRate" DOUBLE PRECISION,
    "format" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Video_storageKey_key" ON "Video"("storageKey");
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX "Video_status_idx" ON "Video"("status");
