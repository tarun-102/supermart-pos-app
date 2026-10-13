const express = require('express');
const router = express.Router();
const { getStatus, addPunch, getAllPunches } = require('../controllers/punchController');
const protect = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/roleMiddleware');

router.get('/status', protect, getStatus);
router.post('/', protect, addPunch);
router.get('/all', protect, adminOnly('admin'), getAllPunches);

module.exports = router;