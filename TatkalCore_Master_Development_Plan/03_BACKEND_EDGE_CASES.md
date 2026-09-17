# Backend Edge Cases, Concurrency and Reliability

## Invariants

1.  A seat cannot have two successful owners for the same schedule.
2.  Critical booking changes are atomic.
3.  Client retries do not accidentally create another booking.
4.  Users can access only authorized bookings.
5.  Queue state is consistent enough to support fair processing.
6.  Dependency failures do not silently corrupt state.

## Critical scenarios

### Same seat concurrently

Many users target one seat. Exactly one ownership claim may succeed.

### Double click

Use idempotency and server-side protection; never rely only on disabling
a button.

### Timeout after commit

If the server committed but the response was lost, retry must return the
existing booking result.

### Same idempotency key, different payload

Reject as a conflict.

### Duplicate queue entry

Reconnects must not create duplicate logical queue entries.

### Worker crash

Determine whether work committed; retry safely using idempotency/event
state.

### Redis failure

Prefer a controlled 503/429 or documented safe fallback rather than
bypassing all overload protection and flooding PostgreSQL.

### PostgreSQL failure

Never confirm a booking when the authoritative database cannot commit
it. Return controlled 503 and recover safely.

### Rollback

If seat locking succeeds but booking creation fails, the transaction
must roll back.

### Payment simulation

Keep payment states simple: `PENDING`, `SUCCESS`, `FAILED`. Clearly
define when seat ownership becomes committed.

### Cancellation race

Concurrent cancellation and booking must have deterministic
transaction/state rules.

### Stale availability

Frontend availability is informational. Booking must re-check
authoritative state inside the transaction.

### Rate limiting

Consider IP, user/account, route and operation type. Document limits.

### Admission control

Use explicit `ACCEPT`, `QUEUE`, `REJECT` outcomes.

### Fairness edge cases

Test near-simultaneous arrivals, slow clients, reconnects, repeated
retries, queue starvation, different network latency and re-entry after
cancellation.

### Clock ordering

Use server-side timestamps/sequence numbers rather than trusting client
clocks.

## Input cases

Test missing fields, extra fields, nulls, empty strings, invalid IDs,
huge strings, malformed identifiers, invalid dates, invalid passenger
counts and duplicate passengers.

## Auth cases

Test wrong passwords, expired/malformed JWTs, disabled/deleted users and
privilege escalation attempts.

## Authorization

Passengers must not access or delete other users' bookings. Admin routes
require admin authorization.

## Error handling

Centralize errors. Return safe public errors; keep diagnostics in logs.

## Observability

Track `requestId`, `userId` where appropriate, `bookingId`, event type,
timestamp, duration and result. Never log passwords, secrets or tokens.

## Backend completion

-   no double booking under concurrency
-   rollback verified
-   idempotency verified
-   duplicate queue entry prevented
-   Redis/PostgreSQL failure tested
-   retries tested
-   authorization tested
-   rate limiting tested
-   admission tested
-   structured errors and request IDs implemented
