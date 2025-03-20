import { Throttle } from 'stream-throttle';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ActiveSessions, DownloadSession } from '../models/Session';
import databaseService from './DatabaseService';
import fileService from './FileService';
import { generateSessionId } from '../utils/tokens';
import config from '../config/index';

class ThrottleService {
    private sessions: ActiveSessions = {};
    private baseRate: number;

    constructor() {
        this.baseRate = config.download.baseRate;
        this.initializeBaseRate();
    }

    private async initializeBaseRate() {
        try {
            this.baseRate = await databaseService.getBaseDownloadRate();
        } catch (error) {
            console.error('Error loading base rate:', error);
        }
    }

    async getBaseRate(): Promise<number> {
        return this.baseRate;
    }

    async setBaseRate(rate: number): Promise<void> {
        this.baseRate = rate;
        await databaseService.setBaseDownloadRate(rate);
    }

    createSession(fileId: string, token: string, res?: Response | null): DownloadSession {
        const sessionId = generateSessionId();

        const session: DownloadSession = {
            id: sessionId,
            fileId,
            token,
            boostMultiplier: 1.0,
            fileStream: null,
            res: res ? res : undefined, // Convert null to undefined
            throttle: null,
            intervalId: null,
            startTime: new Date(),
            lastBoostTime: null,
            challengesSolved: 0,
            currentSpeed: this.baseRate,
        };

        this.sessions[sessionId] = session;
        console.log(`Created session ${sessionId}`);
        return session;
    }

    getSession(sessionId: string): DownloadSession | null {
        console.log(`Getting session ${sessionId}`);
        console.log(this.sessions[sessionId] || null);
        return this.sessions[sessionId] || null;
    }

    async startFileDownload(
        session: DownloadSession,
        filePath: string,
        fileSize: number
    ): Promise<void> {
        console.log(`Starting download for session ${session.id}`);
        // Set up file stream
        const fileStream = createReadStream(filePath);
        session.fileStream = fileStream;

        // Calculate effective rate
        const effectiveRate = this.baseRate * session.boostMultiplier;

        // Create throttle
        session.throttle = new Throttle({ rate: effectiveRate });
        session.currentSpeed = effectiveRate;

        // Ensure that a Response object is available
        const res = session.res;
        if (!res) {
            throw new Error("Response object is missing in the download session.");
        }

        // Set appropriate headers
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Pipe the file through the throttle to the response
        fileStream.pipe(session.throttle).pipe(res);

        // Set up fluctuation of download rate
        this.startRateFluctuation(session);

        // Increment download count
        await fileService.incrementDownloadCount(session.fileId);

        // Clean up when the download finishes
        fileStream.on('end', () => this.cleanupSession(session.id));
        fileStream.on('error', () => this.cleanupSession(session.id));
        res.on('close', () => this.cleanupSession(session.id));
    }

    private startRateFluctuation(session: DownloadSession): void {
        const fluctuateRate = () => {
            if (!session.throttle) return;

            // Calculate multiplier based on boost status
            let multiplier = session.boostMultiplier === 1.0
                ? 0.5 + Math.random() // More variation at base rate
                : 1.0 + Math.random() * 0.5; // Less variation with boost

            // Calculate effective rate
            const effectiveBase = this.baseRate * session.boostMultiplier;
            const newRate = Math.round(effectiveBase * multiplier);

            // Update throttle and session speed by re-piping the stream
            session.fileStream?.unpipe(session.throttle);
            session.throttle = new Throttle({ rate: newRate });
            // Ensure res is defined
            if (session.res) {
                session.fileStream?.pipe(session.throttle).pipe(session.res);
            }
            session.currentSpeed = newRate;

            // Schedule next fluctuation
            const randomDelay = 500 + Math.random() * 1000;
            session.intervalId = setTimeout(fluctuateRate, randomDelay);
        };

        // Start the fluctuation process
        fluctuateRate();
    }

    boostDownloadSpeed(sessionId: string, boostAmount: number = 0.5): boolean {
        const session = this.sessions[sessionId];
        console.log(`Boosting session`, sessionId, session.fileStream, session.throttle);

        console.log(this.sessions)
        if (!session) return false;

        // Pause and modify the stream
        if (session.fileStream && session.throttle) {
            // Pause the file stream
            session.fileStream.pause();

            // Stop the rate fluctuation
            if (session.intervalId) {
                clearTimeout(session.intervalId);
            }

            // Apply the boost
            session.boostMultiplier += boostAmount;

            // Unpipe and recreate the throttle
            session.fileStream.unpipe(session.throttle);

            // Create new throttle with boosted rate
            const effectiveRate = this.baseRate * session.boostMultiplier;
            session.throttle = new Throttle({ rate: effectiveRate });
            session.currentSpeed = effectiveRate;

            // Restart fluctuation
            this.startRateFluctuation(session);

            // Ensure that res is defined before piping
            if (session.res) {
                session.fileStream.pipe(session.throttle).pipe(session.res, { end: false });
            }

            // Resume the file stream
            session.fileStream.resume();

            // Update session stats
            session.lastBoostTime = new Date();
            session.challengesSolved += 1;

            return true;
        }

        return false;
    }

    private cleanupSession(sessionId: string): void {
        const session = this.sessions[sessionId];
        if (!session) return;

        // Clear any running interval
        if (session.intervalId) {
            clearTimeout(session.intervalId);
        }

        // Delete the session
        delete this.sessions[sessionId];
    }

    getActiveSessions(): ActiveSessions {
        return this.sessions;
    }

    getActiveSessionCount(): number {
        return Object.keys(this.sessions).length;
    }
}

export default new ThrottleService();
