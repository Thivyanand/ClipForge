# ClipForge Architecture

## High-level design

The Next.js web application communicates with a NestJS API. The API owns identity, workspace authorization, projects, uploads, billing and job orchestration. Python workers perform media and AI workloads independently from the API.

## Services

- Web: Next.js App Router, React and TypeScript.
- API: NestJS REST API.
- Database: PostgreSQL is the source of truth for application and job state.
- Local queue/cache: Redis; BullMQ is the initial local-development queue option.
- Workers: Python processes for ingestion, transcription, analysis and rendering.
- Media: FFmpeg/FFprobe.
- Object storage: private S3-compatible storage in production.
- Production queue: AWS SQS; workers acknowledge jobs only after durable state transitions.

## Processing pipeline

1. Ingest and validate source media.
2. Extract metadata, proxy media and audio.
3. Transcribe audio and preserve word timestamps.
4. Analyse transcript and selected video frames.
5. Generate, rank and de-duplicate candidate clips.
6. Store editable clip instructions (edit decision list).
7. Render requested exports.
8. Store outputs and notify the web application.

Each stage must be independently retryable and idempotent. PostgreSQL stores authoritative job state; Redis is not the permanent job record.

## Security boundaries

- Every tenant-owned record is workspace-scoped.
- API authorization verifies workspace membership on every request.
- Source media and exports are private by default.
- Uploads use short-lived signed URLs and server-side validation.
- Media workers run with resource limits and least privilege.
- User-provided media is untrusted input.

## Deployment direction

Local development uses Docker Compose for PostgreSQL and Redis. Production is planned around containerized services on AWS, with S3, SQS, RDS PostgreSQL, ECS and CloudFront. Provider choices remain subject to cost and workload benchmarks.
