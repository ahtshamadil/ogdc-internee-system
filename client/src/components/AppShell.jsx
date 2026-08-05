import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileBarChart, Upload, Settings, LogOut,
  Moon, Sun, PanelLeftClose, PanelLeft, Search, ChevronDown, ShieldCheck,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { initials } from '../lib/format.js';
import CommandPalette from './CommandPalette.jsx';
import { LogoMark } from './Logo.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/interns', label: 'Internees', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/import', label: 'Import', icon: Upload, roles: ['admin', 'hr'] },
  { to: '/admin', label: 'Administration', icon: Settings, roles: ['admin'] },
];

/**
 * Labels stay mounted and collapse via CSS rather than being conditionally
 * rendered.
 *
 * Removing them from the DOM makes them vanish on the first frame while the
 * sidebar width animates over the next 220ms -- the text pops out, then the
 * panel catches up. Animating them out in step with the width is what makes the
 * collapse read as one movement.
 */
function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <LogoMark size={24} color="#fff" title="OGDC" />
        </div>
        <div className="nav-label min-w-0">
          <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em' }} className="truncate-1">
            OGDC Internees
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }} className="truncate-1">
            the energy
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <div className="nav-section-label nav-label">Main</div>
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="nav-item"
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} strokeWidth={1.8} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--hairline)', padding: 8 }}>
        <button
          type="button"
          onClick={onToggle}
          className="nav-item w-full"
          style={{ margin: 0 }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    // Defer so the click that opened the menu does not immediately close it.
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg transition-colors"
        style={{ background: open ? 'var(--surface-hover)' : 'transparent' }}
      >
        <div className="avatar" style={{ width: 27, height: 27, fontSize: 11.5 }}>
          {initials(user?.full_name)}
        </div>
        <div className="text-left hidden sm:block">
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{user?.full_name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.25 }}>
            {ROLE_LABELS[user?.role]}
          </div>
        </div>
        <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 animate-in"
          style={{
            width: 210,
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            padding: 5,
          }}
        >
          <div style={{ padding: '7px 10px 9px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user?.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{user?.username}</div>
          </div>
          <div className="divider" style={{ margin: '2px 0 5px' }} />
          <button type="button" className="nav-item w-full" style={{ margin: 0 }} onClick={() => navigate('/account')}>
            <ShieldCheck size={15} strokeWidth={1.8} /> Change password
          </button>
          <button
            type="button"
            className="nav-item w-full"
            style={{ margin: 0, color: 'var(--danger-text)' }}
            onClick={logout}
          >
            <LogOut size={15} strokeWidth={1.8} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ogdc-sidebar') === 'collapsed');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    localStorage.setItem('ogdc-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="app-main">
        <header className="topbar no-print">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline-strong)',
              color: 'var(--text-muted)',
              fontSize: 14,
              minWidth: 200,
              maxWidth: 320,
              flex: '0 1 auto',
            }}
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search internees…</span>
            <kbd
              style={{
                fontSize: 11,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--surface-sunken)',
                border: '1px solid var(--hairline)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Ctrl K
            </kbd>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={toggle}
            className="btn btn-ghost btn-icon"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <UserMenu />
        </header>

        <main className="page">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
