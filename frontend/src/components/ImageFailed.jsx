import { RotateCw } from 'lucide-react';

// Shown in place of a screenshot that would not load even after the automatic retries
function ImageFailed({ onRetry }) {
  return (
    <div className="image-failed">
      <span>This screenshot didn't load.</span>
      <button
        type="button"
        onClick={(event) => {
          // It can sit inside a link to the full-size image; retry here instead of following it
          event.preventDefault();
          event.stopPropagation();
          onRetry();
        }}
      >
        <RotateCw size={13} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

export default ImageFailed;
