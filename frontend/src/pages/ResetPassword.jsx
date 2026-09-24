import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import SmokeyBackground from '../components/SmokeyBackground.jsx';
import '../auth.css';
import { APP_NAME } from '../config.js';
import { updatePassword, friendlyAuthError } from '../auth.js';

// Shown when the user opens the link from the password-reset email.
function ResetPassword({ session, onDone, onBack }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Password confirmation does not match.');

    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      setUpdated(true);
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err, 'Unable to update password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-stage auth-stage-fade">
      <div className="auth-backdrop">
        <SmokeyBackground />
      </div>
      <div className="auth-content">
        <div className="glass-card">
          <div className="glass-heading">
            <span className="brand">{APP_NAME}</span>
            <h1>Choose a new password</h1>
          </div>

          {!session && (
            <>
              <p className="banner banner-error">This reset link is invalid or has expired.</p>
              <button className="glass-google" onClick={onBack}>Back to home</button>
            </>
          )}

          {session && updated && (
            <>
              <p className="banner banner-success">Password updated successfully.</p>
              <button className="glass-submit" onClick={onDone}>Continue to Dashboard <ArrowRight size={18} aria-hidden="true" /></button>
            </>
          )}

          {session && !updated && (
            <>
              {error && <p className="banner banner-error" role="alert">{error}</p>}
              <form onSubmit={handleSubmit} noValidate>
                <div className="float-field">
                  <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder=" " />
                  <label htmlFor="reset-password"><Lock size={16} aria-hidden="true" /> New password</label>
                </div>
                <div className="float-field">
                  <input id="reset-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder=" " />
                  <label htmlFor="reset-confirm"><Lock size={16} aria-hidden="true" /> Confirm new password</label>
                </div>
                <button type="submit" className="glass-submit" disabled={busy}>
                  {busy ? 'Updating password...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default ResetPassword;
