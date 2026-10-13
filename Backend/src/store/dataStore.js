const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/billing_store.json');

// Default initial seed data
const initialData = {
    users: [
        {
            _id: 'usr_admin',
            username: 'admin',
            password: 'admin123',
            name: 'Rajesh Mehta (Store Manager)',
            role: 'admin',
            status: 'APPROVED',
            pin: '1234',
            counterAssigned: 'All Counters'
        },
        {
            _id: 'usr_cashier1',
            username: 'cashier1',
            password: 'cashier123',
            name: 'Rahul Sharma',
            role: 'cashier',
            status: 'APPROVED',
            pin: '1111',
            counterAssigned: 'Counter-01'
        },
        {
            _id: 'usr_cashier2',
            username: 'cashier2',
            password: 'cashier123',
            name: 'Priya Patel',
            role: 'cashier',
            status: 'APPROVED',
            pin: '2222',
            counterAssigned: 'Counter-02'
        },
        {
            _id: 'usr_cash_officer',
            username: 'officer1',
            password: 'officer123',
            name: 'Vikram Singh (Head Cash Officer)',
            role: 'cash_officer',
            status: 'APPROVED',
            pin: '9999',
            counterAssigned: 'Central Cash Vault'
        },
        {
            _id: 'usr_pending_1',
            username: 'anil_cashier',
            password: 'cashier123',
            name: 'Anil Kumar',
            role: 'cashier',
            status: 'PENDING',
            pin: '3333',
            counterAssigned: 'Counter-03',
            createdAt: new Date().toISOString()
        },
        {
            _id: 'usr_pending_2',
            username: 'sunita_officer',
            password: 'officer123',
            name: 'Sunita Verma',
            role: 'cash_officer',
            status: 'PENDING',
            pin: '4444',
            counterAssigned: 'Cash Cabin',
            createdAt: new Date().toISOString()
        }
    ],
    products: [
        {
            _id: 'prod_1',
            barcode: '8901030364958',
            name: 'Aashirvaad Shudh Chakki Atta 5kg',
            category: 'Staples & Flour',
            unit: 'kg',
            mrp: 275,
            sellingPrice: 229,
            purchasePrice: 198,
            taxPercent: 5,
            stock: 85,
            minStockAlert: 15,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_2',
            barcode: '8901233024032',
            name: 'Fortune Sunlite Refined Sunflower Oil 1L',
            category: 'Edible Oils',
            unit: 'liter',
            mrp: 170,
            sellingPrice: 138,
            purchasePrice: 118,
            taxPercent: 5,
            stock: 60,
            minStockAlert: 10,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_3',
            barcode: '8901058852338',
            name: 'Tata Salt Vacuum Evaporated Iodized 1kg',
            category: 'Spices & Seasoning',
            unit: 'kg',
            mrp: 30,
            sellingPrice: 25,
            purchasePrice: 19,
            taxPercent: 0,
            stock: 140,
            minStockAlert: 20,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_4',
            barcode: '8901262010051',
            name: 'Amul Butter Pasteurized 500gm Pack',
            category: 'Dairy & Refrigerated',
            unit: 'gm',
            mrp: 285,
            sellingPrice: 265,
            purchasePrice: 238,
            taxPercent: 12,
            stock: 45,
            minStockAlert: 10,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_5',
            barcode: '8901063012888',
            name: 'Daawat Rozana Super Basmati Rice 5kg',
            category: 'Rice & Grains',
            unit: 'kg',
            mrp: 450,
            sellingPrice: 369,
            purchasePrice: 310,
            taxPercent: 5,
            stock: 35,
            minStockAlert: 8,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_6',
            barcode: '8901725181223',
            name: 'Surf Excel Easy Wash Detergent Powder 1kg',
            category: 'Household & Cleaning',
            unit: 'kg',
            mrp: 165,
            sellingPrice: 139,
            purchasePrice: 119,
            taxPercent: 18,
            stock: 55,
            minStockAlert: 12,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_7',
            barcode: '8901491101830',
            name: 'Haldiram Nagpur Bhujia Sev 400gm',
            category: 'Snacks & Namkeen',
            unit: 'gm',
            mrp: 130,
            sellingPrice: 105,
            purchasePrice: 88,
            taxPercent: 12,
            stock: 75,
            minStockAlert: 15,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_8',
            barcode: '8901058863419',
            name: 'Maggi 2-Minute Masala Noodles 280gm (Pack of 4)',
            category: 'Packaged Foods',
            unit: 'pack',
            mrp: 60,
            sellingPrice: 52,
            purchasePrice: 43,
            taxPercent: 12,
            stock: 120,
            minStockAlert: 25,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_9',
            barcode: '8901030704419',
            name: 'Colgate Strong Teeth Dental Cream 500gm Saver Pack',
            category: 'Personal Care',
            unit: 'pack',
            mrp: 280,
            sellingPrice: 219,
            purchasePrice: 180,
            taxPercent: 18,
            stock: 40,
            minStockAlert: 10,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_10',
            barcode: '8901207010214',
            name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack',
            category: 'Biscuits & Bakery',
            unit: 'pack',
            mrp: 120,
            sellingPrice: 99,
            purchasePrice: 84,
            taxPercent: 5,
            stock: 90,
            minStockAlert: 20,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_11',
            barcode: '2001',
            name: 'Fresh Farm Potatoes (Aloo) Loose',
            category: 'Vegetables & Fruits',
            unit: 'kg',
            mrp: 35,
            sellingPrice: 28,
            purchasePrice: 18,
            taxPercent: 0,
            stock: 195,
            minStockAlert: 30,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_12',
            barcode: '2002',
            name: 'Fresh Red Onions (Pyaz) Loose',
            category: 'Vegetables & Fruits',
            unit: 'kg',
            mrp: 45,
            sellingPrice: 36,
            purchasePrice: 24,
            taxPercent: 0,
            stock: 175,
            minStockAlert: 25,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_13',
            barcode: '2003',
            name: 'Premium Crystal Sugar (Chini) Loose',
            category: 'Staples & Flour',
            unit: 'kg',
            mrp: 52,
            sellingPrice: 44,
            purchasePrice: 38,
            taxPercent: 0,
            stock: 280,
            minStockAlert: 40,
            createdAt: new Date().toISOString()
        },
        {
            _id: 'prod_14',
            barcode: '2004',
            name: 'Toor Dal / Arhar Dal Super Clean 1kg',
            category: 'Pulses & Dals',
            unit: 'kg',
            mrp: 180,
            sellingPrice: 155,
            purchasePrice: 132,
            taxPercent: 0,
            stock: 80,
            minStockAlert: 15,
            createdAt: new Date().toISOString()
        }
    ],
    shifts: [
        {
            _id: 'shift_prev_101',
            shiftNumber: 'SH-20261010-01',
            cashierId: 'usr_cashier1',
            cashierName: 'Rahul Sharma',
            counterNo: 'Counter-01',
            startTime: new Date(Date.now() - 6 * 3600000).toISOString(),
            endTime: new Date(Date.now() - 2 * 3600000).toISOString(),
            status: 'TALLIED_APPROVED',
            openingFloat: 2000,
            billsCount: 14,
            grossSales: 12540,
            totalDiscount: 1890,
            netSales: 10650,
            paymentSummary: {
                cash: 5200,
                upi: 3850,
                card: 1600
            },
            expectedCashInDrawer: 7200, // 2000 float + 5200 cash sales
            physicalCashHandedOver: 7200,
            cashDifference: 0,
            tallyStatus: 'TALLIED',
            denominations: {
                500: 12, // 6000
                200: 4,  // 800
                100: 3,  // 300
                50: 2,   // 100
                20: 0,
                10: 0,
                coins: 0
            },
            officerVerifiedBy: 'Vikram Singh',
            officerNotes: 'Shift verified and cash tallied accurately. Vault entry logged.',
            verifiedAt: new Date(Date.now() - 1.8 * 3600000).toISOString()
        },
        {
            _id: 'shift_prev_102',
            shiftNumber: 'SH-20261010-02',
            cashierId: 'usr_cashier2',
            cashierName: 'Priya Patel',
            counterNo: 'Counter-02',
            startTime: new Date(Date.now() - 5 * 3600000).toISOString(),
            endTime: new Date(Date.now() - 1 * 3600000).toISOString(),
            status: 'CLOSED_PENDING_APPROVAL',
            openingFloat: 2000,
            billsCount: 9,
            grossSales: 8900,
            totalDiscount: 1150,
            netSales: 7750,
            paymentSummary: {
                cash: 4400,
                upi: 2350,
                card: 1000
            },
            expectedCashInDrawer: 6400, // 2000 float + 4400 cash
            physicalCashHandedOver: 6280, // short by 120
            cashDifference: -120,
            tallyStatus: 'SHORTAGE',
            denominations: {
                500: 10, // 5000
                200: 5,  // 1000
                100: 2,  // 200
                50: 1,   // 50
                20: 1,   // 20
                10: 1,   // 10
                coins: 0
            },
            officerVerifiedBy: '',
            officerNotes: 'Shortage of Rs. 120 noticed. Cashier explained customer change adjustment issue. Pending final sign-off.',
            verifiedAt: null
        },
    ],
    bills: [],
    heldBills: [],
    stores: [
        {
            _id: 'store_default',
            storeName: 'Smart Retail & SuperMarket',
            storeType: 'Supermarket & Kirana Store',
            ownerName: 'Rajesh Mehta',
            address: 'Shop No. 12, Main Bazaar, City Center',
            contact: '+91 98765 43210',
            gstin: '24AAACD1234F1Z5',
            receiptTagline: 'Thank you for shopping with us! Visit again.',
            counters: [
                'Counter-01 (Express Grocery)',
                'Counter-02 (General Retail)',
                'Counter-03 (Bulk & Produce)',
                'Counter-04 (Quick Billing)'
            ],
            createdAt: '2026-01-01T00:00:00.000Z'
        }
    ],
    storeConfig: {
        storeName: 'Smart Retail & SuperMarket',
        storeType: 'Supermarket & Kirana Store',
        ownerName: 'Rajesh Mehta',
        address: 'Shop No. 12, Main Bazaar, City Center',
        contact: '+91 98765 43210',
        gstin: '24AAACD1234F1Z5',
        receiptTagline: 'Thank you for shopping with us! Visit again.',
        counters: [
            'Counter-01 (Express Grocery)',
            'Counter-02 (General Retail)',
            'Counter-03 (Bulk & Produce)',
            'Counter-04 (Quick Billing)'
        ]
    }
};

