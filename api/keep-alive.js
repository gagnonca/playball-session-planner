import { supabase } from './_lib/supabase.js';

// Keep-alive endpoint for the Supabase free tier.
//
// Free-tier projects PAUSE after 7 days with no database activity. During the
// off-season the app goes untouched, so nothing queries the DB and it pauses
// (restoring is a manual dashboard click). A Vercel Cron Job hits this route
// daily (see the "crons" entry in vercel.json), running one trivial query so
// the inactivity timer never expires.
//
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron
// invocations when the CRON_SECRET env var is set — we verify it so the
// endpoint can't be triggered by random traffic. If CRON_SECRET isn't set yet
// the check is skipped (so it still works before you add the secret).
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    // Lightweight real query — HEAD request, no rows transferred, just enough
    // to register database activity and reset the 7-day pause timer.
    const { error } = await supabase
      .from('coaches')
      .select('coach_id', { head: true, count: 'exact' })
      .limit(1);

    if (error) throw error;

    return res.status(200).json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    console.error('[keep-alive] query failed', err);
    return res.status(500).json({ ok: false, error: 'query_failed' });
  }
}
