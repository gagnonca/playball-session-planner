import { Redis } from '@upstash/redis';

// Redis client configured from environment variables
// Vercel KV sets KV_REST_API_URL and KV_REST_API_TOKEN
export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
