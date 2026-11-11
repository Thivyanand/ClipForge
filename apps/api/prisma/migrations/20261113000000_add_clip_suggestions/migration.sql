CREATE TABLE "ClipSuggestion" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClipSuggestion_videoId_score_idx" ON "ClipSuggestion"("videoId", "score");

ALTER TABLE "ClipSuggestion"
ADD CONSTRAINT "ClipSuggestion_videoId_fkey"
FOREIGN KEY ("videoId") REFERENCES "Video"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
