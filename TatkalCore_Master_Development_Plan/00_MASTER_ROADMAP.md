# TatkalCore --- Master Roadmap

## Goal

Build TatkalCore as a research-oriented high-concurrency railway
reservation prototype inspired by Tatkal-like demand spikes. It is not
an IRCTC clone and does not modify the real IRCTC system.

## Core question

How can limited-seat reservation remain consistent, reliable, performant
and measurable under extreme concurrent demand?

## Stack

React + TypeScript + Tailwind CSS; Node.js + TypeScript + Fastify;
PostgreSQL; Redis; JWT; k6; Prometheus; Grafana; Docker; Git/GitHub.

## Source of truth

PostgreSQL owns seat ownership and booking state. Redis handles
queueing, admission control, rate limiting and temporary coordination.

## Build order

1.  Understand transactions, race conditions, locking, queues,
    idempotency, fairness and P95/P99.
2.  Install Git, Node LTS, Docker, PostgreSQL/Redis or Docker
    equivalents, k6 and Antigravity.
3.  Create monorepo.
4.  Build API/frontend shells and health checks.
5.  Design database and migrations.
6.  Implement authentication, trains, routes and availability.
7.  Implement basic booking and simulated payment.
8.  Add PostgreSQL transactions and row locking.
9.  Add idempotency and retry safety.
10. Add Redis, rate limiting, admission control and queue.
11. Add fairness measurement and Jain's Fairness Index.
12. Build responsive frontend and system dashboard.
13. Add Prometheus/Grafana.
14. Run unit, integration, concurrency, failure and k6 tests.
15. Compare DB-only, locking, Redis, queue, admission-control and
    fair-queue configurations.
16. Deploy a staging environment.
17. Produce reproducible research data, graphs, report, paper, PPT and
    viva material.

## Definition of done

Booking works; double booking is prevented; retries are safe;
queue/admission/fairness work; UI is responsive; errors and loading
states exist; monitoring works; experiments are reproducible; deployment
works; conclusions use measured data only.
