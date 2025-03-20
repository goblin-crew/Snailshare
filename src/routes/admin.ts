import express from 'express';
import adminController from '../controllers/AdminController';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// Admin login
router.get('/', adminController.showLoginPage);
router.post('/', adminController.handleLogin);

// Admin dashboard (protected)
router.get('/dashboard', requireAdmin, adminController.showDashboard);

// Admin operations (all protected)
router.delete('/files/:fileId', requireAdmin, adminController.handleDeleteFile);
router.post('/settings/rate', requireAdmin, adminController.updateBaseRate);
router.post('/clear', requireAdmin, adminController.clearDatabase);
router.get('/backup', requireAdmin, adminController.downloadBackup);
router.post('/cleanup', requireAdmin, adminController.cleanupExpiredFiles);

export default router;
