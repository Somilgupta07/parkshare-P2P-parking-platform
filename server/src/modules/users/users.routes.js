import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as users from './users.service.js';

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
}).refine((v) => v.name || v.email, 'Provide name or email');

router.get('/me', asyncHandler(async (req, res) => res.json({ success: true, data: await users.getById(req.user.id) })));
router.patch('/me', validate({ body: updateSchema }), asyncHandler(async (req, res) =>
  res.json({ success: true, data: await users.updateMe(req.user.id, req.body) })));
router.post('/me/become-host', asyncHandler(async (req, res) =>
  res.json({ success: true, data: await users.becomeHost(req.user.id) })));

export default router;
