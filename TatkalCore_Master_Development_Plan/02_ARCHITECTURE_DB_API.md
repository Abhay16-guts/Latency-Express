# Architecture, Database and API Contract

## Architecture

``` text
Users → React → Fastify API → Admission Control → Redis Queue → Reservation Engine → PostgreSQL
```

Optional load balancer may sit before the API.

## Responsibilities

React: UI, navigation, forms, states. Fastify: validation, auth,
authorization, orchestration, booking, idempotency, metrics. Redis:
queue, rate limit, admission, temporary coordination. PostgreSQL:
authoritative seats, bookings and transactions.

## Tables

`users`, `trains`, `stations`, `routes`, `schedules`, `coaches`,
`seats`, `passengers`, `bookings`, `payments`, `queue_entries`,
`booking_events`, `idempotency_keys`.

Use primary keys, foreign keys, unique constraints and useful indexes.

## Booking transaction

``` text
BEGIN
→ validate context
→ SELECT target seat FOR UPDATE
→ check availability
→ create/update booking state
→ create event
→ COMMIT
```

On failure: `ROLLBACK`.

## APIs

``` text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me

GET /api/v1/trains
GET /api/v1/trains/:id
GET /api/v1/trains/:id/availability

POST   /api/v1/bookings
GET    /api/v1/bookings
GET    /api/v1/bookings/:id
DELETE /api/v1/bookings/:id

GET /api/v1/queue/status
GET /api/v1/queue/position

POST /api/v1/admin/trains
POST /api/v1/admin/stations
GET  /api/v1/admin/metrics
```

## Response shape

``` json
{"success":true,"data":{}}
```

Error:

``` json
{"success":false,"error":{"code":"SEAT_UNAVAILABLE","message":"The selected seat is no longer available.","requestId":"..."}}
```

## Status codes

200 success, 201 created, 400 invalid request, 401 unauthenticated, 403
forbidden, 404 missing, 409 state conflict, 422 semantic validation, 429
rate limit/admission rejection, 500 unexpected failure, 503 dependency
unavailable.

## Health

`/health`, `/health/live`, `/health/ready`.

## Idempotency

Booking requests use an `Idempotency-Key`. Same key + same request
should reuse the result; same key + different request should be
rejected. Concurrent same-key requests must resolve to one logical
operation.

## Security

Validate input, authenticate, authorize, limit sensitive routes,
restrict request size, configure CORS deliberately, use HTTPS in
deployment and never expose stack traces or secrets.
