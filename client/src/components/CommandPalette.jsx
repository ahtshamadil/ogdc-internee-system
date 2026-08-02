import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { api, qs } from '../api/client.js';
import { useDebounced } from '../hooks/useApi.js';
import { formatDate, STATUS_CLASS } from '../lib/format.js';
import { Pill, Avatar } from './ui/index.jsx';

/** Ctrl/Cmd-K jump-to-intern. */
export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRows([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    api
      .get(`/interns${qs({ search: debounced, pageSize: 8, sort: 'joining_date', dir: 'desc' })}`, {
        signal: controller.signal,
      })
      .then((data) => setRows(data.rows))
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [debounced, open]);

  const go = (intern) => {
    navigate(`/interns/${intern.id}`);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault();
      go(rows[active]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ alignItems: 'flex-start', paddingTop: '12vh' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 560 }} role="dialog" aria-modal="true" aria-label="Search internees">
        <div className="flex items-center gap-2.5 px-4" style={{ height: 50, borderBottom: '1px solid var(--hairline)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search by name, intern code, CNIC or enrollment no…"
            className="flex-1 bg-transparent border-0 outline-none"
            style={{ fontSize: 15 }}
          />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 380, padding: 6 }}>
          {loading && !rows.length && (
            <div style={{ padding: 22, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              Searching…
            </div>
          )}
          {!loading && !rows.length && (
            <div style={{ padding: 22, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              {query ? `No internee matches “${query}”` : 'Start typing to search'}
            </div>
          )}
          {rows.map((row, i) => (
            <button
              key={row.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(row)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
              style={{ background: i === active ? 'var(--surface-hover)' : 'transparent' }}
            >
              <Avatar internId={row.id} photoPath={row.photo_path} name={row.full_name} size={29} />
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 14, fontWeight: 550 }} className="truncate-1">
                  {row.full_name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }} className="truncate-1">
                  {row.intern_code} · {row.university_short || row.university_name || 'No university'} ·{' '}
                  {formatDate(row.joining_date)}
                </div>
              </div>
              <Pill tone={STATUS_CLASS[row.status]?.replace('pill-', '') || 'neutral'}>{row.status}</Pill>
              {i === active && <CornerDownLeft size={13} style={{ color: 'var(--text-muted)' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
