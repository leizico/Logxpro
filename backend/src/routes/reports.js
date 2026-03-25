const express = require('express');
const router = express.Router();
const { getReports, registerDispatchedLoad, getDispatchedLoads } = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateToken, authorizeRole(['MANAGER']), getReports);
router.get('/dispatched-loads', authenticateToken, authorizeRole(['MANAGER']), getDispatchedLoads);
router.post('/dispatched-loads', authenticateToken, authorizeRole(['MANAGER']), registerDispatchedLoad);

module.exports = router;
