// In-memory dev fallback store with sample data for instant testing
const devUsers = [
    {
        _id: 'usr_admin_1',
        username: 'admin',
        password: '$2a$10$abcdefghijklmnopqrstuuEXAMPLEHASH', // bcrypt or mock
        role: 'admin',
        joinDate: new Date(Date.now() - 90 * 86400000).toISOString()
    },
    {
        _id: 'usr_emp_1',
        username: 'rahul_sharma',
        password: '$2a$10$abcdefghijklmnopqrstuuEXAMPLEHASH',
        role: 'employee',
        joinDate: new Date(Date.now() - 60 * 86400000).toISOString()
    },
    {
        _id: 'usr_emp_2',
        username: 'priya_patel',
        password: '$2a$10$abcdefghijklmnopqrstuuEXAMPLEHASH',
        role: 'employee',
        joinDate: new Date(Date.now() - 45 * 86400000).toISOString()
    },
    {
        _id: 'usr_emp_3',
        username: 'amit_verma',
        password: '$2a$10$abcdefghijklmnopqrstuuEXAMPLEHASH',
        role: 'employee',
        joinDate: new Date(Date.now() - 30 * 86400000).toISOString()
    }
];

const now = new Date();
const todayMorning9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0);
const todayLunchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0);
const todayLunchEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 45, 0);
const todayTeaStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0);
const todayTeaEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 15, 0);
const todayEvening6 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);

const devPunches = [
    // Rahul Sharma - Completed Shift Today with Lunch & Tea Break
    {
        _id: 'p_101',
        userId: 'usr_emp_1',
        type: 'IN',
        timestamp: todayMorning9.toISOString(),
        note: 'Office - On time',
        location: 'HQ Floor 3'
    },
    {
        _id: 'p_102',
        userId: 'usr_emp_1',
        type: 'BREAK_START',
        timestamp: todayLunchStart.toISOString(),
        breakType: 'Lunch Break',
        note: 'Cafeteria Lunch'
    },
    {
        _id: 'p_103',
        userId: 'usr_emp_1',
        type: 'BREAK_END',
        timestamp: todayLunchEnd.toISOString(),
        breakDuration: 45 * 60, // 45 mins = 2700s
        breakType: 'Lunch Break',
        note: 'Back from lunch'
    },
    {
        _id: 'p_104',
        userId: 'usr_emp_1',
        type: 'BREAK_START',
        timestamp: todayTeaStart.toISOString(),
        breakType: 'Tea Break',
        note: 'Evening tea'
    },
    {
        _id: 'p_105',
        userId: 'usr_emp_1',
        type: 'BREAK_END',
        timestamp: todayTeaEnd.toISOString(),
        breakDuration: 15 * 60, // 15 mins = 900s
        breakType: 'Tea Break',
        note: 'Back to desk'
    },
    {
        _id: 'p_106',
        userId: 'usr_emp_1',
        type: 'OUT',
        timestamp: todayEvening6.toISOString(),
        sessionDuration: 7.5 * 3600, // 7.5 hours net
        note: 'Day completed'
    },

    // Priya Patel - Currently Working & Took Lunch Break
    {
        _id: 'p_201',
        userId: 'usr_emp_2',
        type: 'IN',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15, 0).toISOString(),
        note: 'Office - Early',
        location: 'HQ Floor 2'
    },
    {
        _id: 'p_202',
        userId: 'usr_emp_2',
        type: 'BREAK_START',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 15, 0).toISOString(),
        breakType: 'Lunch Break'
    },
    {
        _id: 'p_203',
        userId: 'usr_emp_2',
        type: 'BREAK_END',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 55, 0).toISOString(),
        breakDuration: 40 * 60,
        breakType: 'Lunch Break'
    },

    // Amit Verma - Currently ON BREAK (Tea Break)
    {
        _id: 'p_301',
        userId: 'usr_emp_3',
        type: 'IN',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString(),
        note: 'Office',
        location: 'HQ Floor 1'
    },
    {
        _id: 'p_302',
        userId: 'usr_emp_3',
        type: 'BREAK_START',
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
        breakType: 'Tea Break',
        note: 'Quick Tea'
    }
];

const devLeaves = [
    {
        _id: 'lv_001',
        userId: 'usr_emp_1',
        username: 'rahul_sharma',
        leaveType: 'Casual Leave',
        startDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        reason: 'Family function in hometown',
        status: 'Approved',
        appliedOn: new Date(Date.now() - 86400000).toISOString()
    },
    {
        _id: 'lv_002',
        userId: 'usr_emp_2',
        username: 'priya_patel',
        leaveType: 'Sick Leave',
        startDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
        reason: 'Medical checkup appointment',
        status: 'Pending',
        appliedOn: new Date().toISOString()
    }
];

module.exports = { devUsers, devPunches, devLeaves };
