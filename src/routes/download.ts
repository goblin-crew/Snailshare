import express from 'express';
import downloadController from '../controllers/DownloadController';
import { requireValidSession } from '../middleware/auth';

const router = express.Router();

// Download start page
router.get('/start', downloadController.showStartPage);

// File download
router.get('/downloadFile', requireValidSession, downloadController.downloadFile);

// Challenge route
router.post('/challenge', downloadController.handleChallenge);

export default router;
