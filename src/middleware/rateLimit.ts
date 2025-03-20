import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config/index';

// Create a rate limiter for the API endpoints
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        status: 429,
        message: 'Too many requests, please try again later.'
    }
});

// Create a more strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Too many login attempts, please try again later.'
    }
});

// Create a rate limiter for download endpoints
export const downloadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // Limit each IP to 30 download requests per 10 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Too many download requests, please try again later.'
    }
});

// Create a rate limiter for upload endpoints
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 uploads per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Upload limit reached, please try again later.'
    }
});

// Create a rate limiter for the challenge endpoints
export const challengeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 challenge attempts per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Too many challenge attempts, please slow down.'
    }
});
