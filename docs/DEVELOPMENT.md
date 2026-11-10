# Local Development

## Requirements

- Node.js 24+
- npm
- Python 3.11+
- Docker Engine and Docker Compose plugin

## Setup

```bash
cp .env.example .env
npm install
docker compose up -d
docker compose ps
```

## Run the web application

```bash
npm run dev:web
```

Open http://localhost:3000.

## Run the API

In another terminal:

```bash
npm run dev:api
```

The API listens on http://localhost:4000. Health check: http://localhost:4000/api/v1/health.

## Run the Python worker bootstrap

```bash
cd workers/video-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
python -m clipforge_worker.main
```

## Stop local services

```bash
docker compose down
```

To remove local database data too, run `docker compose down -v`. This is destructive.
