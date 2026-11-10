ALTER TABLE "Video"
ADD COLUMN "transcriptionStatus" TEXT NOT NULL DEFAULT 'not_started';

CREATE INDEX "Video_transcriptionStatus_idx" ON "Video"("transcriptionStatus");

CREATE TABLE "Transcript" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "language" TEXT,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranscriptSegment" (
  "id" TEXT NOT NULL,
  "transcriptId" TEXT NOT NULL,
  "startSeconds" DOUBLE PRECISION NOT NULL,
  "endSeconds" DOUBLE PRECISION NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transcript_videoId_key" ON "Transcript"("videoId");
CREATE INDEX "TranscriptSegment_transcriptId_startSeconds_idx"
  ON "TranscriptSegment"("transcriptId", "startSeconds");

ALTER TABLE "Transcript"
ADD CONSTRAINT "Transcript_videoId_fkey"
FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TranscriptSegment"
ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey"
FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
