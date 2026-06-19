# LocalStack local deployment

Run the app locally with **LocalStack** emulating production AWS services (S3, Secrets Manager). PostgreSQL, Mailpit, and LocalStack use the existing `docker-compose.yml` services — RDS is not emulated; use local PostgreSQL instead.

**Entry point:** nginx listens on **port 80** at `http://local.whiteglovesource.com`. Frontend (Vite) and API run on internal Docker ports only — no `:5173` or `:3000` in the browser.

## Architecture

```
Browser → http://local.whiteglovesource.com:80
              ↓
         wgs-nginx (Docker)
         ├── /      → wgs-frontend:5173 (Vite, internal)
         └── /api/* → wgs-api:3000 (NestJS, internal)

wgs-api → host.docker.internal:4566 (LocalStack S3 / Secrets Manager)
wgs-api → host.docker.internal:5432 (PostgreSQL)
```

## What mirrors production

| Production (CDK / EC2) | Local |
|------------------------|-------|
| S3 bucket (`content/`, `uploads/`, `backups/`) | LocalStack S3 (`wgs-local-app`) |
| Secrets Manager (`wgs/db`, `wgs/jwt`) | LocalStack Secrets Manager |
| RDS PostgreSQL | Docker PostgreSQL (`docker-compose.yml`) |
| IAM instance role for S3 | Static `test`/`test` credentials + `AWS_ENDPOINT_URL` |
| nginx reverse proxy on :80 | `wgs-nginx` container (`80:80`) |
| SSM deploy, EC2, Elastic IP | Not used locally |
| SNS / Lambda site monitor | Not emulated |

## Prerequisites

- Docker + Docker Compose
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) **or** `awslocal` (`pip install 'localstack[aws]'`)
- `jq`, `curl`
- **`/etc/hosts` entry** (required):

```
127.0.0.1 local.whiteglovesource.com
```

## Quick start

```bash
chmod +x deploy/scripts/deploy-localstack.sh scripts/localstack-init.sh
./deploy/scripts/deploy-localstack.sh

curl -s http://local.whiteglovesource.com/api/health
```

Open **http://local.whiteglovesource.com** — no port in the URL.

Infra only (skip app containers):

```bash
./deploy/scripts/deploy-localstack.sh --infra-only
```

## Manual steps

```bash
# 1. Start dependencies (PostgreSQL + LocalStack + Mailpit — no MySQL)
docker compose -f docker-compose.yml -f docker-compose.localstack.yml up -d postgres mailpit localstack

# 2. Create bucket, secrets, seed CMS content/
./scripts/localstack-init.sh

# 3. Database
npm run db:setup

# 4. App env + stack
cp .env.localstack.example .env.localstack
docker compose -f deploy/docker-compose.localstack.yml --env-file .env.localstack up -d --build
```

## Environment variables

Copy `.env.localstack.example` to `.env.localstack`. Key values:

| Variable | Local value | Purpose |
|----------|-------------|---------|
| `STORAGE_BACKEND` | `s3` | Same as EC2 production |
| `S3_BUCKET` | `wgs-local-app` | Matches init script default |
| `AWS_REGION` | `us-east-1` | Same as production |
| `AWS_ACCESS_KEY_ID` | `test` | LocalStack default |
| `AWS_SECRET_ACCESS_KEY` | `test` | LocalStack default |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Host scripts / CLI only |
| `S3_PUBLIC_BASE_URL` | `http://localhost:4566/wgs-local-app` | Path-style object URLs (optional) |
| `CORS_ORIGIN` | `http://local.whiteglovesource.com` | Same-origin via nginx (no port) |
| `DB_TYPE` | `postgres` | Matches local dev database |
| `DB_PORT` | `5432` | PostgreSQL on host |
| `PORT` | `3000` | API internal port (nginx proxies `/api`) |

`deploy/docker-compose.localstack.yml` overrides for containers:

- `AWS_ENDPOINT_URL=http://host.docker.internal:4566`
- `S3_PUBLIC_BASE_URL=http://host.docker.internal:4566/wgs-local-app`
- `DB_TYPE=postgres`
- `DB_HOST=host.docker.internal`
- `DB_PORT=5432`
- `SMTP_HOST=host.docker.internal`

LocalStack is **not** exposed to the browser — only the API talks to it.

Script overrides (optional):

| Variable | Default |
|----------|---------|
| `LOCALSTACK_ENDPOINT` | `http://localhost:4566` |
| `LOCAL_DOMAIN` | `local.whiteglovesource.com` |
| `WGS_LOCAL_BUCKET` | `wgs-local-app` |
| `WGS_DB_SECRET_NAME` | `wgs/db` |
| `WGS_JWT_SECRET_NAME` | `wgs/jwt` |

