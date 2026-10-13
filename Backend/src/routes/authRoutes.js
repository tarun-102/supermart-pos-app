const express = require('express');
const router = express.Router();
const {
    login,
    registerRequest,
    getPendingRequests,
    approveUser,
    rejectUser,
    getAllUsers
} = require('../controllers/authController');

router.post('/login', login);
router.post('/register', registerRequest);
router.get('/pending', getPendingRequests);
router.put('/approve/:id', approveUser);
router.put('/reject/:id', rejectUser);
router.get('/users', getAllUsers);

module.exports = router;