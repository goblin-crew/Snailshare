import path from 'path';
import config from '../config/index.js';
// List of allowed file extensions and MIME types
const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx',
    '.xls', '.xlsx', '.txt', '.zip', '.rar', '.7z', '.mp3',
    '.mp4', '.avi', '.mov'
];
// Maximum file size in bytes (default to config value)
const MAX_FILE_SIZE = config.files.maxSize;
/**
 * Middleware to validate file uploads.
 */
export function validateFileUpload(req, res, next) {
    // Formidable will set file object in req.files
    // We'll check it in the controller after parsing
    next();
}
/**
 * Utility function to validate a file by its properties.
 */
export function isValidFile(filename, size, mimetype) {
    // Check file size
    if (size > MAX_FILE_SIZE) {
        return {
            valid: false,
            reason: `File size exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
        };
    }
    // Check file extension
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return {
            valid: false,
            reason: 'File type not allowed'
        };
    }
    // Additional MIME type checks could be added here
    return { valid: true };
}
