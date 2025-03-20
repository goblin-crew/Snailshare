import express from 'express';
import uploadRoutes from './upload';
import downloadRoutes from './download';
import adminRoutes from './admin';

const router = express.Router();

// Home route
router.use('/', uploadRoutes);

// Download routes
router.use('/', downloadRoutes);

// Admin routes
router.use('/admin', adminRoutes);

export default router;
