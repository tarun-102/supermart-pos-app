const { getStore, saveStore, getStoreId } = require('../store/dataStore');
const Product = require('../models/productModel');
const { isConnected } = require('../config/db');

// GET all products with filtering & search (Scoped to Store)
const getProducts = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);
        const { search, category, lowStock } = req.query;

        // If MongoDB is connected, load from MongoDB and sync to local memory
        if (isConnected()) {
            try {
                const query = { storeId };
                if (category && category !== 'ALL') {
                    query.category = category;
                }
                if (lowStock === 'true') {
                    query.$expr = { $lte: ['$stock', '$minStockAlert'] };
                }
                if (search) {
                    const q = search.trim();
                    query.$or = [
                        { name: { $regex: q, $options: 'i' } },
                        { barcode: { $regex: q, $options: 'i' } },
                        { category: { $regex: q, $options: 'i' } }
                    ];
                }

                let dbProducts = await Product.find(query).sort({ name: 1 }).lean();
                if (dbProducts && dbProducts.length > 0) {
                    return res.status(200).json({
                        success: true,
                        storeId,
                        count: dbProducts.length,
                        products: dbProducts
                    });
                }
            } catch (dbErr) {
                console.warn('MongoDB find failed, falling back to local store:', dbErr.message);
            }
        }

        // Filter products belonging to this specific store from local dataStore
        let products = (store.products || []).filter(
            p => (p.storeId || 'store_default') === storeId
        );

        if (search) {
            const q = search.toLowerCase().trim();
            products = products.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.barcode.toLowerCase().includes(q) ||
                (p.category && p.category.toLowerCase().includes(q))
            );
        }

        if (category && category !== 'ALL') {
            products = products.filter(p => p.category === category);
        }

        if (lowStock === 'true') {
            products = products.filter(p => Number(p.stock) <= Number(p.minStockAlert || 10));
        }

        // Sort by product name
        products.sort((a, b) => a.name.localeCompare(b.name));

        res.status(200).json({
            success: true,
            storeId,
            count: products.length,
            products
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET product by barcode (direct scan scoped to Store)
const getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        const store = getStore();
        const storeId = getStoreId(req);
        const cleanBarcode = barcode.trim();

        // 1. Try DB first if connected
        if (isConnected()) {
            try {
                const dbProduct = await Product.findOne({
                    barcode: cleanBarcode,
                    storeId
                }).lean();
                if (dbProduct) {
                    return res.status(200).json({ success: true, product: dbProduct });
                }
            } catch (dbErr) {
                console.warn('MongoDB getProductByBarcode fallback:', dbErr.message);
            }
        }

        // 2. Local store search
        const product = (store.products || []).find(
            p => (p.barcode === cleanBarcode || p.barcode.trim() === cleanBarcode) &&
                 (p.storeId || 'store_default') === storeId
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: `Product with barcode "${barcode}" not found in this shop's inventory.`
            });
        }

        res.status(200).json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// CREATE new product (Scoped to Store - Direct DB + Local Store)
