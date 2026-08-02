import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import { Spinner } from './components/ui/index.jsx';

import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InternList from './pages/InternList.jsx';
import InternDetail from './pages/InternDetail.jsx';
import InternForm from './pages/InternForm.jsx';
import Reports from './pages/Reports.jsx';
import ImportPage from './pages/Import.jsx';
import Admin from './pages/Admin.jsx';

/** Blocks a route for roles that should not reach it, even by typing the URL. */
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--canvas)' }}>
        <Spinner size={22} />
      </div>
    );
  }

  if (!user) return <Login />;

  // A freshly-issued or reset password must be changed before anything else is
  // reachable -- otherwise shared temporary passwords linger for months.
  if (user.must_change_password) return <ChangePassword forced />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/interns" element={<InternList />} />
        <Route
          path="/interns/new"
          element={
            <RequireRole roles={['admin', 'hr']}>
              <InternForm />
            </RequireRole>
          }
        />
        <Route path="/interns/:id" element={<InternDetail />} />
        <Route
          path="/interns/:id/edit"
          element={
            <RequireRole roles={['admin', 'hr']}>
              <InternForm />
            </RequireRole>
          }
        />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/import"
          element={
            <RequireRole roles={['admin', 'hr']}>
              <ImportPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole roles={['admin']}>
              <Admin />
            </RequireRole>
          }
        />
        <Route path="/account" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
