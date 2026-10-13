const roleMiddleware = (expectedRole) => {
    return (req, res, next) => {
        if (!req.role) {
            return res.status(401).json({ message: 'Role not available on token' });
        }
        if (req.role !== expectedRole) {
            return res.status(403).json({ message: 'Forbidden: insufficient permission' });
        }
        next();
    };
};

module.exports = roleMiddleware;
