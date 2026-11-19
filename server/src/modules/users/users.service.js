import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { signAccessToken } from '../../utils/tokens.js';
import { toPublicUser } from '../auth/auth.service.js';

export async function getById(id) {
  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}

export async function updateMe(id, { name, email }) {
  const { rows: [user] } = await query(
    `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email) WHERE id = $1 RETURNING *`,
    [id, name ?? null, email ?? null],
  );
  return toPublicUser(user);
}

// Roles are baked into the JWT, so a fresh access token is returned with the new role.
export async function becomeHost(id) {
  const { rows: [user] } = await query(
    `UPDATE users SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || '{host}'::text[]) r)
     WHERE id = $1 RETURNING *`, [id]);
  return { user: toPublicUser(user), accessToken: signAccessToken(user) };
}
