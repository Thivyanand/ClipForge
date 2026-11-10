import json
import logging
import os
import signal
import time
from pathlib import Path

import psycopg
import redis
from faster_whisper import WhisperModel

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("clipforge.transcription")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clipforge:clipforge_dev@localhost:5432/clipforge")
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "../../storage/uploads")).resolve()
QUEUE_KEY = "clipforge:transcription:jobs"
MODEL_SIZE = os.getenv("MODEL_SIZE", "small")
COMPUTE_TYPE = os.getenv("COMPUTE_TYPE", "int8")

running = True

def stop_worker(_signum, _frame):
    global running
    running = False

signal.signal(signal.SIGINT, stop_worker)
signal.signal(signal.SIGTERM, stop_worker)


def set_status(conn, video_id: str, status: str):
    conn.execute('UPDATE "Video" SET "transcriptionStatus" = %s, "updatedAt" = NOW() WHERE "id" = %s', (status, video_id))


def process_job(conn, model: WhisperModel, job: dict):
    video_id = job["videoId"]
    storage_key = job["storageKey"]
    media_path = (UPLOADS_DIR / storage_key).resolve()
    if UPLOADS_DIR not in media_path.parents or not media_path.is_file():
        raise FileNotFoundError("Uploaded media file is missing or outside the uploads directory")

    set_status(conn, video_id, "processing")
    conn.commit()
    segments, info = model.transcribe(str(media_path), vad_filter=True, word_timestamps=True)
    transcript_segments = []
    full_text = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        full_text.append(text)
        transcript_segments.append((float(segment.start), float(segment.end), text))

    if not transcript_segments:
        raise ValueError("No speech was detected in this video")

    with conn.transaction():
        conn.execute('DELETE FROM "Transcript" WHERE "videoId" = %s', (video_id,))
        row = conn.execute(
            'INSERT INTO "Transcript" ("id", "videoId", "language", "text", "createdAt", "updatedAt") VALUES (%s, %s, %s, %s, NOW(), NOW()) RETURNING "id"',
            (f"tr_{video_id}", video_id, info.language, " ".join(full_text)),
        ).fetchone()
        transcript_id = row[0]
        for start, end, text in transcript_segments:
            conn.execute(
                'INSERT INTO "TranscriptSegment" ("id", "transcriptId", "startSeconds", "endSeconds", "text", "createdAt") VALUES (%s, %s, %s, %s, %s, NOW())',
                (f"{transcript_id}_{len(text)}_{int(start * 1000)}", transcript_id, start, end, text),
            )
        set_status(conn, video_id, "completed")
    logger.info("Transcribed video %s into %s segments (%s)", video_id, len(transcript_segments), info.language)


def main():
    client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    logger.info("Loading Faster-Whisper model '%s' (%s)", MODEL_SIZE, COMPUTE_TYPE)
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type=COMPUTE_TYPE)
    logger.info("Worker ready; waiting on %s", QUEUE_KEY)
    with psycopg.connect(DATABASE_URL) as conn:
        while running:
            item = client.brpop(QUEUE_KEY, timeout=2)
            if not item:
                continue
            _, raw_job = item
            job = json.loads(raw_job)
            try:
                process_job(conn, model, job)
            except Exception:
                logger.exception("Transcription failed for video %s", job.get("videoId"))
                with conn.transaction():
                    set_status(conn, job.get("videoId", ""), "failed")

    client.close()
    logger.info("Worker stopped")

if __name__ == "__main__":
    main()
