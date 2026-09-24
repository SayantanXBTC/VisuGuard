import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut } from 'lucide-react';
import { Button } from './ui.jsx';

// The avatar in the top bar. Click it to see who is signed in, and Sign out.
function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);

  // Google sign-in fills these in. Email/password users have neither.
  const info = user.user_metadata || {};
  const name = info.full_name || info.name;
  const picture = info.avatar_url || info.picture;
  const initial = (name || user.email || '?')[0].toUpperCase();

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    await onLogout();
  }

  const avatar =
    picture && !imageFailed ? (
      <img className="avatar" src={picture} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
    ) : (
      <span className="avatar avatar-default">{initial}</span>
    );

  return (
    <div className="profile" ref={menuRef}>
      <button className="profile-button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        {avatar}
        <ChevronDown size={14} aria-hidden="true" className={open ? 'profile-chevron profile-chevron-open' : 'profile-chevron'} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="profile-popover"
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            <div className="profile-info">
              {avatar}
              <div>
                {name && <strong>{name}</strong>}
                <span>{user.email}</span>
              </div>
            </div>
            <Button size="sm" className="btn-block" role="menuitem" icon={LogOut} onClick={handleLogout} loading={loggingOut}>
              Sign out
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProfileMenu;
