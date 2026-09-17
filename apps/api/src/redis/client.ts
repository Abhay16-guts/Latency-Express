import { Redis } from 'ioredis';
import { config } from '../config/env.js';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

let isRedisConnected = false;

redis.on('connect', () => {
  isRedisConnected = true;
  console.log('⚡ Redis connected successfully');
});

redis.on('error', (err) => {
  isRedisConnected = false;
  console.warn('⚠️ Redis connection error:', err.message);
});

export function checkRedisHealth(): boolean {
  return isRedisConnected && redis.status === 'ready';
}
