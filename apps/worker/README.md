# ClipForge transcription worker

The worker consumes jobs from the Redis list `clipforge:transcription:jobs`, runs Faster-Whisper against uploaded media, and stores timestamped transcript segments in PostgreSQL.

## Requirements

- Python 3.11+
- FFmpeg and FFprobe available on PATH
- PostgreSQL and Redis

## Setup

```bash
cd apps/worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
HF_HUB_DISABLE_XET=1 python worker.py
```

Set `DATABASE_URL`, `REDIS_URL`, and `UPLOADS_DIR` for your environment. The first run downloads the configured Whisper model (default: `small`). CPU mode uses int8 by default. The worker pins PyAV to 16.1.0 to keep its audio decoder compatible with Faster-Whisper.

## Job behaviour

- The API checks that the uploaded file exists and contains an audio stream before queueing it.
- The worker repeats the audio check before decoding, so malformed or video-only files receive a readable failure reason.
- A failed job sets `transcriptionStatus` to `failed` and stores a short `transcriptionError` on the Video record.
- Submit the transcription request again to retry a failed job. The API clears the previous error when it queues a new attempt.
- Successful jobs save the detected language, full text, and timestamped segments in PostgreSQL.
