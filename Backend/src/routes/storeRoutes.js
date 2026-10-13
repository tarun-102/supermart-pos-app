const express = require('express');
const router = express.Router();
const {
    getAllStores,
    registerStore,
    getStoreConfig,
    updateStoreConfig,
    addCounter,
    deleteCounter,
    getCountersStatus
} = require('../controllers/storeController');

router.get('/all', getAllStores);
router.post('/register', registerStore);
router.get('/config', getStoreConfig);
router.put('/config', updateStoreConfig);
router.post('/counters/add', addCounter);
router.post('/counters/delete', deleteCounter);
router.get('/counters/status', getCountersStatus);

module.exports = router;
