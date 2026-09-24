import { useRef, useState } from 'react';

// Baseline on the left, current on the right, with a handle to drag: move it to see what changed at any spot.
// Also works with the keyboard (the hidden range input takes the arrow keys).
function CompareSlider({ before, after }) {
  const [position, setPosition] = useState(50); // percent of the width that shows the baseline
  const boxRef = useRef(null);
  const dragging = useRef(false);

  function moveTo(clientX) {
    const box = boxRef.current.getBoundingClientRect();
    setPosition(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  }

  return (
    <div
      className="slider"
      ref={boxRef}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => dragging.current && moveTo(event.clientX)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <img className="slider-base" src={after} alt="Current screenshot" draggable="false" />
      <img className="slider-top" src={before} alt="Baseline screenshot" draggable="false" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
      <span className="slider-tag slider-tag-left">Baseline</span>
      <span className="slider-tag slider-tag-right">Current</span>
      <div className="slider-handle" style={{ left: `${position}%` }} aria-hidden="true">
        <span />
      </div>
      <input
        className="slider-range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(position)}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Move to compare the baseline and the current version"
      />
    </div>
  );
}

export default CompareSlider;
