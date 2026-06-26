const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;

/**
 * Middleware to verify a JWT token from either:
 *   - Authorization: Bearer <token> header
 *   - req.body.token
 * Attaches decoded payload to req.user on success.
 */
function authMiddleware(req, res, next) {
    try {
        let token = null;

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        } else if (req.body && req.body.token) {
            token = req.body.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired, please log in again' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = authMiddleware;
