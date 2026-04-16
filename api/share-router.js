import { supabase } from './_lib/supabase.js';

// Routed via vercel.json rewrite: /api/share/:slug* → /api/share-router?slug=:slug*
//
// Reads live from Postgres via teams.sharing->>shareToken. No Redis. No push.
//   GET    /api/share/:token                          → team view
//   DELETE /api/share/:token                          → revoke
//   GET    /api/share/:token/sessions                 → lightweight session list
//   GET    /api/share/:token/sessions/:sessionId      → full session (X-PlayBall-Version)

export default async function handler(req, res) {
  const raw = req.query.slug;
  const slug = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.length
      ? raw.split('/')
      : [];
  const [token, sub, sessionId] = slug;
  if (!token) return send(res, 400, 'missing_token');

  try {
    if (sub === 'sessions' && sessionId) return getSession(req, res, token, sessionId);
    if (sub === 'sessions' && !sessionId) return listSessions(res, token);
    if (!sub) {
      if (req.method === 'GET') return getTeam(res, token);
      if (req.method === 'DELETE') return revoke(res, token);
      return send(res, 405, 'method_not_allowed');
    }
    return send(res, 404, 'not_found');
  } catch (e) {
    console.error('[share router]', slug, e);
    return send(res, 500, 'server_error', e.message);
  }
}

async function loadTeamByToken(token) {
  const { data: team, error } = await supabase
    .from('teams')
    .select('id, name, age_group, sharing')
    .eq('sharing->>shareToken', token)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) { console.error('[share.loadTeam]', error); return null; }
  if (!team) return null;
  if (!team.sharing?.isShared) return null;
  return team;
}

async function loadSessionsForTeam(teamId, columns = '*') {
  const { data, error } = await supabase
    .from('sessions')
    .select(columns)
    .eq('team_id', teamId)
    .is('deleted_at', null);
  if (error) { console.error('[share.loadSessions]', error); return []; }
  return (data || []).map(reassembleSession)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function reassembleSession(row) {
  return {
    ...(row.summary || {}),
    id: row.id,
    sections: row.sections || [],
    isTemplate: row.is_template,
  };
}

async function getTeam(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This shared team link is no longer valid.');
  // Lightweight: only fetch id + summary for the team overview
  const sessions = await loadSessionsForTeam(team.id, 'id, summary');
  return res.status(200).json({
    success: true,
    team: {
      teamName: team.name,
      ageGroup: team.age_group || '',
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.summary?.title || s.title || '',
        date: s.summary?.date || s.date || null,
      })).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    },
  });
}

async function revoke(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'Share not found');
  const { error } = await supabase
    .from('teams')
    .update({
      sharing: { isShared: false },
      updated_at: new Date().toISOString(),
    })
    .eq('id', team.id);
  if (error) { console.error('[share.revoke]', error); return send(res, 500, 'server_error'); }
  return res.status(200).json({ success: true, message: 'Share link revoked' });
}

async function listSessions(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This share code is not valid or has been revoked.');
  // Only fetch id + summary — no sections/diagrams needed for the list view
  const sessions = await loadSessionsForTeam(team.id, 'id, summary');
  return res.status(200).json({
    success: true,
    teamName: team.name,
    ageGroup: team.age_group || '',
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.summary?.title || s.title || '',
      date: s.summary?.date || s.date || null,
    })).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  });
}

async function getSession(req, res, token, sessionId) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This share code is not valid or has been revoked.');

  const { data: row, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('team_id', team.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) { console.error('[share.getSession]', error); return send(res, 500, 'server_error'); }
  if (!row) return send(res, 404, 'session_not_found', 'Session not found in this shared team.');

  const session = reassembleSession(row);

  // Rich-text fields are stored as HTML; the iOS viewer and the web SharedView
  // both render them as plain text, so flatten HTML to text with bullets/numbers
  // before sending.
  flattenRichTextFields(session.sections || []);

  // iOS app sends X-PlayBall-Version and expects base64 data URIs in imageDataUrl.
  // CDN URLs need to be fetched and inlined for iOS compatibility.
  const isNativeApp = req.headers['x-playball-version'];
  if (isNativeApp) {
    await inlineCdnImages(session.sections || []);
  }

  return res.status(200).json({
    success: true,
    teamName: team.name,
    ageGroup: team.age_group || '',
    session,
  });
}

async function cdnUrlToBase64(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await resp.arrayBuffer());
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

async function inlineCdnImages(sections) {
  const jobs = [];
  for (const sec of sections) {
    if (sec.imageDataUrl && sec.imageDataUrl.startsWith('http')) {
      jobs.push(cdnUrlToBase64(sec.imageDataUrl).then(b64 => { if (b64) sec.imageDataUrl = b64; }));
    }
    for (const v of sec.variations || []) {
      if (v.imageDataUrl && v.imageDataUrl.startsWith('http')) {
        jobs.push(cdnUrlToBase64(v.imageDataUrl).then(b64 => { if (b64) v.imageDataUrl = b64; }));
      }
    }
  }
  await Promise.all(jobs);
}

const RICH_TEXT_FIELDS = ['objective', 'organization', 'notes'];

function flattenRichTextFields(sections) {
  for (const sec of sections) {
    for (const f of RICH_TEXT_FIELDS) {
      if (typeof sec[f] === 'string') sec[f] = htmlToPlainText(sec[f]);
    }
    for (const v of sec.variations || []) {
      for (const f of RICH_TEXT_FIELDS) {
        if (typeof v[f] === 'string') v[f] = htmlToPlainText(v[f]);
      }
    }
  }
}

function htmlToPlainText(html) {
  if (!html) return '';
  if (!/[<&]/.test(html)) return html;

  let out = html;

  out = out.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let i = 0;
    const items = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (__, li) => {
      i += 1;
      return `\n${i}. ${stripInline(li).trim()}`;
    });
    return `\n${items.trim()}\n`;
  });

  out = out.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.replace(
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
      (__, li) => `\n• ${stripInline(li).trim()}`
    );
    return `\n${items.trim()}\n`;
  });

  out = out.replace(/<\/p>\s*<p\b[^>]*>/gi, '\n\n');
  out = out.replace(/<p\b[^>]*>/gi, '').replace(/<\/p>/gi, '\n');
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = stripInline(out);
  out = decodeEntities(out);

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function stripInline(s) {
  return s.replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function send(res, status, error, message) {
  return res.status(status).json({ success: false, error, message });
}
