import { useState, useEffect } from 'react';

// Images still loading across every mounted useKonvaImage — lets an
// off-screen render (utils/renderDiagram.js) wait until the field, goals,
// cones and ball are all drawn before taking its snapshot.
let pending = 0;
export function pendingKonvaImages() {
  return pending;
}

/**
 * Load an image for use in a Konva <Image> node.
 * Returns the HTMLImageElement once loaded, or null while loading.
 */
export default function useKonvaImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let settled = false;
    const settle = () => { if (!settled) { settled = true; pending -= 1; } };
    pending += 1;
    const img = new window.Image();
    img.onload = () => { settle(); setImage(img); };
    img.onerror = settle;
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
      settle();
    };
  }, [src]);

  return image;
}
