import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { initials } from '../../lib/format.js';

/* ==========================================================================
   Card
   ========================================================================== */

export function Card({ children, className = '', pad = false, ...rest }) {
  return (
    <div className={`card ${pad ? 'card-pad' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`card-header ${className}`}>
      <div className="min-w-0">
        <div className="card-title">{title}</div>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ==========================================================================
   Button
   ========================================================================== */

export function Button({
  children,
  variant = 'secondary',
  size,
  icon: Icon,
  loading = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const iconOnly = !children && Icon;
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${iconOnly ? 'btn-icon' : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 13 : 15} />
      )}
      {children}
    </button>
  );
}

/* ==========================================================================
   Form fields
   ========================================================================== */

export function Field({ label, error, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
      )}
      {children}
      {error && (
        <div className="field-error">
          <AlertTriangle size={11} /> {error}
        </div>
      )}
      {!error && hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Input({ error, className = '', ...rest }) {
  return <input className={`input ${className}`} aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Textarea({ error, className = '', ...rest }) {
  return <textarea className={`textarea ${className}`} aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Select({ error, options = [], placeholder, className = '', children, ...rest }) {
  return (
    <select className={`select ${className}`} aria-invalid={error ? 'true' : undefined} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value ?? opt.id} value={opt.value ?? opt.id}>
          {opt.label ?? opt.name}
        </option>
      ))}
      {children}
    </select>
  );
}

export function Checkbox({ label, className = '', ...rest }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${className}`}>
      <input type="checkbox" className="checkbox" {...rest} />
      <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </label>
  );
}

/* ==========================================================================
   Avatar
   ========================================================================== */

/**
 * The internee's photograph wherever one exists, initials otherwise.
 *
 * Photos are behind the authenticated document route, so the browser sends the
 * session cookie with the <img> request like any other same-origin asset. If
 * the file has gone missing on disk the request 404s -- onError then falls back
 * to initials rather than leaving a broken-image icon in a table.
 */
export function Avatar({ internId, photoPath, name, size = 32, radius, className = '', style = {} }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = internId && photoPath && !failed;

  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        ...(radius ? { borderRadius: radius } : {}),
        ...style,
      }}
      title={name}
    >
      {showPhoto ? (
        <img
          src={`/api/interns/${internId}/photo`}
          alt=""
          /* Not lazy: these are 1-2 KB and cached for 5 minutes, so deferring
             them saves nothing and risks a table of blank circles if the
             browser's lazy heuristics do not fire. */
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}

/* ==========================================================================
   Pill
   ========================================================================== */

export function Pill({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`pill pill-${tone} ${className}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

/* ==========================================================================
   Skeleton
   ========================================================================== */

export function Skeleton({ w = '100%', h = 14, className = '', style = {} }) {
  return <div className={`skeleton ${className}`} style={{ width: w, height: h, ...style }} />;
}

export function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} style={{ padding: '11px 14px' }}>
              <Skeleton h={12} w={c === 0 ? '70%' : '55%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* ==========================================================================
   Empty state
   ========================================================================== */

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={21} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 380 }}>{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ==========================================================================
   Modal
   ========================================================================== */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the modal from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="card-header shrink-0">
            <div className="min-w-0">
              <div className="card-title">{title}</div>
              {subtitle && <div className="card-subtitle">{subtitle}</div>}
            </div>
            <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
          </div>
        )}
        <div className="overflow-y-auto p-5 min-h-0">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3.5 shrink-0"
            style={{ borderTop: '1px solid var(--hairline)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog -- destructive actions never fire on a single click. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={variant} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

/* ==========================================================================
   Tabs & segmented control
   ========================================================================== */

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={value === tab.value}
          className="tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && <tab.icon size={14} />}
          {tab.label}
          {tab.count != null && (
            <span
              className="tnum"
              style={{
                fontSize: 12,
                padding: '0 5px',
                borderRadius: 999,
                background: 'var(--surface-sunken)',
                color: 'var(--text-muted)',
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   Misc
   ========================================================================== */

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--text-muted)' }} />;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div className="min-w-0">
        <h1 style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Could not load this"
      description={error?.message || 'Something went wrong.'}
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  );
}
