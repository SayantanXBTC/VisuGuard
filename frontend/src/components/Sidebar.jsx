import { APP_NAME } from '../config.js';
import ProfileMenu from './ProfileMenu.jsx';

function Sidebar({ section, onSelect, user, onLogout }) {
  return (
    <aside className="sidebar">
      <span className="brand">{APP_NAME}</span>

      <nav className="sidebar-nav">
        <button className={section === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => onSelect('dashboard')}>
          Dashboard
        </button>
        <button className={section === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => onSelect('history')}>
          Test History
        </button>
      </nav>

      <ProfileMenu user={user} onLogout={onLogout} />
    </aside>
  );
}

export default Sidebar;
