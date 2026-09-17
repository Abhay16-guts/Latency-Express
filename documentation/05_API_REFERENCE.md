# 05. REST API Reference Specification

## 1. Overview & Base URL

All API routes are prefixed under `/api/v1`. All requests and responses use `application/json` unless otherwise specified.

Base URL (Local Development): `http://localhost:4000/api/v1`

---

## 2. Standard Headers

| Header | Required | Purpose |
| :--- | :--- | :--- |
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Protected routes | `Bearer <JWT_TOKEN>` |
| `Idempotency-Key` | Mutation routes (`POST /bookings`) | Unique UUID / token preventing duplicate charges/tickets |
| `x-request-id` | Optional | Client tracing ID; echoed in response header |

---

## 3. Standard Response Formats

### 3.1 Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### 3.2 Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "The selected seat is no longer available.",
    "requestId": "req-988af3b1-47c0-4389-9bd9-44755104d4f8"
  }
}
```

---

## 4. Endpoints

### 4.1 Authentication (`/auth`)

#### `POST /auth/register`
Creates a new customer account.
- **Request Body**:
  ```json
  {
    "email": "passenger@example.com",
    "password": "SecurePassword123!",
    "fullName": "Aarav Sharma"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "uuid", "email": "passenger@example.com", "fullName": "Aarav Sharma", "role": "USER" },
      "token": "jwt.token.string"
    }
  }
  ```

#### `POST /auth/login`
Authenticates credentials and issues JWT token.
- **Request Body**:
  ```json
  { "email": "passenger@example.com", "password": "SecurePassword123!" }
  ```
- **Response**: `200 OK` (User object + JWT token).

#### `GET /auth/me`
Fetches authenticated user profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

---

### 4.2 Trains & Availability (`/trains`)

#### `GET /trains`
Search trains between stations on a specific date.
- **Query Parameters**:
  - `source`: Station code (e.g. `NDLS`)
  - `destination`: Station code (e.g. `BCT`)
  - `date`: `YYYY-MM-DD`
- **Response**: `200 OK` (Array of trains with schedules and available seat counts).

#### `GET /trains/:id`
Fetch train details, route stations, and attached coaches.

#### `GET /trains/:id/availability?scheduleId=uuid`
Returns granular coach and seat layout with live status (`AVAILABLE`, `BOOKED`, `PROCESSING`).

---

### 4.3 Reservations & Bookings (`/bookings`)

#### `POST /bookings`
Attempt to reserve one or more seats.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <unique-uuid>`
- **Request Body**:
  ```json
  {
    "scheduleId": "uuid-schedule",
    "seatIds": ["uuid-seat-1"],
    "passengers": [
      {
        "fullName": "Aarav Sharma",
        "age": 32,
        "gender": "MALE",
        "berthPreference": "LOWER"
      }
    ],
    "simulatePaymentDelayMs": 100
  }
  ```
- **Responses**:
  - `201 Created`: Direct confirmation (if admitted via fast-path).
  - `202 Accepted`: Enqueued in Redis waiting room (if under Tatkal spike load):
    ```json
    {
      "success": true,
      "data": {
        "status": "QUEUED",
        "ticketId": "q_ticket_18274092",
        "position": 14,
        "estimatedWaitSeconds": 3.5
      }
    }
    ```
  - `409 Conflict`: Seat already locked/booked by a competing transaction.
  - `429 Too Many Requests`: Capacity exceeded; request shed gracefully.

#### `GET /bookings`
Returns current user's booking history.

#### `GET /bookings/:id`
Returns ticket details and PNR status.

#### `DELETE /bookings/:id`
Cancels booking, executes atomic seat release, and creates cancellation audit log.

---

### 4.4 Queue Telemetry (`/queue`)

#### `GET /queue/status`
Returns global queue health (active workers, waiting requests, drain rate).

#### `GET /queue/position?ticketId=q_ticket_xyz`
Returns client's real-time queue position and status (`PENDING`, `PROCESSING`, `COMPLETED`, `EXPIRED`).

---

### 4.5 System Health & Metrics (`/health`, `/admin/metrics`)

#### `GET /health`
Shallow liveness check (`200 OK`).

#### `GET /health/ready`
Deep readiness check validating PostgreSQL and Redis connectivity.

#### `GET /admin/metrics`
Prometheus-formatted metrics scrapable by Prometheus or visualized in the Live Dashboard.
