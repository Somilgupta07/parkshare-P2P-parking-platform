import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { paginationSchema } from '../../utils/pagination.js';
import * as admin from './admin.service.js';

const router = Router();
router.use(authenticate, authorize('admin'));

const idParam = z.object({ id: z.string().uuid() });
const ok = (res, data) => res.json({ success: true, data });
const okPaged = (res, { items, meta }) => res.json({ success: true, data: items, meta });

router.get('/stats', asyncHandler(async (req, res) => ok(res, await admin.stats())));

router.get('/users', validate({ query: z.object({
  ...paginationSchema,
  search: z.string().trim().max(100).optional(),
  role: z.enum(['seeker', 'host', 'admin']).optional(),
  status: z.enum(['active', 'blocked']).optional(),
}) }), asyncHandler(async (req, res) => okPaged(res, await admin.listUsers(req.query))));

router.patch('/users/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(['active', 'blocked']) }) }),
  asyncHandler(async (req, res) => ok(res, await admin.setUserStatus(req.user.id, req.params.id, req.body.status))));

router.get('/listings', validate({ query: z.object({
  ...paginationSchema,
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'inactive']).optional(),
}) }), asyncHandler(async (req, res) => okPaged(res, await admin.listListings(req.query))));

router.patch('/listings/:id/status', validate({
  params: idParam,
  body: z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().trim().min(3).max(500).optional() })
    .refine((b) => b.status !== 'rejected' || b.reason, { message: 'Reason is required when rejecting', path: ['reason'] }),
}), asyncHandler(async (req, res) => ok(res, await admin.setListingStatus(req.user.id, req.params.id, req.body))));

router.get('/bookings', validate({ query: z.object({
  ...paginationSchema,
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
}) }), asyncHandler(async (req, res) => okPaged(res, await admin.listBookings(req.query))));

export default router;
