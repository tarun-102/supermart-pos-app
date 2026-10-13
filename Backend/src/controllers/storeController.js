const jwt = require('jsonwebtoken');
const { getStore, saveStore, getStoreId } = require('../store/dataStore');

const JWT_SECRET = process.env.JWT_SECRET || 'supermarket_pos_secret_key_2026';

// Helper to get active store object
function findTargetStore(store, req) {
    const storeId = getStoreId(req);
    if (!store.stores || !Array.isArray(store.stores) || store.stores.length === 0) {
        return store.storeConfig;
    }
    const found = store.stores.find(s => s._id === storeId);
    return found || store.stores[0] || store.storeConfig;
}

// 1. GET ALL REGISTERED STORES (For login / store selector)
const getAllStores = async (req, res) => {
    try {
        const store = getStore();
        const stores = (store.stores || []).map(s => ({
            id: s._id,
            storeName: s.storeName,
            storeType: s.storeType || 'Retail Store',
            ownerName: s.ownerName,
            address: s.address,
            contact: s.contact,
            gstin: s.gstin,
            receiptTagline: s.receiptTagline,
            counters: s.counters || []
        }));

        res.status(200).json({
            success: true,
            count: stores.length,
            stores
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. REGISTER A BRAND NEW STORE / SHOP
const registerStore = async (req, res) => {
    try {
        const store = getStore();
        const {
            storeName,
            storeType = 'Supermarket & Grocery',
            ownerName,
            address = '',
            contact = '',
            gstin = '',
            receiptTagline = 'Thank you for shopping with us! Visit again.',
            counters,
            adminUsername,
            adminPassword,
            seedSampleProducts = true
        } = req.body;

        if (!storeName || !storeName.trim()) {
            return res.status(400).json({ success: false, message: 'Store Name is required.' });
        }
        if (!adminUsername || !adminUsername.trim()) {
            return res.status(400).json({ success: false, message: 'Admin Username is required.' });
        }
        if (!adminPassword || !adminPassword.trim()) {
            return res.status(400).json({ success: false, message: 'Admin Password is required.' });
        }

        const cleanUsername = adminUsername.toLowerCase().trim();
        const existingUser = store.users.find(u => u.username.toLowerCase() === cleanUsername);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: `Username "${cleanUsername}" is already taken. Please choose another username.`
            });
        }

        const newStoreId = `store_${Date.now()}`;
        const defaultCounters = Array.isArray(counters) && counters.length > 0 ? counters : [
            'Counter-01 (Express Billing)',
            'Counter-02 (General Checkout)',
            'Counter-03 (Quick Pay)'
        ];

        const newStoreObj = {
            _id: newStoreId,
            storeName: storeName.trim(),
            storeType: storeType.trim(),
            ownerName: ownerName ? ownerName.trim() : 'Store Owner',
            address: address.trim(),
            contact: contact.trim(),
            gstin: gstin.trim(),
            receiptTagline: receiptTagline.trim(),
            counters: defaultCounters,
            createdAt: new Date().toISOString()
        };

        if (!store.stores) store.stores = [];
        store.stores.push(newStoreObj);

        // Create the Store Admin / Manager account with full instant access
        const newAdmin = {
            _id: `usr_${Date.now()}`,
            storeId: newStoreId,
            username: cleanUsername,
            password: adminPassword.trim(),
            name: ownerName ? `${ownerName.trim()} (Store Owner)` : `${storeName.trim()} Admin`,
            role: 'admin',
            status: 'APPROVED',
            pin: '1234',
            counterAssigned: 'All Counters',
            createdAt: new Date().toISOString()
        };
        store.users.push(newAdmin);

        // Optional: Seed standard grocery inventory catalog cloned for this new store
        if (seedSampleProducts) {
            const baseProducts = store.products.filter(p => (p.storeId || 'store_default') === 'store_default');
            const itemsToClone = baseProducts.length > 0 ? baseProducts : [];
            itemsToClone.forEach((item, idx) => {
                store.products.push({
                    ...item,
                    _id: `prod_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
                    storeId: newStoreId,
                    stock: Number(item.stock) || 50,
                    createdAt: new Date().toISOString()
                });
            });
        }

        saveStore();

        // Generate immediate JWT token for frictionless owner onboarding
        const token = jwt.sign(
            { userId: newAdmin._id, role: newAdmin.role, username: newAdmin.username, name: newAdmin.name, storeId: newStoreId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: `Shop "${storeName}" registered successfully! Store Admin created.`,
            token,
            store: newStoreObj,
            user: {
                id: newAdmin._id,
                username: newAdmin.username,
                name: newAdmin.name,
                role: newAdmin.role,
                status: newAdmin.status,
                storeId: newStoreId,
                counterAssigned: newAdmin.counterAssigned
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 3. GET STORE CONFIGURATION (Scoped to Store)
const getStoreConfig = async (req, res) => {
    try {
        const store = getStore();
        const currentStore = findTargetStore(store, req);

        res.status(200).json({
            success: true,
            config: currentStore,
            storeId: currentStore._id
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. UPDATE STORE CONFIGURATION (Scoped to Store)
const updateStoreConfig = async (req, res) => {
    try {
        const store = getStore();
        const currentStore = findTargetStore(store, req);
        const {
            storeName,
            storeType,
            ownerName,
            address,
            contact,
            gstin,
            receiptTagline,
            counters
        } = req.body;

        if (storeName) currentStore.storeName = storeName.trim();
        if (storeType) currentStore.storeType = storeType.trim();
        if (ownerName) currentStore.ownerName = ownerName.trim();
        if (address !== undefined) currentStore.address = address.trim();
        if (contact !== undefined) currentStore.contact = contact.trim();
        if (gstin !== undefined) currentStore.gstin = gstin.trim();
        if (receiptTagline !== undefined) currentStore.receiptTagline = receiptTagline.trim();
        if (Array.isArray(counters)) currentStore.counters = counters;

        // If this is default store, keep storeConfig in sync
        if (currentStore._id === store.stores?.[0]?._id) {
            store.storeConfig = { ...currentStore };
        }

        saveStore();

        res.status(200).json({
            success: true,
            message: 'Shop profile and receipt branding updated successfully.',
            config: currentStore
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 5. ADD NEW COUNTER
const addCounter = async (req, res) => {
    try {
        const store = getStore();
        const currentStore = findTargetStore(store, req);
        const { counterName } = req.body;

        if (!counterName || !counterName.trim()) {
            return res.status(400).json({ success: false, message: 'Counter name is required.' });
        }

        const trimmed = counterName.trim();
        if (!currentStore.counters) currentStore.counters = [];

        if (currentStore.counters.includes(trimmed)) {
            return res.status(400).json({ success: false, message: 'This counter already exists.' });
        }

        currentStore.counters.push(trimmed);
        if (currentStore._id === store.stores?.[0]?._id && store.storeConfig) {
            store.storeConfig.counters = currentStore.counters;
        }

        saveStore();

        res.status(200).json({
            success: true,
            message: `Counter "${trimmed}" added successfully.`,
            counters: currentStore.counters
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 6. DELETE COUNTER
const deleteCounter = async (req, res) => {
    try {
        const store = getStore();
        const currentStore = findTargetStore(store, req);
        const { counterName } = req.body;

        if (!currentStore.counters) currentStore.counters = [];
        currentStore.counters = currentStore.counters.filter(c => c !== counterName);

        if (currentStore._id === store.stores?.[0]?._id && store.storeConfig) {
            store.storeConfig.counters = currentStore.counters;
        }

        saveStore();

        res.status(200).json({
            success: true,
            message: `Counter "${counterName}" removed.`,
            counters: currentStore.counters
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 7. GET COUNTERS STATUS (Occupancy for Cashier Selection)
const getCountersStatus = async (req, res) => {
    try {
        const store = getStore();
        const currentStore = findTargetStore(store, req);
        const configuredCounters = currentStore.counters || [
            'Counter-01 (Express Billing)',
            'Counter-02 (General Checkout)'
        ];

        // Find active shifts ONLY for this store
        const storeId = currentStore._id;
        const activeShifts = (store.shifts || []).filter(
            s => s.status === 'ACTIVE' && (s.storeId || 'store_default') === storeId
        );

        const countersStatus = configuredCounters.map(counter => {
            const activeShift = activeShifts.find(s => s.counterNo === counter);
            return {
                name: counter,
                isOccupied: !!activeShift,
                activeCashier: activeShift ? activeShift.cashierName : null,
                activeCashierId: activeShift ? activeShift.cashierId : null,
                shiftNumber: activeShift ? activeShift.shiftNumber : null,
                startTime: activeShift ? activeShift.startTime : null
            };
        });

        res.status(200).json({
            success: true,
            storeName: currentStore.storeName,
            counters: countersStatus
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    getAllStores,
    registerStore,
    getStoreConfig,
    updateStoreConfig,
    addCounter,
    deleteCounter,
    getCountersStatus
};
