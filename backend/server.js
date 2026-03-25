const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const net = require('net');

// Import Routes
const authRoutes = require('./src/routes/auth');
const taskRoutes = require('./src/routes/tasks');
const userRoutes = require('./src/routes/users');
const manifestRoutes = require('./src/routes/manifests');
const reportRoutes = require('./src/routes/reports');
const notificationRoutes = require('./src/routes/notifications');
const locationRoutes = require('./src/routes/location');
const profileRoutes = require('./src/routes/profiles');

const app = express();
app.use(cors());

// Increase payload limit to handle base64 images (photos, signatures)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dispatched-loads', manifestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/profiles', profileRoutes);

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../dist')));

// Anything that doesn't match the above, send back index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;

const ensurePortAvailable = (port) => {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', () => resolve(false))
            .once('listening', () => {
                tester.close(() => resolve(true));
            })
            .listen(port, '0.0.0.0');
    });
};

const start = async () => {
    const available = await ensurePortAvailable(PORT);
    if (!available) {
        console.log(`Porta ${PORT} em uso. Backend já está rodando. Não iniciando novo servidor.`);
        return;
    }
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend running on port ${PORT}`);
    });
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            console.log(`Porta ${PORT} em uso. Backend já está rodando. Não iniciando novo servidor.`);
        } else {
            console.error(err);
        }
    });
};

start();
