# EcoVerse deployment checklist

## Vercel frontend and Render backend

Use the Vercel workspace `aayush-dhuris-projects-52698d4d` for this deployment.
The production Render service URL must be known before configuring the frontend.

On Render, use a Node web service with build command `npm ci && npm run build`
and start command `npm run db:migrate && npm run start:production`.
The migration command initializes the selected database without importing local legacy data.
Set the production environment variables below and health check `/api/health`.
For a hosted MySQL database requiring TLS, set `DB_SSL=true` and, when required,
`DB_SSL_CA` to the provider's CA certificate. Certificate verification stays enabled.

On Vercel, build with `npm run build` and serve `dist`. Configure an external
rewrite from `/api/:path*` to `https://YOUR-RENDER-SERVICE.onrender.com/api/:path*`.
Replace the placeholder with the actual service URL before deploying. Keep
frontend API requests relative to `/api` so that session cookies are first-party.
On Render set `APP_ORIGIN` to the exact Vercel production origin and
`TRUST_PROXY=1`. Do not allow every `*.vercel.app` origin.

Render's free filesystem is ephemeral. Do not publish the evidence-upload
workflow until persistent storage is configured; a separate object-storage
adapter is required for free Render hosting. Hosted MySQL is also required:
the developer's local database is not accessible from Render.

EcoVerse is a Node.js/Express application that serves the Vite build and connects to MySQL. It is not a frontend-only static site.

## Recommended hosting shape

- Node host: Render, Railway, Fly.io, or another Node 22 host
- Managed MySQL: Railway, Aiven, DigitalOcean, or another MySQL 8 provider
- Persistent proof storage: a mounted volume or object storage adapter
- HTTPS: provided by the host or a reverse proxy

## Required production environment variables

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<platform-provided-port>
APP_ORIGIN=https://your-domain.example
SESSION_SECRET=<long-random-secret-at-least-32-characters>
TRUST_PROXY=1
DB_HOST=<managed-mysql-host>
DB_PORT=3306
DB_NAME=ecoverse
DB_USER=<managed-mysql-user>
DB_PASSWORD=<managed-mysql-password>
PROOF_DIR=<persistent-proof-directory>
FOREST_THRESHOLDS=0,200,500,1000,2000
```

SMTP variables are optional. Add them only when a real mail provider is configured:

```text
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
EMAIL_FROM=EcoVerse <no-reply@your-domain.example>
```

## Build and start commands

```powershell
npm ci
npm run build
npm run db:init
npm start
```

Run `npm run db:init` once against the production database before starting the app. Do not run `npm run db:demo` in production unless demo data is intentionally wanted.

The host must expose the port from `PORT`. The health check is:

```text
GET /api/health
```

It should return status `200` with `storage: "mysql"`.

## Before going live

- Use a fresh production database and least-privilege database user.
- Set a unique `SESSION_SECRET`; never commit `.env`.
- Configure `APP_ORIGIN` to the exact HTTPS frontend URL.
- Enable HTTPS and set `TRUST_PROXY=1` only when the host is behind one trusted proxy.
- Put proof images on persistent storage; ephemeral container disks can lose uploads after redeploys.
- Configure database backups and test a restore.
- Run `npm test`, `npm run build`, and the browser checks after deployment.
- Create the first administrator with `npm run admin:grant` using the production database connection, then remove or restrict that operational access.

## Important limitation

The current app uses server-side Express sessions and MySQL. Keep the Node server and MySQL database online together. Supabase is not required for this deployment; migrating to Supabase would require changing the database layer, session storage, and migrations.
