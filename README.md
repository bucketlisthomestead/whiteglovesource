# White Glove Source

Premium furniture receiving, storage, delivery, and installation platform for interior designers in High Point, NC and the surrounding Triad region.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + PWA (offline-capable)
- **Backend:** NestJS + TypeORM + JWT Auth
- **Database:** MySQL 8

## Features

### Public Website
- Marketing pages, services, contact, and quote request forms
- Email notifications to owner on contact/quote submissions (SMTP or console log)

### Project Portal
- Live demo project (14 pieces, 5 rooms) — works offline after first visit
- Role-based access: **admin**, **designer**, **client**
- Room filtering, piece detail, condition/stage tracking
- PDF inventory export (room-by-room manifest)

### Field Tools (Mobile-First)
- **Field** page for quick piece updates during pickups
- Camera capture for condition photos (`capture="environment"`)
- **Offline mode** — updates queue in IndexedDB and sync when back online
- PWA installable on phones; bottom nav for thumb-friendly navigation
- 48px+ touch targets, 16px inputs (no iOS zoom), safe-area padding

### Admin Dashboard
- Stats overview, recent quotes, messages
- Send quotes via email to clients
- Mark messages as read

## Quick Start

```bash
# 1. Start MySQL
npm run db:setup
# Uses Homebrew MySQL on Mac, or Docker if available

# 2. Backend
cd backend && npm install && npm run start:dev

# 3. Frontend
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

### Demo Logins (password: `password123`)

| Role | Email |
|------|-------|
| Admin | admin@whiteglovedeliverync.com |
| Designer | sarah@whitfieldinteriors.com |
| Client | morrison@example.com |

## Offline & Sync

1. Visit a project while online — data caches to IndexedDB
2. Go offline (or lose signal at a pickup) — field updates queue locally
3. Photos stored as base64 in queue when offline
4. When connection returns, sync runs automatically (every 30s + on `online` event)
5. Service worker caches static assets and API responses (NetworkFirst)

Manual sync: tap **Sync Now** in the offline banner.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/contact` | Public | Contact form |
| POST | `/api/quotes` | Public | Quote request |
| GET | `/api/projects/demo` | Public | Demo project |
| GET | `/api/projects/my` | JWT | User's projects |
| POST | `/api/projects/pieces/:id/events` | Designer/Admin | Update piece |
| POST | `/api/sync` | Designer/Admin | Batch offline sync |
| POST | `/api/uploads/photo` | Designer/Admin | Photo upload |
| GET | `/api/pdf/project/:id/inventory` | JWT | PDF export |
| GET | `/api/admin/dashboard` | Admin | Dashboard |

## Environment Variables

See `backend/.env.example` for SMTP, JWT secret, and database config.

## Secret scan (before git init / first push)

Run the pre-commit scanner to catch `.env` files, CDK artifacts, deploy state, and hardcoded secrets before they reach GitHub:

```bash
chmod +x scripts/pre-commit-scan.sh   # once
npm run pre-commit:scan
# or: ./scripts/pre-commit-scan.sh
```

Run this **before** `git init` and again before your first push. Exit code `1` means fix reported failures first.

### Git pre-commit hook

After `git init`, enable the secret scan on every commit (one-time setup):

```bash
npm run setup:git-hooks
```

This sets `core.hooksPath` to `.githooks/` and runs `scripts/pre-commit-scan.sh` before each commit. Failed scans block the commit.

## Install as PWA

On mobile: open the site in Safari/Chrome → **Add to Home Screen**. The app works offline for cached projects and queued field updates.
