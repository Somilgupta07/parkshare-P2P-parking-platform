import { query, withTransaction } from '../../config/db.js';
import { redis } from '../../config/redis.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMeta, paginate } from '../../utils/pagination.js';
import { revokeAllForUser } from '../auth/auth.service.js';

// Builds "WHERE a = $1 AND b = $2" from [sql-with-?, value] pairs.
function buildWhere(conditions) {
  const params = [];
  const parts = conditions.filter(([, v]) => v !== undefined && v !== '').map(([sql, v]) => {
    params.push(sql.includes('ILIKE') ? `%${v}%` : v);
    return sql.replaceAll('?', `$${params.length}`);
  });
  return { where: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

async function paged(selectSql, fromSql, conditions, pg, orderBy) {
  const { where, params } = buildWhere(conditions);
  const { limit, offset } = paginate(pg);
  const [{ rows: [{ n }] }, { rows }] = await Promise.all([
    query(`SELECT count(*)::int AS n ${fromSql} ${where}`, params),
    query(`${selectSql} ${fromSql} ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
  ]);
  return { items: rows, meta: pageMeta(n, pg) };
}

const audit = (client, adminId, action, entity, entityId, meta = {}) =>
  client.query('INSERT INTO admin_audit_logs (admin_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5)',
    [adminId, action, entity, entityId, meta]);

export async function stats() {
  const [users, listings, bookings, revenue] = await Promise.all([
    query(`SELECT count(*)::int total, count(*) FILTER (WHERE 'host' = ANY(roles))::int hosts,
                  count(*) FILTER (WHERE status = 'blocked')::int blocked FROM users`),
    query(`SELECT status, count(*)::int n FROM listings GROUP BY status`),
    query(`SELECT status, count(*)::int n FROM bookings GROUP BY status`),
    query(`SELECT COALESCE(sum(amount), 0) total FROM payments WHERE status = 'captured'`),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { users: users.rows[0], listings: toMap(listings.rows), bookings: toMap(bookings.rows), revenue: revenue.rows[0].total };
}

export const listUsers = ({ search, role, status, ...pg }) =>
  paged(
    'SELECT id, phone, email, name, roles, status, kyc_status AS "kycStatus", created_at AS "createdAt"',
    'FROM users',
    [['(name ILIKE ? OR phone ILIKE ? OR email ILIKE ?)', search], ['? = ANY(roles)', role], ['status = ?', status]],
    pg, 'created_at DESC',
  );

export async function setUserStatus(adminId, userId, status) {
  if (adminId === userId) throw ApiError.badRequest('You cannot change your own status');
  const user = await withTransaction(async (client) => {
    const { rows: [u] } = await client.query('UPDATE users SET status = $2 WHERE id = $1 RETURNING id, status', [userId, status]);
    if (!u) throw ApiError.notFound('User not found');
    await audit(client, adminId, `user.${status}`, 'user', userId);
    return u;
  });
  if (status === 'blocked') {
    await redis.set(`blocked:${userId}`, '1');
    await revokeAllForUser(userId);
  } else {
    await redis.del(`blocked:${userId}`);
  }
  return user;
}

export const listListings = ({ status, search, ...pg }) =>
  paged(
    `SELECT l.id, l.title, l.address, l.status, l.price_hour AS "priceHour", l.price_day AS "priceDay",
            l.amenities, l.rejection_reason AS "rejectionReason", l.created_at AS "createdAt",
            ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
            u.name AS "hostName", u.phone AS "hostPhone"`,
    'FROM listings l JOIN users u ON u.id = l.host_id',
    [['l.status = ?', status], ['(l.title ILIKE ? OR l.address ILIKE ?)', search]],
    pg, 'l.created_at DESC',
  );

export async function setListingStatus(adminId, listingId, { status, reason }) {
  return withTransaction(async (client) => {
    const { rows: [l] } = await client.query(
      `UPDATE listings SET status = $2, rejection_reason = $3 WHERE id = $1 RETURNING id, title, status, rejection_reason AS "rejectionReason"`,
      [listingId, status, status === 'rejected' ? reason : null],
    );
    if (!l) throw ApiError.notFound('Listing not found');
    await audit(client, adminId, `listing.${status}`, 'listing', listingId, { reason });
    return l;
  });
}

export const listBookings = ({ status, ...pg }) =>
  paged(
    `SELECT b.id, b.status, b.amount, b.commission, b.start_ts AS "startTs", b.end_ts AS "endTs",
            l.title AS "listingTitle", u.name AS "seekerName", u.phone AS "seekerPhone"`,
    'FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN users u ON u.id = b.seeker_id',
    [['b.status = ?', status]],
    pg, 'b.created_at DESC',
  );
