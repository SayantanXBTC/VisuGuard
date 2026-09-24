import { ArrowLeft } from 'lucide-react';
import AuthCard from '../components/AuthCard.jsx';
import SmokeyBackground from '../components/SmokeyBackground.jsx';
import '../auth.css';

// The sign in / sign up screen: an animated background with a glass card on top.
// reveal = { x, y } (where the user clicked): the screen opens as a circle that grows from that point over the
// page the user came from, then the card fades in. Without it (no page underneath) the screen simply fades in.
function Auth({ mode, onBack, reveal }) {
  const style = reveal ? { '--reveal-x': `${reveal.x}px`, '--reveal-y': `${reveal.y}px` } : undefined;

  return (
    <main className={reveal ? 'auth-stage auth-stage-reveal' : 'auth-stage auth-stage-fade'} style={style}>
      <div className="auth-backdrop">
        <SmokeyBackground />
      </div>
      <div className="auth-content">
        <button className="glass-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </button>
        <AuthCard initialMode={mode} />
      </div>
    </main>
  );
}

export default Auth;
