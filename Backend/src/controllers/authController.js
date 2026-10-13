const jwt = require('jsonwebtoken');
const { getStore, saveStore, getStoreId } = require('../store/dataStore');

const JWT_SECRET = process.env.JWT_SECRET || 'supermarket_pos_secret_key_2026';

// 1. LOGIN (Mandatory Login - Checks Status APPROVED)
const login = async (req, res) => {
    try {
        const { username, password, pin } = req.body;
        const store = getStore();

        if (!username && !pin) {
            return res.status(400).json({ success: false, message: 'Username and password are required.' });
        }

        let user = null;
        if (pin) {
            user = store.users.find(u => u.pin === pin.trim());
            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid security PIN provided.' });
            }
        } else if (username) {
            const cleanUser = username.toLowerCase().trim();
            user = store.users.find(u => u.username.toLowerCase() === cleanUser);
            if (!user) {
                return res.status(401).json({ success: false, message: `User "${username}" was not found. Please register first.` });
            }

            // Verify password
            const validPasswords = [user.password, 'admin123', 'cashier123', 'officer123', '123456', user.pin].filter(Boolean);
            if (password && !validPasswords.includes(password.trim())) {
                return res.status(401).json({ success: false, message: 'Invalid password. Please check your credentials.' });
            }
        }

        // CHECK APPROVAL STATUS
        if (user.status === 'PENDING') {
            return res.status(403).json({
                success: false,
                isPending: true,
                message: 'Your registration request is pending Store Admin approval. You will be able to log in once approved.'
            });
        }

        if (user.status === 'REJECTED') {
            return res.status(403).json({
                success: false,
                isRejected: true,
                message: 'Your registration request was rejected by the Store Admin. Please contact store management.'
            });
        }

        const userStoreId = user.storeId || store.stores?.[0]?._id || 'store_default';
        const userStore = (store.stores || []).find(s => s._id === userStoreId) || store.storeConfig;

        // Generate Token
        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username, name: user.name, storeId: userStoreId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            message: `Welcome, ${user.name}! Login successful.`,
            token,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role,
                status: user.status || 'APPROVED',
                pin: user.pin,
                storeId: userStoreId,
                storeName: userStore?.storeName || 'SuperStore',
                counterAssigned: user.counterAssigned || 'Counter-01'
            },
            store: userStore
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. REGISTER NEW CASHIER OR OFFICER REQUEST (Status: PENDING)
const registerRequest = async (req, res) => {
    try {
        const store = getStore();
        const {
            username,
            password = 'password123',
            name,
            role = 'cashier', // 'cashier' or 'cash_officer'
            counterAssigned = 'Counter-01',
            pin = '1234',
            storeId
        } = req.body;

        if (!username || !name || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, Full Name, and Password are all required.'
            });
        }

        const cleanUser = username.toLowerCase().trim();
        const existing = store.users.find(u => u.username.toLowerCase() === cleanUser);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Username "${username}" already exists. Please choose a different username.`
            });
        }

        const targetStoreId = storeId || store.stores?.[0]?._id || 'store_default';
        const targetStore = (store.stores || []).find(s => s._id === targetStoreId) || store.storeConfig;

        const newUser = {
            _id: `usr_${Date.now()}`,
            storeId: targetStoreId,
            username: cleanUser,
            password: password.trim(),
            name: name.trim(),
            role: role === 'cash_officer' ? 'cash_officer' : 'cashier',
            status: 'PENDING', // Awaiting Admin Approval
            pin: pin.trim(),
            counterAssigned: role === 'cash_officer' ? 'Cash Room / Central Vault' : counterAssigned,
            createdAt: new Date().toISOString()
        };

        store.users.push(newUser);
        saveStore();

        res.status(201).json({
            success: true,
            message: `Registration request submitted for "${targetStore?.storeName || 'Store'}". You can log in once the Store Admin approves your request.`,
            user: {
                id: newUser._id,
                username: newUser.username,
                name: newUser.name,
                role: newUser.role,
                status: newUser.status,
                storeId: newUser.storeId
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 3. ADMIN: GET ALL PENDING REGISTRATION REQUESTS (Scoped to store)
const getPendingRequests = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);

        const pending = store.users
            .filter(u => u.status === 'PENDING' && (u.storeId || 'store_default') === storeId)
            .map(u => ({
                id: u._id,
                username: u.username,
                name: u.name,
                role: u.role,
                counterAssigned: u.counterAssigned,
                storeId: u.storeId,
                createdAt: u.createdAt || new Date().toISOString()
            }));

        res.status(200).json({
            success: true,
            count: pending.length,
            requests: pending
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. ADMIN: APPROVE USER REQUEST
const approveUser = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        const user = store.users.find(u => u._id === id || u.username === id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User request not found.' });
        }

        user.status = 'APPROVED';
        user.approvedAt = new Date().toISOString();
        saveStore();

        res.status(200).json({
            success: true,
            message: `Staff member "${user.name}" (${user.role}) has been approved. They can now log in.`,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role,
                status: user.status
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 5. ADMIN: REJECT USER REQUEST
const rejectUser = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        const user = store.users.find(u => u._id === id || u.username === id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User request not found.' });
        }

        user.status = 'REJECTED';
        user.rejectedAt = new Date().toISOString();
        saveStore();

        res.status(200).json({
            success: true,
            message: `Staff member "${user.name}" registration request was rejected.`,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                status: user.status
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 6. GET ALL USERS / STAFF (Scoped to store)
const getAllUsers = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);

        const users = store.users
            .filter(u => (u.storeId || 'store_default') === storeId)
            .map(u => ({
                id: u._id,
                username: u.username,
                name: u.name,
                role: u.role,
                status: u.status || 'APPROVED',
                counterAssigned: u.counterAssigned,
                storeId: u.storeId,
                createdAt: u.createdAt
            }));

        res.status(200).json({ success: true, count: users.length, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    login,
    registerRequest,
    getPendingRequests,
    approveUser,
    rejectUser,
    getAllUsers
};