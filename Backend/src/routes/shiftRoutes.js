const express = require('express');
const router = express.Router();
const {
    getActiveShift,
    startShift,
    closeShift,
    getAllShifts,
    verifyShiftTally,
    getCashOfficeDashboard,
    updateShiftCounter
} = require('../controllers/shiftController');

router.get('/active/:cashierId', getActiveShift);
router.post('/start', startShift);
router.post('/close/:shiftId', closeShift);
router.get('/all', getAllShifts);
router.put('/verify/:shiftId', verifyShiftTally);
router.get('/dashboard-summary', getCashOfficeDashboard);
router.put('/update-counter/:shiftId', updateShiftCounter);

module.exports = router;

