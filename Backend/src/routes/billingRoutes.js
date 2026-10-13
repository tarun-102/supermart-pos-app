const express = require('express');
const router = express.Router();
const {
    checkout,
    getBills,
    getBillById,
    holdBill,
    getHeldBills,
    deleteHeldBill
} = require('../controllers/billingController');

router.post('/checkout', checkout);
router.get('/bills', getBills);
router.get('/bills/:id', getBillById);
router.post('/hold', holdBill);
router.get('/held-bills', getHeldBills);
router.delete('/held-bills/:id', deleteHeldBill);

module.exports = router;

