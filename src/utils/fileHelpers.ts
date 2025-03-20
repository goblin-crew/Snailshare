import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import config from '../config/index';

/**
 * Creates all necessary directories for the application.
 */
export async function ensureDirectories(): Promise<void> {
    const directories = [
        config.files.uploadDir,
        path.join(__dirname, '../../logs'),
        path.join(__dirname, '../../temp')
    ];

    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
            throw error;
        }
    }
}

/**
 * Gets a file's MIME type from its extension or content.
 */
export function getFileMimeType(filePath: string): string {
    const mimeType = mime.lookup(filePath);
    return mimeType || 'application/octet-stream';
}

/**
 * Formats a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

/**
 * Calculates the SHA-256 hash of a file.
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Check if a file exists and is accessible.
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Sanitizes a filename to prevent path traversal and ensure it's safe.
 */
export function sanitizeFilename(filename: string): string {
    // Remove any directory paths
    let sanitized = path.basename(filename);

    // Replace any characters that could cause issues
    sanitized = sanitized.replace(/[^\w\s.-]/g, '_');

    // Ensure the filename isn't too long
    if (sanitized.length > 200) {
        const extension = path.extname(sanitized);
        const name = path.basename(sanitized, extension);
        sanitized = name.substring(0, 190) + extension;
    }

    return sanitized;
}

/**
 * Generates a temporary file path.
 */
export function generateTempFilePath(extension: string = ''): string {
    const tempDir = path.join(__dirname, '../../temp');
    const randomName = Date.now() + '-' + Math.random().toString(36).substring(2);
    return path.join(tempDir, `${randomName}${extension}`);
}
