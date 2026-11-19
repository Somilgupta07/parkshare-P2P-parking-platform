export function Pager({ meta, onPage }) {
  if (!meta) return null;
  return (
    <div className="pager">
      <button className="btn ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Prev</button>
      <span className="muted">Page {meta.page} of {Math.max(meta.pages, 1)} ({meta.total} total)</span>
      <button className="btn ghost" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</button>
    </div>
  );
}

export const Badge = ({ value }) => <span className={`badge ${String(value).toLowerCase()}`}>{value}</span>;
