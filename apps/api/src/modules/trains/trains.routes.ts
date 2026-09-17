import { FastifyInstance } from 'fastify';
import { query } from '../../db/connection.js';
import type { Schedule, Seat } from '@latency-express/types';

export async function trainsRoutes(fastify: FastifyInstance) {
  // Search trains
  fastify.get('/', async (request, reply) => {
    const { source, destination, date } = request.query as {
      source?: string;
      destination?: string;
      date?: string;
    };

    let sql = `
      SELECT 
        s.id, s.departure_time, s.arrival_time, s.journey_date, s.status,
        t.id as train_id, t.train_number, t.name as train_name, t.train_type,
        src.id as src_id, src.code as src_code, src.name as src_name,
        dst.id as dst_id, dst.code as dst_code, dst.name as dst_name,
        COUNT(st.id) as total_seats,
        COUNT(CASE WHEN st.status = 'AVAILABLE' THEN 1 END) as available_seats
      FROM schedules s
      JOIN trains t ON t.id = s.train_id
      JOIN stations src ON src.id = s.source_station_id
      JOIN stations dst ON dst.id = s.destination_station_id
      LEFT JOIN seats st ON st.schedule_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (source) {
      params.push(source.toUpperCase());
      sql += ` AND (src.code = $${params.length} OR src.city ILIKE $${params.length})`;
    }
    if (destination) {
      params.push(destination.toUpperCase());
      sql += ` AND (dst.code = $${params.length} OR dst.city ILIKE $${params.length})`;
    }
    if (date) {
      params.push(date);
      sql += ` AND s.journey_date = $${params.length}`;
    }

    sql += `
      GROUP BY s.id, t.id, src.id, dst.id
      ORDER BY s.departure_time ASC;
    `;

    const result = await query(sql, params);

    const schedules: Schedule[] = result.rows.map((r) => ({
      id: r.id,
      trainId: r.train_id,
      trainNumber: r.train_number,
      trainName: r.train_name,
      sourceStationId: r.src_id,
      sourceStationCode: r.src_code,
      sourceStationName: r.src_name,
      destinationStationId: r.dst_id,
      destinationStationCode: r.dst_code,
      destinationStationName: r.dst_name,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      journeyDate: r.journey_date,
      status: r.status,
      availableSeatsCount: parseInt(r.available_seats || '0', 10),
      totalSeatsCount: parseInt(r.total_seats || '0', 10),
    }));

    return reply.send({ success: true, data: schedules });
  });

  // Get stations list for dropdowns
  fastify.get('/stations', async (request, reply) => {
    const res = await query('SELECT id, code, name, city, state FROM stations ORDER BY code ASC');
    return reply.send({ success: true, data: res.rows });
  });

  // Get train details by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const trainRes = await query('SELECT * FROM trains WHERE id = $1', [id]);
    if (trainRes.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TRAIN_NOT_FOUND', message: 'Train not found' },
      });
    }

    const coachesRes = await query(
      'SELECT id, coach_number, coach_class, total_seats FROM coaches WHERE train_id = $1 ORDER BY coach_number ASC',
      [id]
    );

    return reply.send({
      success: true,
      data: {
        train: trainRes.rows[0],
        coaches: coachesRes.rows,
      },
    });
  });

  // Get granular seat layout with live status for a schedule
  fastify.get('/:id/availability', async (request, reply) => {
    const { scheduleId } = request.query as { scheduleId?: string };
    if (!scheduleId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'scheduleId query parameter is required' },
      });
    }

    const seatQuery = `
      SELECT 
        s.id, s.coach_id, s.schedule_id, s.seat_number, s.berth_type, 
        s.status, s.base_price, s.version,
        c.coach_number, c.coach_class
      FROM seats s
      JOIN coaches c ON c.id = s.coach_id
      WHERE s.schedule_id = $1
      ORDER BY c.coach_number ASC, CAST(s.seat_number AS INTEGER) ASC;
    `;

    const result = await query(seatQuery, [scheduleId]);

    const seats: Seat[] = result.rows.map((r) => ({
      id: r.id,
      coachId: r.coach_id,
      coachNumber: r.coach_number,
      coachClass: r.coach_class,
      scheduleId: r.schedule_id,
      seatNumber: r.seat_number,
      berthType: r.berth_type,
      status: r.status,
      basePrice: parseFloat(r.base_price),
      version: r.version,
    }));

    return reply.send({ success: true, data: seats });
  });
}
