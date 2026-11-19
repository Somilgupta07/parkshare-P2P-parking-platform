import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <>
      <div className="tabs">
        <NavLink end to="/admin">Dashboard</NavLink>
        <NavLink to="/admin/users">Users</NavLink>
        <NavLink to="/admin/listings">Listings</NavLink>
        <NavLink to="/admin/bookings">Bookings</NavLink>
      </div>
      <Outlet />
    </>
  );
}
