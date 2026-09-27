# DINS by Daniyal — AI E-Commerce Website

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

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `npm run dev`        | Start the development server |
| `npm run build`      | Production build             |
| `npm run start`      | Serve the production build   |
| `npm run lint`       | Run ESLint                   |
| `npm run typecheck`  | Run TypeScript type checking |
| `npm test`           | Run tests (Vitest)           |
| `npm run test:watch` | Run tests in watch mode      |

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
components/   Reusable UI primitives, motion helpers and storefront features
lib/          Supabase clients, auth, validation, security, storefront config, utilities
services/     Centralized service layer (business logic)
supabase/     Database migrations and RLS
tests/        Unit, integration and E2E tests
```

Storefront presentation is separated from data: the homepage, category, product
and announcement configuration lives in `lib/storefront/` (types + mock data),
leaving a clean boundary to swap in Supabase-backed services later. Product
sections, cards, the hero, newsletter and footer live under
`components/storefront/`.

Business logic must live in the service layer, not in React components or AI
agents. All database access goes through the Supabase clients in `lib/supabase/`
and respects RLS. See `AGENTS.md` for the full architecture.

## Phases

The project is developed in phases (see `AGENTS.md` §64). Phase 1
established the foundation (design tokens, UI primitives, Supabase, security/
Guardian patterns). Phase 2 built the premium storefront: announcement bar,
navbar + menu, hero, overlapping Shop by Category, product sections/cards,
brand story, social gallery, newsletter and footer. Later phases add the
catalog backend, checkout, admin, AI workforce and WhatsApp automation.

## License

Proprietary. All rights reserved.
