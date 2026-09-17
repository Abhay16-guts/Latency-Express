# Final Execution Checklist and Delivery

## Build order

Environment → repository → frontend/backend shells → database → auth →
train/search → availability → booking → concurrency → idempotency →
Redis → admission → queue → fairness → monitoring → frontend polish →
tests → experiments → deployment → report.

## Foundation

-   [ ] repo initialized
-   [ ] frontend/backend run
-   [ ] PostgreSQL/Redis connect
-   [ ] health works
-   [ ] environment works
-   [ ] Docker works

## Reservation

-   [ ] search
-   [ ] availability
-   [ ] seat map
-   [ ] passenger details
-   [ ] booking
-   [ ] simulated payment
-   [ ] confirmation
-   [ ] cancellation
-   [ ] history

## Correctness

-   [ ] transaction
-   [ ] row lock
-   [ ] concurrent same-seat test
-   [ ] no double booking
-   [ ] rollback
-   [ ] authorization

## Reliability

-   [ ] idempotency
-   [ ] retry safety
-   [ ] duplicate request protection
-   [ ] worker recovery
-   [ ] Redis failure
-   [ ] PostgreSQL failure
-   [ ] timeout handling

## High concurrency

-   [ ] rate limiting
-   [ ] admission control
-   [ ] queue
-   [ ] queue status
-   [ ] worker
-   [ ] recovery

## Fairness

-   [ ] FIFO
-   [ ] fair scheduling
-   [ ] waiting time
-   [ ] success distribution
-   [ ] Jain index

## UX

-   [ ] mobile
-   [ ] tablet
-   [ ] desktop
-   [ ] skeletons
-   [ ] network error
-   [ ] retry
-   [ ] empty states
-   [ ] 404
-   [ ] 403
-   [ ] 500
-   [ ] service unavailable
-   [ ] session expiry
-   [ ] accessibility
-   [ ] reduced motion

## Performance

-   [ ] code splitting
-   [ ] lazy routes
-   [ ] request deduplication
-   [ ] debounce where useful
-   [ ] pagination
-   [ ] safe caching
-   [ ] optimized images
-   [ ] small payloads
-   [ ] DB indexes
-   [ ] connection pool tuning
-   [ ] no unnecessary rerenders

## Research

-   [ ] baseline
-   [ ] locking experiment
-   [ ] Redis experiment
-   [ ] queue experiment
-   [ ] admission experiment
-   [ ] fair queue experiment
-   [ ] repeated runs
-   [ ] controlled workloads
-   [ ] raw data
-   [ ] charts
-   [ ] evidence-based conclusions

## Final demo

1.  Search train.
2.  Show availability.
3.  Run controlled concurrent load.
4.  Show queue/admission control.
5.  Demonstrate same-seat contention.
6.  Show no double booking.
7.  Open live dashboard.
8.  Show requests/sec, queue, P95/P99, successes/failures and fairness.
9.  Compare two configurations.
10. Explain measured trade-offs.

## Final report

Include: 1. Introduction 2. Problem 3. Research gap 4. Objectives 5.
Literature review 6. Existing system 7. Architecture 8. Database 9.
Reservation engine 10. Concurrency 11. Redis/queue 12. Admission control
13. Idempotency 14. Fairness 15. Frontend 16. Security 17. Experimental
setup 18. Results 19. Discussion 20. Limitations 21. Future scope 22.
Conclusion 23. References

## Viva essentials

Know why PostgreSQL, Redis, row locking, idempotency, admission control,
queues, fairness, P95/P99, k6 and Prometheus/Grafana are used.

## Final definition of done

Core booking works; concurrency is correct; retries are safe;
queue/admission/fairness work; UI is responsive; monitoring works; tests
and experiments are reproducible; deployment is repeatable;
documentation is complete; no research results are fabricated.
