# ClipForge

AI-powered video repurposing platform for content creators.

> Turn long-form recordings into engaging short-form content with AI-assisted clip selection and editing.

## Status

**Sprint 1 — Video ingestion and metadata persistence.** The API accepts video uploads, validates media with FFprobe, and stores metadata in PostgreSQL. The creator dashboard and AI editing pipeline are still in development.

## Planned stack

- Web: Next.js, React, TypeScript, Tailwind CSS
- API: NestJS, TypeScript
- AI workers: Python
- Data: PostgreSQL and Prisma
- Local queue/cache: Redis and BullMQ (planned)
- Media: FFmpeg
- Development: Docker Compose
- Production direction: AWS (S3, SQS, RDS, ECS)

## Repository layout

- `apps/web` — creator dashboard and editor
- `apps/api` — application API
- `workers/video-worker` — media and AI processing worker
- `packages` — shared packages
- `infrastructure` — deployment configuration
- `docs` — product and engineering documentation

## Local development

Requirements: Node.js 24+, npm, Python 3.11+, Docker Compose, FFmpeg and FFprobe.

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate --workspace @clipforge/api
npm run prisma:migrate --workspace @clipforge/api
```

Run the applications in separate terminals:

```bash
npm run dev:web
npm run dev:api
```

See [Development](docs/DEVELOPMENT.md) and [Architecture](docs/ARCHITECTURE.md).

## Product principles

1. AI handles repetitive editing; creators retain creative control.
2. Processing is asynchronous and retryable.
3. Generated clips remain editable through structured edit instructions.
4. Usage and infrastructure costs are measurable.
5. Customer media stays private and workspace-scoped.

## License

All rights reserved while the project is in development. A license will be selected before public distribution.
