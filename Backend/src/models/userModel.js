const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' }, // नया फीचर
    joinDate: { type: Date, default: Date.now } // Attendance Rate के लिए
});

module.exports = mongoose.model('User', userSchema);