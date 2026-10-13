const Punch = require('../models/punchModel');
const db = require('../config/db');
const { devPunches, devUsers } = require('../devData');
const mongoose = require('mongoose');

let punchSeqCounter = 1000;

// Helper to compute state and metrics from punch history
function computeUserMetrics(punches, targetHours = 8) {
    const sorted = [...punches].sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b._seq || 0) - (a._seq || 0);
    });
    const latestPunch = sorted[0];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayPunches = sorted.filter(p => new Date(p.timestamp) >= todayStart);

    let isPunchedIn = false;
    let isOnBreak = false;
    let sessionStart = null;
    let breakStart = null;
    let currentBreakType = 'General';

    if (latestPunch) {
        if (latestPunch.type === 'IN') {
            isPunchedIn = true;
            isOnBreak = false;
        } else if (latestPunch.type === 'BREAK_START') {
            isPunchedIn = true;
            isOnBreak = true;
            breakStart = latestPunch.timestamp;
            currentBreakType = latestPunch.breakType || 'General';
        } else if (latestPunch.type === 'BREAK_END') {
            isPunchedIn = true;
            isOnBreak = false;
        } else if (latestPunch.type === 'OUT') {
            isPunchedIn = false;
            isOnBreak = false;
        }
    }

    // Find the latest 'IN' that belongs to the active shift
    if (isPunchedIn) {
        const lastIn = sorted.find(p => p.type === 'IN');
        if (lastIn) {
            sessionStart = lastIn.timestamp;
        }
    }

    // Compute today's completed work seconds & break seconds
    let totalCompletedWorkSecondsToday = 0;
    let totalBreakSecondsToday = 0;
    const completedBreaksToday = [];

    // Chronological punches today
    const chronologicalToday = [...todayPunches].sort((a, b) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (a._seq || 0) - (b._seq || 0);
    });

    let activeBreakStart = null;
    let activeBreakType = 'General';
    let activeInTime = null;

    chronologicalToday.forEach(p => {
        if (p.type === 'IN') {
            activeInTime = new Date(p.timestamp);
        } else if (p.type === 'BREAK_START') {
            activeBreakStart = new Date(p.timestamp);
            activeBreakType = p.breakType || 'General';
        } else if (p.type === 'BREAK_END') {
            if (activeBreakStart) {
                const dur = Math.max(0, Math.floor((new Date(p.timestamp) - activeBreakStart) / 1000));
                totalBreakSecondsToday += (p.breakDuration || dur);
                completedBreaksToday.push({
                    breakType: activeBreakType,
                    startTime: activeBreakStart.toISOString(),
                    endTime: new Date(p.timestamp).toISOString(),
                    duration: (p.breakDuration || dur),
                    note: p.note || ''
                });
                activeBreakStart = null;
            } else if (p.breakDuration) {
                totalBreakSecondsToday += p.breakDuration;
            }
        } else if (p.type === 'OUT') {
            if (p.sessionDuration) {
                totalCompletedWorkSecondsToday += p.sessionDuration;
            } else if (activeInTime) {
                const gross = Math.max(0, Math.floor((new Date(p.timestamp) - activeInTime) / 1000));
                totalCompletedWorkSecondsToday += gross;
            }
            activeInTime = null;
        }
    });

    // If currently on break, calculate live break elapsed
    let liveBreakSeconds = 0;
    if (isOnBreak && breakStart) {
        liveBreakSeconds = Math.max(0, Math.floor((Date.now() - new Date(breakStart)) / 1000));
    }

    // If currently punched in, calculate current active session worked seconds (excluding breaks)
    let currentSessionWorkedSeconds = 0;
    if (isPunchedIn && sessionStart) {
        const grossSessionSeconds = Math.max(0, Math.floor((Date.now() - new Date(sessionStart)) / 1000));
        let breaksInCurrentSession = 0;
        chronologicalToday.forEach(p => {
            if (new Date(p.timestamp) >= new Date(sessionStart)) {
                if (p.type === 'BREAK_END' && p.breakDuration) {
                    breaksInCurrentSession += p.breakDuration;
                }
            }
        });
        if (isOnBreak && breakStart) {
            breaksInCurrentSession += liveBreakSeconds;
        }
        currentSessionWorkedSeconds = Math.max(0, grossSessionSeconds - breaksInCurrentSession);
    }

    const totalWorkedToday = totalCompletedWorkSecondsToday + currentSessionWorkedSeconds;
    const targetSeconds = targetHours * 3600;
    const remainingToTarget = Math.max(0, targetSeconds - totalWorkedToday);
    const overtimeToday = Math.max(0, totalWorkedToday - targetSeconds);

    return {
        isPunchedIn,
        isOnBreak,
        sessionStart,
        breakStart,
        currentBreakType,
        liveBreakSeconds,
        totalBreakSecondsToday: totalBreakSecondsToday + liveBreakSeconds,
        completedBreaksToday,
        workedSeconds: totalWorkedToday,
        todaySeconds: totalWorkedToday,
        remainingToTarget,
        overtimeToday,
        targetHours
    };
}

