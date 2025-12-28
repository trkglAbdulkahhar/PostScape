function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/auth/login');
    }
    res.locals.currentUser = req.session.user;
    next();
}

module.exports = isAuthenticated;