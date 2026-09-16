# SaaS Multi-Tenant Platform

A production-grade multi-tenant SaaS application. Multiple organizations live inside one
PostgreSQL database, each with isolated members, roles, and settings. Users can belong to
several organizations and switch between them without logging out.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Zustand, TanStack Query, TailwindCSS
- **Backend:** NestJS 10, TypeScript, Prisma 5, PostgreSQL, JWT + rotating refresh tokens
- **Auth:** argon2id password hashing, HttpOnly refresh cookie, short-lived access JWT
- **Dev infra:** Docker Compose (PostgreSQL 16 + Redis 7), pnpm workspaces, Turborepo

## Repository Layout

```
apps/
  api/       NestJS backend (port 3000)
  web/       Next.js frontend (port 3001)
packages/
  shared/    Shared types, enums, and zod validation schemas
```

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Docker Desktop (for PostgreSQL and Redis)

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the database and Redis:

   ```bash
   docker compose up -d
   ```

3. Copy environment files:

   ```bash
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env.local
   # then edit them to taste
   ```

4. Run migrations and seed:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```


5. Start both apps:

   ```bash
   pnpm dev
   ```

   - API: http://localhost:3000/api
   - Web: http://localhost:3001

Or run them individually with `pnpm dev:api` and `pnpm dev:web`.

## Auth Model

- **Access token:** JWT, 15-minute lifetime, stored in memory (Zustand) only.
- **Refresh token:** random 48-byte hex, 7-day lifetime, stored as SHA-256 in the DB and in an
  HttpOnly cookie. Rotated on every use; a reused revoked token revokes the whole family.
- **Active organization** is embedded in the access token, so every request is tenant-scoped
  from the JWT — never from client input.

## Roles

| Role          | Scope       | Notes                                   |
| ------------- | ----------- | --------------------------------------- |
| SUPER_ADMIN   | Global flag | Platform-wide access, seeded only       |
| ORG_ADMIN     | Membership  | Manage members, invites, org settings   |
| ORG_USER      | Membership  | Read/write business data                |
| MEMBER        | Membership  | Read-only / limited                     |

## Key Endpoints

```
POST /api/auth/register           POST /api/auth/switch-org
POST /api/auth/login              POST /api/auth/forgot-password
POST /api/auth/refresh            POST /api/auth/reset-password
POST /api/auth/logout             GET  /api/auth/me

GET|POST /api/orgs                PATCH|DELETE /api/orgs/:id
GET /api/orgs/:id/members         PATCH|DELETE /api/orgs/:orgId/members/:userId
POST /api/orgs/:orgId/invitations DELETE /api/orgs/:orgId/invitations/:id

GET  /api/invitations/:token      POST /api/invitations/:token/accept

GET /api/admin/organizations      GET /api/admin/users      GET /api/admin/audit-logs
```

## Security

- Passwords hashed with argon2id (password min 8 chars with complexity rules).
- DTOs validated with class-validator, `whitelist: true`, `forbidNonWhitelisted: true`.
- Rate limiting (10/min) on register, login, forgot-password; global throttler elsewhere.
- JWT strategy re-checks DB membership on every request — removal is effective immediately.
- Every tenant-scoped query filters by `organizationId` from the JWT.
- CORS locked to the Next.js origin with credentials.
- Sensitive actions write to the audit log.

## Scripts

| Command           | Action                                  |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | Run API and web in watch mode           |
| `pnpm build`      | Build all packages                      |
| `pnpm lint`       | Typecheck all packages                  |
| `pnpm db:migrate` | Apply Prisma migrations                 |
| `pnpm db:seed`    | Seed super admin + demo org             |
| `pnpm db:reset`   | Drop, re-migrate, and re-seed the DB    |
| `pnpm db:studio`  | Open Prisma Studio                       |