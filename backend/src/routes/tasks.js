const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTask, bulkUpdateTasks, importTasks } = require('../controllers/taskController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateToken, getTasks);
router.post('/', authenticateToken, authorizeRole(['MANAGER']), createTask);
router.post('/bulk', authenticateToken, authorizeRole(['MANAGER']), bulkUpdateTasks);
router.post('/import', authenticateToken, authorizeRole(['MANAGER']), importTasks);
router.put('/:id', authenticateToken, updateTask); // Drivers need to update status

module.exports = router;
