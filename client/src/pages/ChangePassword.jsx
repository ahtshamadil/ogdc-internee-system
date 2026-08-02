import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Card, Field, Input, PageHeader } from '../components/ui/index.jsx';

export default function ChangePassword({ forced = false }) {
  const { changePassword, logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await changePassword(form);
      toast.success('Your password has been changed');
      if (!forced) navigate('/');
    } catch (err) {
      setErrors(err.fields || { _: err.message });
      if (!err.fields) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <form onSubmit={submit} className="grid gap-4">
      {errors._ && (
        <div
          className="px-3 py-2.5 rounded-lg"
          style={{ background: 'var(--danger-tint)', color: 'var(--danger-text)', fontSize: 13.5 }}
        >
          {errors._}
        </div>
      )}

      <Field label="Current password" error={errors.current_password} required>
        <Input
          type="password"
          value={form.current_password}
          onChange={set('current_password')}
          error={errors.current_password}
          autoComplete="current-password"
          autoFocus
          required
        />
      </Field>

      <Field
        label="New password"
        error={errors.new_password}
        hint="At least 8 characters."
        required
      >
        <Input
          type="password"
          value={form.new_password}
          onChange={set('new_password')}
          error={errors.new_password}
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="Confirm new password" error={errors.confirm_password} required>
        <Input
          type="password"
          value={form.confirm_password}
          onChange={set('confirm_password')}
          error={errors.confirm_password}
          autoComplete="new-password"
          required
        />
      </Field>

      <div className="flex items-center gap-2 mt-1">
        <Button type="submit" variant="primary" icon={ShieldCheck} loading={busy}>
          Update password
        </Button>
        {forced ? (
          <Button icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        ) : (
          <Button onClick={() => navigate('/')}>Cancel</Button>
        )}
      </div>
    </form>
  );

  if (forced) {
    return (
      <div
        className="min-h-screen grid place-items-center p-6"
        style={{ background: 'var(--canvas)' }}
      >
        <Card className="w-full animate-in" style={{ maxWidth: 430 }}>
          <div className="card-pad">
            <div
              className="mb-4"
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: 'var(--primary-tint)',
                color: 'var(--primary)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <KeyRound size={19} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em' }}>
              Choose a new password
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 5, marginBottom: 20, lineHeight: 1.6 }}>
              You are signed in as <strong style={{ color: 'var(--text)' }}>{user?.username}</strong> with a
              temporary password. Set your own before continuing.
            </p>
            {body}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Your account" subtitle="Change the password you use to sign in." />
      <Card className="max-w-xl">
        <div className="card-pad">{body}</div>
      </Card>
    </>
  );
}
