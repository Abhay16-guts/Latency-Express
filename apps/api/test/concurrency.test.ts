import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { query, pool } from '../src/db/connection.js';
import { FastifyInstance } from 'fastify';

describe('High-Concurrency Reservation & Idempotency Suite', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let authToken: string;
  let scheduleId: string;
  let targetSeatId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Login default passenger
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'passenger@latencyexpress.com',
        password: 'Passenger@123',
      },
    });

    const loginData = JSON.parse(loginRes.body);
    expect(loginRes.statusCode).toBe(200);
    testUserId = loginData.data.user.id;
    authToken = loginData.data.token;

    // Fetch an available schedule and target seat
    const schedRes = await query('SELECT id FROM schedules LIMIT 1');
    scheduleId = schedRes.rows[0].id;

    // Reset all seats for this schedule to AVAILABLE for clean test run
    await query("UPDATE seats SET status = 'AVAILABLE' WHERE schedule_id = $1", [scheduleId]);

    const seatRes = await query(
      "SELECT id FROM seats WHERE schedule_id = $1 AND status = 'AVAILABLE' LIMIT 1",
      [scheduleId]
    );
    targetSeatId = seatRes.rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('Strict Zero Double-Booking: 50 concurrent requests for the exact same seat', async () => {
    const concurrentRequests = 50;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      const p = app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': `test-race-req-${i}-${Date.now()}`,
          'x-test-bypass-rate-limit': 'true',
        },
        payload: {
          scheduleId,
          seatIds: [targetSeatId],
          passengers: [
            {
              fullName: `Contender ${i + 1}`,
              age: 28,
              gender: 'MALE',
              berthPreference: 'LOWER',
            },
          ],
        },
      });
      promises.push(p);
    }

    const responses = await Promise.all(promises);

    let successCount = 0;
    let conflictCount = 0;

    for (const res of responses) {
      if (res.statusCode === 201) {
        successCount++;
      } else if (res.statusCode === 409) {
        conflictCount++;
      }
    }

    // Exactly 1 must succeed; 49 must receive conflict
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(concurrentRequests - 1);

    // Verify in database: seat is BOOKED and exactly 1 passenger record exists for this seat
    const seatDb = await query('SELECT status FROM seats WHERE id = $1', [targetSeatId]);
    expect(seatDb.rows[0].status).toBe('BOOKED');

    const passDb = await query('SELECT COUNT(*) as count FROM passengers WHERE seat_id = $1', [targetSeatId]);
    expect(parseInt(passDb.rows[0].count, 10)).toBe(1);
  });

  it('Idempotency Replay: identical request with same key returns original cached booking', async () => {
    // Pick another available seat
    const seatRes = await query(
      "SELECT id FROM seats WHERE schedule_id = $1 AND status = 'AVAILABLE' LIMIT 1",
      [scheduleId]
    );
    const newSeatId = seatRes.rows[0].id;
    const uniqueKey = `idemp-key-${Date.now()}`;

    const payload = {
      scheduleId,
      seatIds: [newSeatId],
      passengers: [
        {
          fullName: 'Idempotent Passenger',
          age: 35,
          gender: 'FEMALE',
        },
      ],
    };

    // First attempt
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: {
        authorization: `Bearer ${authToken}`,
        'idempotency-key': uniqueKey,
        'x-test-bypass-rate-limit': 'true',
      },
      payload,
    });

    expect(res1.statusCode).toBe(201);
    const data1 = JSON.parse(res1.body);

    // Second attempt (replay after hypothetical network timeout)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: {
        authorization: `Bearer ${authToken}`,
        'idempotency-key': uniqueKey,
        'x-test-bypass-rate-limit': 'true',
      },
      payload,
    });

    expect(res2.statusCode).toBe(201);
    const data2 = JSON.parse(res2.body);

    // Both must return identical PNR
    expect(data2.data.booking.pnr).toBe(data1.data.booking.pnr);
    expect(data2.data.isReplay).toBe(true);

    // Verify seat is not double-counted
    const passCount = await query('SELECT COUNT(*) as count FROM passengers WHERE seat_id = $1', [newSeatId]);
    expect(parseInt(passCount.rows[0].count, 10)).toBe(1);
  });

  it('Idempotency Conflict: same key with different payload is rejected', async () => {
    const key = `idemp-reuse-${Date.now()}`;
    const seatRes = await query(
      "SELECT id FROM seats WHERE schedule_id = $1 AND status = 'AVAILABLE' LIMIT 2",
      [scheduleId]
    );
    const seatA = seatRes.rows[0].id;
    const seatB = seatRes.rows[1].id;

    // First request
    await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: {
        authorization: `Bearer ${authToken}`,
        'idempotency-key': key,
        'x-test-bypass-rate-limit': 'true',
      },
      payload: {
        scheduleId,
        seatIds: [seatA],
        passengers: [{ fullName: 'Passenger A', age: 25, gender: 'MALE' }],
      },
    });

    // Second request reusing same key with different seat
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: {
        authorization: `Bearer ${authToken}`,
        'idempotency-key': key,
        'x-test-bypass-rate-limit': 'true',
      },
      payload: {
        scheduleId,
        seatIds: [seatB],
        passengers: [{ fullName: 'Passenger B', age: 30, gender: 'FEMALE' }],
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
