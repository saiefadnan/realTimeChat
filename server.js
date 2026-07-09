const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const { socketHandler } = require('./sockets/chatSocket');
const { assign } = require('./controllers/chatController');
const routes = require('./routes/route');
const { generalLimiter } = require('./middleware/rateLimiter');
const { ping } = require('./controllers/chatController');

const app = express();
const server = http.createServer(app);

// Trust the first proxy so rate-limiter reads real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────── 
// Allow all origins in development; restrict to env-specified origins in prod.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4000'];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. same-origin)
        // In production, also allow any subdomain of onrender.com
        if (
            !origin || 
            allowedOrigins.includes(origin) || 
            origin.endsWith('.onrender.com') ||
            process.env.NODE_ENV !== 'production'
        ) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy violation: ${origin} is not allowed.`));
        }
    },

    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
    optionsSuccessStatus: 204
};

const io = new Server(server, {
    cors: corsOptions,
    allowEIO3: true,
    pingTimeout: 60000
});

// ─── Security Middleware ──────────────────────────────────────────────────── 
// Helmet's CSP interferes with CDN-loaded scripts. Use only non-CSP protections.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────── 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── CORS ─────────────────────────────────────────────────────────────────── 
app.use(cors(corsOptions));

// ─── Request Logging ─────────────────────────────────────────────────────── 
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// ─── Rate Limiting ────────────────────────────────────────────────────────── 
app.use('/api', generalLimiter);

// ─── Static Files ─────────────────────────────────────────────────────────── 
app.use(express.static(path.join(__dirname, './public')));

// ─── Ping (no auth, no rate-limit) ───────────────────────────────────────── 
app.all('/ping', ping);

// ─── Routes ───────────────────────────────────────────────────────────────── 
app.use('/api', routes);

// ─── Global Error Handler ─────────────────────────────────────────────────── 
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Database ─────────────────────────────────────────────────────────────── 
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log('[MongoDB] Connected');
    })
    .catch(err => {
        console.error('[MongoDB] Connection error:', err.message);
        process.exit(1);
    });

// ─── Socket.IO ────────────────────────────────────────────────────────────── 
assign(io);
socketHandler(io);

// ─── Server Start ─────────────────────────────────────────────────────────── 
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────── 
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(async () => {
        try {
            await mongoose.connection.close();
            console.log('[Server] Shutdown complete.');
            process.exit(0);
        } catch (err) {
            console.error('[Server] Error during shutdown:', err);
            process.exit(1);
        }
    });
});

