# dINS by Daniyal — AI E-Commerce Website

A production-grade AI-powered e-commerce platform for a premium Pakistani
fashion/clothing brand.

> **Source of truth:** Read `AGENTS.md` before any task. It defines the
> project rulebook, security principles, architecture and phased plan.

## Tech Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4
- Framer Motion, Lucide React
- React Hook Form + Zod
- Supabase (PostgreSQL, Auth, Storage, RLS)
- OpenAI Agents SDK (future AI orchestration)
- Vitest + Testing Library (tests)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the development server         |
| `npm run build`      | Production build                     |
| `npm run start`      | Serve the production build           |
| `npm run lint`       | Run ESLint                           |
| `npm run typecheck`  | Run TypeScript type checking         |
| `npm test`           | Run tests (Vitest)                   |
| `npm run test:watch` | Run tests in watch mode              |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values.

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Never commit `.env.local` or real secrets. Service-role credentials must never
reach the browser.

## Supabase Setup

1. Create a Supabase project.
2. Configure Supabase Auth (email/password and, optionally, Google OAuth).
3. Run the migrations in `supabase/migrations/` on your database.
4. Apply the RLS policies (included in the migration).
5. Add your project URL and keys to `.env.local`.

The foundation migration creates a `profiles` table with role-based
authorization, an auto-create trigger on signup, and RLS policies that keep
users scoped to their own data and admins able to read all profiles.

## Architecture

The codebase is organized so later phases (AI Manager, AI Employees, Skills,
Guardians, Tools, WhatsApp) can integrate cleanly.

```text
app/          App Router routes, layouts, error/loading/not-found boundaries
components/   Reusable UI and feature components
lib/          Supabase clients, auth, validation, security, utilities
services/     Centralized service layer (business logic)
supabase/     Database migrations and RLS
tests/        Unit, integration and E2E tests
```

Business logic must live in the service layer, not in React components or AI
agents. All database access goes through the Supabase clients in `lib/supabase/`
and respects RLS. See `AGENTS.md` for the full architecture.

## Phases

The project is developed in phases (see `AGENTS.md` §64). Phase 1 establishes
the foundation; later phases add the storefront, products, checkout, admin,
AI workforce and WhatsApp automation.

## License

Proprietary. All rights reserved.
