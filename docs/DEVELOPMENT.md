# Development Guide

## Requirements

- Node.js 24+
- npm
- Docker with Docker Compose
- Python 3.11+
- FFmpeg and FFprobe

## First-time setup

From the repository root:

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate --workspace @clipforge/api
npm run prisma:migrate --workspace @clipforge/api
```

The API reads `DATABASE_URL` from the root `.env`. The default local Compose database is:

```text
postgresql://clipforge:clipforge_dev@localhost:5432/clipforge
```

## Run the applications

Start the web app and API in separate terminals:

```bash
npm run dev:web
npm run dev:api
```

The API listens on `http://localhost:4000/api/v1`.

## Video API

- `POST /api/v1/videos/upload` — multipart upload using the `file` field. MP4, MOV and WebM are accepted, up to 500 MB. FFprobe validates the video stream and extracts metadata before a database record is created.
- `GET /api/v1/videos` — returns the latest 100 video records.
- `GET /api/v1/videos/:id` — returns one video record.

Uploaded media is stored locally under the configured uploads directory and is intentionally excluded from Git. PostgreSQL stores metadata and the storage key; it does not store video bytes.

## Verify the database-backed upload

With PostgreSQL running and the API started, upload a test video:

```bash
curl -X POST http://localhost:4000/api/v1/videos/upload \
  -F "file=@storage/temp/test-video.mp4"
```

Then list records:

```bash
curl http://localhost:4000/api/v1/videos
```

Use the returned video `id` to fetch one record:

```bash
curl http://localhost:4000/api/v1/videos/VIDEO_ID
```

## Notes

- Keep real credentials in the untracked root `.env`; never commit it.
- The current upload storage is local development storage. Production object storage and workspace authorization are future work.
- Run `npm run build:api` after changing API code.
