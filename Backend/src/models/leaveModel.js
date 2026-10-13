const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    leaveType: { type: String, default: 'Casual Leave', enum: ['Casual Leave', 'Sick Leave', 'Paid Leave', 'Emergency Leave', 'Half Day'] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    adminComment: { type: String, default: '' },
    appliedOn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', leaveSchema);