const Leave = require('../models/leaveModel');
const db = require('../config/db');
const { devLeaves } = require('../devData');
const mongoose = require('mongoose');

// @route   POST /api/leave (Employee: Apply Leave)
const applyLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason, leaveType = 'Casual Leave' } = req.body;
        const username = req.username || 'User';

        if (db.isConnected() && mongoose.connection.readyState === 1) {
            const newLeave = await Leave.create({
                userId: req.user,
                username,
                leaveType,
                startDate,
                endDate,
                reason
            });
            return res.status(201).json({ success: true, message: 'Leave applied successfully', leave: newLeave });
        }

        // dev fallback
        const newLeave = {
            _id: `lv_${Date.now()}`,
            userId: req.user,
            username,
            leaveType,
            startDate,
            endDate,
            reason,
            status: 'Pending',
            adminComment: '',
            appliedOn: new Date().toISOString()
        };
        devLeaves.push(newLeave);
        return res.status(201).json({ success: true, message: 'Leave applied (dev mode)', leave: newLeave });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @route   GET /api/leave (All: Get Upcoming & Pending Leaves)
const getLeaves = async (req, res) => {
    try {
        if (db.isConnected() && mongoose.connection.readyState === 1) {
            const leaves = req.role === 'admin'
                ? await Leave.find().sort({ appliedOn: -1 })
                : await Leave.find({ userId: req.user }).sort({ appliedOn: -1 });
            return res.status(200).json(leaves);
        }

        // dev fallback
        const leaves = req.role === 'admin'
            ? [...devLeaves].sort((a, b) => new Date(b.appliedOn || b.startDate) - new Date(a.appliedOn || a.startDate))
            : devLeaves.filter(l => l.userId === req.user).sort((a, b) => new Date(b.appliedOn || b.startDate) - new Date(a.appliedOn || a.startDate));
        return res.status(200).json(leaves);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @route   PUT /api/leave/:id (Admin: Approve/Reject Leave)
const updateLeaveStatus = async (req, res) => {
    try {
        const { status, adminComment = '' } = req.body; // 'Approved' or 'Rejected'
        if (db.isConnected() && mongoose.connection.readyState === 1) {
            const leave = await Leave.findByIdAndUpdate(req.params.id, { status, adminComment }, { new: true });
            return res.status(200).json({ success: true, leave });
        }

        // dev fallback
        const idx = devLeaves.findIndex(l => l._id === req.params.id);
        if (idx === -1) return res.status(404).json({ message: 'Leave not found' });
        devLeaves[idx].status = status;
        devLeaves[idx].adminComment = adminComment;
        return res.status(200).json({ success: true, leave: devLeaves[idx] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { applyLeave, getLeaves, updateLeaveStatus };