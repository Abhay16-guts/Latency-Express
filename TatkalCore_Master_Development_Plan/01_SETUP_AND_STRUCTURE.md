# Setup, Dependencies and Project Structure

## Prerequisites

Use a current Node.js LTS, Git, Docker Desktop, a PostgreSQL/Redis
environment, k6 and Antigravity.

Verify:

``` bash
git --version
node --version
npm --version
docker --version
docker compose version
```

## Repository

``` bash
mkdir tatkal-core
cd tatkal-core
git init
```

Recommended structure:

``` text
tatkal-core/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── types/
│   └── config/
├── infra/
│   ├── docker/
│   ├── prometheus/
│   └── grafana/
├── load-tests/
├── scripts/
├── docs/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
└── README.md
```

## Frontend

``` bash
npm create vite@latest apps/web -- --template react-ts
cd apps/web
npm install
npm install react-router-dom lucide-react zod @tanstack/react-query
```

Configure Tailwind using its current Vite documentation.

## Backend

``` bash
mkdir -p apps/api
cd apps/api
npm init -y
npm install fastify @fastify/cors @fastify/jwt @fastify/helmet zod pg ioredis bcrypt pino
npm install -D typescript tsx @types/node vitest eslint prettier
```

Optional ORM:

``` bash
npm install prisma @prisma/client
npx prisma init
```

Use one ORM strategy, not multiple.

## Environment

`.env`:

``` env
NODE_ENV=development
PORT=4000
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
CORS_ORIGIN=
LOG_LEVEL=info
```

Commit `.env.example`, never `.env`.

## Backend structure

``` text
src/
├── config/
├── plugins/
├── middleware/
├── modules/
│   ├── auth/
│   ├── trains/
│   ├── availability/
│   ├── bookings/
│   ├── queue/
│   ├── admin/
│   └── metrics/
├── db/
├── redis/
├── reservation/
├── concurrency/
├── errors/
├── utils/
├── app.ts
└── server.ts
```

## Frontend structure

``` text
src/
├── app/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── booking/
│   └── dashboard/
├── features/
│   ├── auth/
│   ├── trains/
│   ├── booking/
│   ├── queue/
│   └── admin/
├── layouts/
├── pages/
├── hooks/
├── lib/
├── services/
├── types/
├── styles/
└── main.tsx
```

## Git

Use `main` plus feature branches and PRs:

``` bash
git checkout -b feature/concurrency-locking
git add .
git commit -m "feat: add reservation transaction"
```

Commit examples: `feat:`, `fix:`, `test:`, `perf:`, `chore:`, `docs:`.

## First milestone

Frontend starts; backend starts; PostgreSQL and Redis connect; `/health`
works; frontend calls API; `.env` is ignored; Docker Compose works.
