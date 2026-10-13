const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        required: true, 
        enum: ['IN', 'OUT', 'BREAK_START', 'BREAK_END'] 
    },
    timestamp: { type: Date, default: Date.now },
    sessionDuration: { type: Number, default: 0 }, // Session work duration in seconds
    breakDuration: { type: Number, default: 0 },   // Break duration in seconds
    breakType: { type: String, default: 'General' }, // Lunch, Tea, Short Break, etc.
    note: { type: String, default: '' },
    location: { type: String, default: 'Office' }
});

module.exports = mongoose.model('Punch', punchSchema);