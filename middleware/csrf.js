const csurf = require('csurf');

const csrfOptions = {
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
};

const csrfProtection = csurf(csrfOptions);
const csrfPermissive = csurf({
    ...csrfOptions,
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE']
});

// Dual CSRF Middleware
const csrfMiddleware = (req, res, next) => {
    const contentType = req.get('Content-Type');

    if (contentType && contentType.startsWith('multipart/form-data')) {
        csrfPermissive(req, res, next);
    } else {
        csrfProtection(req, res, next);
    }
};

// Token injector
const csrfTokenInjector = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
};

// Error handler
const csrfErrorHandler = (err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403).send(
        'Güvenlik Hatası: Form oturumunuz sona erdi. Lütfen sayfayı yenileyin.'
    );
};

module.exports = {
    csrfMiddleware,
    csrfTokenInjector,
    csrfErrorHandler
};
