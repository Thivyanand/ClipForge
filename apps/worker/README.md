# ClipForge transcription worker

The worker consumes transcription jobs from the Redis list `clipforge:transcription:jobs`, runs Faster-Whisper against the uploaded media, and stores timestamped transcript segments in PostgreSQL.

## Requirements

- Python 3.11+
- FFmpeg available on PATH
- PostgreSQL and Redis from the repository Docker Compose stack

## Setup

```bash
cd apps/worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python worker.py
```

Set `DATABASE_URL`, `REDIS_URL`, and `UPLOADS_DIR` for your environment. The first run downloads the configured Whisper model (default: `small`). CPU mode uses int8 by default; set `COMPUTE_TYPE=float16` only when your hardware supports it.

Jobs are retryable: failed jobs set the video's transcription status to `failed`; submitting the request again queues a fresh attempt. The worker acknowledges a Redis job only after it has stored the transcript or marked the video failed.
