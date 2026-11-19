import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">ParkShare</Link>
        <nav>
          <NavLink to="/">Home</NavLink>
          {hasRole('admin') && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="spacer" />
        {user ? (
          <>
            <span className="muted">{user.name || user.phone} ({user.roles.join(', ')})</span>
            <button className="btn ghost" onClick={async () => { await logout(); navigate('/login'); }}>Logout</button>
          </>
        ) : (
          <Link className="btn" to="/login">Login</Link>
        )}
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
