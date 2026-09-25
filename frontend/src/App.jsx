import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getSession, onAuthChange, signOut } from './auth.js';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// The link in a password-reset email brings the user back with this in the URL
const cameFromResetEmail = window.location.hash.includes('type=recovery');

// The center of the button that was clicked: where the sign-in screen opens from
function originOf(event) {
  const box = event.currentTarget.getBoundingClientRect();
  // A keyboard "click" has no mouse position, so use the middle of the button
  return event.detail === 0 ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: event.clientX, y: event.clientY };
}

const REVEAL_MS = 1500; // how long the landing page stays under the sign-in screen while it opens

// `view` says which screen to show; each maps to a real URL path so the
// address bar, refresh, and back/forward all match what's on screen.
// view is one of: 'landing' | 'auth' | 'dashboard' | 'reset'
const PATH_BY_VIEW = { landing: '/', auth: '/auth', dashboard: '/dashboard', reset: '/reset-password' };
const VIEW_BY_PATH = { '/': 'landing', '/auth': 'auth', '/dashboard': 'dashboard', '/reset-password': 'reset' };

function viewForPath(pathname) {
  return VIEW_BY_PATH[pathname] || 'landing';
}

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true); // true until we know if someone is logged in
  const [view, setView] = useState(cameFromResetEmail ? 'reset' : viewForPath(window.location.pathname));
  const firstUrlSync = useRef(true);
  const [authMode, setAuthMode] = useState('signin'); // which tab the Auth page opens on
  const [notice, setNotice] = useState('');
  const [reveal, setReveal] = useState(null); // { x, y } while the sign-in screen opens over the landing page
  const [landingBehind, setLandingBehind] = useState(false); // keep the landing page under it until it has opened

  useEffect(() => {
    if (!supabase) return;

    // Start listening first so no event (like PASSWORD_RECOVERY) is missed
    const stopListening = onAuthChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setView('reset');
      if (event === 'SIGNED_OUT') setView('landing');
      // Move to the dashboard on sign-in, whether from the Auth page or a full-page OAuth
      // redirect back from Google (which reloads the app fresh, so `view` is never 'auth' then).
      if (event === 'SIGNED_IN') setView((current) => (current === 'reset' ? current : 'dashboard'));
    });

    // Returning user, or back from Google: go straight to the dashboard
    getSession().then((currentSession) => {
      setSession(currentSession);
      if (currentSession) setView((current) => (current === 'reset' ? current : 'dashboard'));
      setChecking(false);
    });

    return stopListening;
  }, []);

  // Removes the landing page once the sign-in screen has fully opened over it
  useEffect(() => {
    if (!landingBehind) return undefined;
    const timer = setTimeout(() => setLandingBehind(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [landingBehind]);

  // Keep the address bar in sync with `view` (/dashboard, /auth, ...)
  useEffect(() => {
    const path = PATH_BY_VIEW[view];
    if (window.location.pathname === path) return;
    if (firstUrlSync.current) {
      window.history.replaceState({ view }, '', path);
    } else {
      window.history.pushState({ view }, '', path);
    }
  }, [view]);

  useEffect(() => {
    firstUrlSync.current = false;
  }, []);

  // Back/forward buttons: move to whatever view the URL now points at
  useEffect(() => {
    function onPopState() {
      setView(viewForPath(window.location.pathname));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function goToAuth(mode, event) {
    setAuthMode(mode);
    setNotice('');
    setReveal(event ? originOf(event) : null);
    setLandingBehind(Boolean(event));
    setView('auth');
  }

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      console.error(error);
    }
    setSession(null);
    setNotice('Signed out successfully.');
    setView('landing');
  }

  if (!supabase) {
    return (
      <main className="center-message">
        <h1>Supabase keys are missing</h1>
        <p>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>frontend/.env</code>, then restart <code>npm run dev</code>.
        </p>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="center-message">
        <span className="spinner" aria-hidden="true" />
        <span>Loading...</span>
      </main>
    );
  }

  if (view === 'reset') {
    return <ResetPassword session={session} onDone={() => setView('dashboard')} onBack={() => setView('landing')} />;
  }

  // The dashboard needs a logged-in user
  if (view === 'dashboard' && session) {
    return <Dashboard user={session.user} onLogout={handleLogout} />;
  }

  const landing = (
    <Landing
      loggedIn={Boolean(session)}
      notice={notice}
      onGetStarted={(event) => goToAuth('signup', event)}
      onSignIn={(event) => goToAuth('signin', event)}
      onGoDashboard={() => setView('dashboard')}
    />
  );

  if (view === 'auth' || view === 'dashboard') {
    return (
      <>
        {/* The page the user came from stays visible (and untouchable) while the sign-in screen opens over it */}
        {landingBehind && <div inert aria-hidden="true">{landing}</div>}
        <Auth
          mode={authMode}
          reveal={reveal}
          onBack={() => {
            setReveal(null);
            setLandingBehind(false);
            setView('landing');
          }}
        />
      </>
    );
  }

  return landing;
}

export default App;
