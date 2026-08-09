import { useEffect, useState } from 'react';

// Small standalone reduced-motion hook (avoids pulling framer-motion just for
// this). Returns true when the user asked the OS to minimize motion — every
// Broadcast XI animation (foil, tilt, flip, count-up, hexagon draw) checks it.
export default function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setReduced(e.matches);
    // addEventListener is the modern API; addListener is the Safari fallback.
    mq.addEventListener ? mq.addEventListener('change', onChange)
                        : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange)
                            : mq.removeListener(onChange);
    };
  }, []);

  return reduced;
}
