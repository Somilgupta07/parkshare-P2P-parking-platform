import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// <Route element={<ProtectedRoute roles={['admin']} />}> ...children... </Route>
export default function ProtectedRoute({ roles }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted">Loading...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !hasRole(...roles)) return <p className="center error">403 - You do not have access to this page.</p>;
  return <Outlet />;
}
