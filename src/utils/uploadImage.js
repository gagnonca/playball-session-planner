import { uid } from './helpers';

/**
 * Upload a base64 data-URL image to Vercel Blob CDN.
 * Returns the CDN URL on success, or null on failure (non-blocking).
 *
 * @param {string} base64 - base64 data-URL (e.g. "data:image/png;base64,...")
 * @param {string} [prefix='diagram'] - path prefix inside the blob bucket
 * @returns {Promise<string|null>} CDN URL or null
 */
export async function uploadImageToCDN(base64, prefix = 'diagram') {
  if (!base64 || !base64.startsWith('data:')) return null;

  try {
    const key = `${prefix}-${uid()}`;
    const res = await fetch('/api/session-library/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, key }),
    });
    const data = await res.json();
    return data.success ? data.url : null;
  } catch (err) {
    console.warn('CDN upload failed, keeping base64 fallback:', err);
    return null;
  }
}

/**
 * Replace base64 imageDataUrl with a CDN URL in a diagram save payload.
 * Strips diagramData.dataUrl after upload to avoid storing the base64 twice.
 * Mutates the object in place for efficiency.
 *
 * @param {object} diagramData - { dataUrl, elements, lines, fieldType, ... }
 * @returns {Promise<{imageUrl: string, diagramData: object}>}
 */
export async function uploadDiagramImage(diagramData) {
  const base64 = diagramData?.dataUrl;
  const cdnUrl = await uploadImageToCDN(base64);

  // Use CDN URL if upload succeeded, otherwise keep base64 as fallback
  const imageUrl = cdnUrl || base64 || '';

  // Strip the large base64 from diagramData — we only need elements/lines/fieldType
  const cleanDiagramData = { ...diagramData };
  delete cleanDiagramData.dataUrl;

  return { imageUrl, diagramData: cleanDiagramData };
}
