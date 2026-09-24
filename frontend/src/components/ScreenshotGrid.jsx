// Thumbnails of the captured pages. Click one to open the full-size screenshot in a new tab.
function ScreenshotGrid({ testId, pages }) {
  return (
    <div className="screenshot-grid">
      {pages.map((page) => {
        // The URL is built from the test id and the saved file name, nothing else
        const src = `/files/${testId}/${page.screenshot}`;
        return (
          <figure className="screenshot-card" key={page.index}>
            <a href={src} target="_blank" rel="noreferrer" title="Open the full-size screenshot">
              <img src={src} alt={`Screenshot of ${page.path}`} loading="lazy" />
            </a>
            <figcaption>
              <strong>{page.title || page.path}</strong>
              <span className="muted">{page.path}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export default ScreenshotGrid;
