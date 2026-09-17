import bcrypt from 'bcrypt';
import { pool } from './connection.js';

async function seed() {
  console.log('🌱 Starting database seed for Latency Express...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Users
    const passwordHashAdmin = await bcrypt.hash('Admin@123', 10);
    const passwordHashUser = await bcrypt.hash('Passenger@123', 10);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES 
        ('admin@latencyexpress.com', $1, 'Admin Controller', 'ADMIN'),
        ('passenger@latencyexpress.com', $2, 'Aarav Sharma', 'USER'),
        ('riya@latencyexpress.com', $2, 'Riya Sen', 'USER')
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id, email, role;`,
      [passwordHashAdmin, passwordHashUser]
    );
    console.log(`Created/Updated ${userRes.rowCount} users`);

    // 2. Stations
    const stationsData = [
      { code: 'NDLS', name: 'New Delhi Railway Station', city: 'New Delhi', state: 'Delhi' },
      { code: 'BCT', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra' },
      { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal' },
      { code: 'MAS', name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
      { code: 'SBC', name: 'KSR Bengaluru', city: 'Bengaluru', state: 'Karnataka' },
      { code: 'BSB', name: 'Varanasi Junction', city: 'Varanasi', state: 'Uttar Pradesh' },
    ];

    const stationMap: Record<string, string> = {};
    for (const st of stationsData) {
      const res = await client.query(
        `INSERT INTO stations (code, name, city, state)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [st.code, st.name, st.city, st.state]
      );
      stationMap[res.rows[0].code] = res.rows[0].id;
    }
    console.log('Populated 6 major junction stations');

    // 3. Trains
    const trainsData = [
      { number: '12952', name: 'New Delhi Rajdhani Express', type: 'RAJDHANI' },
      { number: '22436', name: 'Vande Bharat Express', type: 'VANDE_BHARAT' },
      { number: '12260', name: 'Sealdah Duronto Express', type: 'DURONTO' },
      { number: '12626', name: 'Kerala Superfast Express', type: 'SUPERFAST' },
    ];

    const trainMap: Record<string, string> = {};
    for (const tr of trainsData) {
      const res = await client.query(
        `INSERT INTO trains (train_number, name, train_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (train_number) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, train_number;`,
        [tr.number, tr.name, tr.type]
      );
      trainMap[res.rows[0].train_number] = res.rows[0].id;
    }
    console.log('Populated trains');

    // 4. Coaches for 12952 Rajdhani & 22436 Vande Bharat
    const coaches = [
      { trainNumber: '12952', coachNumber: 'H1', coachClass: '1A', totalSeats: 24 },
      { trainNumber: '12952', coachNumber: 'A1', coachClass: '2A', totalSeats: 48 },
      { trainNumber: '12952', coachNumber: 'B1', coachClass: '3A', totalSeats: 64 },
      { trainNumber: '12952', coachNumber: 'B2', coachClass: '3A', totalSeats: 64 },
      { trainNumber: '22436', coachNumber: 'C1', coachClass: 'CC', totalSeats: 78 },
      { trainNumber: '22436', coachNumber: 'E1', coachClass: 'EC', totalSeats: 52 },
    ];

    const coachMap: Record<string, string> = {};
    for (const c of coaches) {
      const trainId = trainMap[c.trainNumber];
      const res = await client.query(
        `INSERT INTO coaches (train_id, coach_number, coach_class, total_seats)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (train_id, coach_number) DO UPDATE SET total_seats = EXCLUDED.total_seats
         RETURNING id, coach_number;`,
        [trainId, c.coachNumber, c.coachClass, c.totalSeats]
      );
      coachMap[`${c.trainNumber}_${c.coachNumber}`] = res.rows[0].id;
    }
    console.log('Populated coaches');

    // 5. Schedules (Today and Tomorrow)
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const schedulesToCreate = [
      {
        trainNumber: '12952',
        sourceCode: 'NDLS',
        destCode: 'BCT',
        date: today,
        dep: `${today}T16:55:00.000Z`,
        arr: `${tomorrow}T08:35:00.000Z`,
      },
      {
        trainNumber: '12952',
        sourceCode: 'NDLS',
        destCode: 'BCT',
        date: tomorrow,
        dep: `${tomorrow}T16:55:00.000Z`,
        arr: new Date(Date.now() + 172800000).toISOString(),
      },
      {
        trainNumber: '22436',
        sourceCode: 'NDLS',
        destCode: 'BSB',
        date: today,
        dep: `${today}T06:00:00.000Z`,
        arr: `${today}T14:00:00.000Z`,
      },
    ];

    const scheduleIds: string[] = [];
    for (const sc of schedulesToCreate) {
      const trainId = trainMap[sc.trainNumber];
      const sourceId = stationMap[sc.sourceCode];
      const destId = stationMap[sc.destCode];

      const res = await client.query(
        `INSERT INTO schedules (train_id, source_station_id, destination_station_id, departure_time, arrival_time, journey_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (train_id, journey_date) DO UPDATE SET departure_time = EXCLUDED.departure_time
         RETURNING id;`,
        [trainId, sourceId, destId, sc.dep, sc.arr, sc.date]
      );
      scheduleIds.push(res.rows[0].id);
    }
    console.log(`Populated ${scheduleIds.length} schedules`);

    // 6. Generate Seats for the schedules
    const berthTypes = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
    let totalSeatsInserted = 0;

    for (const scheduleId of scheduleIds) {
      // Find coaches for the schedule's train
      const coachRows = await client.query(
        `SELECT c.id, c.coach_number, c.coach_class, c.total_seats
         FROM coaches c
         JOIN schedules s ON s.train_id = c.train_id
         WHERE s.id = $1`,
        [scheduleId]
      );

      for (const coach of coachRows.rows) {
        // Create 24-32 seats per coach to give a rich test grid
        const seatLimit = Math.min(coach.total_seats, 32);
        for (let i = 1; i <= seatLimit; i++) {
          const seatNumber = `${i}`;
          const berthType = coach.coach_class === 'CC' || coach.coach_class === 'EC' 
            ? 'WINDOW' 
            : berthTypes[(i - 1) % berthTypes.length];
          const basePrice = coach.coach_class === '1A' ? 2450.00 :
                            coach.coach_class === '2A' ? 1750.00 :
                            coach.coach_class === '3A' ? 1250.00 : 750.00;

          await client.query(
            `INSERT INTO seats (coach_id, schedule_id, seat_number, berth_type, status, base_price)
             VALUES ($1, $2, $3, $4, 'AVAILABLE', $5)
             ON CONFLICT (coach_id, schedule_id, seat_number) DO NOTHING;`,
            [coach.id, scheduleId, seatNumber, berthType, basePrice]
          );
          totalSeatsInserted++;
        }
      }
    }
    console.log(`Generated ${totalSeatsInserted} seats across scheduled coaches.`);

    await client.query('COMMIT');
    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
