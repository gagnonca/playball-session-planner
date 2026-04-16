import { put } from '@vercel/blob';

/**
 * POST /api/session-library/upload-image
 *
 * Body: { base64: string, key: string }
 * Returns: { success: true, url: string }
 *
 * Uploads a diagram image (base64-encoded PNG) to Vercel Blob CDN
 * for compact storage in the session library.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const { base64, key } = req.body;

  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'missing_base64',
      message: 'base64 image data is required',
    });
  }

  if (!key || typeof key !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'missing_key',
      message: 'A unique key is required',
    });
  }

  try {
    // Strip data URL prefix if present (e.g., "data:image/png;base64,")
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const imageBuffer = Buffer.from(raw, 'base64');

    const blob = await put(`session-library/${key}.png`, imageBuffer, {
      access: 'public',
      contentType: 'image/png',
      allowOverwrite: true,
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Error in POST /api/session-library/upload-image:', error);
    return res.status(500).json({
      success: false,
      error: 'upload_failed',
      message: 'Failed to upload image',
    });
  }
}
