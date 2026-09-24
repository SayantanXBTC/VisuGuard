import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getSession, onAuthChange, signOut } from './auth.js';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// The link in a password-reset email brings the user back with this in the URL
const cameFromResetEmail = window.location.hash.includes('type=recovery');

// No router: `view` says which screen to show.
// view is one of: 'landing' | 'auth' | 'dashboard' | 'reset'
function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true); // true until we know if someone is logged in
  const [view, setView] = useState(cameFromResetEmail ? 'reset' : 'landing');
  const [authMode, setAuthMode] = useState('signin'); // which tab the Auth page opens on
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return;

    // Start listening first so no event (like PASSWORD_RECOVERY) is missed
    const stopListening = onAuthChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setView('reset');
      if (event === 'SIGNED_OUT') setView('landing');
      // Only move to the dashboard if the user was on the Auth page
      if (event === 'SIGNED_IN') setView((current) => (current === 'auth' ? 'dashboard' : current));
    });

    // Returning user, or back from Google: go straight to the dashboard
    getSession().then((currentSession) => {
      setSession(currentSession);
      if (currentSession) setView((current) => (current === 'reset' ? current : 'dashboard'));
      setChecking(false);
    });

    return stopListening;
  }, []);

  function goToAuth(mode) {
    setAuthMode(mode);
    setNotice('');
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

  if (checking) return <main className="center-message">Loading...</main>;

  if (view === 'reset') {
    return <ResetPassword session={session} onDone={() => setView('dashboard')} onBack={() => setView('landing')} />;
  }

  // The dashboard needs a logged-in user
  if (view === 'dashboard' && session) {
    return <Dashboard user={session.user} onLogout={handleLogout} />;
  }

  if (view === 'auth' || view === 'dashboard') {
    return <Auth mode={authMode} onBack={() => setView('landing')} />;
  }

  return (
    <Landing
      loggedIn={Boolean(session)}
      notice={notice}
      onGetStarted={() => goToAuth('signup')}
      onSignIn={() => goToAuth('signin')}
      onGoDashboard={() => setView('dashboard')}
    />
  );
}

export default App;
