import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

// Thumbnails of the captured pages. Click one to open the full-size screenshot in a new tab.
// Each thumbnail shows a shimmering skeleton until its image has actually loaded, so the grid
// never flashes blank tiles or shifts layout while screenshots stream in.
function ScreenshotGrid({ testId, pages }) {
  const [loaded, setLoaded] = useState(() => new Set());
  const markLoaded = (index) => setLoaded((current) => new Set(current).add(index));

  return (
    <div className="screenshot-grid">
      {pages.map((page) => {
        // The URL is built from the test id and the saved file name, nothing else
        const src = `/files/${testId}/${page.screenshot}`;
        const isLoaded = loaded.has(page.index);
        return (
          <figure className="screenshot-card" key={page.index}>
            <a href={src} target="_blank" rel="noreferrer" title="Open the full-size screenshot">
              <div className="screenshot-media-wrap">
                {!isLoaded && (
                  <div className="screenshot-skeleton">
                    <ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" />
                    <span className="skeleton-shimmer" aria-hidden="true" />
                  </div>
                )}
                <img
                  src={src}
                  alt={`Screenshot of ${page.path}`}
                  loading="lazy"
                  className="screenshot-img"
                  style={{ opacity: isLoaded ? 1 : 0 }}
                  onLoad={() => markLoaded(page.index)}
                />
              </div>
            </a>
            <figcaption>
              <span className="mono">{page.path}</span>
              <span>{page.title}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export default ScreenshotGrid;
