import { useId } from 'react';
import { Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { statusLabel, statusTone } from '../helpers.js';

// The small building blocks every signed-in screen uses. Their look lives in app.css (one place).

// variant: primary | secondary | danger | ghost. size: md | sm.
// While `loading` the label keeps its space (only its opacity changes), so the button never changes width.
export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, children, className = '', type = 'button', disabled, ...props }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${loading ? ' is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 16} aria-hidden="true" />}
      <span className="btn-label">{children}</span>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
    </button>
  );
}

// tone: neutral | captured | busy | done | failed | changed | warning
export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`badge badge-${tone}`}>
      <i className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export const StatusBadge = ({ status }) => <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;

// A dark, softly bordered surface
export function GlassPanel({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`panel ${className}`} {...props}>
      {children}
    </Tag>
  );
}

// Title on the left, an optional small note or action on the right
export function SectionHeader({ title, note, action }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {note && <span className="section-note">{note}</span>}
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

// A short spinner line, for waits that have no content shape yet
export function LoadingState({ label }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// Grey placeholder rows, for lists
export function SkeletonRows({ count = 3, label }) {
  return (
    <div className="skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, n) => <div className="skeleton-row" key={n} />)}
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

// Calm and actionable: what happened, and one button to try again
export function ErrorState({ title, text, onRetry, retryLabel = 'Retry' }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {onRetry && <Button size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}

// value: 0..1, or null for a bar that only moves (when the total is not known)
export function ProgressBar({ value = null }) {
  const known = value !== null;
  return (
    <div className={known ? 'progress' : 'progress progress-indeterminate'} aria-hidden="true">
      <span style={known ? { transform: `scaleX(${Math.min(1, Math.max(0.04, value))})` } : undefined} />
    </div>
  );
}

// A labelled input with an inline message under it. `error` turns it red, `valid` adds a small green check.
export function Field({ label, icon: Icon, error, valid, hint, className = '', ...props }) {
  const id = useId();
  return (
    <div className={`field${error ? ' field-error' : ''}${valid ? ' field-valid' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <span className="input-wrap">
        {Icon && <Icon size={17} aria-hidden="true" />}
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...props} />
        {valid && !error && <CheckCircle2 size={16} className="input-ok" aria-hidden="true" />}
      </span>
      {(error || hint) && <span id={`${id}-msg`} className={error ? 'field-msg field-msg-error' : 'field-msg'}>{error || hint}</span>}
    </div>
  );
}

// One stage in the vertical workflow of a test. state: done | active | waiting | failed
export function FlowStep({ state, title, badge, action, children }) {
  return (
    <section className={`flow-step flow-${state}`}>
      <span className="flow-node" aria-hidden="true">
        {state === 'done' ? <Check size={13} strokeWidth={3} /> : state === 'failed' ? <X size={13} strokeWidth={3} /> : <i />}
      </span>
      <div className="flow-main">
        <header className="flow-head">
          <h2>{title}</h2>
          {badge}
          {action && <div className="flow-action">{action}</div>}
        </header>
        <div className="flow-body">{children}</div>
      </div>
    </section>
  );
}
