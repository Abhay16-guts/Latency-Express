-- Latency Express Relational Database Schema
-- Optimized for PostgreSQL 16 with ACID transactional integrity

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Railway Network (Stations, Trains, Routes)
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    train_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    train_type VARCHAR(50) NOT NULL DEFAULT 'EXPRESS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    source_station_id UUID NOT NULL REFERENCES stations(id),
    destination_station_id UUID NOT NULL REFERENCES stations(id),
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time TIMESTAMPTZ NOT NULL,
    journey_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_train_schedule UNIQUE (train_id, journey_date)
);

-- 3. Coaches & Granular Seat Inventory
CREATE TABLE IF NOT EXISTS coaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    coach_number VARCHAR(20) NOT NULL,
    coach_class VARCHAR(10) NOT NULL, -- '1A', '2A', '3A', 'SL', 'CC', 'EC'
    total_seats INTEGER NOT NULL DEFAULT 72,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_train_coach UNIQUE (train_id, coach_number)
);

CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    seat_number VARCHAR(10) NOT NULL,
    berth_type VARCHAR(20) NOT NULL, -- 'LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW'
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'LOCKED', 'BOOKED', 'UNAVAILABLE'
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_seat_schedule UNIQUE (coach_id, schedule_id, seat_number)
);

-- 4. Bookings & Passengers
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pnr VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    schedule_id UUID NOT NULL REFERENCES schedules(id),
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED', -- 'PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'
    total_fare DECIMAL(10, 2) NOT NULL,
    booking_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id),
    full_name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(20) NOT NULL,
    berth_preference VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Payments Simulation
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS', -- 'PENDING', 'SUCCESS', 'FAILED'
    payment_method VARCHAR(50) NOT NULL DEFAULT 'SIMULATED_GATEWAY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Idempotency & Retry Safety
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    request_hash VARCHAR(64) NOT NULL,
    response_body TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 7. Audit & Event Trail
CREATE TABLE IF NOT EXISTS booking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_seats_schedule_status ON seats (schedule_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_coach ON seats (coach_id);
CREATE INDEX IF NOT EXISTS idx_schedules_search ON schedules (source_station_id, destination_station_id, journey_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings (pnr);
CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events (booking_id);
