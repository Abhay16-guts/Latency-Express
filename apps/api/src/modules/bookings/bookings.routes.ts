import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reserveSeatsAtomic, ReservationError } from '../../reservation/locking.js';
import { admission } from '../../concurrency/admission.js';
import { queueManager } from '../../concurrency/queue.js';
import { query, getClient } from '../../db/connection.js';
import type { Booking, Passenger, BerthType } from '@latency-express/types';

const bookingSchema = z.object({
  scheduleId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1),
  passengers: z.array(
    z.object({
      fullName: z.string().min(2),
      age: z.number().int().min(1).max(120),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
      berthPreference: z.enum(['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW']).optional(),
    })
  ).min(1),
  simulatePaymentDelayMs: z.number().optional(),
});

export async function bookingsRoutes(fastify: FastifyInstance) {
  // Create booking with Admission Control, Concurrency Locking & Idempotency
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUser = (request as any).user;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    const parseResult = bookingSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
      });
    }

    const { scheduleId, seatIds, passengers, simulatePaymentDelayMs } = parseResult.data;

    // 1. Rate Limiting Check
    const bypassRateLimit = process.env.NODE_ENV !== 'production' && request.headers['x-test-bypass-rate-limit'] === 'true';
    if (!bypassRateLimit) {
      const rateLimit = await admission.checkRateLimit(`booking:${authUser.id}`, 20, 60);
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many booking requests. Please wait ${rateLimit.resetSeconds}s before retrying.`,
          },
        });
      }
    }

    // 2. Admission Control Decision
    const currentQueueLength = await queueManager.getQueueLength();
    const decision = await admission.evaluateAdmission(currentQueueLength);

    // Case A: Load Shedding / Capacity Saturation
    if (decision.outcome === 'REJECT') {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'ADMISSION_SHED',
          message: decision.reason || 'Server capacity saturated. Please retry shortly.',
        },
      });
    }

    // Case B: High Load -> Queue for Orderly Processing
    if (decision.outcome === 'QUEUE') {
      const ticket = await queueManager.enqueue({
        userId: authUser.id,
        scheduleId,
        seatIds,
        passengers,
        idempotencyKey,
        simulatePaymentDelayMs,
      });

      return reply.status(202).send({
        success: true,
        data: {
          status: 'QUEUED',
          ticket,
        },
      });
    }

    // Case C: Direct Fast-Path (ACCEPT)
    await admission.incrementActiveWorkers();
    try {
      const result = await reserveSeatsAtomic({
        userId: authUser.id,
        scheduleId,
        seatIds,
        passengers: passengers as any,
        idempotencyKey,
        simulatePaymentDelayMs,
      });

      return reply.status(201).send({
        success: true,
        data: {
          booking: result.booking,
          isReplay: result.isReplay,
        },
      });
    } catch (err: any) {
      if (err instanceof ReservationError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
      }
      request.log.error(err, 'Unhandled reservation failure');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process booking transaction.' },
      });
    } finally {
      await admission.decrementActiveWorkers();
    }
  });

  // Get user's bookings history
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUser = (request as any).user;

    const sql = `
      SELECT 
        b.id, b.pnr, b.user_id, b.schedule_id, b.status, b.total_fare, b.booking_time,
        s.journey_date, s.departure_time,
        t.train_number, t.name as train_name,
        src.code as src_code, dst.code as dst_code,
        p.status as payment_status
      FROM bookings b
      JOIN schedules s ON s.id = b.schedule_id
      JOIN trains t ON t.id = s.train_id
      JOIN stations src ON src.id = s.source_station_id
      JOIN stations dst ON dst.id = s.destination_station_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.booking_time DESC;
    `;

    const result = await query(sql, [authUser.id]);
    const bookings: Booking[] = [];

    for (const r of result.rows) {
      // Get passengers for this booking
      const pRes = await query(
        `SELECT p.id, p.full_name, p.age, p.gender, p.berth_preference,
                s.seat_number, c.coach_number, c.coach_class
         FROM passengers p
         JOIN seats s ON s.id = p.seat_id
         JOIN coaches c ON c.id = s.coach_id
         WHERE p.booking_id = $1`,
        [r.id]
      );

      bookings.push({
        id: r.id,
        pnr: r.pnr,
        userId: r.user_id,
        scheduleId: r.schedule_id,
        trainNumber: r.train_number,
        trainName: r.train_name,
        sourceStation: r.src_code,
        destinationStation: r.dst_code,
        journeyDate: r.journey_date,
        departureTime: r.departure_time,
        status: r.status,
        totalFare: parseFloat(r.total_fare),
        paymentStatus: r.payment_status || 'SUCCESS',
        bookingTime: r.booking_time,
        passengers: pRes.rows.map((p) => ({
          id: p.id,
          bookingId: r.id,
          fullName: p.full_name,
          age: p.age,
          gender: p.gender,
          berthPreference: p.berth_preference,
          seatNumber: p.seat_number,
          coachNumber: p.coach_number,
          coachClass: p.coach_class,
        })),
      });
    }

    return reply.send({ success: true, data: bookings });
  });

  // Get specific booking details
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUser = (request as any).user;
    const { id } = request.params as { id: string };

    const sql = `
      SELECT 
        b.id, b.pnr, b.user_id, b.schedule_id, b.status, b.total_fare, b.booking_time,
        s.journey_date, s.departure_time,
        t.train_number, t.name as train_name,
        src.code as src_code, dst.code as dst_code,
        p.status as payment_status
      FROM bookings b
      JOIN schedules s ON s.id = b.schedule_id
      JOIN trains t ON t.id = s.train_id
      JOIN stations src ON src.id = s.source_station_id
      JOIN stations dst ON dst.id = s.destination_station_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE (b.id::text = $1 OR b.pnr = $1)
      LIMIT 1;
    `;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    const r = result.rows[0];
    if (r.user_id !== authUser.id && authUser.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to view this booking' },
      });
    }

    const pRes = await query(
      `SELECT p.id, p.full_name, p.age, p.gender, p.berth_preference,
              s.seat_number, c.coach_number, c.coach_class
       FROM passengers p
       JOIN seats s ON s.id = p.seat_id
       JOIN coaches c ON c.id = s.coach_id
       WHERE p.booking_id = $1`,
      [r.id]
    );

    const booking: Booking = {
      id: r.id,
      pnr: r.pnr,
      userId: r.user_id,
      scheduleId: r.schedule_id,
      trainNumber: r.train_number,
      trainName: r.train_name,
      sourceStation: r.src_code,
      destinationStation: r.dst_code,
      journeyDate: r.journey_date,
      departureTime: r.departure_time,
      status: r.status,
      totalFare: parseFloat(r.total_fare),
      paymentStatus: r.payment_status || 'SUCCESS',
      bookingTime: r.booking_time,
      passengers: pRes.rows.map((p) => ({
        id: p.id,
        bookingId: r.id,
        fullName: p.full_name,
        age: p.age,
        gender: p.gender,
        berthPreference: p.berth_preference,
        seatNumber: p.seat_number,
        coachNumber: p.coach_number,
        coachClass: p.coach_class,
      })),
    };

    return reply.send({ success: true, data: booking });
  });

  // Cancel booking (Atomic Seat Release)
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUser = (request as any).user;
    const { id } = request.params as { id: string };

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const bRes = await client.query(
        'SELECT id, user_id, status FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (bRes.rows.length === 0) {
        throw new ReservationError('BOOKING_NOT_FOUND', 'Booking not found', 404);
      }

      const booking = bRes.rows[0];
      if (booking.user_id !== authUser.id && authUser.role !== 'ADMIN') {
        throw new ReservationError('FORBIDDEN', 'Unauthorized to cancel this booking', 403);
      }

      if (booking.status === 'CANCELLED') {
        throw new ReservationError('ALREADY_CANCELLED', 'This booking has already been cancelled', 400);
      }

      // Find occupied seat IDs
      const pRes = await client.query('SELECT seat_id FROM passengers WHERE booking_id = $1', [id]);
      const seatIds = pRes.rows.map((r) => r.seat_id);

      // Release seats back to AVAILABLE
      if (seatIds.length > 0) {
        await client.query(
          `UPDATE seats 
           SET status = 'AVAILABLE',
               version = version + 1,
               updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [seatIds]
        );
      }

      // Update booking status to CANCELLED
      await client.query(
        "UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1",
        [id]
      );

      // Audit event
      await client.query(
        `INSERT INTO booking_events (booking_id, event_type, payload)
         VALUES ($1, 'BOOKING_CANCELLED', $2)`,
        [id, JSON.stringify({ cancelledBy: authUser.id, releasedSeats: seatIds })]
      );

      await client.query('COMMIT');
      return reply.send({ success: true, message: 'Booking successfully cancelled and seats released.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
