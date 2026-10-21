import { request, isSignedIn } from './api';

// The public Community library. Browsing works signed out (plain fetch, no
// token); adding and reporting need an account.

async function getJson(path) {
  let res;
  try {
    res = await fetch(path);
  } catch {
    throw new Error("Couldn't reach PlayBall — check your connection.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(data?.message || 'Something went wrong loading the Community.');
  return data;
}

// filters: { kind?, q?, ageGroup?, moment? }
export async function listCommunity(filters = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const data = await getJson(`/api/v2/public${qs.toString() ? `?${qs}` : ''}`);
  return data.items;
}

export async function getCommunityItem(id) {
  const data = await getJson(`/api/v2/public/${encodeURIComponent(id)}`);
  return data.item;
}

export function countAdd(id) {
  if (!isSignedIn()) return;
  request('POST', `/api/v2/public/${encodeURIComponent(id)}/add`).catch(() => {});
}

export async function reportItem(id, reason) {
  await request('POST', `/api/v2/public/${encodeURIComponent(id)}/report`, { reason });
}

// ---- moderation (admin only; the server enforces it) ----

export async function listReview() {
  const data = await request('GET', '/api/v2/public?review=1');
  return data.items;
}

export async function removeItem(id) {
  await request('DELETE', `/api/v2/public/${encodeURIComponent(id)}`);
}

export async function restoreItem(id) {
  await request('POST', `/api/v2/public/${encodeURIComponent(id)}/restore`);
}
