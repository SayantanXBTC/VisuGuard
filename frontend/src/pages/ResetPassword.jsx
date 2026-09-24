import { useState } from 'react';
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
    <div className="auth-page">
      <div className="auth-card">
        <span className="brand">{APP_NAME}</span>
        <h1>Choose a new password</h1>

        {!session && (
          <>
            <p className="banner banner-error">This reset link is invalid or has expired.</p>
            <button className="btn btn-outline btn-block" onClick={onBack}>Back to home</button>
          </>
        )}

        {session && updated && (
          <>
            <p className="banner banner-success">Password updated successfully.</p>
            <button className="btn btn-primary btn-block" onClick={onDone}>Continue to Dashboard</button>
          </>
        )}

        {session && !updated && (
          <>
            {error && <p className="banner banner-error" role="alert">{error}</p>}
            <form onSubmit={handleSubmit} noValidate>
              <label>
                New Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <label>
                Confirm New Password
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