const createProduct = async (req, res) => {
    try {
        const store = getStore();
        const storeId = req.body.storeId || getStoreId(req);
        const {
            barcode,
            name,
            category = 'General',
            unit = 'pc',
            mrp,
            sellingPrice,
            purchasePrice = 0,
            taxPercent = 0,
            stock = 0,
            minStockAlert = 10
        } = req.body;

        if (!barcode || !name || mrp === undefined || sellingPrice === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Barcode, Name, MRP, and Selling Price are required.'
            });
        }

        const cleanBarcode = barcode.trim();

        // Check duplicate barcode within THIS store in local store
        const existing = (store.products || []).find(
            p => p.barcode === cleanBarcode && (p.storeId || 'store_default') === storeId
        );
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Barcode "${barcode}" is already assigned to "${existing.name}" in this store.`
            });
        }

        let dbProduct = null;
        if (isConnected()) {
            try {
                // Check if already in MongoDB
                const existingDb = await Product.findOne({ storeId, barcode: cleanBarcode });
                if (existingDb) {
                    return res.status(400).json({
                        success: false,
                        message: `Barcode "${barcode}" already exists in database for this store.`
                    });
                }

                dbProduct = await Product.create({
                    storeId,
                    barcode: cleanBarcode,
                    name: name.trim(),
                    category: category.trim(),
                    unit: unit.trim(),
                    mrp: Number(mrp),
                    sellingPrice: Number(sellingPrice),
                    purchasePrice: Number(purchasePrice),
                    taxPercent: Number(taxPercent),
                    stock: Number(stock),
                    minStockAlert: Number(minStockAlert)
                });
            } catch (dbErr) {
                console.warn('MongoDB Product.create warning:', dbErr.message);
            }
        }

        const newProduct = {
            _id: dbProduct ? dbProduct._id.toString() : `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            storeId,
            barcode: cleanBarcode,
            name: name.trim(),
            category: category.trim(),
            unit: unit.trim(),
            mrp: Number(mrp),
            sellingPrice: Number(sellingPrice),
            purchasePrice: Number(purchasePrice),
            taxPercent: Number(taxPercent),
            stock: Number(stock),
            minStockAlert: Number(minStockAlert),
            createdAt: new Date().toISOString()
        };

        if (!store.products) store.products = [];
        store.products.push(newProduct);
        saveStore();

        res.status(201).json({
            success: true,
            message: 'Product added successfully to store database inventory.',
            product: newProduct
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// UPDATE product (Scoped to Store)
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        const storeId = req.body.storeId || getStoreId(req);

        const idx = (store.products || []).findIndex(
            p => (p._id === id || p.barcode === id) && (p.storeId || 'store_default') === storeId
        );

        if (idx === -1 && !isConnected()) {
            return res.status(404).json({ success: false, message: 'Product not found in this store.' });
        }

        const current = idx !== -1 ? store.products[idx] : {};
        const {
            barcode,
            name,
            category,
            unit,
            mrp,
            sellingPrice,
            purchasePrice,
            taxPercent,
            stock,
            minStockAlert
        } = req.body;

        // If barcode changed, check uniqueness within THIS store
        if (barcode && barcode.trim() !== current.barcode) {
            const cleanBarcode = barcode.trim();
            const conflict = (store.products || []).find(
                p => p.barcode === cleanBarcode && p._id !== current._id && (p.storeId || 'store_default') === storeId
            );
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    message: `Barcode "${barcode}" already exists on another item in this store.`
                });
            }
        }

        const updateData = {
            barcode: barcode ? barcode.trim() : (current.barcode || id),
            name: name ? name.trim() : current.name,
            category: category ? category.trim() : current.category,
            unit: unit ? unit.trim() : current.unit,
            mrp: mrp !== undefined ? Number(mrp) : current.mrp,
            sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : current.sellingPrice,
            purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : current.purchasePrice,
            taxPercent: taxPercent !== undefined ? Number(taxPercent) : current.taxPercent,
            stock: stock !== undefined ? Number(stock) : current.stock,
            minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : current.minStockAlert,
            updatedAt: new Date().toISOString()
        };

        // Update MongoDB if connected
        if (isConnected()) {
            try {
                await Product.findOneAndUpdate(
                    {
                        $or: [{ _id: id }, { barcode: id }],
                        storeId
                    },
                    { $set: updateData },
                    { new: true }
                );
            } catch (dbErr) {
                console.warn('MongoDB updateProduct warning:', dbErr.message);
            }
        }

        if (idx !== -1) {
            const updated = {
                ...current,
                ...updateData
            };
            store.products[idx] = updated;
            saveStore();

            return res.status(200).json({
                success: true,
                message: 'Product updated successfully.',
                product: updated
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product updated in database.',
            product: updateData
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// DELETE product (Scoped to Store)
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        const storeId = getStoreId(req);

        // Delete from MongoDB
        if (isConnected()) {
            try {
                await Product.deleteOne({
                    $or: [{ _id: id }, { barcode: id }],
                    storeId
                });
            } catch (dbErr) {
                console.warn('MongoDB deleteProduct warning:', dbErr.message);
            }
        }

        const initialLen = (store.products || []).length;
        store.products = (store.products || []).filter(
            p => !( (p._id === id || p.barcode === id) && (p.storeId || 'store_default') === storeId )
        );

        if (store.products.length === initialLen && !isConnected()) {
            return res.status(404).json({ success: false, message: 'Product not found in this store.' });
        }

        saveStore();
        res.status(200).json({ success: true, message: 'Product removed from store inventory.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// Stock adjust (Restock / write-off scoped to store)
const adjustStock = async (req, res) => {
    try {
        const { productId, changeAmount } = req.body;
        const store = getStore();
        const storeId = getStoreId(req);

        const product = (store.products || []).find(
            p => (p._id === productId || p.barcode === productId) && (p.storeId || 'store_default') === storeId
        );

        if (!product && !isConnected()) {
            return res.status(404).json({ success: false, message: 'Product not found in this store.' });
        }

        const diff = Number(changeAmount) || 0;
        if (product) {
            product.stock = Math.max(0, Number(product.stock) + diff);
            saveStore();
        }

        // MongoDB sync
        if (isConnected()) {
            try {
                await Product.findOneAndUpdate(
                    {
                        $or: [{ _id: productId }, { barcode: productId }],
                        storeId
                    },
                    { $inc: { stock: diff } }
                );
            } catch (dbErr) {
                console.warn('MongoDB adjustStock warning:', dbErr.message);
            }
        }

        res.status(200).json({
            success: true,
            message: `Stock updated for ${product ? product.name : productId}. New Stock: ${product ? product.stock : 'updated'}`,
            product
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// Reset products catalog for this store
const resetCatalog = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);

        // Remove this store's products and re-seed from default catalog
        store.products = (store.products || []).filter(p => (p.storeId || 'store_default') !== storeId);

        // Find reference template products (from store_default)
        const templateItems = store.products.filter(p => p.storeId === 'store_default');
        const sourceItems = templateItems.length > 0 ? templateItems : [
            {
                barcode: '8901030364958',
                name: 'Aashirvaad Shudh Chakki Atta 5kg',
                category: 'Staples & Flour',
                unit: 'kg',
                mrp: 275,
                sellingPrice: 229,
                purchasePrice: 198,
                taxPercent: 5,
                stock: 85,
                minStockAlert: 15
            },
            {
                barcode: '8901233024032',
                name: 'Fortune Sunlite Refined Sunflower Oil 1L',
                category: 'Edible Oils',
                unit: 'liter',
                mrp: 170,
                sellingPrice: 138,
                purchasePrice: 118,
                taxPercent: 5,
                stock: 60,
                minStockAlert: 10
            }
        ];

        sourceItems.forEach((item, idx) => {
            store.products.push({
                ...item,
                _id: `prod_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
                storeId,
                createdAt: new Date().toISOString()
            });
        });

        saveStore();

        const currentStoreProducts = store.products.filter(p => (p.storeId || 'store_default') === storeId);

        res.status(200).json({
            success: true,
            message: 'Inventory catalog reset with standard grocery items.',
            products: currentStoreProducts
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    getProducts,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    resetCatalog
};