const getStatus = async (req, res) => {
    try {
        let punches = [];
        if (db.isConnected() && mongoose.connection.readyState === 1) {
            punches = await Punch.find({ userId: req.user }).sort({ timestamp: -1 });
        } else {
            punches = devPunches.filter(p => p.userId === req.user).sort((a, b) => {
                const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                if (timeDiff !== 0) return timeDiff;
                return (b._seq || 0) - (a._seq || 0);
            });
        }

        const metrics = computeUserMetrics(punches, 8);
        return res.status(200).json({
            success: true,
            ...metrics,
            punches,
            minimumHours: metrics.targetHours
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const addPunch = async (req, res) => {
    try {
        const { type, note = '', breakType = 'General', location = 'Office' } = req.body;
        const validTypes = ['IN', 'OUT', 'BREAK_START', 'BREAK_END'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({ message: 'Invalid punch action type' });
        }

        let userPunches = [];
        const isDbReady = db.isConnected() && mongoose.connection.readyState === 1;

        if (isDbReady) {
            userPunches = await Punch.find({ userId: req.user }).sort({ timestamp: -1 });
        } else {
            userPunches = devPunches.filter(p => p.userId === req.user).sort((a, b) => {
                const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                if (timeDiff !== 0) return timeDiff;
                return (b._seq || 0) - (a._seq || 0);
            });
        }

        const lastPunch = userPunches[0];

        // State validations
        if (type === 'IN') {
            if (lastPunch && (lastPunch.type === 'IN' || lastPunch.type === 'BREAK_START' || lastPunch.type === 'BREAK_END')) {
                return res.status(400).json({ message: 'Already punched in!' });
            }
        } else if (type === 'BREAK_START') {
            if (!lastPunch || lastPunch.type === 'OUT') {
                return res.status(400).json({ message: 'Must Punch In before taking a break!' });
            }
            if (lastPunch.type === 'BREAK_START') {
                return res.status(400).json({ message: 'Already on break!' });
            }
        } else if (type === 'BREAK_END') {
            if (!lastPunch || lastPunch.type !== 'BREAK_START') {
                return res.status(400).json({ message: 'Not currently on a break!' });
            }
        } else if (type === 'OUT') {
            if (!lastPunch || lastPunch.type === 'OUT') {
                return res.status(400).json({ message: 'Cannot punch out without punching in first!' });
            }
        }

        let sessionDuration = 0;
        let breakDuration = 0;

        if (type === 'BREAK_END' && lastPunch && lastPunch.type === 'BREAK_START') {
            breakDuration = Math.max(0, Math.floor((Date.now() - new Date(lastPunch.timestamp)) / 1000));
        }

        if (type === 'OUT') {
            const lastIn = userPunches.find(p => p.type === 'IN');
            if (lastIn) {
                const grossDuration = Math.max(0, Math.floor((Date.now() - new Date(lastIn.timestamp)) / 1000));
                let breaksDuringSession = 0;
                userPunches.forEach(p => {
                    if (new Date(p.timestamp) >= new Date(lastIn.timestamp) && p.type === 'BREAK_END' && p.breakDuration) {
                        breaksDuringSession += p.breakDuration;
                    }
                });
                if (lastPunch.type === 'BREAK_START') {
                    const unfinishedBreak = Math.max(0, Math.floor((Date.now() - new Date(lastPunch.timestamp)) / 1000));
                    breaksDuringSession += unfinishedBreak;
                }
                sessionDuration = Math.max(0, grossDuration - breaksDuringSession);
            }
        }

        punchSeqCounter += 1;
        const nowIso = new Date().toISOString();
        const punchDoc = {
            userId: req.user,
            type,
            timestamp: nowIso,
            sessionDuration,
            breakDuration,
            breakType: (type === 'BREAK_START' || type === 'BREAK_END') ? (breakType || (lastPunch?.breakType) || 'General') : '',
            note,
            location,
            _seq: punchSeqCounter
        };

        if (isDbReady) {
            await Punch.create(punchDoc);
            userPunches = await Punch.find({ userId: req.user }).sort({ timestamp: -1 });
        } else {
            const newPunch = { ...punchDoc, _id: `${Date.now()}_${Math.random()}` };
            devPunches.unshift(newPunch);
            userPunches = devPunches.filter(p => p.userId === req.user).sort((a, b) => {
                const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                if (timeDiff !== 0) return timeDiff;
                return (b._seq || 0) - (a._seq || 0);
            });
        }

        const metrics = computeUserMetrics(userPunches, 8);
        return res.status(201).json({
            success: true,
            message: `Punch ${type} registered successfully`,
            ...metrics,
            punches: userPunches
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getAllPunches = async (req, res) => {
    try {
        let allPunches = [];
        let allUsers = [];

        const isDbReady = db.isConnected() && mongoose.connection.readyState === 1;

        if (isDbReady) {
            allPunches = await Punch.find().populate('userId', 'username role').sort({ timestamp: -1 });
            const User = require('../models/userModel');
            allUsers = await User.find({}, 'username role _id');
        } else {
            allPunches = devPunches.map(p => {
                const u = devUsers.find(user => user._id === p.userId || user.username === p.userId);
                return {
                    ...p,
                    userId: u ? { _id: u._id, username: u.username, role: u.role } : { _id: p.userId, username: p.userId, role: 'employee' }
                };
            }).sort((a, b) => {
                const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                if (timeDiff !== 0) return timeDiff;
                return (b._seq || 0) - (a._seq || 0);
            });
            allUsers = devUsers.map(u => ({ _id: u._id, username: u.username, role: u.role }));
        }

        const userSummaryMap = {};

        allUsers.forEach(u => {
            const uid = u._id.toString();
            userSummaryMap[uid] = {
                userId: uid,
                username: u.username,
                role: u.role,
                currentStatus: 'OFFLINE',
                lastPunchAt: null,
                punchInTimeToday: null,
                punchOutTimeToday: null,
                totalWorkSecondsToday: 0,
                totalBreakSecondsToday: 0,
                totalCompletedSessions: 0,
                totalOverallWorkSeconds: 0,
                breaksToday: [],
                allPunches: []
            };
        });

        allPunches.forEach(punch => {
            const userObj = punch.userId;
            if (!userObj) return;
            const uid = (userObj._id || userObj).toString();

            if (!userSummaryMap[uid]) {
                userSummaryMap[uid] = {
                    userId: uid,
                    username: userObj.username || uid,
                    role: userObj.role || 'employee',
                    currentStatus: 'OFFLINE',
                    lastPunchAt: null,
                    punchInTimeToday: null,
                    punchOutTimeToday: null,
                    totalWorkSecondsToday: 0,
                    totalBreakSecondsToday: 0,
                    totalCompletedSessions: 0,
                    totalOverallWorkSeconds: 0,
                    breaksToday: [],
                    allPunches: []
                };
            }

            const item = userSummaryMap[uid];
            item.allPunches.push(punch);

            if (punch.type === 'OUT') {
                item.totalOverallWorkSeconds += (punch.sessionDuration || 0);
            }
        });

        Object.values(userSummaryMap).forEach(item => {
            const userPunches = item.allPunches.sort((a, b) => {
                const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                if (timeDiff !== 0) return timeDiff;
                return (b._seq || 0) - (a._seq || 0);
            });
            if (userPunches.length > 0) {
                item.lastPunchAt = userPunches[0].timestamp;
                const latestType = userPunches[0].type;
                if (latestType === 'IN' || latestType === 'BREAK_END') {
                    item.currentStatus = 'WORKING';
                } else if (latestType === 'BREAK_START') {
                    item.currentStatus = 'ON_BREAK';
                } else {
                    item.currentStatus = 'OFFLINE';
                }
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayPunches = userPunches.filter(p => new Date(p.timestamp) >= todayStart)
                .sort((a, b) => {
                    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                    if (timeDiff !== 0) return timeDiff;
                    return (a._seq || 0) - (b._seq || 0);
                });

            const firstIn = todayPunches.find(p => p.type === 'IN');
            if (firstIn) {
                item.punchInTimeToday = firstIn.timestamp;
            }

            const lastOut = [...todayPunches].reverse().find(p => p.type === 'OUT');
            if (lastOut) {
                item.punchOutTimeToday = lastOut.timestamp;
            }

            let activeBreakStart = null;
            let activeBreakType = 'General';
            todayPunches.forEach(p => {
                if (p.type === 'BREAK_START') {
                    activeBreakStart = new Date(p.timestamp);
                    activeBreakType = p.breakType || 'General';
                } else if (p.type === 'BREAK_END') {
                    if (activeBreakStart) {
                        const dur = Math.max(0, Math.floor((new Date(p.timestamp) - activeBreakStart) / 1000));
                        item.totalBreakSecondsToday += (p.breakDuration || dur);
                        item.breaksToday.push({
                            breakType: activeBreakType,
                            startTime: activeBreakStart.toISOString(),
                            endTime: new Date(p.timestamp).toISOString(),
                            duration: (p.breakDuration || dur),
                            note: p.note || ''
                        });
                        activeBreakStart = null;
                    } else if (p.breakDuration) {
                        item.totalBreakSecondsToday += p.breakDuration;
                    }
                } else if (p.type === 'OUT') {
                    item.totalCompletedSessions += 1;
                    item.totalWorkSecondsToday += (p.sessionDuration || 0);
                }
            });

            if (item.currentStatus === 'WORKING' || item.currentStatus === 'ON_BREAK') {
                const latestIn = userPunches.find(p => p.type === 'IN');
                if (latestIn) {
                    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(latestIn.timestamp)) / 1000));
                    item.totalWorkSecondsToday += Math.max(0, elapsed - item.totalBreakSecondsToday);
                }
            }
        });

        const attendanceSummary = Object.values(userSummaryMap).sort((a, b) => a.username.localeCompare(b.username));

        return res.status(200).json({
            success: true,
            punches: allPunches,
            attendanceSummary
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = { getStatus, addPunch, getAllPunches };