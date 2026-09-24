// Lets any screen make Edith hop out and say something, without passing props through the whole app.
//   title, text   what the speech bubble says
//   once          a key: say it only once per browser session (per-page greetings)
//   ask           clicking the bubble opens the chat and asks this question straight away
//   celebrate     a bigger, happier hop with a little burst
import { useEffect } from 'react';

const EVENT = 'edith:say';

function seen(key) {
  try {
    return sessionStorage.getItem(`edith-said-${key}`) === '1';
  } catch {
    return false;
  }
}

function remember(key) {
  try {
    sessionStorage.setItem(`edith-said-${key}`, '1');
  } catch {
    /* private mode: she may repeat herself next visit, which is harmless */
  }
}

export function edithSay(message) {
  if (message.once) {
    if (seen(message.once)) return;
    remember(message.once);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

// A screen's once-per-session greeting, a moment after the screen appears (so the page settles first).
// Leaving the screen before then cancels it, and it stays unsaid for next time.
export function useEdithGreeting(message, ready = true, delay = 900) {
  const key = message?.once;
  useEffect(() => {
    if (!ready || !message) return undefined;
    const timer = setTimeout(() => edithSay(message), delay);
    return () => clearTimeout(timer);
    // The message object is rebuilt every render; its `once` key is what identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, delay]);
}

export function onEdithSay(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// While a capture or analysis runs, Edith's button shows she's watching it. label: short text, or null when done.
const BUSY = 'edith:busy';

export function edithBusy(label) {
  window.dispatchEvent(new CustomEvent(BUSY, { detail: label || null }));
}

export function onEdithBusy(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(BUSY, listener);
  return () => window.removeEventListener(BUSY, listener);
}