// In-memory runtime state
let store = null;

function loadStore() {
    if (store) return store;
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            store = JSON.parse(raw);

            // Ensure stores array exists
            if (!store.stores || !Array.isArray(store.stores) || store.stores.length === 0) {
                store.stores = [
                    {
                        _id: 'store_default',
                        storeName: store.storeConfig?.storeName || 'Smart Retail & SuperMarket',
                        storeType: store.storeConfig?.storeType || 'Supermarket & Kirana Store',
                        ownerName: store.storeConfig?.ownerName || 'Rajesh Mehta',
                        address: store.storeConfig?.address || 'Shop No. 12, Main Bazaar, City Center',
                        contact: store.storeConfig?.contact || '+91 98765 43210',
                        gstin: store.storeConfig?.gstin || '24AAACD1234F1Z5',
                        receiptTagline: store.storeConfig?.receiptTagline || 'Thank you for shopping with us! Visit again.',
                        counters: store.storeConfig?.counters || [
                            'Counter-01 (Express Grocery)',
                            'Counter-02 (General Retail)',
                            'Counter-03 (Bulk & Produce)',
                            'Counter-04 (Quick Billing)'
                        ],
                        createdAt: new Date().toISOString()
                    }
                ];
            }

            // Sync legacy storeConfig
            if (!store.storeConfig) {
                store.storeConfig = JSON.parse(JSON.stringify(store.stores[0]));
            }
            if (!store.storeConfig.counters || store.storeConfig.counters.length === 0) {
                store.storeConfig.counters = [...store.stores[0].counters];
            }

            const defaultStoreId = store.stores[0]._id || 'store_default';

            // Ensure storeId and status on existing users
            if (store.users) {
                store.users.forEach(u => {
                    if (!u.status) u.status = 'APPROVED';
                    if (!u.storeId) u.storeId = defaultStoreId;
                });
                // Ensure officer1 exists
                if (!store.users.find(u => u.username === 'officer1')) {
                    store.users.push({
                        _id: 'usr_cash_officer',
                        storeId: defaultStoreId,
                        username: 'officer1',
                        password: 'officer123',
                        name: 'Vikram Singh (Head Cash Officer)',
                        role: 'cash_officer',
                        status: 'APPROVED',
                        pin: '9999',
                        counterAssigned: 'Central Cash Vault'
                    });
                }
                // Ensure pending sample requests exist if none
                if (!store.users.find(u => u.status === 'PENDING')) {
                    store.users.push(
                        {
                            _id: 'usr_pending_1',
                            storeId: defaultStoreId,
                            username: 'anil_cashier',
                            password: 'cashier123',
                            name: 'Anil Kumar',
                            role: 'cashier',
                            status: 'PENDING',
                            pin: '3333',
                            counterAssigned: 'Counter-03',
                            createdAt: new Date().toISOString()
                        },
                        {
                            _id: 'usr_pending_2',
                            storeId: defaultStoreId,
                            username: 'sunita_officer',
                            password: 'officer123',
                            name: 'Sunita Verma',
                            role: 'cash_officer',
                            status: 'PENDING',
                            pin: '4444',
                            counterAssigned: 'Cash Cabin',
                            createdAt: new Date().toISOString()
                        }
                    );
                }
            }

            // Ensure storeId on products
            if (store.products) {
                store.products.forEach(p => {
                    if (!p.storeId) p.storeId = defaultStoreId;
                });
            }

            // Ensure storeId on shifts
            if (store.shifts) {
                store.shifts.forEach(s => {
                    if (!s.storeId) s.storeId = defaultStoreId;
                });
            }

            // Ensure storeId on bills
            if (store.bills) {
                store.bills.forEach(b => {
                    if (!b.storeId) b.storeId = defaultStoreId;
                });
            }

            // Ensure storeId on heldBills
            if (store.heldBills) {
                store.heldBills.forEach(h => {
                    if (!h.storeId) h.storeId = defaultStoreId;
                });
            }

            saveStore();
        } else {
            store = JSON.parse(JSON.stringify(initialData));
            saveStore();
        }
    } catch (err) {
        console.error('Failed to load store, initializing defaults:', err.message);
        store = JSON.parse(JSON.stringify(initialData));
    }
    return store;
}

function getStoreId(req) {
    if (!req) return 'store_default';
    return (
        req.headers?.['x-store-id'] ||
        req.query?.storeId ||
        req.body?.storeId ||
        req.user?.storeId ||
        'store_default'
    );
}

function saveStore() {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
        console.error('Failed to save store to disk:', err.message);
    }
}

function resetToDefaults() {
    store = JSON.parse(JSON.stringify(initialData));
    saveStore();
    return store;
}

module.exports = {
    getStore: loadStore,
    saveStore,
    resetToDefaults,
    getStoreId
};

