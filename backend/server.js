const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

// ── Global Panic Mitigation ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Fatal]: Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[Fatal]: Uncaught Exception:', err);
    // Give it a moment to log before dying
    setTimeout(() => process.exit(1), 1000);
});

const app = express();
const PORT = process.env.PORT || 5005; // CLOUD COMPATIBLE PORT (RENDER/HEROKU)

// High-Capacity Data Substrate
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// PRE-AUTHORIZED STATIC SUBSTRATE (SERVED BEFORE NEURAL GATING)
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

app.get('/reports/:filename', (req, res) => {
    // Resolve absolute path from repo root for maximum production stability
    const filePath = path.join(__dirname, 'reports', req.params.filename);
    console.log(`[NeuralServe]: Requesting file: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
        res.sendFile(filePath);
    } else {
        console.error(`[NeuralFault]: File not found: ${filePath}`);
        res.status(404).json({ error: 'Diagnostic report not found in storage substrate.' });
    }
});

// Tactical Request Trace Middleware
app.use((req, res, next) => {
    console.log(`[NeuralTrace]: ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Neural Cluster Connected (Port 5005)'))
    .catch(err => console.error('DB Tactical Fault:', err));

// ── Reports & System Status ──
const ScanReport = require('./models/ScanReport');

app.get('/status', (req, res) => res.json({ status: 'SENTINEL_SYSTEM_ALIVE', port: 5005, layer: 'Absolute_Neural_Gateway_V3' }));

app.get('/api/reports', async (req, res) => {
    try {
        const { userId } = req.query;
        const reports = await ScanReport.find(userId ? { userId } : {}).sort({ createdAt: -1 });
        res.json(reports);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scan/active/:userId', async (req, res) => {
    try {
        const active = await ScanReport.findOne({ userId: req.params.userId, status: 'in-progress' }).sort({ createdAt: -1 });
        if (!active) return res.json({ status: 'idle' });
        res.json(active);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Priority 2: Infrastructure Layers (Unified Neural Routing) ──

// Routes
const { router: scanRouter } = require('./routes/scanRoutes');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const jobRoutes = require('./routes/jobRoutes');
const schedulerService = require('./services/schedulerService');

// Priority 2: Infrastructure Layers (Unified Neural Routing)
app.use('/api', scanRouter); 
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/scheduling', jobRoutes);

// Tactical Pulse Feedback for Verification
app.get('/api/debug/ping', (req, res) => res.json({ status: 'Neural Uplink Stable', timestamp: new Date() }));



const server = http.createServer(app);

// Global Socket Instance
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
global.io = io;

io.on('connection', (socket) => {
    console.log('Tactical Uplink Established:', socket.id);
    
    socket.on('join-room', (reportId) => {
        socket.join(reportId);
        console.log(`Socket ${socket.id} joined Tactical Room: ${reportId}`);
    });

    socket.on('join-user', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined Global User Room: user_${userId}`);
    });

    socket.on('join-chat', (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined Neural Chat: ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log('Tactical Uplink Severed:', socket.id);
    });
});

// ── Smart Port Recovery ──────────────────────────────────────────────────────
const startServer = () => {
    server.listen(PORT, async () => {
        console.log(`Sentinel Server Active on Port ${PORT}`);
        // Initialize tactical scheduler substrate
        await schedulerService.init();
    }).on('error', async (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`[Fatal]: Port ${PORT} is busy. Executing tactical cleanup...`);
            const { execSync } = require('child_process');
            try {
                // Find PID using the port on Windows
                const stdout = execSync(`netstat -ano | findstr :${PORT}`).toString();
                const lines = stdout.split('\n');
                const pids = new Set();
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 4) {
                        const pid = parts[parts.length - 1];
                        if (pid !== '0' && !isNaN(pid)) pids.add(pid);
                    }
                });

                // Additional cleanup for common zombie PIDs
                try {
                    const { execSync } = require('child_process');
                    const processes = ['32168', '3420', '3104', '36388']; // Common zombie PIDs
                    processes.forEach(pid => {
                        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch(e) {}
                    });
                    console.log('[Cleanup]: Common zombie PIDs checked.');
                } catch (error) {
                    console.warn('[Cleanup]: Tactical cleanup encountered permissions bottleneck for common PIDs.');
                }

                pids.forEach(pid => {
                    console.log(`[Cleanup]: Terminating zombie process ${pid}...`);
                    try { execSync(`taskkill /F /PID ${pid}`); } catch (_) {}
                });

                console.log(`[Cleanup]: Port ${PORT} cleared. Restarting in 2s...`);
                setTimeout(startServer, 2000);
            } catch (err) {
                console.error(`[Cleanup Error]: Failed to clear port: ${err.message}`);
                process.exit(1);
            }
        } else {
            console.error('[Server Error]:', e);
        }
    });
};

startServer();
