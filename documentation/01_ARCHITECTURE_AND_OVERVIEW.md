# 01. Architecture and System Overview

## 1. Executive Summary

**Latency Express** is a high-concurrency railway reservation prototype engineered to simulate and solve extreme burst demand scenarios (analogous to the Indian Railways Tatkal ticket rush at 10:00 / 11:00 AM). In these high-contention spikes, thousands of concurrent requests target a scarce pool of inventory within milliseconds.

Unlike standard e-commerce applications where overbooking can occasionally be reconciled offline, railway reservation requires **absolute zero double-booking tolerance**, **strict sub-second transaction atomicity**, and **measurable fairness** to prevent request starvation.

---

## 2. Core Problem Statement

During high-demand flash reservation events:
1. **Seat Contention**: Hundreds of requests attempt to claim the identical berth simultaneously.
2. **Database Overload**: If unthrottled traffic hits PostgreSQL directly, connection pool exhaustion, CPU saturation, and cascading transaction timeouts trigger complete service outage.
3. **Double-Clicking & Network Uncertainty**: Users resubmitting requests due to packet latency risk duplicate financial charges and duplicate seat reservations.
4. **Queue Inequity**: Naive FIFO or unordered processing can unfairly penalize users with slightly higher network jitter, or starve users behind stalled transactions.

---

## 3. High-Level Architecture

Latency Express adopts a **hybrid two-tier architecture** separating *authoritative state persistence* from *high-throughput traffic regulation*:

```
                           +------------------------------------+
                           |        Client Layer (Web UI)       |
                           | React 19 + TypeScript + Vite +     |
                           | TanStack Query + Tailwind CSS      |
                           +-----------------+------------------+
                                             | HTTP / REST + JWT
                                             v
                           +------------------------------------+
                           |        API Gateway Layer           |
                           |     Fastify (Node.js 24 LTS)       |
                           |  Helmet, CORS, Pino Tracing        |
                           +--------+------------------+--------+
                                    |                  |
           +------------------------+                  +------------------------+
           | Token Bucket Rate Limit                   | Real-time Metrics
           v                                           v
+-----------------------+                   +-----------------------+
|  Admission Control    |                   | Prometheus & Metrics  |
|  Redis Lua Scripting  |                   | prom-client Collector |
|  - ACCEPT (Fast-path) |                   +-----------------------+
|  - QUEUE  (Buffer)    |                              ^
|  - REJECT (Shed load) |                              | Scrapes
+-----------+-----------+                   +----------+------------+
            |                               |    Live Dashboard     |
            | If QUEUED                     | Admin & Research UI   |
            v                               +-----------------------+
+-----------------------+
|     Redis Queue       |
| FIFO / Fair Scheduler |
+-----------+-----------+
            |
            | Dequeued Worker Flow / Direct ACCEPT
            v
+---------------------------------------------------------------+
|                      Reservation Engine                       |
|           PostgreSQL 16 Authoritative ACID Storage            |
|                                                               |
|  BEGIN TRANSACTION;                                           |
|  SELECT * FROM seats WHERE id = $1 FOR UPDATE;                |
|  -- Verify availability, check idempotency hash                |
|  -- Insert booking, passenger details, payment record         |
|  -- Update seat status to 'BOOKED'                            |
|  COMMIT;                                                      |
+---------------------------------------------------------------+
```

---

## 4. Separation of Responsibilities

| Subsystem | Technology | Responsibility | Authority Level |
| :--- | :--- | :--- | :--- |
| **Authoritative Store** | PostgreSQL 16 | Seat inventory, passenger details, booking state, idempotency keys, financial audit trails. | **Authoritative (Source of Truth)** |
| **Traffic Coordinator** | Redis 8.x | Token-bucket rate limiting, admission control, priority queuing, temporary lock coordination, session cache. | Non-Authoritative (Transient Buffer) |
| **API & Business Logic**| Fastify / TypeScript | Request validation (Zod), JWT authentication, transaction demarcation, queue dispatch, error normalization. | Orchestrator |
| **Client Interface** | React / Vite | Interactive seat map, responsive reservation flow, queue waiting room, live telemetry dashboard. | Presentation |
| **Observability** | Prometheus / Pino | Structured JSON logs with `requestId`, latency percentiles (P50, P95, P99), throughput (RPS), fairness metrics. | Telemetry |

---

## 5. Architectural Principles & Invariants

1. **PostgreSQL is the Sole Authority**: Redis state must never confirm a booking. A booking is confirmed *if and only if* PostgreSQL commits the transaction. If Redis experiences catastrophic failure, the database remains completely uncorrupted.
2. **Never Trust Client Availability**: Cached availability displayed on the frontend is purely informational. Every reservation re-validates seat status inside an explicit database row lock.
3. **Strict Zero Double-Booking Invariant**: Under no circumstance can two distinct users hold a confirmed status for the same `seat_id` on the same `schedule_id`.
4. **Idempotency Guarantees**: Repeating a request with the same `Idempotency-Key` must return the identical result without re-executing transactions.
5. **Controlled Load Shedding**: When concurrency exceeds the database connection capacity, the system sheds load with structured `429 Too Many Requests` or queues users gracefully rather than failing with unhandled 500 crashes.
