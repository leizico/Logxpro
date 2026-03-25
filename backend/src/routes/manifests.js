const express = require('express');
const router = express.Router();
const { getDispatchedLoads, createDispatchedLoad } = require('../controllers/manifestController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateToken, getDispatchedLoads);
router.post('/', authenticateToken, authorizeRole(['MANAGER']), createDispatchedLoad);

module.exports = router;
