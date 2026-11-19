import { query } from '../../config/db.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { hmac, randomOtp, randomToken, safeEqual, sha256 } from '../../utils/crypto.js';
import { sendSms } from '../../utils/sms.js';
import { signAccessToken } from '../../utils/tokens.js';

const K = {
  otp: (p) => `otp:${p}`,
  attempts: (p) => `otp:attempts:${p}`,
  cooldown: (p) => `otp:cooldown:${p}`,
  hourly: (p) => `otp:hourly:${p}`,
};

export const toPublicUser = (u) => ({
  id: u.id, phone: u.phone, email: u.email, name: u.name,
  roles: u.roles, status: u.status, kycStatus: u.kyc_status, createdAt: u.created_at,
});

export async function requestOtp(phone) {
  if (await redis.exists(K.cooldown(phone))) throw ApiError.tooMany('Please wait 60 seconds before requesting another OTP');
  const count = await redis.incr(K.hourly(phone));
  if (count === 1) await redis.expire(K.hourly(phone), 3600);
  if (count > 5) throw ApiError.tooMany('Too many OTP requests. Try again in an hour');

  const otp = randomOtp();
  await redis.set(K.otp(phone), hmac(env.OTP_SECRET, `${phone}:${otp}`), 'EX', env.OTP_TTL_SECONDS);
  await redis.del(K.attempts(phone));
  await redis.set(K.cooldown(phone), '1', 'EX', 60);
  await sendSms(phone, `Your ParkShare OTP is ${otp}. It is valid for ${Math.floor(env.OTP_TTL_SECONDS / 60)} minutes.`);

  return { expiresIn: env.OTP_TTL_SECONDS, ...(env.otpDevEcho && { devOtp: otp }) };
}

async function issueTokens(user, meta = {}) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1, $2, $3, $4, $5)`,
    [user.id, sha256(refreshToken), expiresAt, meta.userAgent?.slice(0, 255), meta.ip],
  );
  return { accessToken: signAccessToken(user), refreshToken, refreshExpiresAt: expiresAt };
}

export async function verifyOtp({ phone, otp, name, role }, meta) {
  const stored = await redis.get(K.otp(phone));
  if (!stored) throw ApiError.unauthorized('OTP expired or not requested');

  const attempts = await redis.incr(K.attempts(phone));
  if (attempts === 1) await redis.expire(K.attempts(phone), env.OTP_TTL_SECONDS);
  if (attempts > 5) {
    await redis.del(K.otp(phone));
    throw ApiError.tooMany('Too many wrong attempts. Request a new OTP');
  }
  if (!safeEqual(stored, hmac(env.OTP_SECRET, `${phone}:${otp}`))) throw ApiError.unauthorized('Invalid OTP');
  await redis.del(K.otp(phone), K.attempts(phone));

  let { rows: [user] } = await query('SELECT * FROM users WHERE phone = $1', [phone]);
  if (!user) {
    ({ rows: [user] } = await query(
      'INSERT INTO users (phone, name, roles) VALUES ($1, $2, $3) RETURNING *', [phone, name ?? null, [role]],
    ));
  } else if (!user.name && name) {
    ({ rows: [user] } = await query('UPDATE users SET name = $2 WHERE id = $1 RETURNING *', [user.id, name]));
  }
  if (user.status === 'blocked') throw ApiError.forbidden('Your account has been blocked');

  const tokens = await issueTokens(user, meta);
  return { user: toPublicUser(user), tokens };
}

// Refresh-token rotation with reuse detection.
export async function refresh(token, meta) {
  if (!token) throw ApiError.unauthorized('Missing refresh token');
  const { rows: [row] } = await query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [sha256(token)]);
  if (!row) throw ApiError.unauthorized('Invalid refresh token');

  if (row.revoked_at) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    throw ApiError.unauthorized('Refresh token reuse detected. Please log in again');
  }
  if (new Date(row.expires_at) < new Date()) throw ApiError.unauthorized('Refresh token expired');

  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [row.user_id]);
  if (!user || user.status === 'blocked') throw ApiError.forbidden('Account unavailable');

  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
  const tokens = await issueTokens(user, meta);
  return { user: toPublicUser(user), tokens };
}

export async function logout(token) {
  if (token) await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(token)]);
}

export async function revokeAllForUser(userId) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

export { issueTokens };
