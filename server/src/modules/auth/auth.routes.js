import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requestOtpSchema, verifyOtpSchema } from './auth.schema.js';
import * as auth from './auth.service.js';
import * as users from '../users/users.service.js';

const router = Router();
const COOKIE = 'refresh_token';
const cookieOpts = () => ({
  httpOnly: true, secure: env.isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE, path: '/api/v1/auth',
});
const meta = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const sendSession = (res, { user, tokens }) => {
  res.cookie(COOKIE, tokens.refreshToken, { ...cookieOpts(), expires: tokens.refreshExpiresAt });
  res.json({ success: true, data: { accessToken: tokens.accessToken, user } });
};

router.use(authLimiter);

router.post('/request-otp', validate({ body: requestOtpSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await auth.requestOtp(req.body.phone) });
}));

router.post('/verify-otp', validate({ body: verifyOtpSchema }), asyncHandler(async (req, res) => {
  sendSession(res, await auth.verifyOtp(req.body, meta(req)));
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  sendSession(res, await auth.refresh(req.cookies[COOKIE], meta(req)));
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await auth.logout(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, cookieOpts());
  res.json({ success: true, data: { message: 'Logged out' } });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await users.getById(req.user.id) });
}));

export default router;
