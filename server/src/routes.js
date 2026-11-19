import { Router } from 'express';
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/admin', adminRoutes);

// Teammates: mount your module router here, e.g.
// router.use('/listings', listingsRoutes);   // Person 2
// router.use('/search', searchRoutes);       // Person 3
// router.use('/bookings', bookingRoutes);    // Person 4

export default router;
