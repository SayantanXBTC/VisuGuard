import { motion } from 'framer-motion';
import { Plus, ShieldCheck } from 'lucide-react';
import { APP_NAME } from '../config.js';
import { Button } from './ui.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'history', label: 'Test History' },
];

// The bar at the top of every signed-in screen: brand, the two sections, "New Test" and the profile menu.
function Topbar({ section, onSelect, onNewTest, user, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="topbar-brand" onClick={() => onSelect('dashboard')} aria-label={`${APP_NAME} dashboard`}>
          <ShieldCheck size={22} strokeWidth={2.2} aria-hidden="true" />
          <span>{APP_NAME}</span>
        </button>

        <nav className="topbar-tabs" aria-label="Sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={section === tab.id ? 'topbar-tab topbar-tab-active' : 'topbar-tab'}
              onClick={() => onSelect(tab.id)}
              aria-current={section === tab.id ? 'page' : undefined}
            >
              {section === tab.id && <motion.span layoutId="topbar-pill" className="topbar-pill" transition={{ type: 'spring', stiffness: 500, damping: 42 }} />}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <Button variant="primary" size="sm" icon={Plus} onClick={onNewTest} aria-label="New Test">
            <span className="topbar-new-label">New Test</span>
          </Button>
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

export default Topbar;
