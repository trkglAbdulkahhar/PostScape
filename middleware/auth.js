module.exports = {
    isAdmin: (req, res, next) => {
        if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'owner')) {
            return next();
        }
        res.status(403).render('error', { message: 'Access Denied: Admins Only', title: '403 Forbidden' });
    },
    isOwner: (req, res, next) => {
        // ALLOW ADMIN TEMPORARILY FOR RECOVERY
        if (req.session.user && (req.session.user.role === 'owner' || req.session.user.role === 'admin')) {
            return next();
        }
        res.status(403).render('error', { message: 'Access Denied: Owners Only', title: '403 Forbidden' });
    }
};
