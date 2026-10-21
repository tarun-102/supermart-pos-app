const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    storeId: {
        type: String,
        required: true,
        default: 'store_default',
        index: true
    },
    barcode: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'General',
        trim: true
    },
    unit: {
        type: String,
        default: 'pc',
        trim: true
    },
    mrp: {
        type: Number,
        required: true,
        default: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        default: 0
    },
    purchasePrice: {
        type: Number,
        default: 0
    },
    taxPercent: {
        type: Number,
        default: 0
    },
    stock: {
        type: Number,
        default: 0
    },
    minStockAlert: {
        type: Number,
        default: 10
    }
}, {
    timestamps: true
});

// Compound index for fast lookup scoped to shop storeId
productSchema.index({ storeId: 1, barcode: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);

