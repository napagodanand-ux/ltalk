import { useEffect, useState } from 'react';

// Returns true when the viewport is at or below the given max-width (mobile).
// Defaults to one pixel below the Tailwind `md` breakpoint (767px) so it stays
// in sync with the `md:` utilities used across the UI.
export function useIsMobile(maxWidth = 767): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
