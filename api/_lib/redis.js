import { Redis } from '@upstash/redis';

// Redis client configured from environment variables
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set by Vercel
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
