# Testing, Load Experiments and Research Methodology

## Testing pyramid

Use unit + API/integration + E2E. Manual testing alone is insufficient.

## Unit tests

Validation, queue ordering, fairness calculations, state transitions,
admission decisions and rate-limit decisions.

## Integration tests

API + PostgreSQL, API + Redis, booking transaction, idempotency, queue
processing, authentication and authorization.

## Critical concurrency test

Send many simultaneous requests for one seat. Verify that at most one
successful ownership claim occurs.

## Idempotency tests

-   same key + same request
-   same key + different request
-   retry after timeout
-   concurrent same-key requests

## Failure tests

PostgreSQL unavailable, Redis unavailable, network timeout, worker
crash, duplicate request, stale availability and expired authentication.

## k6 workloads

Start with 100, 500 and 1,000 concurrent users, then increase only if
the environment can support it.

Workload types: - baseline - ramp - spike - stress - soak

Tatkal-like example:

``` text
normal → rapid ramp → extreme demand → recovery
```

The chosen numbers are experimental workloads, not real railway traffic
claims.

## Configurations

A. DB only B. DB + row locking C. Redis + DB D. Queue + DB E. Admission
control + queue + DB F. Fair queue + admission control + DB

## Metrics

Performance: throughput, average, P50, P95, P99 latency. Reliability:
errors, timeouts, failed bookings, duplicate attempts, double-booking
count. Resources: CPU, memory, DB connections, Redis operations.
Fairness: queue waiting time, successful allocation distribution, Jain's
Fairness Index.

## Jain's Fairness Index

``` text
              (Σ xi)²
J = -------------------------
        n × Σ(xi²)
```

Define `xi` before experiments and keep it consistent. Jain's index is a
quantitative measure, not the complete definition of fairness.

## Experimental controls

Keep hardware, dataset, workload mix, duration, environment and
application version as constant as practical. Change the mechanism under
investigation.

## Repeated runs

Run important experiments multiple times. Record variation and anomalies
rather than relying on one run.

## Data record

``` text
experiment_id
configuration
concurrency
duration
throughput
p50
p95
p99
errors
timeouts
double_bookings
queue_wait
cpu
memory
db_connections
redis_usage
fairness_index
git_commit
timestamp
```

## Results table

Use measured values only: \| Configuration \| Throughput \| P95 \| P99
\| Errors \| Double Booking \| Fairness \|
\|---\|---:\|---:\|---:\|---:\|---:\|---:\| \| DB only \| measured \|
measured \| measured \| measured \| measured \| measured \| \| DB + lock
\| measured \| measured \| measured \| measured \| measured \| measured
\| \| Redis + DB \| measured \| measured \| measured \| measured \|
measured \| measured \| \| Queue + DB \| measured \| measured \|
measured \| measured \| measured \| measured \| \| Admission + Queue \|
measured \| measured \| measured \| measured \| measured \| measured \|
\| Fair Queue + Admission \| measured \| measured \| measured \|
measured \| measured \| measured \|

## Research conclusion

Do not decide the winner before testing. Explain what improved, what
degraded, under which workload and what trade-offs exist.

## Reproducibility

Keep scripts, configs, data, charts, environment details and Git commit
IDs with every experiment.
