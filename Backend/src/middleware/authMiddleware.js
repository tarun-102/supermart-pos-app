const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    // support 'Bearer <token>' format
    if (token.startsWith('Bearer ')) token = token.slice(7).trim();

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded.userId;
        req.role = decoded.role;
        req.username = decoded.username;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = protect;