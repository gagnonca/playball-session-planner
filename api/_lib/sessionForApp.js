// A saved session in the shape the iOS app's session viewer reads: summary
// fields and sections reassembled, rich text flattened to plain text, and
// (for the app) CDN images inlined as data URIs. Shared by the read-only
// share links (share-router.js) and signed-in accounts (v2.js).

export function reassembleSession(row) {
  return {
    ...(row.summary || {}),
    id: row.id,
    sections: row.sections || [],
    isTemplate: row.is_template,
  };
}

// Everything the app needs for one session row.
export async function sessionForApp(row, { inlineImages }) {
  const session = reassembleSession(row);
  flattenRichTextFields(session.sections || []);
  if (inlineImages) await inlineCdnImages(session.sections || []);
  return session;
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

export async function inlineCdnImages(sections) {
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

export function flattenRichTextFields(sections) {
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
