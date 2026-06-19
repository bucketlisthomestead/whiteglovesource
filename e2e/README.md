# E2E / Playwright tests

UI feature tests for White Glove Source. These cover change orders, scope reduction, layout presets, and quote finalize workflows.

## Prerequisites

1. **Database** with seed data (catalog, admin user, designers):

   ```bash
   npm run db:setup
   ```

2. **Backend** on port 3001:

   ```bash
   npm run backend:dev
   ```

3. **Frontend** on port 5173 (proxies `/api` to backend):

   ```bash
   npm run frontend:dev
   ```

   Or use the LocalStack dev URL: `http://local.whiteglovesource.com` (see [deploy/LOCALSTACK.md](../deploy/LOCALSTACK.md)).

4. **Playwright** (first time only):

   ```bash
   npm run walkthrough:install
   # or: cd e2e && npm install && npx playwright install chromium
   ```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend base URL (`BASE_URL` also accepted) |
| `E2E_API_URL` | `http://localhost:3001` when base is `:5173`; else same as `E2E_BASE_URL` | Backend origin for health checks (direct, not via Vite proxy) |
| `E2E_ADMIN_EMAIL` | `admin@whiteglovedeliverync.com` | Admin login email |
| `E2E_ADMIN_PASSWORD` | *(required)* | Admin login password — must match `DEV_ADMIN_PASSWORD` in `backend/.env` |
| `E2E_API_PREFIX` | `/api` | API path prefix |
| `E2E_HEADED` | `0` | Set to `1` to run headed browser |

`E2E_ADMIN_PASSWORD` has no default in code. Export it before running tests:

```bash
export E2E_ADMIN_PASSWORD='your-dev-admin-password'   # same as DEV_ADMIN_PASSWORD
npm run test:features
```

Global setup checks the **backend directly** at `E2E_API_URL` (not through the Vite proxy). A 502 at `localhost:5173/api/health` usually means the frontend is up but the backend on `:3001` is not.

Example against local hostname:

```bash
E2E_BASE_URL=http://local.whiteglovesource.com npm run test:features
```

(`E2E_API_URL` defaults to the same host — nginx proxies `/api`.)

## Run tests

From repo root:

```bash
# All feature specs
npm run test:features

# Single file
cd e2e && npx playwright test features/change-orders.spec.ts --config playwright.features.config.ts

# Headed / debug
E2E_HEADED=1 npm run test:features
cd e2e && npx playwright test --config playwright.features.config.ts --ui
```

Deploy smoke (health + login only):

```bash
npm run test:deploy-smoke
```

## Test structure

| Spec | Coverage |
|------|----------|
| `features/layout-presets.spec.ts` | `ProjectLayoutSwitcher` — Classic, Admin, Compact tabs and persistence |
| `features/change-orders.spec.ts` | Create change order quote from project page |
| `features/quote-finalize.spec.ts` | Quote detail — mark accepted, add to project inventory |
| `features/scope-reduction.spec.ts` | Scope reduction wizard, credit preview, finalize removal |

Shared helpers live in `helpers/`:

- `auth.ts` — admin login (UI + API token)
- `project-fixture.ts` — creates non-demo projects with inventory via API
- `ui.ts` — project navigation and layout helpers

## Seed / setup notes

- Tests create **new** quotes and projects per run (unique emails). No manual seed beyond default `db:setup` + backend boot.
- Requires the **piece catalog** seed (`Accent Chair`, etc.) and at least one **designer** from backend `SeedService`.
- Change orders and scope reduction **do not work on the demo project** (`/demo`); tests use real API-created projects.
- Confirm dialogs (`Mark accepted`, `Add to inventory`) are auto-accepted in tests.

## Limitations

- Requires a running local stack (not AWS/LocalStack infrastructure tests).
- Serial execution (`workers: 1`) to reduce DB contention.
- Mailpit / email delivery is not asserted.
- PDF export, contract amendments, and field/mobile flows are out of scope.
- Layout persistence test uses `localStorage` per browser context; isolated runs are reliable.

## Other Playwright configs

| Config | Purpose |
|--------|---------|
| `playwright.config.ts` | Marketing walkthrough video (`walkthrough.spec.ts`) |
| `playwright.deploy.config.ts` | Deploy smoke (`deploy-smoke.spec.ts`) |
| `playwright.features.config.ts` | Feature specs in `features/` |
