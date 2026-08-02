import { useState } from 'react';
import { LogIn, AlertTriangle, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Button, Field, Input } from '../components/ui/index.jsx';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Could not sign in');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Brand panel */}
        <div
          className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, #0d7d5c 0%, #0b6b4f 26%, #084f3b 62%, #062e23 100%)',
          }}
        >
          {/* Soft light bloom, purely decorative */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 620,
              height: 620,
              borderRadius: '50%',
              top: -180,
              right: -220,
              background: 'radial-gradient(circle, rgba(232,163,23,0.22) 0%, rgba(232,163,23,0) 68%)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 520,
              height: 520,
              borderRadius: '50%',
              bottom: -200,
              left: -160,
              background: 'radial-gradient(circle, rgba(43,196,138,0.20) 0%, rgba(43,196,138,0) 70%)',
            }}
          />

          <div className="relative flex items-center gap-3">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.22)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              OG
            </div>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em' }}>
                Oil &amp; Gas Development Company
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.66)' }}>Internee Management System</div>
            </div>
          </div>

          <div className="relative" style={{ color: '#fff', maxWidth: 460 }}>
            <h1 style={{ fontSize: 36, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.18 }}>
              Every internee, every department, one record.
            </h1>
            <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.72)', marginTop: 14, lineHeight: 1.65 }}>
              Register internees with their documents, then see intake by university, degree, city and
              department — month over month, year over year.
            </p>
          </div>

          <div className="relative" style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Internal use only · Runs on the OGDC network
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 relative" style={{ background: 'var(--canvas)' }}>
          <button
            type="button"
            onClick={toggle}
            className="btn btn-ghost btn-icon absolute top-5 right-5"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div style={{ width: '100%', maxWidth: 368 }} className="animate-in">
            <div className="lg:hidden flex items-center gap-2.5 mb-7">
              <div className="brand-mark" style={{ width: 36, height: 36 }}>
                OG
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 650 }}>OGDC Internees</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Management System</div>
              </div>
            </div>

            <h2 style={{ fontSize: 23, fontWeight: 650, letterSpacing: '-0.02em' }}>Sign in</h2>
            <p style={{ fontSize: 14.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 24 }}>
              Use the account issued to you by the administrator.
            </p>

            {error && (
              <div
                className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg"
                style={{
                  background: 'var(--danger-tint)',
                  color: 'var(--danger-text)',
                  fontSize: 13.5,
                  border: '1px solid transparent',
                }}
                role="alert"
              >
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="grid gap-4">
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="e.g. admin"
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" variant="primary" icon={LogIn} loading={busy} className="w-full mt-1">
                Sign in
              </Button>
            </form>

            <p
              style={{
                fontSize: 12.5,
                color: 'var(--text-muted)',
                marginTop: 22,
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              Forgot your password? Ask an administrator to reset it — there is no email recovery on the
              internal network.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
