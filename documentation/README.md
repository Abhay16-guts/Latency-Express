# Latency Express — Technical Documentation Suite

Welcome to the comprehensive technical documentation for **Latency Express**, an industry-standard, high-concurrency railway reservation prototype engineered for extreme demand spikes.

---

## Documentation Index

1. [**01. Architecture & System Overview**](./01_ARCHITECTURE_AND_OVERVIEW.md)
   - Problem statement and high-concurrency Tatkal dynamics
   - Component responsibilities & data flow
   - Architectural invariants & zero-double-booking guarantees

2. [**02. Database Schema & Models**](./02_DATABASE_SCHEMA_AND_MODELS.md)
   - Complete Entity Relationship Diagram (ERD)
   - Table definitions, foreign key constraints & unique indexes
   - State machine lifecycles and idempotency tables

3. [**03. Concurrency, Locking & Transaction Safety**](./03_CONCURRENCY_AND_LOCKING.md)
   - Race condition anatomy & write contention analysis
   - PostgreSQL `SELECT ... FOR UPDATE` row locking
   - Deadlock prevention and sorted lock acquisition
   - Idempotency key mechanics and SHA-256 payload hashing

4. [**04. Admission Control, Rate Limiting & Fair Queuing**](./04_ADMISSION_CONTROL_AND_QUEUING.md)
   - Token-bucket rate limiting via Redis
   - 3-tier dynamic admission states (`ACCEPT`, `QUEUE`, `REJECT`)
   - Fair queuing algorithms & Jain's Fairness Index mathematical formulation

5. [**05. REST API Reference Specification**](./05_API_REFERENCE.md)
   - Authentication, train search, real-time availability
   - Transactional booking requests with `Idempotency-Key`
   - Queue telemetry and live metrics endpoints
   - Standardized error codes and HTTP response envelopes

6. [**06. Research Methodology, Benchmarking & Fairness Metrics**](./06_RESEARCH_METHODOLOGY_AND_BENCHMARKS.md)
   - 6 comparative architectural configurations (DB-only through Fair Queue)
   - Workload modeling (Baseline, Spike, Soak)
   - Automated reproducibility protocols and telemetry schemas

7. [**07. Setup, Operations & Runbook**](./07_SETUP_AND_OPERATIONS_RUNBOOK.md)
   - Local prerequisites, setup commands, environment variables
   - Database migrations & seeding
   - Concurrency testing commands and failure recovery drills
