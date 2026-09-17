import { FastifyInstance } from 'fastify';
import client from 'prom-client';
import { queueManager } from '../../concurrency/queue.js';
import { pool } from '../../db/connection.js';
import { query } from '../../db/connection.js';

// Setup Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed by Latency Express',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const bookingCounter = new client.Counter({
  name: 'tatkal_bookings_total',
  help: 'Total booking attempts partitioned by outcome',
  labelNames: ['outcome'], // 'SUCCESS', 'CONFLICT', 'REJECTED'
  registers: [register],
});

export const doubleBookingPreventionCounter = new client.Counter({
  name: 'double_bookings_prevented_total',
  help: 'Instances where race-condition row-locks prevented double booking',
  registers: [register],
});

// Real-time rolling metrics window for UI Telemetry
interface RollingRequest {
  timestamp: number;
  durationMs: number;
  status: number;
}
const rollingWindow: RollingRequest[] = [];
let preventedDoubleBookings = 0;

export function recordRollingMetric(durationMs: number, status: number) {
  const now = Date.now();
  rollingWindow.push({ timestamp: now, durationMs, status });
  // Keep last 60 seconds
  const cutoff = now - 60000;
  while (rollingWindow.length > 0 && rollingWindow[0].timestamp < cutoff) {
    rollingWindow.shift();
  }
}

export function incrementDoubleBookingPrevented() {
  preventedDoubleBookings++;
  doubleBookingPreventionCounter.inc();
}

export async function metricsRoutes(fastify: FastifyInstance) {
  // Prometheus Scrape Endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });

  // Real-time JSON Telemetry for UI Dashboard
  fastify.get('/admin/telemetry', async (request, reply) => {
    const now = Date.now();
    const cutoff = now - 60000;
    const activeSample = rollingWindow.filter((r) => r.timestamp >= cutoff);

    const rps = Math.round((activeSample.length / 60) * 10) / 10;
    const durations = activeSample.map((r) => r.durationMs).sort((a, b) => a - b);

    const p50 = durations.length ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : 0;
    const p99 = durations.length ? durations[Math.floor(durations.length * 0.99)] : 0;

    const queueLength = await queueManager.getQueueLength();
    const jainsIndex = queueManager.calculateJainsFairnessIndex();

    // Query DB totals
    const countsRes = await query(
      `SELECT 
        COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled
       FROM bookings`
    );

    return reply.send({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        requestsPerSecond: rps,
        p50LatencyMs: Math.round(p50),
        p95LatencyMs: Math.round(p95),
        p99LatencyMs: Math.round(p99),
        activeQueueLength: queueLength,
        successfulBookings: parseInt(countsRes.rows[0]?.confirmed || '0', 10),
        cancelledBookings: parseInt(countsRes.rows[0]?.cancelled || '0', 10),
        doubleBookingsPrevented: preventedDoubleBookings,
        dbPoolActive: pool.totalCount - pool.idleCount,
        dbPoolIdle: pool.idleCount,
        dbPoolTotal: pool.totalCount,
        jainsFairnessIndex: jainsIndex,
        currentMode: 'ROW_LOCK_ADMISSION_QUEUE',
      },
    });
  });
}
