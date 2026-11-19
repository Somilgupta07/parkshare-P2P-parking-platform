import { useEffect, useState } from 'react';
import { api, errMsg } from '../../api/client.js';
import { Badge, Pager } from '../../components/Table.jsx';

export default function AdminBookings() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/bookings', { params: { page, ...(status && { status }) } })
      .then((r) => { setRows(r.data.data); setMeta(r.data.meta); setError(''); }).catch((e) => setError(errMsg(e)));
  }, [status, page]);

  return (
    <>
      <div className="filters">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Listing</th><th>Seeker</th><th>From</th><th>To</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.listingTitle}</td><td>{b.seekerName || b.seekerPhone}</td>
              <td>{new Date(b.startTs).toLocaleString()}</td><td>{new Date(b.endTs).toLocaleString()}</td>
              <td>Rs {b.amount}</td><td><Badge value={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error && <p className="muted">No bookings yet.</p>}
      <Pager meta={meta} onPage={setPage} />
    </>
  );
}
