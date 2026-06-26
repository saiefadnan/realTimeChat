const express = require('express');
const router = express.Router();
const { loginData, signinData, chatData, getUserInfo, queryUser } = require('../controllers/controller');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes — rate limited to prevent brute-force
router.post('/login', authLimiter, loginData);
router.post('/signin', authLimiter, signinData);

// Protected routes — require a valid JWT
router.post('/userData', authMiddleware, getUserInfo);
router.post('/getchats', authMiddleware, chatData);
router.post('/search', authMiddleware, queryUser);

module.exports = router;