import { useState } from 'react';

// Avatar, name, email and Logout for the signed-in user.
function ProfileMenu({ user, onLogout }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Google sign-in fills these in. Email/password users have neither.
  const info = user.user_metadata || {};
  const name = info.full_name || info.name;
  const picture = info.avatar_url || info.picture;
  const initial = (name || user.email || '?')[0].toUpperCase();

  async function handleLogout() {
    setLoggingOut(true);
    await onLogout();
  }

  return (
    <div className="profile">
      <div className="profile-row">
        {picture && !imageFailed ? (
          <img className="avatar" src={picture} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <div className="avatar avatar-default">{initial}</div>
        )}
        <div className="profile-text">
          {name && <strong>{name}</strong>}
          <span className="muted">{user.email}</span>
        </div>
      </div>
      <button className="btn btn-outline btn-block" onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? 'Signing out...' : 'Logout'}
      </button>
    </div>
  );
}

export default ProfileMenu;
