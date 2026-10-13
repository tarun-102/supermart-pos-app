require('dotenv').config({ override: true });
const app = require('./src/app');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Allow access across any network / IP

app.listen(PORT, HOST, () => {
    console.log(`🛒 SuperStore POS & Cash Officer Server running on http://localhost:${PORT}`);
});

// Connect to Database in background
connectDB().catch((err) => {
    console.error('DB connection failed (continuing in-memory):', err && err.message);
});