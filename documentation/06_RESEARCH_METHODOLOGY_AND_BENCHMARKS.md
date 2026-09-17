# 06. Research Methodology, Benchmarking and Fairness Metrics

## 1. Research Objectives

The core question of the Latency Express research framework is:
> *How can limited-seat reservation remain consistent, reliable, performant, and measurable under extreme concurrent demand spikes?*

To answer this scientifically, Latency Express provides an automated experimental test harness that executes repeatable load workloads across **six distinct architectural configurations**.

---

## 2. Tested Architectural Configurations

| ID | Configuration Name | Write Handling | Read Caching | Overload Protection |
| :---: | :--- | :--- | :--- | :--- |
| **A** | **DB-Only (Baseline)** | Unlocked SQL `UPDATE` | None | None |
| **B** | **DB + Row Locking** | `SELECT ... FOR UPDATE` | None | None |
| **C** | **Redis + DB** | `SELECT ... FOR UPDATE` | Redis Read Cache | None |
| **D** | **Queue + DB** | Worker Sequential Ingestion | None | Queue Buffer |
| **E** | **Admission Control + Queue + DB** | Dynamically Routed (`ACCEPT`/`QUEUE`) | Redis Read Cache | Active Load Shedding |
| **F** | **Fair Queue + Admission + DB** | Fair Scheduler (DRR / Latency-normalized) | Redis Read Cache | Fair Load Shedding |

---

## 3. Workload Models

Using both custom high-concurrency Node.js test harnesses and k6 scripts, we subject each configuration to standardized workloads:

```
Concurrency (Active Users)
     ▲
1000 ┼                  ╭──────────────╮
 800 ┼                 ╭╯              ╰╮
 600 ┼                ╭╯                ╰╮
 400 ┼     ╭──────────╯                  ╰──────────╮
 200 ┼────╭╯                                        ╰────
   0 ┴────┴────────────┴────────────────┴───────────┴────► Time
       Baseline      Ramp-up          Spike / Peak       Soak
```

- **Baseline**: 50 concurrent users (smooth continuous traffic).
- **Ramp-up**: Quick escalation to 500 users over 5 seconds.
- **Tatkal Spike**: 1,000+ simultaneous requests targeting 50 available seats within a 500ms window.
- **Soak**: Sustained load testing memory leaks and connection pool stability.

---

## 4. Key Performance Indicators (KPIs)

1. **Throughput**: Completed requests per second (RPS).
2. **Latency Percentiles**: P50, P95, and P99 response times (measured in milliseconds).
3. **Double-Booking Count**: Total instances where multiple users were confirmed for the exact same seat. *(Must strictly be 0 for any viable architecture!)*
4. **Error Distribution**:
   - HTTP 409 (Seat Contention / Expected Business Conflict)
   - HTTP 429 (Controlled Throttling / Load Shedding)
   - HTTP 500 / 503 (Database crash / Uncontrolled timeout failure)
5. **Jain's Fairness Index ($J$)**:
   Quantitative index measuring whether the queue served users equitably or starved trailing connections.

---

## 5. Jain's Fairness Index Calculation

For $n$ competing users where $x_i$ represents the normalized turnaround latency (or allocation ratio):

$$J = \frac{\left( \sum_{i=1}^n x_i \right)^2}{n \cdot \sum_{i=1}^n x_i^2}$$

- **Input Data**: Recorded arrival timestamps vs completion timestamps for each transaction.
- **Interpretation**:
  - $J \approx 1.0$: Highly equitable queue processing regardless of client network variation.
  - $J < 0.6$: Substantial queue jumping or head-of-line starvation.

---

## 6. Reproducibility Protocol

All benchmark runs log an immutable experimental artifact:
```json
{
  "experimentId": "exp_20260917_fair_queue_1000users",
  "configuration": "FAIR_QUEUE_ADMISSION_DB",
  "concurrency": 1000,
  "durationSeconds": 30,
  "totalRequests": 14820,
  "successfulBookings": 50,
  "contentionConflicts409": 950,
  "shedRequests429": 13820,
  "serverErrors500": 0,
  "doubleBookings": 0,
  "latencyMs": { "p50": 18.4, "p95": 86.2, "p99": 142.1 },
  "jainsFairnessIndex": 0.942,
  "timestamp": "2026-09-17T10:30:00Z"
}
```
Scripts in `./load-tests/` automate this protocol for one-click verification.
