# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Anchal Caterers is a Next.js 14 (App Router) event/catering management app with Hindi input support, recipe-to-ingredient auto-population, and print-ready layouts. Stack: TypeScript, Prisma 5 + PostgreSQL (Neon), Clerk auth, Tailwind CSS, Radix UI. Deployed on Vercel (no `vercel.json`, zero-config).

## Commands

- `npm run dev` — start dev server
- `npm run build` — runs `prisma generate` then `next build`
- `npm run lint` — `next lint` (default `eslint-config-next`, no custom rules)
- No test suite exists in this repo.
- The README references `npm run db:generate` / `db:push` / `db:studio` — these scripts do **not** exist in `package.json`. Use `npx prisma generate`, `npx prisma db push`, `npx prisma studio` directly instead.
- There is no `prisma/migrations` directory — schema changes are applied via `npx prisma db push`, not `prisma migrate`.

## Multiuser access control (critical)

This app has owner/staff roles (`User.role`, `User.ownerId` in `prisma/schema.prisma`). Staff accounts must see the **owner's** data, not their own. `src/lib/getEffectiveUserId.ts` resolves this:

```ts
getEffectiveUserId(dbUser) // returns dbUser.ownerId for staff, dbUser.id for owner
```

**Every API route that reads/writes user-scoped data must use `getEffectiveUserId(dbUser)` instead of `dbUser.id` directly**, or staff/owner data will leak or become isolated incorrectly.

## Auth

Clerk (`@clerk/nextjs`), wired in `src/middleware.ts` (note: middleware lives at `src/`, not the app root). Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`, `/api/health(.*)`; everything else requires `auth().protect()`. `src/app/api/webhooks/clerk/route.ts` syncs Clerk `user.created/updated/deleted` events into the Prisma `User` table by `clerkId` — must stay public. The middleware matcher excludes `.docx`/`.xlsx`/`.csv`/`.zip` extensions, which matters since the app generates Word/Excel exports (`docx`, `exceljs`).

## Workflow

- Git: no fixed rule — small fixes commit directly to `main`; larger changes get a branch/PR. Match whichever the change size calls for.
- `.env` holds `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, `DATABASE_URL` — no `.env.example` exists, so the README's env var list is the de facto template.
- `.github/workflows/backup.yml` runs a weekly `pg_dump` backup of `DATABASE_URL` — not a build/test CI, don't expect it to catch regressions.
