import { useState } from 'react';
import { APP_NAME } from '../config.js';
import { signIn, signUp, signInWithGoogle, resetPassword, friendlyAuthError } from '../auth.js';

const GOOGLE_BUSY = 'Signing in with Google...';

const titles = { signin: 'Sign in', signup: 'Create your account', forgot: 'Reset your password' };
const subtitles = {
  signin: 'Welcome back.',
  signup: 'Start comparing your deployments.',
  forgot: 'Enter your email and we will send you a reset link.',
};
const submitLabels = { signin: 'Sign In', signup: 'Create Account', forgot: 'Send Reset Email' };

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

// One card for sign in, sign up and forgot password.
function AuthCard({ initialMode }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(''); // text of the action in progress, '' when idle

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  function showError(text) {
    setMessage('');
    setError(text);
  }

  // Runs one auth action with a loading label, and shows a friendly error if it fails
  async function run(label, action, fallbackError) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err, fallbackError));
    } finally {
      setBusy('');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!isValidEmail(email)) return showError('Please enter a valid email.');

    if (mode === 'forgot') {
      return run('Sending reset email...', async () => {
        await resetPassword(email);
        setMessage('Password reset email sent. Check your inbox.');
      }, 'Unable to send reset email.');
    }

    if (!password) return showError('Please enter your password.');

    if (mode === 'signin') {
      // On success App.jsx notices the new session and shows the dashboard
      return run('Signing in...', () => signIn(email, password), 'Unable to sign in.');
    }

    // sign up
    if (password.length < 6) return showError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return showError('Password confirmation does not match.');

    return run('Creating account...', async () => {
      const data = await signUp(email, password);
      // Supabase hides "email already used" by returning a user with no identities
      if (data.user?.identities?.length === 0) throw new Error('User already registered');
      // No session means Supabase is waiting for the user to confirm their email
      if (!data.session) {
        setMessage('Account created successfully. Check your email to confirm your account.');
      }
    }, 'Unable to create account.');
  }

  return (
    <div className="auth-card">
      <span className="brand">{APP_NAME}</span>
      <h1>{titles[mode]}</h1>
      <p className="muted">{subtitles[mode]}</p>

      {error && <p className="banner banner-error" role="alert">{error}</p>}
      {message && <p className="banner banner-success">{message}</p>}

      <form onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        {mode !== 'forgot' && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
        )}

        {mode === 'signup' && (
          <label>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={Boolean(busy)}>
          {busy && busy !== GOOGLE_BUSY ? busy : submitLabels[mode]}
        </button>
      </form>

      {mode === 'signin' && (
        <button className="link-button forgot-link" onClick={() => switchMode('forgot')}>
          Forgot password?
        </button>
      )}

      {mode !== 'forgot' && (
        <>
          <div className="divider"><span>or</span></div>
          <button
            className="btn btn-outline btn-block"
            onClick={() => run(GOOGLE_BUSY, signInWithGoogle, 'Unable to sign in with Google.')}
            disabled={Boolean(busy)}
          >
            {busy === GOOGLE_BUSY ? busy : 'Continue with Google'}
          </button>
        </>
      )}

      <p className="switch-mode">
        {mode === 'signin' && (
          <>Don&apos;t have an account? <button className="link-button" onClick={() => switchMode('signup')}>Sign Up</button></>
        )}
        {mode === 'signup' && (
          <>Already have an account? <button className="link-button" onClick={() => switchMode('signin')}>Sign In</button></>
        )}
        {mode === 'forgot' && (
          <button className="link-button" onClick={() => switchMode('signin')}>Back to Sign In</button>
        )}
      </p>
    </div>
  );
}

export default AuthCard;
