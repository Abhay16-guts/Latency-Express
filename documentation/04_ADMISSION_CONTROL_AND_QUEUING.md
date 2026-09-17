# 04. Admission Control, Rate Limiting and Fair Queuing

## 1. High-Concurrency Traffic Regulation

While database transactions guarantee consistency, admitting unlimited concurrent connections to PostgreSQL during a Tatkal burst will saturate the database connection pool, exhaust server memory, and spike P99 latency into dozens of seconds.

**Latency Express** incorporates an upstream **Redis-powered Admission Control & Queuing Subsystem** that shields the database while ensuring fair customer experience.

---

## 2. Multi-Tier Traffic Pipeline

```
Inbound HTTP Traffic
        │
        ▼
[ 1. IP & User Rate Limiter ] ───(Exceeded)───> HTTP 429 "Too Many Requests"
        │ (Passed)
        ▼
[ 2. Dynamic Admission Control ]
        ├── Capacity < Soft Limit (e.g. < 50 req/sec active)
        │       └──> Outcome: ACCEPT (Direct Transaction Execution)
        │
        ├── Capacity between Soft & Hard Limits
        │       └──> Outcome: QUEUE  (Enqueue in Redis FIFO/Fair Queue)
        │
        └── Queue Buffer Exceeded (> Max Queue Length)
                └──> Outcome: REJECT (HTTP 503 / 429 "High Demand - Please Retry")
```

---

## 3. Token Bucket Rate Limiting

Implemented via Redis atomic operations using token buckets per IP and per authenticated User ID:
- **Bucket Capacity**: 100 requests.
- **Refill Rate**: 20 tokens / second.
- **Tatkal Route Burst Allowance**: Specific booking endpoints have stricter burst quotas (5 booking attempts per minute per user).

---

## 4. The 3-Tier Admission Control Engine

When a booking request hits `/api/v1/bookings`:
1. **ACCEPT (Fast-Path)**:
   - Evaluates active in-flight database transactions.
   - If active workers < concurrency threshold (e.g., 25), request bypasses queue and processes immediately.
2. **QUEUE (Controlled Buffer)**:
   - If database is running at target concurrency, the user is issued a `Queue Ticket` (`ticket_id`, position, estimated wait, timestamp).
   - Ticket is enqueued into a Redis Sorted Set keyed by arrival timestamp.
   - Client polls `/api/v1/queue/position?ticketId=...` or listens to updates.
   - Background worker drains the queue at calibrated rate (e.g., 20 tickets/sec) matching PostgreSQL connection pool throughput.
3. **REJECT (Load Shedding)**:
   - If the queue length exceeds maximum buffer capacity (e.g., 2,000 waiting requests), excess requests are dropped gracefully with `429 System Busy`.

---

## 5. Fair Queuing vs. Simple FIFO

### Problem with Raw FIFO
In real-world networks, users with ultra-low latency connections (bots or colocated servers) submit rapid repeated bursts, monopolizing early queue slots and starving human users on mobile networks.

### Latency Express Fair Queue Algorithm
The fair queue mechanism tracks:
- User history / attempt frequency.
- Client arrival time normalized by connection round-trip latency.
- Deficit Round Robin (DRR) or Virtual Time fair scheduling across user categories, preventing single actors from flooding the queue.

---

## 6. Measuring Fairness: Jain's Fairness Index

To scientifically quantify whether system access is distributed fairly, Latency Express computes **Jain's Fairness Index** ($J$):

$$J(x_1, x_2, \dots, x_n) = \frac{\left( \sum_{i=1}^n x_i \right)^2}{n \cdot \sum_{i=1}^n x_i^2}$$

Where:
- $n$: Total number of participating users.
- $x_i$: Ratio of allocated service time to expected arrival time (or allocation success metric for user $i$).
- $J \in [1/n, 1.0]$:
  - $J = 1.0$: Absolute perfect fairness (every user receives equitable queue turnaround).
  - $J \to 1/n$: Total unfairness (one user monopolizes all seat allocations).
