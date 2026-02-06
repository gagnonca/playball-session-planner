import { useState, useEffect } from 'react';

/**
 * Hook to load an image for use with react-konva's Image component.
 * Handles the async image loading and returns the loaded HTMLImageElement.
 *
 * @param {string} src - The image source URL
 * @returns {HTMLImageElement|null} The loaded image or null while loading
 */
export default function useKonvaImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = src;

    return () => {
      img.onload = null;
    };
  }, [src]);

  return image;
}
