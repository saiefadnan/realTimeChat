const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for authentication endpoints (login / signup).
 * Allows max 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many attempts from this IP, please try again after 15 minutes.'
    }
});

/**
 * General API rate limiter — prevents API abuse.
 * Allows max 200 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests from this IP, please slow down.'
    }
});

module.exports = { authLimiter, generalLimiter };
