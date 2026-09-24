import { ImageIcon } from 'lucide-react';
import { useImageLoad } from '../useImageLoad.js';
import ImageFailed from './ImageFailed.jsx';

// One thumbnail. It shows a shimmering skeleton until its image has actually loaded, so the grid
// never flashes blank tiles or shifts layout while screenshots stream in.
function ScreenshotCard({ src, page }) {
  const { loaded, failed, retry, imgProps } = useImageLoad(src);
  return (
    <figure className="screenshot-card">
      <a href={src} target="_blank" rel="noreferrer" title="Open the full-size screenshot">
        <div className="screenshot-media-wrap">
          {!loaded && (
            <div className="screenshot-skeleton">
              {failed ? (
                <ImageFailed onRetry={retry} />
              ) : (
                <>
                  <ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span className="skeleton-shimmer" aria-hidden="true" />
                </>
              )}
            </div>
          )}
          <img
            {...imgProps}
            alt={`Screenshot of ${page.path}`}
            className="screenshot-img"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </div>
      </a>
      <figcaption>
        <span className="mono">{page.path}</span>
        <span>{page.title}</span>
      </figcaption>
    </figure>
  );
}

// Thumbnails of the captured pages. Click one to open the full-size screenshot in a new tab.
function ScreenshotGrid({ testId, pages }) {
  return (
    <div className="screenshot-grid">
      {pages.map((page) => (
        // The URL is built from the test id and the saved file name, nothing else
        <ScreenshotCard key={page.index} src={`/files/${testId}/${page.screenshot}`} page={page} />
      ))}
    </div>
  );
}

export default ScreenshotGrid;
