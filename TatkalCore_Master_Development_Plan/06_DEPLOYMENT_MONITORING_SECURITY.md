# Deployment, Monitoring and Security

## Environments

Use at least: - development - staging Production can be added later.

## Local infrastructure

Docker Compose can run: - PostgreSQL - Redis - API - Prometheus -
Grafana

## Cloud model

``` text
React frontend
   ↓
Frontend hosting
   ↓ HTTPS
Fastify API
   ↓
Managed PostgreSQL
   +
Managed Redis
```

## Build

``` bash
npm run build
```

Run tests, typecheck and lint before deployment.

## Secrets

Use deployment environment variables. Never put secrets in Git,
Dockerfiles or frontend source.

## PostgreSQL

Prefer managed PostgreSQL. Configure backups, migrations, connection
limits, TLS/SSL and restricted credentials. Do not expose the database
publicly without a deliberate secure architecture.

## Redis

Prefer managed Redis. Configure authentication/TLS where supported,
memory policy and monitoring. Redis remains non-authoritative for seat
ownership.

## Health

Use `/health/live` and `/health/ready`. Liveness should not
unnecessarily fail just because a dependency is temporarily unavailable.

## Monitoring

Prometheus metrics: - request count - errors - request duration -
booking success/failure/conflict - queue length/wait - DB pool usage -
Redis operations

Grafana panels: - traffic - P50/P95/P99 - bookings - queue -
CPU/memory - DB connections - Redis - fairness

## Logging

Structured logs should contain timestamp, level, service, requestId,
route, status, duration and safe error codes. Never log passwords, JWT
secrets or sensitive tokens.

## Security

HTTPS, password hashing, JWT validation, RBAC, input validation,
request-size limits, rate limiting, secure CORS, security headers,
environment secrets, dependency updates and audit logs.

## CORS

Allow only expected frontend origins. Do not blindly allow `*` when
credentials are involved.

## Failure drills

Test backend restart, Redis restart, PostgreSQL restart, network
failure, bad environment variables, API unavailable, expired token and
partial deployment.

## Rollback

Record Git commit, migration version and deployment configuration.
Maintain a rollback plan.

## Performance caveat

Free tiers can become the bottleneck and distort research results.
Record CPU, RAM, database tier, Redis tier, region and network
conditions.

## Deployment checklist

HTTPS; env vars; migrations; backups; health checks; structured logs;
monitoring; CORS; rate limiting; RBAC; rollback; staging smoke test;
controlled load-test environment.
