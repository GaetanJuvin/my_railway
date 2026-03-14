# Architecture — my_railway

## System Overview

my_railway is an open-source cloud deployment platform (Railway.com clone). Users deploy apps from git repositories, provision databases, manage environment variables, configure networking, and monitor services — all through a web dashboard or CLI.

## Layers (top → bottom)

```
┌─────────────────────────────────────────────┐
│  UI Layer — React Router v7 routes          │
│  (routes/, components/, shadcn/ui)          │
├─────────────────────────────────────────────┤
│  API Layer — Loaders + Actions              │
│  (data fetching, mutations, validation)     │
├──────────┬──────────┬───────────────────────┤
│  Deploy  │ Database │  Networking           │
│  Service │ Service  │  Service              │
├──────────┴──────────┴───────────────────────┤
│  Runtime Backend — Docker (dockerode)       │
├─────────────────────────────────────────────┤
│  Data Layer — Drizzle ORM + SQLite/Postgres │
├─────────────────────────────────────────────┤
│  Types — Shared type definitions            │
└─────────────────────────────────────────────┘

External:
┌─────────────┐  ┌─────────────┐  ┌──────────┐
│  Traefik    │  │  Docker     │  │  Git     │
│  (proxy)    │  │  Engine     │  │  (repos) │
└─────────────┘  └─────────────┘  └──────────┘
```

## Dependency Rules

- **Down only:** Each layer depends on layers below, never above
- **Routes** depend on services (via loaders/actions), never on Docker/DB directly
- **Services** depend on runtime backend + data layer
- **Runtime backend** depends on Docker only
- **Data layer** depends on Drizzle only
- **Types** depend on nothing internal

## Module Responsibilities

### UI Layer (`app/routes/`, `app/components/`)
- React Router v7 file-based routing
- shadcn/ui components for consistent design
- Real-time updates via WebSocket (deploy logs, metrics)
- No business logic — delegates to loaders/actions

### API Layer (loaders + actions in route files)
- Input validation (zod schemas)
- Auth checks
- Calls service layer
- Returns typed data to components

### Deploy Service (`app/lib/deployer.server.ts`)
- Git clone → Dockerfile detection → Docker build → container start
- Build log streaming via WebSocket
- Rollback (restart previous container image)
- Environment variable injection

### Database Service (`app/lib/databases.server.ts`)
- Provision Postgres/Redis/MySQL containers
- Generate connection strings
- Expose to linked services via env vars
- Backup/restore

### Networking Service (`app/lib/networking.server.ts`)
- Traefik dynamic configuration
- Public URL generation (subdomain-based)
- Custom domain + SSL via Let's Encrypt
- Private service-to-service networking (Docker network)

### Runtime Backend (`app/lib/docker.server.ts`)
- Thin wrapper around dockerode
- Container lifecycle: create, start, stop, remove, logs
- Image management: build, pull, tag
- Network management: create, connect, disconnect
- Volume management

### Data Layer (`app/lib/db.server.ts`, `drizzle/`)
- Drizzle ORM with typed schemas
- Migrations in `drizzle/` directory
- SQLite for local dev, Postgres for production

### CLI (`cli/`)
- `myrailway login` — authenticate
- `myrailway deploy` — trigger deploy from current dir
- `myrailway up` — deploy + stream logs
- `myrailway logs` — tail service logs
- `myrailway env` — manage environment variables
- `myrailway link` — link local dir to project/service

## Data Model (core entities)

```
User
  └── Project (has many)
        ├── Service (has many)
        │     ├── Deployment (has many)
        │     ├── EnvVar (has many)
        │     └── Domain (has many)
        ├── Database (has many)
        │     └── Backup (has many)
        └── Environment (has many: staging, production, preview)
```

## Deployment Pipeline

```
Git Push / Manual Trigger
  → Clone repo into temp dir
  → Detect Dockerfile (or generate from buildpacks)
  → Docker build (stream logs via WebSocket)
  → Tag image: myrailway/{service}:{deploy-id}
  → Stop old container (if exists)
  → Start new container with env vars + networking
  → Update Traefik routing
  → Health check
  → Mark deployment as active (or rollback on failure)
```

## Networking Model

```
Internet → Traefik (port 80/443)
             ├── app-abc.local.railway → container:3000
             ├── api-xyz.local.railway → container:8080
             └── custom.example.com   → container:3000

Internal Docker Network (myrailway-internal):
  service-a ↔ service-b (via container name DNS)
  service-a → postgres-db (via Docker network alias)
```

## Security Boundaries

- Auth required for all dashboard routes and API endpoints
- Docker socket access is server-side only (.server.ts)
- Environment variables encrypted at rest in database
- No direct container access from client — all through API layer
- CLI authenticates via API token
