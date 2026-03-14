# my_railway — Cloud Deployment Platform

> Open-source Railway.com clone. Deploy apps from git, provision databases, manage environments, monitor services.

## Tech Stack

- **Framework:** React Router v7 (framework mode — SSR + client)
- **UI:** shadcn/ui + Tailwind CSS v4
- **ORM:** Drizzle + SQLite (local) / Postgres (prod)
- **Runtime:** Node.js + Docker (via dockerode)
- **Proxy:** Traefik (reverse proxy, SSL, routing)
- **CLI:** Node.js (`myrailway` command)
- **Testing:** Vitest (unit) + BraveMCP (E2E browser tests)
- **Language:** TypeScript throughout

## Architecture

```
Types → DB/ORM → Services → API (loaders/actions) → UI (routes/components)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system layers.

## Directory Map

| Path                           | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `app/routes/`                  | React Router v7 file-based routes                |
| `app/components/`              | shadcn/ui primitives + custom components         |
| `app/components/ui/`           | shadcn base components                           |
| `app/lib/`                     | Server-side services (.server.ts) + shared utils |
| `app/lib/db.server.ts`         | Drizzle ORM setup + connection                   |
| `app/lib/docker.server.ts`     | Dockerode wrapper                                |
| `app/lib/deployer.server.ts`   | Build + deploy pipeline                          |
| `app/lib/networking.server.ts` | Reverse proxy management                         |
| `app/lib/auth.server.ts`       | Session-based auth                               |
| `drizzle/`                     | Database migrations                              |
| `cli/`                         | CLI tool (`myrailway`)                           |
| `tests/e2e/`                   | BraveMCP browser tests                           |

## Key Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System layers and module layout
- [docs/design-docs/](./docs/design-docs/) — Design decisions
- [docs/plans/](./docs/plans/) — Execution plans
- [docs/product-specs/](./docs/product-specs/) — Feature specifications

## Pre-Work Checklist

Before modifying code:

1. Read the relevant route/service code
2. Check `ARCHITECTURE.md` for dependency rules
3. Verify active plans in `docs/plans/`
4. Run `npm run typecheck && npm run lint && npm test`

## Quality Gates

- `npm run typecheck` — TypeScript strict mode
- `npm run lint` — ESLint
- `npm run format:check` — Prettier
- `npm test` — Vitest
- `npm run e2e` — BraveMCP E2E tests

## Conventions

- Validate at boundaries (API inputs), trust internally
- Server-only code uses `.server.ts` suffix
- Database access only through Drizzle queries in `.server.ts` files
- All API mutations go through React Router actions
- Data loading goes through React Router loaders
- Docker operations wrapped in `docker.server.ts` — never call dockerode directly from routes
- Environment variables validated at startup, not at use site
