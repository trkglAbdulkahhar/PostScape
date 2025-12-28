const notFound = (req, res) => {
    res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        description: 'The page you are looking for does not exist.'
    });
};

const globalError = (err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(err.status || 500).render('error', {
        title: 'Error',
        statusCode: err.status || 500,
        description: 'An unexpected error occurred.'
    });
};

module.exports = { notFound, globalError };
