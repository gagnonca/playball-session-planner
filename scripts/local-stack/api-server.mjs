// Minimal stand-in for `vercel dev`'s API routing, so the API runs with only
// the env passed on the command line (local Supabase, no production Redis).
// Usage: node api-server.mjs <planner repo dir> [port]
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.argv[2];
const port = Number(process.argv[3] || 3000);
const load = (rel) => import(pathToFileURL(path.join(repo, rel)).href).then(m => m.default);

function route(pathname) {
  let m;
  if ((m = pathname.match(/^\/api\/v2\/(.*)$/))) return ['api/v2.js', { slug: m[1] }];
  if (pathname === '/api/v2') return ['api/v2.js', { slug: '' }];
  if (pathname === '/api/team-share/push') return ['api/team-share/push.js', {}];
  if ((m = pathname.match(/^\/api\/team-share\/([^/]+)$/))) return ['api/team-share/[code].js', { code: m[1] }];
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const r = route(url.pathname);
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.headersSent) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  if (!r) return res.status(404).json({ error: 'no_route' });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
  const query = Object.fromEntries(url.searchParams);
  const [file, params] = r;
  if ('slug' in params) query.slug = params.slug.split('/').filter(Boolean);
  if (params.code) query.code = params.code;
  req.query = query;
  const started = Date.now();
  try {
    const handler = await load(file);
    await handler(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'adapter_error', message: e.message });
  }
  console.log(`${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
}).listen(port, () => console.log(`API on http://localhost:${port} → ${process.env.SUPABASE_URL}`));
