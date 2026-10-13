const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    resetCatalog
} = require('../controllers/inventoryController');

router.get('/', getProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/adjust-stock', adjustStock);
router.post('/reset-seeds', resetCatalog);

module.exports = router;

