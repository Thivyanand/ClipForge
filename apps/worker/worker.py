import json
import logging
import os
import signal
import subprocess
import uuid
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
    conn.execute(
        'UPDATE "Video" SET "transcriptionStatus" = %s, "updatedAt" = NOW() WHERE "id" = %s',
        (status, video_id),
    )


def set_failure(conn, video_id: str, reason: str):
    message = (reason.strip() or "Transcription failed.")[:2000]
    with conn.transaction():
        conn.execute(
            'UPDATE "Video" SET "transcriptionStatus" = %s, "transcriptionError" = %s, "updatedAt" = NOW() WHERE "id" = %s',
            ("failed", message, video_id),
        )


def ensure_audio_stream(media_path: Path):
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "a",
                "-show_entries", "stream=index", "-of", "csv=p=0", str(media_path),
            ],
            check=True, capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError as error:
        raise RuntimeError("FFprobe is not installed or is not available on PATH.") from error
    except subprocess.SubprocessError as error:
        raise ValueError("Could not inspect the video's audio stream.") from error

    if not result.stdout.strip():
        raise ValueError("This video has no audio stream and cannot be transcribed.")


def process_job(conn, model: WhisperModel, job: dict):
    video_id = job["videoId"]
    storage_key = job["storageKey"]
    media_path = (UPLOADS_DIR / storage_key).resolve()
    if UPLOADS_DIR not in media_path.parents or not media_path.is_file():
        raise FileNotFoundError("Uploaded media file is missing or outside the uploads directory")

    ensure_audio_stream(media_path)
    with conn.transaction():
        conn.execute(
            'UPDATE "Video" SET "transcriptionStatus" = %s, "transcriptionError" = NULL, "updatedAt" = NOW() WHERE "id" = %s',
            ("processing", video_id),
        )

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
        raise ValueError("No speech was detected in this video.")

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
                (str(uuid.uuid4()), transcript_id, start, end, text),
            )
        conn.execute(
            'UPDATE "Video" SET "transcriptionStatus" = %s, "transcriptionError" = NULL, "updatedAt" = NOW() WHERE "id" = %s',
            ("completed", video_id),
        )
    logger.info("Transcribed video %s into %s segments (%s)", video_id, len(transcript_segments), info.language)


def main():
    client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    logger.info("Loading Faster-Whisper model '%s' (%s)", MODEL_SIZE, COMPUTE_TYPE)
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type=COMPUTE_TYPE)
    logger.info("Worker ready; waiting on %s", QUEUE_KEY)
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            while running:
                item = client.brpop(QUEUE_KEY, timeout=2)
                if not item:
                    continue
                _, raw_job = item
                job = json.loads(raw_job)
                try:
                    process_job(conn, model, job)
                except Exception as error:
                    logger.exception("Transcription failed for video %s", job.get("videoId"))
                    set_failure(conn, job.get("videoId", ""), str(error))
    finally:
        client.close()
    logger.info("Worker stopped")


if __name__ == "__main__":
    main()
