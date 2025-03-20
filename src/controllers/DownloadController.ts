import { Request, Response } from 'express';
import fileService from '../services/FileService';
import throttleService from '../services/ThrottleService';
import challengeService from '../services/ChallengeService';
import { DifficultyLevel } from '../models/Challenge';
import { generateSessionId } from '../utils/tokens';

class DownloadController {
    // Arrow function ensures that `this` is bound to the instance.
    showStartPage = async (req: Request, res: Response): Promise<void> => {
        try {
            const fileToken = req.query.file as string;
            if (!fileToken) {
                return res.status(400).render('error', {
                    title: 'Download Error',
                    message: 'No file token provided.',
                });
            }

            // Validate the file token
            const file = await fileService.getFileByToken(fileToken);
            if (!file) {
                return res.status(404).render('error', {
                    title: 'File Not Found',
                    message: 'The requested file does not exist or has expired.',
                });
            }

            // Get session ID from query (if any)
            let sessionId = req.query.session as string;
            // Check if the session exists
            const sessionExists = sessionId ? throttleService.getSession(sessionId) : false;
            // Check if the download has started (challenge/download page)
            const download = req.query.download === '1';

            if (!download || !sessionExists) {
                // Intermediate page: if no session ID is provided, create one now
                if (!sessionId || !sessionExists) {
                    const session = throttleService.createSession(file.metadata.id, fileToken, undefined);
                    sessionId = session.id;
                }
                res.render('start', {
                    title: 'File Ready',
                    fileName: file.metadata.originalName,
                    fileSize: this.formatFileSize(file.metadata.size),
                    fileToken,
                    sessionId,
                });
            } else {
                // Download page: try to get the existing session
                let session = sessionId ? throttleService.getSession(sessionId) : null;
                if (!session) {
                    // If no session exists, create one
                    session = throttleService.createSession(file.metadata.id, fileToken, undefined);
                    sessionId = session.id; // update sessionId to the newly created one
                }
                // Generate a challenge for the download page
                const challenge = challengeService.generateChallenge(DifficultyLevel.EASY);

                res.render('download', {
                    title: 'Downloading...',
                    fileName: file.metadata.originalName,
                    fileSize: this.formatFileSize(file.metadata.size),
                    sessionId,
                    fileToken,
                    downloadUrl: `/downloadFile?session=${sessionId}&file=${fileToken}`,
                    challenge,
                    socketEnabled: true,
                });
            }
        } catch (error) {
            console.error('Error showing start page:', error);
            res.status(500).render('error', {
                title: 'Server Error',
                message: 'An error occurred while processing your request.',
            });
        }
    };

    downloadFile = async (req: Request, res: Response): Promise<any> => {
        try {
            const fileToken = req.query.file as string;
            const sessionId = req.query.session as string;

            if (!fileToken || !sessionId) {
                return res.status(400).send('Missing required parameters');
            }

            // Get the file
            const file = await fileService.getFileByToken(fileToken);
            if (!file) {
                return res.status(404).send('File not found');
            }

            // Try to get the existing session
            let session = throttleService.getSession(sessionId);
            if (!session) {
                // If no session exists, create one and use it.
                session = throttleService.createSession(file.metadata.id, fileToken, res);
            } else {
                // Update the session's response object with the current response, if needed.
                session.res = res;
            }

            // Set content-disposition header
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${encodeURIComponent(file.metadata.originalName)}"`
            );

            // Start the download using the existing session
            await throttleService.startFileDownload(
                session,
                file.path,
                file.metadata.size
            );
            // The response is being handled by the throttle service
        } catch (error) {
            console.error('Download error:', error);
            res.status(500).send('An error occurred during download');
        }
    };


    handleChallenge = async (req: Request, res: Response): Promise<any> => {
        try {
            const { sessionId, answer, difficulty } = req.body;

            if (!sessionId || answer === undefined) {
                return res
                    .status(400)
                    .json({ success: false, message: 'Missing required parameters' });
            }

            // Get the session
            const session = throttleService.getSession(sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Download session not found',
                });
            }

            // Validate the answer against the last challenge
            // In a real implementation, you'd store the challenge in the session
            // and validate against it
            const difficultyLevel = (difficulty as DifficultyLevel) || DifficultyLevel.EASY;
            const challenge = challengeService.generateChallenge(difficultyLevel);
            const userAnswer = parseInt(answer as string, 10);

            // For demo purposes, we'll consider all answers correct
            if (!isNaN(userAnswer)) {
                // Apply boost based on difficulty
                const boostAmount = challenge.boostMultiplier;
                const boosted = throttleService.boostDownloadSpeed(sessionId, boostAmount);

                if (boosted) {
                    // Generate a new challenge for the next round
                    const newChallenge = challengeService.generateChallenge(difficultyLevel);
                    return res.json({
                        success: true,
                        message: `Speed boosted by ${boostAmount}x!`,
                        currentSpeed: session.currentSpeed,
                        boostMultiplier: session.boostMultiplier,
                        newChallenge,
                    });
                } else {
                    return res.json({
                        success: false,
                        message: 'Failed to boost speed. Try again.',
                    });
                }
            } else {
                return res.json({
                    success: false,
                    message: 'Incorrect answer. Try again.',
                });
            }
        } catch (error) {
            console.error('Challenge error:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while processing the challenge',
            });
        }
    };

    // Arrow function to preserve `this` context
    private formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024)
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    };
}

export default new DownloadController();
