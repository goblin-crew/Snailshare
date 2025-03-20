import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import config from '../config/index';

// Create a custom Winston logger
const logger = winston.createLogger({
    level: config.server.env === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'snailshare' },
    transports: [
        // Write to all logs with level 'info' and below to 'combined.log'
        // Write all logs with level 'error' and below to 'error.log'
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log')
        }),
    ],
});

// If we're not in production, also log to the console
if (config.server.env !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// Create a middleware function to log HTTP requests
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Log request details
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

    logger.info({
        message: `Incoming request`,
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

    // Capture response details when the response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;

        logger.info({
            message: `Request complete`,
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
        });
    });

    next();
}

// Export the logger instance for use throughout the application
export default logger;
