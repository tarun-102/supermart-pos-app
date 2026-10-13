const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const storeRoutes = require('./routes/storeRoutes');
const db = require('./config/db');

const app = express();

// ==========================================
// PROFESSIONAL PRODUCTION CORS CONFIGURATION
// Explicit whitelist for Vercel production frontend & local dev
// ==========================================
const allowedOrigins = [
    'https://supermart-pos-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.replace(/\/+$/, '');

        // Check if origin matches whitelist, any Vercel preview domain, or local LAN IP (e.g. phone on Wi-Fi)
        const isAllowed = allowedOrigins.includes(cleanOrigin) ||
            cleanOrigin.endsWith('.vercel.app') ||
            /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(cleanOrigin);

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
            callback(new Error(`CORS Policy: Origin ${origin} is not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-store-id',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['x-store-id'],
    optionsSuccessStatus: 204
};

// Enable CORS with options & handle preflight OPTIONS across all routes
app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

app.use(express.json());

// Health & Deployment Status Endpoint
app.get('/api/health', (req, res) => {
    const connected = db.isConnected();
    return res.status(200).json({
        ok: true,
        service: 'SuperStore POS & Cash Office System',
        environment: process.env.NODE_ENV || 'production',
        db: connected ? 'connected' : 'in-memory-persistent-store',
        allowedFrontend: 'https://supermart-pos-app.vercel.app',
        timestamp: new Date().toISOString()
    });
});

// Main API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/store', storeRoutes);

module.exports = app;