import fs from 'fs/promises';
import path from 'path';
import { createReadStream, constants as fsConstants } from 'fs';
import config from '../config/index';
import { FileMetadata, UploadedFile } from '../models/File';
import databaseService from './DatabaseService';
import { generateRandomId, generateDownloadToken } from '../utils/tokens';

class FileService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = config.files.uploadDir;
    }

    async createUploadMetadata(
        originalName: string,
        size: number,
        mimeType: string
    ): Promise<FileMetadata> {
        const id = generateRandomId();
        const token = generateDownloadToken();
        const uploadDate = new Date();

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + config.files.expiryDays);

        return {
            id,
            originalName,
            size,
            mimeType,
            uploadDate,
            expiryDate,
            downloadCount: 0,
            token,
            isEncrypted: false,
        };
    }

    async saveUploadedFile(
        tempPath: string,
        metadata: FileMetadata
    ): Promise<UploadedFile> {
        const targetPath = path.join(this.uploadDir, metadata.id);

        // Move file from temporary location to final destination
        await fs.rename(tempPath, targetPath);

        // Save metadata to database
        await databaseService.addFile(metadata);

        return {
            metadata,
            path: targetPath,
        };
    }

    async getFile(fileId: string): Promise<UploadedFile | null> {
        const metadata = await databaseService.getFileMetadata(fileId);
        if (!metadata) return null;

        const filePath = path.join(this.uploadDir, fileId);

        // Check if file exists
        try {
            await fs.access(filePath, fsConstants.F_OK);
            return { metadata, path: filePath };
        } catch (error) {
            // File doesn't exist - remove from database
            await databaseService.deleteFile(fileId);
            return null;
        }
    }

    async getFileByToken(token: string): Promise<UploadedFile | null> {
        const fileId = await databaseService.getFileIdByToken(token);
        if (!fileId) return null;

        return this.getFile(fileId);
    }

    async incrementDownloadCount(fileId: string): Promise<void> {
        const metadata = await databaseService.getFileMetadata(fileId);
        if (metadata) {
            metadata.downloadCount += 1;
            await databaseService.updateFile(metadata);
        }
    }

    createReadStream(filePath: string) {
        return createReadStream(filePath);
    }

    async deleteFile(fileId: string): Promise<boolean> {
        const file = await this.getFile(fileId);
        if (!file) return false;

        try {
            await fs.unlink(file.path);
            await databaseService.deleteFile(fileId);
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    async cleanupExpiredFiles(): Promise<number> {
        const expiredFileIds = await databaseService.cleanupExpiredFiles();

        let deletedCount = 0;
        for (const fileId of expiredFileIds) {
            try {
                const filePath = path.join(this.uploadDir, fileId);
                await fs.unlink(filePath);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete expired file ${fileId}:`, error);
            }
        }

        return deletedCount;
    }
}

export default new FileService();
