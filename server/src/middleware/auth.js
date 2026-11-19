import { redis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/tokens.js';

// Sets req.user = { id, roles }. Use on every protected route.
export const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Missing access token');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }
  if (await redis.exists(`blocked:${payload.sub}`)) throw ApiError.forbidden('Account is blocked');

  req.user = { id: payload.sub, roles: payload.roles };
  next();
});

// authorize('host') or authorize('admin', 'host') - user needs at least one of the roles.
export const authorize = (...roles) => (req, res, next) =>
  req.user?.roles?.some((r) => roles.includes(r)) ? next() : next(ApiError.forbidden('You do not have permission'));
