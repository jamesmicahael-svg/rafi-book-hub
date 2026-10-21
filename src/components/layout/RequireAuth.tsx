import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Navbar } from './Navbar';
import { Spinner } from '../ui/Feedback';

export function RequireAuth() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
    </div>
  );
}
