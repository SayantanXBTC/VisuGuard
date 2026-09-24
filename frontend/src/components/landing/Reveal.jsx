import { motion } from 'framer-motion';

const ease = [0.2, 0.7, 0.2, 1];

// Fades and lifts its content in once when it scrolls into view. delay is in seconds.
export function Reveal({ children, delay = 0, y = 22, className, as = 'div' }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </Tag>
  );
}

// Reveals its children one after the other. Children must be motion elements with variants={item}.
export const stagger = (gap = 0.08) => ({ hidden: {}, visible: { transition: { staggerChildren: gap } } });
export const item = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};
