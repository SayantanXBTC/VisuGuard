import { ShieldCheck } from 'lucide-react';

// The VisuGuard mark: a shield with a check
function Logo({ size = 28 }) {
  return <ShieldCheck className="lp-logo" size={size} strokeWidth={2} aria-hidden="true" />;
}

export default Logo;
