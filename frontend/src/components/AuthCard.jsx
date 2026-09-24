import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
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

  const passwordType = showPassword ? 'text' : 'password';

  return (
    <div className="glass-card">
      <div className="glass-heading">
        <span className="brand">{APP_NAME}</span>
        <h1>{titles[mode]}</h1>
        <p>{subtitles[mode]}</p>
      </div>

      {error && <p className="banner banner-error" role="alert">{error}</p>}
      {message && <p className="banner banner-success">{message}</p>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="float-field">
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder=" "
          />
          <label htmlFor="auth-email"><Mail size={16} aria-hidden="true" /> Email address</label>
        </div>

        {mode !== 'forgot' && (
          <div className="float-field">
            <input
              id="auth-password"
              type={passwordType}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder=" "
            />
            <label htmlFor="auth-password"><Lock size={16} aria-hidden="true" /> Password</label>
            <button
              type="button"
              className="peek-button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <div className="float-field">
            <input
              id="auth-confirm"
              type={passwordType}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder=" "
            />
            <label htmlFor="auth-confirm"><Lock size={16} aria-hidden="true" /> Confirm password</label>
          </div>
        )}

        {mode === 'signin' && (
          <button type="button" className="glass-link glass-forgot" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}

        <button type="submit" className="glass-submit" disabled={Boolean(busy)}>
          {busy && busy !== GOOGLE_BUSY ? busy : submitLabels[mode]}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>

      {mode !== 'forgot' && (
        <>
          <div className="glass-divider"><span>or continue with</span></div>
          <button
            type="button"
            className="glass-google"
            onClick={() => run(GOOGLE_BUSY, signInWithGoogle, 'Unable to sign in with Google.')}
            disabled={Boolean(busy)}
          >
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
            </svg>
            {busy === GOOGLE_BUSY ? busy : 'Continue with Google'}
          </button>
        </>
      )}

      <p className="glass-switch">
        {mode === 'signin' && (
          <>Don&apos;t have an account? <button type="button" className="glass-link glass-link-strong" onClick={() => switchMode('signup')}>Sign Up</button></>
        )}
        {mode === 'signup' && (
          <>Already have an account? <button type="button" className="glass-link glass-link-strong" onClick={() => switchMode('signin')}>Sign In</button></>
        )}
        {mode === 'forgot' && (
          <button type="button" className="glass-link glass-link-strong" onClick={() => switchMode('signin')}>Back to Sign In</button>
        )}
      </p>
    </div>
  );
}

export default AuthCard;
