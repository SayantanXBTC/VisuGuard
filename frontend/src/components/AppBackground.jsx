import { useEffect, useRef } from 'react';

// The background of every signed-in screen: the same sunset video as the home page, darkened and softly blurred so
// the content stays readable. With "reduce motion" the video is paused on its first frame.
const VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4';

function AppBackground() {
  const video = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.current?.pause();
  }, []);

  return (
    <div className="app-bg" aria-hidden="true">
      <video ref={video} className="bg-video" src={VIDEO} autoPlay loop muted playsInline />
      <div className="bg-shade" />
    </div>
  );
}

export default AppBackground;
