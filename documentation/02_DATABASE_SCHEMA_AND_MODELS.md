# 02. Database Schema, Data Models and Integrity

## 1. Overview

The persistence tier of **Latency Express** is built on **PostgreSQL 16**. The schema is designed with strict relational integrity, referential foreign keys, comprehensive unique constraints, and high-selectivity B-tree indexes to enable sub-millisecond lookups under load.

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : "places"
    STATIONS ||--o{ ROUTES : "origin / destination"
    TRAINS ||--o{ SCHEDULES : "operates on"
    TRAINS ||--o{ COACHES : "comprises"
    COACHES ||--o{ SEATS : "contains"
    SCHEDULES ||--o{ SEATS : "allocates"
    SCHEDULES ||--o{ BOOKINGS : "books against"
    BOOKINGS ||--|{ PASSENGERS : "includes"
    BOOKINGS ||--|| PAYMENTS : "billed via"
    BOOKINGS ||--o{ BOOKING_EVENTS : "audited by"
    USERS ||--o{ IDEMPOTENCY_KEYS : "initiates"

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role
        timestamptz created_at
    }

    STATIONS {
        uuid id PK
        varchar code UK
        varchar name
        varchar city
        varchar state
    }

    TRAINS {
        uuid id PK
        varchar train_number UK
        varchar name
        varchar train_type
        boolean is_active
    }

    SCHEDULES {
        uuid id PK
        uuid train_id FK
        uuid source_station_id FK
        uuid destination_station_id FK
        timestamptz departure_time
        timestamptz arrival_time
        date journey_date
        varchar status
    }

    COACHES {
        uuid id PK
        uuid train_id FK
        varchar coach_number
        varchar coach_class
        integer total_seats
    }

    SEATS {
        uuid id PK
        uuid coach_id FK
        uuid schedule_id FK
        varchar seat_number
        varchar berth_type
        varchar status
        decimal base_price
        integer version
    }

    BOOKINGS {
        uuid id PK
        varchar pnr UK
        uuid user_id FK
        uuid schedule_id FK
        varchar status
        decimal total_fare
        timestamptz booking_time
    }

    PASSENGERS {
        uuid id PK
        uuid booking_id FK
        uuid seat_id FK
        varchar full_name
        integer age
        varchar gender
        varchar berth_preference
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK UK
        varchar transaction_ref UK
        decimal amount
        varchar status
        varchar payment_method
        timestamptz created_at
    }

    IDEMPOTENCY_KEYS {
        varchar key PK
        uuid user_id FK
        varchar request_hash
        text response_body
        integer response_status
        timestamptz locked_at
        timestamptz expires_at
    }

    BOOKING_EVENTS {
        uuid id PK
        uuid booking_id FK
        varchar event_type
        jsonb payload
        timestamptz created_at
    }
```

---

## 3. Data Integrity & Constraints

### 3.1 Strict Seat Uniqueness
A seat is unique per coach and schedule. The constraint prevents duplicate physical seats:
```sql
CONSTRAINT uq_seat_schedule UNIQUE (coach_id, schedule_id, seat_number)
```

### 3.2 Booking Status State Machine
A booking transitions through formal lifecycle states:
```text
[INITIATED] ──> [PENDING_PAYMENT] ──> [CONFIRMED]
      │                 │
      ▼                 ▼
  [REJECTED]        [FAILED] ──> [CANCELLED]
```

### 3.3 Idempotency Enforcement
The `idempotency_keys` table stores:
- `key`: Client-supplied unique token (UUID / nanoId).
- `request_hash`: SHA-256 hash of the request parameters (ensures identical payload validation).
- `locked_at`: Prevents race conditions during concurrent identical requests.
- `response_body` & `response_status`: Cached HTTP response returned directly on replay.

---

## 4. Indexing Strategy

| Table | Indexed Columns | Index Type | Purpose |
| :--- | :--- | :--- | :--- |
| `seats` | `(schedule_id, status)` | B-Tree | Fast lookup of available seats for search queries |
| `seats` | `(id)` | Primary Key B-Tree | High-speed row lock execution via `FOR UPDATE` |
| `bookings` | `(pnr)` | Unique B-Tree | Instant ticket status retrieval |
| `bookings` | `(user_id, created_at DESC)` | B-Tree | User booking history queries |
| `schedules` | `(source_station_id, destination_station_id, journey_date)` | B-Tree | Train search optimization |
| `idempotency_keys`| `(key, user_id)` | Unique B-Tree | Millisecond idempotency duplicate rejection |
