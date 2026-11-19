import { useEffect, useState } from 'react';
import { api, errMsg } from '../../api/client.js';

const Stat = ({ label, value }) => (
  <div className="card stat"><div className="muted">{label}</div><div className="big">{value ?? 0}</div></div>
);

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/stats').then((r) => setS(r.data.data)).catch((e) => setError(errMsg(e))); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!s) return <p className="muted">Loading...</p>;
  return (
    <div className="grid">
      <Stat label="Users" value={s.users.total} />
      <Stat label="Hosts" value={s.users.hosts} />
      <Stat label="Blocked users" value={s.users.blocked} />
      <Stat label="Listings pending" value={s.listings.pending} />
      <Stat label="Listings approved" value={s.listings.approved} />
      <Stat label="Bookings confirmed" value={s.bookings.CONFIRMED} />
      <Stat label="Revenue (captured)" value={`Rs ${s.revenue}`} />
    </div>
  );
}
