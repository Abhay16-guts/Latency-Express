import { redis, checkRedisHealth } from '../redis/client.js';

export type AdmissionOutcome = 'ACCEPT' | 'QUEUE' | 'REJECT';

export interface AdmissionDecision {
  outcome: AdmissionOutcome;
  activeCount: number;
  queueLength: number;
  reason?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export class AdmissionController {
  private softLimit = 25;       // Below this: direct ACCEPT
  private hardLimit = 50;       // Above softLimit: route to QUEUE
  private maxQueueBuffer = 500; // Above this: REJECT (load shedding)
  
  // In-memory metrics fallback
  private inMemoryActive = 0;

  public setLimits(soft: number, hard: number, maxQueue: number) {
    this.softLimit = soft;
    this.hardLimit = hard;
    this.maxQueueBuffer = maxQueue;
  }

  public getLimits() {
    return {
      softLimit: this.softLimit,
      hardLimit: this.hardLimit,
      maxQueueBuffer: this.maxQueueBuffer,
    };
  }

  /**
   * Token Bucket Rate Limiter using Redis INCR & EXPIRE
   */
  async checkRateLimit(key: string, limit: number = 60, windowSeconds: number = 60): Promise<RateLimitResult> {
    if (!checkRedisHealth()) {
      return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
    }

    const redisKey = `ratelimit:${key}`;
    try {
      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, windowSeconds);
      }
      const ttl = await redis.ttl(redisKey);

      if (current > limit) {
        return { allowed: false, remaining: 0, resetSeconds: Math.max(ttl, 1) };
      }
      return { allowed: true, remaining: Math.max(0, limit - current), resetSeconds: Math.max(ttl, 1) };
    } catch {
      return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
    }
  }

  /**
   * Evaluates system load and determines ACCEPT, QUEUE, or REJECT
   */
  async evaluateAdmission(queueLength: number): Promise<AdmissionDecision> {
    let activeWorkers = this.inMemoryActive;

    if (checkRedisHealth()) {
      try {
        const val = await redis.get('active_workers_count');
        activeWorkers = val ? parseInt(val, 10) : 0;
      } catch {
        // Fallback to inMemoryActive
      }
    }

    // Tier 1: System has available capacity -> Direct ACCEPT
    if (activeWorkers < this.softLimit && queueLength === 0) {
      return {
        outcome: 'ACCEPT',
        activeCount: activeWorkers,
        queueLength,
      };
    }

    // Tier 3: Queue is overloaded -> REJECT (Load Shedding)
    if (queueLength >= this.maxQueueBuffer) {
      return {
        outcome: 'REJECT',
        activeCount: activeWorkers,
        queueLength,
        reason: 'System queue capacity saturated. Please retry shortly.',
      };
    }

    // Tier 2: System is at capacity -> QUEUE
    return {
      outcome: 'QUEUE',
      activeCount: activeWorkers,
      queueLength,
      reason: 'High concurrent demand. Request enqueued for orderly processing.',
    };
  }

  async incrementActiveWorkers(): Promise<number> {
    this.inMemoryActive++;
    if (checkRedisHealth()) {
      try {
        return await redis.incr('active_workers_count');
      } catch {
        return this.inMemoryActive;
      }
    }
    return this.inMemoryActive;
  }

  async decrementActiveWorkers(): Promise<number> {
    this.inMemoryActive = Math.max(0, this.inMemoryActive - 1);
    if (checkRedisHealth()) {
      try {
        const count = await redis.decr('active_workers_count');
        return Math.max(0, count);
      } catch {
        return this.inMemoryActive;
      }
    }
    return this.inMemoryActive;
  }
}

export const admission = new AdmissionController();
