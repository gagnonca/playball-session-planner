import { useSyncExternalStore } from 'react';

// Phone-width layout (below Tailwind's `md`). For layout that CSS classes
// can't express — a different component tree, not just different spacing.
const QUERY = '(max-width: 767px)';

function subscribe(onChange) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
