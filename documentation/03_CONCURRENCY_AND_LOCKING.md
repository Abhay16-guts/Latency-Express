# 03. Concurrency, Locking and Transaction Safety

## 1. Concurrency Challenges in Railway Ticketing

During peak booking events, multiple concurrent transactions read the identical seat as `AVAILABLE` and proceed to write simultaneously. Without deliberate locking, this creates a classic **Lost Update / Write Conflict race condition**, resulting in two tickets issued for one physical seat.

---

## 2. Race Condition Deep-Dive

### The Naive Unprotected Flow (Failure Mode)
```
Request A (Client 1)              Request B (Client 2)
      |                                 |
      |-- SELECT status = 'AVAILABLE' ->|
      |   (Returns AVAILABLE)           |-- SELECT status = 'AVAILABLE' ->
      |                                 |   (Returns AVAILABLE)
      |-- UPDATE status = 'BOOKED' ---->|
      |   (Seat booked for User 1)      |-- UPDATE status = 'BOOKED' ---->
      |                                 |   (Seat overwritten for User 2!)
      v                                 v
   User 1 Confirmed                  User 2 Confirmed  <-- DOUBLE BOOKING!
```

---

## 3. The PostgreSQL Row-Level Locking Solution

Latency Express prevents race conditions by leveraging PostgreSQL's **`SELECT ... FOR UPDATE`** row-level locking mechanism inside an explicit transaction boundary.

### The Atomic Reservation Sequence
```sql
BEGIN TRANSACTION;

-- 1. Acquire exclusive lock on seat row; blocks concurrent transactions
SELECT id, schedule_id, status, base_price, version
FROM seats
WHERE id = $1 AND schedule_id = $2
FOR UPDATE;

-- 2. Validate current authoritative status
-- If status != 'AVAILABLE', rollback and return 409 Conflict immediately.

-- 3. Transition seat state to 'LOCKED' or 'BOOKED'
UPDATE seats
SET status = 'BOOKED',
    version = version + 1
WHERE id = $1;

-- 4. Create authoritative booking and passenger records
INSERT INTO bookings (id, pnr, user_id, schedule_id, status, total_fare)
VALUES ($3, $4, $5, $2, 'CONFIRMED', $6);

INSERT INTO passengers (id, booking_id, seat_id, full_name, age, gender)
VALUES ($7, $3, $1, $8, $9, $10);

-- 5. Record Idempotency key to lock the response
INSERT INTO idempotency_keys (key, user_id, request_hash, response_body, response_status, locked_at)
VALUES ($11, $5, $12, $13, 201, NOW());

COMMIT;
```

### Serialized Execution via Row Lock
```
Request A (Client 1)                    Request B (Client 2)
      |                                       |
      |-- SELECT ... FOR UPDATE ------------->|
      |   [Lock Granted to A]                 |-- SELECT ... FOR UPDATE ------------>
      |                                       |   [BLOCKS: Waiting for A to finish]
      |-- UPDATE status = 'BOOKED' ---------->|      |
      |-- INSERT INTO bookings -------------->|      |
      |-- COMMIT (Releases Lock) ------------>|      |
      |                                       |   [Unblocks and acquires lock]
      |                                       |   Seat status is now 'BOOKED'!
      |                                       |-- ROLLBACK & Return 409 CONFLICT ---->
      v                                       v
   User 1 Confirmed                       User 2 receives "Seat Unavailable"
```

---

## 4. Deadlock Prevention Rules

When booking multi-seat reservations, naive lock acquisition orders can create deadlocks:
- Transaction 1 locks Seat A and attempts to lock Seat B.
- Transaction 2 locks Seat B and attempts to lock Seat A.

### Latency Express Invariants:
1. **Sorted Lock Ordering**: All seat IDs within a batch reservation are strictly sorted alphabetically/numerically before issuing locks:
   ```sql
   SELECT * FROM seats 
   WHERE id = ANY($1::uuid[]) 
   ORDER BY id ASC 
   FOR UPDATE;
   ```
2. **Short Lock Hold Time**: No external network calls (e.g., third-party payment gateways) are ever executed while holding database row locks. Payments are pre-authorized or verified via webhooks/two-phase transitions.
3. **Lock Timeout Safeguards**: Fastify database connections enforce a 2000ms `lock_timeout` to gracefully abort stuck transactions rather than causing cascading starvation.

---

## 5. Idempotency Implementation

To defend against duplicate submissions (network retries, impatient users double-clicking):
1. **Header Requirement**: Clients must send an `Idempotency-Key` header with mutation requests.
2. **Hash Comparison**: The server hashes the request payload (`SHA-256`).
3. **Behavior Matrix**:
   - **Key Not Found**: Execute transaction, store key + hash + response, return response.
   - **Key Exists & Matching Hash**: Immediately return the cached response without running the transaction.
   - **Key Exists & Mismatched Hash**: Reject with `409 Conflict` (idempotency key reuse violation).
   - **Concurrent Duplicate Key**: If a second request arrives while the first is in progress, the second waits briefly or receives a `409 State Conflict (Request in progress)`.
