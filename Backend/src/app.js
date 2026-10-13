const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const storeRoutes = require('./routes/storeRoutes');
const db = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
    const connected = db.isConnected();
    return res.status(200).json({
        ok: true,
        service: 'SuperStore POS & Cash Office System',
        db: connected ? 'connected' : 'in-memory-persistent-store',
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