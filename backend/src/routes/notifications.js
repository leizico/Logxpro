const express = require('express');
const router = express.Router();
const { getNotifications, createNotification } = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getNotifications);
router.post('/', authenticateToken, createNotification);

module.exports = router;
