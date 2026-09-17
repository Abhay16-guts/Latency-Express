import crypto from 'crypto';
import { getClient, query } from '../db/connection.js';
import type { Booking, Passenger, BerthType, CoachClass } from '@latency-express/types';

export interface ReserveRequest {
  userId: string;
  scheduleId: string;
  seatIds: string[];
  passengers: {
    fullName: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    berthPreference?: BerthType;
  }[];
  idempotencyKey?: string;
  simulatePaymentDelayMs?: number;
  useLocking?: boolean; // Set false only during research benchmarking to demonstrate race conditions
}

export interface ReserveResult {
  booking: Booking;
  isReplay?: boolean;
}

export class ReservationError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ReservationError';
  }
}

export async function reserveSeatsAtomic(req: ReserveRequest): Promise<ReserveResult> {
  const {
    userId,
    scheduleId,
    seatIds,
    passengers,
    idempotencyKey,
    simulatePaymentDelayMs = 0,
    useLocking = true,
  } = req;

  if (!seatIds.length) {
    throw new ReservationError('INVALID_INPUT', 'At least one seat must be selected', 400);
  }

  if (seatIds.length !== passengers.length) {
    throw new ReservationError('INVALID_INPUT', 'Number of passengers must equal number of selected seats', 400);
  }

  // 1. Idempotency Check
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ scheduleId, seatIds, passengers }))
    .digest('hex');

  if (idempotencyKey) {
    const existingKey = await query(
      'SELECT request_hash, response_body, response_status FROM idempotency_keys WHERE key = $1',
      [idempotencyKey]
    );

    if (existingKey.rows.length > 0) {
      const record = existingKey.rows[0];
      if (record.request_hash !== payloadHash) {
        throw new ReservationError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key already used with a different request payload',
          409
        );
      }
      return {
        booking: JSON.parse(record.response_body),
        isReplay: true,
      };
    }
  }

  // 2. Transaction Execution
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Deadlock prevention: sort seatIds lexicographically
    const sortedSeatIds = [...seatIds].sort();

    // Query seats: with or without row-level lock
    const lockClause = useLocking ? 'FOR UPDATE' : '';
    const seatQuery = `
      SELECT s.id, s.seat_number, s.status, s.base_price, s.coach_id, c.coach_number, c.coach_class
      FROM seats s
      JOIN coaches c ON c.id = s.coach_id
      WHERE s.id = ANY($1::uuid[]) AND s.schedule_id = $2
      ORDER BY s.id ASC
      ${lockClause};
    `;

    const seatResult = await client.query(seatQuery, [sortedSeatIds, scheduleId]);

    if (seatResult.rows.length !== sortedSeatIds.length) {
      throw new ReservationError('INVALID_SEATS', 'One or more selected seats do not exist for this schedule', 404);
    }

    // Check availability
    const unavailableSeats = seatResult.rows.filter((s) => s.status !== 'AVAILABLE');
    if (unavailableSeats.length > 0) {
      const seatNums = unavailableSeats.map((s) => s.seat_number).join(', ');
      throw new ReservationError(
        'SEAT_UNAVAILABLE',
        `The following seat(s) are no longer available: ${seatNums}`,
        409,
        { unavailableSeatIds: unavailableSeats.map((s) => s.id) }
      );
    }

    // Optional simulated payment latency
    if (simulatePaymentDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(simulatePaymentDelayMs, 3000)));
    }

    // Calculate total fare
    const totalFare = seatResult.rows.reduce((sum, s) => sum + parseFloat(s.base_price), 0);

    // Fetch schedule info for summary
    const scheduleRes = await client.query(
      `SELECT s.journey_date, s.departure_time, t.train_number, t.name as train_name,
              src.code as src_code, dst.code as dst_code
       FROM schedules s
       JOIN trains t ON t.id = s.train_id
       JOIN stations src ON src.id = s.source_station_id
       JOIN stations dst ON dst.id = s.destination_station_id
       WHERE s.id = $1`,
      [scheduleId]
    );
    const sched = scheduleRes.rows[0];

    // Generate unique PNR
    const pnr = `PNR-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create booking
    const bookingRes = await client.query(
      `INSERT INTO bookings (pnr, user_id, schedule_id, status, total_fare)
       VALUES ($1, $2, $3, 'CONFIRMED', $4)
       RETURNING id, pnr, status, total_fare, booking_time;`,
      [pnr, userId, scheduleId, totalFare]
    );
    const bookingRecord = bookingRes.rows[0];

    // Mark seats as BOOKED
    await client.query(
      `UPDATE seats
       SET status = 'BOOKED',
           version = version + 1,
           updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND schedule_id = $2;`,
      [sortedSeatIds, scheduleId]
    );

    // Insert passengers
    const passengerResults: Passenger[] = [];
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const seat = seatResult.rows.find((s) => s.id === seatIds[i]) || seatResult.rows[i];
      const pRes = await client.query(
        `INSERT INTO passengers (booking_id, seat_id, full_name, age, gender, berth_preference)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id;`,
        [bookingRecord.id, seat.id, p.fullName, p.age, p.gender, p.berthPreference || null]
      );
      passengerResults.push({
        id: pRes.rows[0].id,
        bookingId: bookingRecord.id,
        seatId: seat.id,
        seatNumber: seat.seat_number,
        coachNumber: seat.coach_number,
        coachClass: seat.coach_class,
        fullName: p.fullName,
        age: p.age,
        gender: p.gender,
        berthPreference: p.berthPreference,
      });
    }

    // Insert payment record
    const paymentRef = `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    await client.query(
      `INSERT INTO payments (booking_id, transaction_ref, amount, status)
       VALUES ($1, $2, $3, 'SUCCESS');`,
      [bookingRecord.id, paymentRef, totalFare]
    );

    const bookingResponse: Booking = {
      id: bookingRecord.id,
      pnr: bookingRecord.pnr,
      userId,
      scheduleId,
      trainNumber: sched.train_number,
      trainName: sched.train_name,
      sourceStation: sched.src_code,
      destinationStation: sched.dst_code,
      journeyDate: sched.journey_date,
      departureTime: sched.departure_time,
      status: 'CONFIRMED',
      totalFare: parseFloat(bookingRecord.total_fare),
      passengers: passengerResults,
      paymentStatus: 'SUCCESS',
      bookingTime: bookingRecord.booking_time,
    };

    // Save idempotency record if key provided
    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys (key, user_id, request_hash, response_body, response_status)
         VALUES ($1, $2, $3, $4, 201)
         ON CONFLICT (key) DO NOTHING;`,
        [idempotencyKey, userId, payloadHash, JSON.stringify(bookingResponse)]
      );
    }

    // Audit event
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'BOOKING_CONFIRMED', $2);`,
      [bookingRecord.id, JSON.stringify({ seatIds, totalFare, pnr })]
    );

    await client.query('COMMIT');
    return { booking: bookingResponse };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
