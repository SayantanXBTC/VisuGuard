import { useEffect, useState } from 'react';

// One place for how the home page scrolls. Every link and button that goes to a section uses scrollToSection.
// The offset for the fixed navigation bar is not calculated here: the target has CSS scroll-margin-top
// (var(--lp-nav-h)), so the browser puts it in exactly the same place from every scroll position.
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const target = section.querySelector('[data-anchor]') || section; // the heading block of the section
  target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

// The id of the section that is in the middle band of the screen (for the highlight in the navigation)
export function useActiveSection(ids) {
  const [active, setActive] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }, // a thin band a little above the middle of the screen
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    // At the very top no section is active
    const onScroll = () => {
      if (window.scrollY < 80) setActive(null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [ids]);

  return active;
}

// true while the media query matches (for example the desktop layout)
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
