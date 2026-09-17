import { redis, checkRedisHealth } from '../redis/client.js';
import { reserveSeatsAtomic, ReserveRequest } from '../reservation/locking.js';
import type { QueueTicket, QueueStatus, Booking } from '@latency-express/types';

export interface EnqueueOptions {
  userId: string;
  scheduleId: string;
  seatIds: string[];
  passengers: any[];
  idempotencyKey?: string;
  simulatePaymentDelayMs?: number;
}

export class QueueManager {
  private queueKey = 'tatkal_booking_queue';
  private ticketPrefix = 'tatkal_ticket:';
  private completedPrefix = 'tatkal_result:';

  // Fairness tracking array: [serviceLatencyMs, ...]
  private completedLatencies: number[] = [];
  private isProcessing = false;

  async enqueue(options: EnqueueOptions): Promise<QueueTicket> {
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const enqueuedAt = Date.now();

    const payload = JSON.stringify({
      ticketId,
      options,
      enqueuedAt,
    });

    if (checkRedisHealth()) {
      // Add to Redis Sorted Set with score = timestamp (FIFO order)
      await redis.zadd(this.queueKey, enqueuedAt, ticketId);
      // Store ticket payload with 15-minute TTL
      await redis.set(`${this.ticketPrefix}${ticketId}`, payload, 'EX', 900);

      const rank = await redis.zrank(this.queueKey, ticketId);
      const totalInQueue = await redis.zcard(this.queueKey);

      const position = rank !== null ? rank + 1 : 1;
      const estimatedWaitSeconds = Math.max(1, Math.round((position * 100) / 1000)); // assumes 10 reqs/sec drain

      return {
        ticketId,
        userId: options.userId,
        scheduleId: options.scheduleId,
        seatIds: options.seatIds,
        position,
        totalInQueue,
        status: 'PENDING',
        estimatedWaitSeconds,
        enqueuedAt,
      };
    }

    // Fallback: in-memory mock if Redis is down
    return {
      ticketId,
      userId: options.userId,
      scheduleId: options.scheduleId,
      seatIds: options.seatIds,
      position: 1,
      totalInQueue: 1,
      status: 'PENDING',
      estimatedWaitSeconds: 1,
      enqueuedAt,
    };
  }

  async getQueueLength(): Promise<number> {
    if (!checkRedisHealth()) return 0;
    try {
      return await redis.zcard(this.queueKey);
    } catch {
      return 0;
    }
  }

  async getTicketStatus(ticketId: string): Promise<{
    ticketId: string;
    status: QueueStatus;
    position: number;
    totalInQueue: number;
    booking?: Booking;
    error?: string;
  }> {
    if (!checkRedisHealth()) {
      return { ticketId, status: 'FAILED', position: 0, totalInQueue: 0, error: 'Queue service unavailable' };
    }

    // Check if result is already completed
    const cachedResult = await redis.get(`${this.completedPrefix}${ticketId}`);
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      if (parsed.success) {
        return {
          ticketId,
          status: 'COMPLETED',
          position: 0,
          totalInQueue: 0,
          booking: parsed.booking,
        };
      } else {
        return {
          ticketId,
          status: 'FAILED',
          position: 0,
          totalInQueue: 0,
          error: parsed.error,
        };
      }
    }

    // Check position in sorted set
    const rank = await redis.zrank(this.queueKey, ticketId);
    const totalInQueue = await redis.zcard(this.queueKey);

    if (rank === null) {
      // Check if raw ticket exists
      const ticketRaw = await redis.get(`${this.ticketPrefix}${ticketId}`);
      if (!ticketRaw) {
        return { ticketId, status: 'EXPIRED', position: 0, totalInQueue, error: 'Ticket expired or not found' };
      }
      return { ticketId, status: 'PROCESSING', position: 0, totalInQueue };
    }

    return {
      ticketId,
      status: 'PENDING',
      position: rank + 1,
      totalInQueue,
    };
  }

  /**
   * Background Drain Worker: drains tickets in batches and executes atomic booking
   */
  async processQueueBatch(batchSize: number = 5): Promise<number> {
    if (this.isProcessing || !checkRedisHealth()) return 0;
    this.isProcessing = true;

    try {
      // Pop oldest items
      const ticketIds = await redis.zrange(this.queueKey, 0, batchSize - 1);
      if (!ticketIds.length) {
        this.isProcessing = false;
        return 0;
      }

      for (const ticketId of ticketIds) {
        // Remove from queue
        await redis.zrem(this.queueKey, ticketId);

        const ticketRaw = await redis.get(`${this.ticketPrefix}${ticketId}`);
        if (!ticketRaw) continue;

        const { options, enqueuedAt } = JSON.parse(ticketRaw);
        const startTime = Date.now();

        try {
          const result = await reserveSeatsAtomic({
            userId: options.userId,
            scheduleId: options.scheduleId,
            seatIds: options.seatIds,
            passengers: options.passengers,
            idempotencyKey: options.idempotencyKey,
            simulatePaymentDelayMs: options.simulatePaymentDelayMs,
          });

          const totalServiceTime = Date.now() - enqueuedAt;
          this.recordLatency(totalServiceTime);

          // Save completed result
          await redis.set(
            `${this.completedPrefix}${ticketId}`,
            JSON.stringify({ success: true, booking: result.booking }),
            'EX',
            300
          );
        } catch (err: any) {
          const totalServiceTime = Date.now() - enqueuedAt;
          this.recordLatency(totalServiceTime);

          await redis.set(
            `${this.completedPrefix}${ticketId}`,
            JSON.stringify({ success: false, error: err.message || 'Seat unavailable' }),
            'EX',
            300
          );
        }
      }

      return ticketIds.length;
    } finally {
      this.isProcessing = false;
    }
  }

  private recordLatency(latencyMs: number) {
    this.completedLatencies.push(latencyMs);
    if (this.completedLatencies.length > 500) {
      this.completedLatencies.shift();
    }
  }

  /**
   * Calculates Jain's Fairness Index over the rolling window of completion times
   * J = (sum(xi))^2 / (n * sum(xi^2))
   */
  calculateJainsFairnessIndex(): number {
    if (this.completedLatencies.length < 2) return 1.0;

    const n = this.completedLatencies.length;
    let sum = 0;
    let sumSquares = 0;

    for (const val of this.completedLatencies) {
      sum += val;
      sumSquares += val * val;
    }

    if (sumSquares === 0) return 1.0;

    const jainIndex = (sum * sum) / (n * sumSquares);
    return Math.min(1.0, Math.max(0, Math.round(jainIndex * 1000) / 1000));
  }
}

export const queueManager = new QueueManager();
