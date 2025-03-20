import { Request, Response } from 'express';

import path from 'path';
import fileService from '../services/FileService';
import { isValidFile } from '../middleware/fileValidation';
import config from '../config/index';

import formidable, { Fields, Files } from 'formidable';

class UploadController {
    async showUploadPage(req: Request, res: Response): Promise<void> {
        res.render('home', {
            title: 'Snailshare - Secure File Hosting',
        });
    }

    async handleFileUpload(req: Request, res: Response): Promise<void> {
        try {
            // Configure formidable
            const uploadDir = path.resolve(config.files.uploadDir);
            const form = formidable({
                uploadDir,
                keepExtensions: true,
                maxFileSize: config.files.maxSize,
                maxTotalFileSize: config.files.maxSize,
                allowEmptyFiles: false,
                filter: (part) => {
                    return part.mimetype !== null;
                },
                multiples: false,
                maxFields: 1,
                maxFieldsSize: 1024 * 1024 // 1MB for form fields
            });

            // Helper function to wrap form.parse in a promise
            const parseForm = (
                req: Request,
                form: ReturnType<typeof formidable>
            ): Promise<[Fields, Files]> => {
                return new Promise((resolve, reject) => {
                    form.parse(req, (err: any, fields: Fields, files: Files) => {
                        if (err) return reject(err);
                        resolve([fields, files]);
                    });
                });
            };

            // Parse the form using the helper
            const [fields, files] = await parseForm(req, form);

            // Get the uploaded file
            const uploadedFile = Array.isArray(files.uploadfile)
                ? files.uploadfile[0]
                : files.uploadfile;

            if (!uploadedFile) {
                res.status(400).render('error', {
                    title: 'Upload Error',
                    message: 'No file was uploaded.'
                });
                return;
            }

            const originalName = uploadedFile.originalFilename || 'unknown';
            const tempPath = uploadedFile.filepath;
            const fileSize = uploadedFile.size;
            const mimeType = uploadedFile.mimetype || 'application/octet-stream';

            // Validate the file
            const validation = isValidFile(originalName, fileSize, mimeType);
            if (!validation.valid) {
                res.status(400).render('error', {
                    title: 'Upload Error',
                    message: validation.reason || 'Invalid file.'
                });
                return;
            }

            // Create file metadata
            const metadata = await fileService.createUploadMetadata(
                originalName,
                fileSize,
                mimeType
            );

            // Save the file
            const savedFile = await fileService.saveUploadedFile(tempPath, metadata);

            // Construct share URL
            const host = req.headers.host;
            const shareUrl = `https://${host}/start?file=${savedFile.metadata.token}`;

            // Render success page
            res.render('upload-success', {
                title: 'Upload Successful',
                fileName: originalName,
                shareUrl,
            });
        } catch (error) {
            console.error('Upload error:', error);
            // Log more details about the error
            if (error instanceof Error) {
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            res.status(500).render('error', {
                title: 'Upload Error',
                message: config.server.env === 'production' 
                    ? 'An error occurred while uploading your file.'
                    : error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }
}

export default new UploadController();
