import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../../api/client.js';
import { Badge, Pager } from '../../components/Table.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', status: '', page: 1 });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    api.get('/admin/users', { params }).then((r) => { setRows(r.data.data); setMeta(r.data.meta); setError(''); })
      .catch((e) => setError(errMsg(e)));
  }, [filters]);
  useEffect(load, [load]);

  const toggle = async (u) => {
    const status = u.status === 'blocked' ? 'active' : 'blocked';
    if (!confirm(`${status === 'blocked' ? 'Block' : 'Unblock'} ${u.name || u.phone}?`)) return;
    try { await api.patch(`/admin/users/${u.id}/status`, { status }); load(); } catch (e) { alert(errMsg(e)); }
  };
  const f = (k) => (e) => setFilters({ ...filters, [k]: e.target.value, page: 1 });

  return (
    <>
      <div className="filters">
        <input placeholder="Search name / phone / email" value={filters.search} onChange={f('search')} />
        <select value={filters.role} onChange={f('role')}><option value="">All roles</option><option>seeker</option><option>host</option><option>admin</option></select>
        <select value={filters.status} onChange={f('status')}><option value="">All status</option><option>active</option><option>blocked</option></select>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Roles</th><th>Status</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name || '-'}</td><td>{u.phone}</td><td>{u.roles.join(', ')}</td>
              <td><Badge value={u.status} /></td><td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>{u.id !== me.id && <button className="btn ghost" onClick={() => toggle(u)}>{u.status === 'blocked' ? 'Unblock' : 'Block'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
    </>
  );
}
