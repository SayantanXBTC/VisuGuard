import { useState, useEffect } from 'react';
import { ShieldCheck, Menu, X, CheckCircle2 } from 'lucide-react';
import { APP_NAME } from '../config.js';
import Panel, { PANELS } from '../components/landing/Panels.jsx';

const NAV_LINKS = PANELS.filter((panel) => panel.id !== 'hero');

export default function Landing({ loggedIn, notice, onGetStarted, onSignIn, onGoDashboard }) {
  const [activeId, setActiveId] = useState('hero');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(Boolean(notice));

  useEffect(() => {
    if (!notice) return;
    setShowNotice(true);
    const timer = setTimeout(() => setShowNotice(false), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const show = (id) => {
    setMenuOpen(false);
    setActiveId(id);
  };

  const accountButtons = loggedIn ? (
    <button
      type="button"
      onClick={onGoDashboard}
      className="rounded-full bg-white text-black font-medium text-sm px-5 py-2 hover:bg-gray-200 transition-colors cursor-pointer"
    >
      Go to Dashboard
    </button>
  ) : (
    <>
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-full liquid-glass text-white font-medium text-sm px-5 py-2 hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={onGetStarted}
        className="rounded-full bg-white text-black font-medium text-sm px-5 py-2 hover:bg-gray-200 transition-colors cursor-pointer"
      >
        Get Started
      </button>
    </>
  );

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-black text-white font-['Inter',sans-serif] flex flex-col select-none">
      <video
        className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Blur at the bottom, so the text on the left stays readable */}
      <div
        className="fixed inset-0 pointer-events-none backdrop-blur-xl z-[1]"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
          maskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
        }}
        aria-hidden="true"
      />

      {showNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-blur-fade-up">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full liquid-glass text-xs font-medium text-emerald-300 shadow-xl">
            <CheckCircle2 size={15} />
            <span>{notice}</span>
          </div>
        </div>
      )}

      <header className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-6 shrink-0">
        <button
          type="button"
          onClick={() => show('hero')}
          className="h-8 md:h-10 flex items-center gap-2.5 font-bold tracking-tight text-white animate-blur-fade-up cursor-pointer bg-transparent border-0 p-0"
          aria-label={`${APP_NAME} home`}
        >
          <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 text-white stroke-[2.2]" />
          <span className="text-lg md:text-xl font-semibold tracking-wider uppercase">{APP_NAME}</span>
        </button>

        <nav className="hidden lg:flex items-center gap-8" aria-label="Sections">
          {NAV_LINKS.map((link, index) => (
            <button
              key={link.id}
              type="button"
              onClick={() => show(link.id)}
              aria-current={activeId === link.id ? 'true' : undefined}
              className={`text-sm font-medium bg-transparent p-0 pb-1 cursor-pointer animate-blur-fade-up border-b transition-colors ${
                activeId === link.id ? 'text-white border-white' : 'text-gray-300 border-transparent hover:text-white'
              }`}
              style={{ animationDelay: `${100 + index * 50}ms` }}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 animate-blur-fade-up" style={{ animationDelay: '350ms' }}>
            {accountButtons}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full liquid-glass text-white cursor-pointer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Menu for screens below lg */}
      <div
        className={`absolute top-[72px] inset-x-0 z-40 transition-all duration-300 ease-out ${
          menuOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-4 opacity-0 invisible pointer-events-none'
        }`}
      >
        <div className="bg-black/80 backdrop-blur-lg border-y border-white/10 px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => show(link.id)}
              className={`w-full text-left py-3 px-3 rounded-lg text-sm font-medium cursor-pointer hover:bg-white/10 ${
                activeId === link.id ? 'text-white bg-white/10' : 'text-gray-300'
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="sm:hidden flex items-center gap-3 pt-3 mt-2 border-t border-white/10">{accountButtons}</div>
        </div>
      </div>

      {/* The screen for the chosen link, bottom left. It scrolls only when the window is too small for it. */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col px-4 sm:px-6 md:px-12 pb-20 md:pb-14 z-10 relative">
        <div className="mt-auto">
          <div key={activeId} className="flex-1 min-w-0">
            <Panel id={activeId} />
          </div>

        </div>
      </main>
    </div>
  );
}
