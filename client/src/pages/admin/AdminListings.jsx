import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../../api/client.js';
import { Badge, Pager } from '../../components/Table.jsx';

export default function AdminListings() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/admin/listings', { params: { page, ...(status && { status }) } })
      .then((r) => { setRows(r.data.data); setMeta(r.data.meta); setError(''); }).catch((e) => setError(errMsg(e)));
  }, [status, page]);
  useEffect(load, [load]);

  const decide = async (l, next) => {
    let reason;
    if (next === 'rejected') { reason = prompt('Reason for rejection (min 3 characters):'); if (!reason) return; }
    try { await api.patch(`/admin/listings/${l.id}/status`, { status: next, reason }); load(); } catch (e) { alert(errMsg(e)); }
  };

  return (
    <>
      <div className="filters">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option>pending</option><option>approved</option><option>rejected</option><option>draft</option><option>inactive</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Title</th><th>Host</th><th>Address</th><th>Price/hr</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{l.title}</td><td>{l.hostName || l.hostPhone}</td><td>{l.address}</td><td>Rs {l.priceHour ?? '-'}</td>
              <td><Badge value={l.status} />{l.rejectionReason && <div className="muted small">{l.rejectionReason}</div>}</td>
              <td className="actions">
                {l.status !== 'approved' && <button className="btn" onClick={() => decide(l, 'approved')}>Approve</button>}
                {l.status !== 'rejected' && <button className="btn ghost" onClick={() => decide(l, 'rejected')}>Reject</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager meta={meta} onPage={setPage} />
    </>
  );
}
