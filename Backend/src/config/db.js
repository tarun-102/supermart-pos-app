const mongoose = require('mongoose');

let _isConnected = false;

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dmart_pos';

    try {
        const conn = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 3000
        });
        _isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return;
    } catch (primaryErr) {
        // If the primary URI failed (e.g. Atlas IP Whitelist error) and it wasn't localhost, try local MongoDB
        if (!mongoUri.includes('127.0.0.1') && !mongoUri.includes('localhost')) {
            console.warn(`⚠️  Remote Atlas DB failed (${primaryErr.message.slice(0, 70)}...). Trying local MongoDB...`);
            try {
                const localConn = await mongoose.connect('mongodb://127.0.0.1:27017/dmart_pos', {
                    serverSelectionTimeoutMS: 2000
                });
                _isConnected = true;
                console.log(`✅ Local MongoDB Connected: ${localConn.connection.host}/${localConn.connection.name}`);
                return;
            } catch (localErr) {
                // fall through to in-memory/JSON store
            }
        }

        _isConnected = false;
        console.log(`⚡ Running in Local Persistent Storage Mode (Offline Ready - Backend/data/billing_store.json)`);
    }
};

module.exports = { connectDB, isConnected: () => _isConnected };