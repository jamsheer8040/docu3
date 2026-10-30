const router = require('express').Router();
router.use(require('../middleware/auth.middleware').verifyToken);
router.get('/', require('../controllers/search.controller').search);
module.exports = router;
