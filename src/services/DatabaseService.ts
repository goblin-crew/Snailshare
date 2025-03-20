import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import config from '../config/index';
import { FileMetadata } from '../models/File';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

// Define the database schema
interface DatabaseSchema {
    files: {
        [fileId: string]: FileMetadata;
    };
    downloadTokens: {
        [token: string]: string; // token -> fileId
    };
    settings: {
        baseDownloadRate: number;
    };
}

// Create a class for database operations
class DatabaseService {
    private db: Low<DatabaseSchema>;
    private dbFile: string;
    private isInitialized: boolean = false;

    constructor() {
        this.dbFile = path.join(__dirname, '../../db.json');
        const adapter = new JSONFile<DatabaseSchema>(this.dbFile);
        this.db = new Low<DatabaseSchema>(adapter);
    }

    async initialize(): Promise<void> {
        try {
            await this.db.read();

            // Initialize with default values if DB is empty
            if (!this.db.data) {
                this.db.data = {
                    files: {},
                    downloadTokens: {},
                    settings: {
                        baseDownloadRate: config.download.baseRate,
                    },
                };
                await this.db.write();
            }
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
        await this.ensureInitialized();
        return this.db.data!.files[fileId] || null;
    }

    async getFileIdByToken(token: string): Promise<string | null> {
        await this.ensureInitialized();
        return this.db.data!.downloadTokens[token] || null;
    }

    async addFile(fileMetadata: FileMetadata): Promise<void> {
        await this.ensureInitialized();
        this.db.data!.files[fileMetadata.id] = fileMetadata;
        this.db.data!.downloadTokens[fileMetadata.token] = fileMetadata.id;
        await this.db.write();
    }

    async updateFile(fileMetadata: FileMetadata): Promise<void> {
        await this.ensureInitialized();
        this.db.data!.files[fileMetadata.id] = fileMetadata;
        await this.db.write();
    }

    async deleteFile(fileId: string): Promise<boolean> {
        await this.ensureInitialized();
        const file = this.db.data!.files[fileId];
        if (!file) return false;

        // Delete from tokens
        const token = file.token;
        delete this.db.data!.downloadTokens[token];

        // Delete from files
        delete this.db.data!.files[fileId];

        await this.db.write();
        return true;
    }

    async getAllFiles(): Promise<FileMetadata[]> {
        await this.ensureInitialized();
        return Object.values(this.db.data!.files);
    }

    async getBaseDownloadRate(): Promise<number> {
        await this.ensureInitialized();
        return this.db.data!.settings.baseDownloadRate;
    }

    async setBaseDownloadRate(rate: number): Promise<void> {
        await this.ensureInitialized();
        this.db.data!.settings.baseDownloadRate = rate;
        await this.db.write();
    }

    async getBackup(): Promise<string> {
        await this.ensureInitialized();
        return JSON.stringify(this.db.data, null, 2);
    }

    async clearDatabase(): Promise<void> {
        await this.ensureInitialized();
        this.db.data = {
            files: {},
            downloadTokens: {},
            settings: {
                baseDownloadRate: config.download.baseRate,
            },
        };
        await this.db.write();
    }

    // Check for expired files
    async cleanupExpiredFiles(): Promise<string[]> {
        await this.ensureInitialized();
        const now = new Date();
        const expiredFileIds: string[] = [];

        for (const [fileId, metadata] of Object.entries(this.db.data!.files)) {
            if (new Date((metadata as any).expiryDate) < now) {
                expiredFileIds.push(fileId);
            }
        }

        // Delete expired files from database
        for (const fileId of expiredFileIds) {
            await this.deleteFile(fileId);
        }

        return expiredFileIds;
    }
}

// Export as singleton
export default new DatabaseService();