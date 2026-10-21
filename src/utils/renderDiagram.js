import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { DiagramStatic } from '../components/DiagramPlayground';
import { pendingKonvaImages } from '../hooks/useKonvaImage';
import { uploadImageToCDN } from './uploadImage';

// Draw a diagram from its vector data to a PNG, off-screen, with PlayBall's
// own renderer. Used when copying Community items into an account: the copy
// gets a thumbnail that was generated here, never one supplied by its author.

const frame = () => new Promise(r => requestAnimationFrame(() => r()));

export async function renderDiagramPng(diagram, width = 1100) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  let stage = null;
  try {
    root.render(createElement(DiagramStatic, { diagram, width, stageRef: (s) => { stage = s; } }));
    const deadline = Date.now() + 4000;
    // Mounting starts the image loads; wait until none are outstanding.
    await frame();
    while ((!stage || pendingKonvaImages() > 0) && Date.now() < deadline) await frame();
    await frame(); await frame();
    return stage ? stage.toDataURL({ pixelRatio: 1 }) : '';
  } catch (e) {
    console.warn('[renderDiagram]', e);
    return '';
  } finally {
    root.unmount();
    host.remove();
  }
}

// Give every vector diagram in a section-like payload (and its variations) a
// freshly drawn image, uploaded to the CDN when possible.
export async function imageFor(diagram) {
  const png = await renderDiagramPng(diagram);
  if (!png) return '';
  return (await uploadImageToCDN(png)) || png;
}

export async function withRenderedImages(block) {
  const out = { ...block };
  if (out.diagramData?.shapes?.length) out.imageDataUrl = await imageFor(out.diagramData);
  out.variations = await Promise.all((block.variations || []).map(async v => (
    v.diagramData?.shapes?.length ? { ...v, imageDataUrl: await imageFor(v.diagramData) } : v
  )));
  return out;
}

export async function sessionWithRenderedImages(payload) {
  return { ...payload, sections: await Promise.all((payload.sections || []).map(withRenderedImages)) };
}
