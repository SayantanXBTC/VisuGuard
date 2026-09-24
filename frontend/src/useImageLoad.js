import { useCallback, useState } from 'react';

const AUTO_RETRIES = 2;

// Follows one <img> until it has really loaded, for screenshots that show a skeleton meanwhile.
// - The state remembers which src it belongs to, so a new src starts over without an effect.
//   (Resetting in an effect raced with cached images: they could load before the effect ran,
//   get marked "loading" again, and never fire another load event - a skeleton stuck forever.)
// - The ref catches an image the browser already had complete before React saw it.
// - A failed load retries twice with a cache-busting query, then reports `failed` so the
//   caller can offer a manual retry.
export function useImageLoad(src) {
  const [state, setState] = useState({ src, attempt: 0, status: 'loading' });
  let current = state;
  if (state.src !== src) {
    current = { src, attempt: 0, status: 'loading' };
    setState(current);
  }

  const shownSrc = src && current.attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${current.attempt}` : src;

  const onLoad = useCallback(() => {
    setState((now) => (now.src === src && now.status !== 'loaded' ? { ...now, status: 'loaded' } : now));
  }, [src]);

  const onError = useCallback(() => {
    setState((now) => {
      if (now.src !== src) return now;
      if (now.attempt < AUTO_RETRIES) {
        // Wait a moment before trying again, so a brief network hiccup has time to pass
        setTimeout(() => setState((later) => (later === now ? { ...now, attempt: now.attempt + 1 } : later)), 700 * (now.attempt + 1));
        return now;
      }
      return { ...now, status: 'failed' };
    });
  }, [src]);

  const ref = useCallback((img) => {
    if (img && img.complete && img.naturalWidth > 0) onLoad();
  }, [onLoad, shownSrc]); // shownSrc: a new address gets a new ref call, which checks again

  const retry = useCallback(() => {
    setState((now) => ({ src: now.src, attempt: now.attempt + 1, status: 'loading' }));
  }, []);

  return {
    loaded: current.status === 'loaded',
    failed: current.status === 'failed',
    retry,
    imgProps: { ref, src: shownSrc, onLoad, onError },
  };
}
