import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Trash2, X } from 'lucide-react';
import { streamChat } from '../api.js';
import { onEdithSay } from '../edith-bus.js';
import '../edith.css';

const GREETING = "Hi, I'm Edith. Ask me anything about how VisuGuard works.";
const SUGGESTIONS = ['How does VisuGuard work?', 'What is a baseline?', 'How do I export a PDF?', 'What are AI findings?'];
const FACE = '/edith-face.png';
const BODY = '/edith-robot.png';
const SHOW_MS = 5200; // how long she stays out before hopping back
const BURST = Array.from({ length: 10 }, (_, n) => (n / 10) * Math.PI * 2);

// Edith: the assistant in the bottom right corner. Her answers come from the backend (/api/chat), which holds the key.
// Any screen can make her hop out and say something through edith-bus.js.
function Edith() {
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState(null); // { title, text, ask, celebrate } while she's out
  const hideTimer = useRef(null);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Scroll only the message list. (scrollIntoView would also scroll the page behind, which moved the home screen out of view.)
  const scrollDown = () => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  };
  useEffect(scrollDown, [messages, waiting, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const stopAnswer = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };
  useEffect(() => stopAnswer, []);

  // Hop out when a screen asks her to. A new message replaces the one showing (never a queue of bubbles).
  // Skipped while the chat is open: she's already talking to you.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const stop = onEdithSay((message) => {
      if (openRef.current) return;
      clearTimeout(hideTimer.current);
      setGreeting({ ...message, key: Date.now() });
      hideTimer.current = setTimeout(() => setGreeting(null), message.celebrate ? SHOW_MS + 1500 : SHOW_MS);
    });
    return () => {
      stop();
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Opening the chat ends the hello straight away
  useEffect(() => {
    if (open) setGreeting(null);
  }, [open]);

  // Clicking the bubble opens the chat; some messages come with a question to ask right away
  function acceptGreeting() {
    const question = greeting?.ask;
    setOpen(true);
    if (question) setTimeout(() => send(question), 250);
  }

  // The answer appears while it is written: the last message grows with every piece that arrives
  async function send(text) {
    const question = text.trim();
    if (!question || waiting) return;
    const history = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setDraft('');
    setWaiting(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const showAnswer = (content) => !controller.signal.aborted && setMessages([...history, { role: 'assistant', content }]);
    try {
      const answer = await streamChat(history.map(({ role, content }) => ({ role, content })), showAnswer, controller.signal);
      if (!answer) throw new Error('Edith could not answer right now. Please try again.');
      showAnswer(answer);
    } catch (err) {
      if (controller.signal.aborted) return; // the chat was cleared: nothing to show
      // Keep whatever part of the answer already arrived, and add the problem after it
      setMessages((list) => [...list, { role: 'assistant', content: err.message || 'Edith could not answer right now.', error: true }]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setWaiting(false);
      }
    }
  }

  // Delete chat: stop any answer that is still coming and go back to the greeting
  function clearChat() {
    stopAnswer();
    setWaiting(false);
    setDraft('');
    setMessages([{ role: 'assistant', content: GREETING }]);
    inputRef.current?.focus();
  }

  const started = messages.length > 1;

  return (
    <div className="edith">
      <AnimatePresence>
        {open && (
          <motion.section
            className="edith-panel"
            aria-label="Edith, the VisuGuard assistant"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <header className="edith-head">
              <img className="edith-avatar" src={FACE} alt="" />
              <div>
                <strong>Edith</strong>
                <span>VisuGuard assistant</span>
              </div>
              <button className="edith-close" onClick={clearChat} disabled={!started} aria-label="Delete chat" title="Delete chat">
                <Trash2 size={15} aria-hidden="true" />
              </button>
              <button className="edith-close" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="edith-messages" aria-live="polite" ref={listRef}>
              {messages.map((message, index) => (
                <div key={index} className={`edith-msg edith-${message.role}${message.error ? ' edith-error' : ''}`}>
                  {message.content}
                </div>
              ))}
              {waiting && messages[messages.length - 1].role === 'user' && (
                <div className="edith-msg edith-assistant edith-typing" aria-label="Edith is typing">
                  <i /><i /><i />
                </div>
              )}
              {!started && !waiting && (
                <div className="edith-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>
                  ))}
                </div>
              )}
            </div>

            <form className="edith-form" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about VisuGuard"
                maxLength={500}
                aria-label="Your question"
              />
              <button type="submit" disabled={!draft.trim() || waiting} aria-label="Send">
                <ArrowUp size={16} aria-hidden="true" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {greeting && !open && (
          <div className="edith-greet" key={greeting.key}>
            <motion.button
              type="button"
              className="edith-bubble"
              onClick={acceptGreeting}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.35, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] } }}
              exit={{ opacity: 0, y: 6, scale: 0.95, transition: { duration: 0.18 } }}
            >
              <strong>{greeting.title}</strong>
              <span>{greeting.text}</span>
              {greeting.ask && <em>Tap to ask me</em>}
            </motion.button>
            <div className="edith-hop-wrap">
              {greeting.celebrate &&
                BURST.map((angle, n) => (
                  <motion.i
                    key={n}
                    className="edith-spark"
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: Math.cos(angle) * 78,
                      y: Math.sin(angle) * 78 - 30,
                      scale: [0.4, 1, 0.6],
                      transition: { delay: 0.45 + (n % 3) * 0.06, duration: 0.9, ease: 'easeOut' },
                    }}
                  />
                ))}
              <motion.img
                className="edith-hop"
                src={BODY}
                alt="Edith, the VisuGuard robot"
                onClick={acceptGreeting}
                initial={{ opacity: 0, y: 90, scale: 0.35, rotate: -8 }}
                animate={
                  greeting.celebrate
                    ? { opacity: 1, y: [90, -28, 0, -12, 0], scale: [0.35, 1.08, 1, 1.03, 1], rotate: [-8, 8, -5, 3, 0], transition: { duration: 1.2, ease: 'easeOut' } }
                    : { opacity: 1, y: 0, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 14, mass: 0.9 } }
                }
                exit={{ opacity: 0, y: 90, scale: 0.35, rotate: 6, transition: { duration: 0.38, ease: [0.5, 0, 0.75, 0] } }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <button className="edith-launcher" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close Edith' : 'Ask Edith'}>
        <img className="edith-avatar edith-avatar-launcher" src={FACE} alt="" />
        {!open && <span className="edith-launcher-label">Ask Edith</span>}
        {open && <X size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

export default Edith;
