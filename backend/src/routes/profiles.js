const express = require('express');
const router = express.Router();
const { getProfiles, createProfile } = require('../controllers/profileController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Allow authorized users (managers/admins) to view and create profiles
router.get('/', authenticateToken, getProfiles);
router.post('/', authenticateToken, authorizeRole(['MANAGER', 'ADMIN']), createProfile);

module.exports = router;
