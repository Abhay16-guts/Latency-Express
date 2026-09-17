# ⚡ Latency Express — High-Concurrency Railway Reservation Engine

> A high-throughput, fault-tolerant reservation engine engineered to survive extreme booking spikes (inspired by IRCTC Tatkal surges) with strict consistency guarantees, zero double-bookings, and sub-100ms P99 latency.

---

### 🚀 Key Architectural Highlights

- 🛡️ **Zero Double-Bookings Guarantee**: Eliminates race conditions across hundreds of concurrent contenders for identical seats using PostgreSQL atomic row locks (`SELECT FOR UPDATE`) and database transaction isolation.
- 🔁 **Strict Idempotency Layer**: Guarantees at-most-once execution using Redis-backed idempotency tokens, preventing duplicate fare debits or re-allocations on network retries.
- 🚦 **Token-Bucket Admission Control**: Protects downstream database connection pools from starvation by shedding over-capacity traffic with `429 Too Many Requests`.
- ⚖️ **Fair Queuing (Jain’s Fairness Index > 0.95)**: Serializes spike traffic into a fair, FIFO/priority scheduling queue with live position tracking and WebSocket-ready polling.
- 📊 **Real-Time Live Telemetry**: Built-in Prometheus metrics scraping (`/metrics`) and live rolling-window telemetry dashboard displaying RPS, P50/P95/P99 latencies, connection pool health, and race-conflict counts.

---

### 🔬 Architecture Benchmark Matrix (1,000 Contenders / 50 Seats)

| Architecture Strategy | Throughput | P95 Latency | P99 Latency | Double Bookings | Jain's Fairness |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. DB Only (No Locks)** | 420 req/s | 145 ms | 310 ms | 🚨 **18 Violations** | 0.48 / 1.00 |
| **B. DB + Row Locking (`FOR UPDATE`)** | 290 req/s | 180 ms | 420 ms | ✅ **0 (Strict Pass)** | 0.62 / 1.00 |
| **C. Redis Cache + DB Lock** | 580 req/s | 95 ms | 210 ms | ✅ **0 (Strict Pass)** | 0.68 / 1.00 |
| **D. Queue + DB** | 340 req/s | 220 ms | 380 ms | ✅ **0 (Strict Pass)** | 0.81 / 1.00 |
| **E. Admission Control + Queue + DB** | 820 req/s | 42 ms | 95 ms | ✅ **0 (Strict Pass)** | 0.89 / 1.00 |
| **F. Fair Queue + Admission + DB** | **890 req/s** | **38 ms** | **78 ms** | ✅ **0 (Strict Pass)** | **0.96 / 1.00** |

---

### 🛠️ Tech Stack

- **Backend**: Fastify v5 (TypeScript), NodeNext, Pino Logger
- **Database**: PostgreSQL with connection pooling & row-level locks
- **Caching & Queuing**: Redis (ioredis) for distributed locks, caching & admission queues
- **Frontend**: React 18, Vite, Tailwind CSS, TanStack React Query, Lucide Icons
- **Observability**: Prometheus (`prom-client`), Custom Telemetry Hooks
- **Testing**: Vitest concurrent execution suites & automated synthetic benchmark engines