## Verify

```bash
curl -s http://local.whiteglovesource.com/api/health
curl -s http://localhost:4566/_localstack/health | jq .

aws --endpoint-url=http://localhost:4566 --region us-east-1 s3 ls
aws --endpoint-url=http://localhost:4566 --region us-east-1 s3 ls s3://wgs-local-app/
```

## Troubleshooting: empty S3 in the LocalStack UI

The app is configured for S3 (`STORAGE_BACKEND=s3`, bucket **`wgs-local-app`**, region **`us-east-1`**, endpoint **`http://localhost:4566`**), but **nothing appears in the LocalStack web UI until init creates the bucket and seeds objects**. Starting LocalStack alone does not create `wgs-local-app`.

### Most common causes

1. **Init never ran** — `npm run localstack:up` (or `docker compose ... localstack.yml up`) only starts the container. You still need:
   ```bash
   npm run localstack:init
   # or the full flow (recommended):
   ./deploy/scripts/deploy-localstack.sh
   ```
   `--infra-only` still runs init; skipping the deploy script entirely does not.

2. **Wrong LocalStack instance on port 4566** — Only one process can bind `:4566`. If you already have **awslocal** / LocalStack Desktop / another compose project running, the project container `wgds-localstack` may stay in `Created` state while the **other** instance serves the UI and CLI. Init and the app both talk to whatever is on `localhost:4566`, not necessarily `wgds-localstack`.
   ```bash
   docker ps -a --filter publish=4566
   # Expect either awslocal-localstack-1 (external) OR wgds-localstack (this repo), not both fighting for the port.
   ```
   Pick one stack, stop the other, then re-run init:
   ```bash
   docker stop awslocal-localstack-1   # if you use the repo's compose LocalStack instead
   npm run localstack:up
   npm run localstack:init
   ```

3. **Ephemeral awslocal data** — A standalone `awslocal` instance often has **persistence disabled**. Restarting it wipes buckets; run `npm run localstack:init` again after each restart.

4. **UI region / bucket mismatch** — In the Resource Browser, set region to **`us-east-1`** and look for bucket **`wgs-local-app`** (not a production bucket name). Objects live under prefixes like `content/` and `uploads/`.

### Quick diagnostic commands

```bash
# Is anything listening on LocalStack?
curl -s http://localhost:4566/_localstack/health | jq '{version, edition, persistence: .features.persistence, s3: .services.s3}'

# Any buckets at all? (empty list => init not run on THIS instance)
aws --endpoint-url=http://localhost:4566 --region us-east-1 s3 ls

# Expected bucket and CMS seed files
aws --endpoint-url=http://localhost:4566 --region us-east-1 s3 ls s3://wgs-local-app/content/
```

### Fix (one command)

```bash
./deploy/scripts/deploy-localstack.sh
```

Or, if LocalStack is already up and you only need S3 + secrets:

```bash
npm run localstack:init
```

## npm scripts

```bash
npm run localstack:up      # docker compose up (postgres + localstack + mailpit)
npm run localstack:init    # bucket + secrets + content seed
npm run localstack:deploy  # full deploy-localstack.sh
```

## Limitations vs production

- **No RDS** — schema sync via `TYPEORM_SYNCHRONIZE=true` locally; production uses `false` and RDS backups to S3.
- **No SSM / blue-green / EIP** — single Docker stack on the host.
- **S3 URLs** — LocalStack path-style URLs differ from `*.s3.amazonaws.com`; file downloads still go through authenticated API routes.
- **Secrets Manager** — created for parity with `user-data.sh`; the app reads DB/JWT from `.env` directly in local dev (not fetched at runtime).

## Files

- `docker-compose.localstack.yml` — LocalStack service (infra)
- `deploy/docker-compose.localstack.yml` — app stack (nginx + frontend + api)
- `deploy/nginx/nginx.localstack.conf` — nginx reverse proxy config
- `scripts/localstack-init.sh` — S3 + Secrets Manager bootstrap
- `scripts/lib/aws-local.sh` — `awslocal` / `aws --endpoint-url` helper
- `deploy/scripts/deploy-localstack.sh` — orchestration script
- `.env.localstack.example` — env template
- `backend/src/storage/s3-client.factory.ts` — `AWS_ENDPOINT_URL` support

See also [infra/README.md](../infra/README.md) for the real AWS/CDK deployment.
