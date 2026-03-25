const express = require('express');
const router = express.Router();
const { updateLocation } = require('../controllers/locationController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, updateLocation);

module.exports = router;
