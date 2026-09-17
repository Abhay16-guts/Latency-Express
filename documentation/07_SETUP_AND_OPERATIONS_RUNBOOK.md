# 07. Setup, Operations and Runbook

## 1. Local Development Prerequisites

Ensure the following runtimes are installed on your host:
- **Node.js**: >= 20.0.0 LTS (Node 24 LTS verified)
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 15 (PostgreSQL 16 recommended)
- **Redis**: >= 7.0 (Redis 8.x recommended)
- **Git**

---

## 2. Quickstart Guide

### 2.1 Clone & Install Dependencies
```bash
cd "Latency Express"
npm install
```

### 2.2 Environment Configuration
Copy `.env.example` to `.env` in `apps/api`:
```bash
cp apps/api/.env.example apps/api/.env
```

Default configuration values:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://localhost:5432/latency_express_dev
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=super_secret_jwt_key_latency_express_2026_dev
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

### 2.3 Database Initialization & Seeding
```bash
# Create local database if not present
createdb latency_express_dev

# Run database migrations and populate seed data
npm run db:setup
```

### 2.4 Start Development Services
Run frontend and backend concurrently in workspace mode:
```bash
npm run dev
```
- **Web UI**: `http://localhost:5173`
- **Fastify API**: `http://localhost:4000`
- **Health Check**: `http://localhost:4000/health`
- **Live System Metrics**: `http://localhost:4000/admin/metrics`

---

## 3. Running Automated Tests & Concurrency Benchmarks

### 3.1 Unit & Integration Tests
```bash
npm test
```

### 3.2 Concurrency Race-Condition Verification
Simulates 50 simultaneous workers competing for a single seat:
```bash
npm run test:concurrency
```
**Expected Outcome**: Exactly 1 booking succeeds (HTTP 201), 49 requests receive HTTP 409 Conflict, and 0 duplicate rows are created in the database.

### 3.3 Benchmarking Comparison Across Architectures
Runs the multi-architecture comparison suite:
```bash
npm run test:benchmark
```

---

## 4. Health Checks & Diagnostics

| Endpoint | Method | Expected Output | Purpose |
| :--- | :--- | :--- | :--- |
| `/health` | GET | `{"status":"ok"}` | Fast container/pod liveness check |
| `/health/ready` | GET | `{"status":"ok","postgres":"connected","redis":"connected"}` | Deep readiness check |
| `/health/live` | GET | `{"status":"alive","uptime":1284}` | Process uptime check |

---

## 5. Failure Drills & Disaster Recovery

### Scenario A: Redis Crash
1. Stop Redis: `brew services stop redis`
2. Attempt bookings:
   - System drops to safe fallback mode or yields structured `503 Service Unavailable` rather than bypassing admission control and overwhelming PostgreSQL.
3. Restart Redis: `brew services start redis`
4. Verify auto-reconnect in logs.

### Scenario B: Database Pool Starvation
1. If PostgreSQL max connections is exceeded, Fastify pool queuing gracefully rejects queued transactions beyond `connectionTimeoutMillis` with `503 Database Busy`, preventing memory crashes.
