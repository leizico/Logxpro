const express = require('express');
const router = express.Router();
const { getManagers, getDrivers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/managers', getManagers);
router.get('/drivers', getDrivers);
router.post('/drivers', authenticateToken, authorizeRole(['MANAGER']), createUser);
router.put('/:id', authenticateToken, authorizeRole(['MANAGER']), updateUser);
router.delete('/:id', authenticateToken, authorizeRole(['MANAGER']), deleteUser);

module.exports = router;
