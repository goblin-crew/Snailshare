import { Request, Response } from 'express';
import challengeService from '../services/ChallengeService';
import throttleService from '../services/ThrottleService';
import { DifficultyLevel } from '../models/Challenge';

class ChallengeController {
    async handleChallenge(req: Request, res: Response): Promise<any> {
        try {
            const { sessionId, answer, difficulty, requestNewChallenge } = req.body;

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing session ID'
                });
            }

            // Get the session
            const session = throttleService.getSession(sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Download session not found'
                });
            }

            // Handle request for a new challenge
            if (requestNewChallenge) {
                const difficultyLevel = (difficulty as DifficultyLevel) || DifficultyLevel.EASY;
                const newChallenge = challengeService.generateChallenge(difficultyLevel);

                return res.json({
                    success: true,
                    newChallenge,
                });
            }

            // Handle challenge answer submission
            if (answer === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing answer'
                });
            }

            const difficultyLevel = (difficulty as DifficultyLevel) || DifficultyLevel.EASY;
            const challenge = challengeService.generateChallenge(difficultyLevel);
            const userAnswer = parseInt(answer as string, 10);

            const isCorrect = challengeService.validateAnswer(challenge, userAnswer);

            if (isCorrect) {
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
                        message: 'Failed to boost speed. Your download may have finished.',
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
                message: 'An error occurred while processing the challenge'
            });
        }
    }
}

export default new ChallengeController();
