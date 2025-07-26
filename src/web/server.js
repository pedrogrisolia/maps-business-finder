const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const ScraperEngine = require('../core/ScraperEngine');
const logger = require('../utils/logger');
const settings = require('../config/settings.json');

class WebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 3000;
        this.activeSessions = new Map();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, '../../public')));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS for API endpoints
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });

        logger.info('Web server middleware configured');
    }

    setupRoutes() {
        // Main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });

        // API Routes
        this.app.post('/api/scrape', this.handleScrapeRequest.bind(this));
        this.app.get('/api/sessions/:sessionId', this.getSessionStatus.bind(this));
        this.app.delete('/api/sessions/:sessionId', this.stopSession.bind(this));
        this.app.get('/api/exports', this.listExports.bind(this));
        this.app.get('/api/exports/:filename', this.downloadExport.bind(this));
        this.app.get('/api/health', this.healthCheck.bind(this));

        logger.info('Web server routes configured');
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            socket.on('subscribe-to-session', (sessionId) => {
                socket.join(sessionId);
                logger.info(`Client ${socket.id} subscribed to session ${sessionId}`);
            });

            socket.on('unsubscribe-from-session', (sessionId) => {
                socket.leave(sessionId);
                logger.info(`Client ${socket.id} unsubscribed from session ${sessionId}`);
            });

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });

        logger.info('WebSocket handlers configured');
    }

    async handleScrapeRequest(req, res) {
        try {
            const { searchTerm, options = {} } = req.body;

            // Validate input
            if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Termo de pesquisa é obrigatório'
                });
            }

            // Create new scraper instance
            const scraper = new ScraperEngine();
            const sessionId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Store session
            this.activeSessions.set(sessionId, {
                scraper,
                startTime: new Date(),
                searchTerm: searchTerm.trim(),
                options,
                status: 'starting'
            });

            // Set up progress callback for real-time updates
            scraper.setProgressCallback((progressData) => {
                this.io.to(sessionId).emit('progress', {
                    sessionId,
                    ...progressData
                });
            });

            // Send immediate response with session ID
            res.json({
                success: true,
                sessionId,
                message: 'Scraping iniciado com sucesso'
            });

            // Start scraping in background
            this.startScrapingSession(sessionId, searchTerm.trim(), options);

        } catch (error) {
            logger.error('Scrape request failed', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }

    async startScrapingSession(sessionId, searchTerm, options) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        try {
            session.status = 'running';
            
            // Notify clients that scraping started
            this.io.to(sessionId).emit('session-started', {
                sessionId,
                searchTerm,
                options
            });

            logger.info(`Starting web scraping session: ${sessionId}`, { searchTerm, options });

            // Execute scraping
            const result = await session.scraper.scrapeBusinesses(searchTerm, options);

            // Update session
            session.result = result;
            session.status = result.success ? 'completed' : 'failed';
            session.endTime = new Date();

            // Notify clients of completion
            this.io.to(sessionId).emit('session-completed', {
                sessionId,
                result
            });

            logger.info(`Web scraping session completed: ${sessionId}`, {
                success: result.success,
                businessCount: result.results?.total || 0
            });

        } catch (error) {
            logger.error(`Web scraping session failed: ${sessionId}`, error);
            
            session.status = 'failed';
            session.error = error.message;
            session.endTime = new Date();

            this.io.to(sessionId).emit('session-failed', {
                sessionId,
                error: error.message
            });
        }
    }

    async getSessionStatus(req, res) {
        try {
            const { sessionId } = req.params;
            const session = this.activeSessions.get(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Sessão não encontrada'
                });
            }

            const sessionInfo = {
                sessionId,
                searchTerm: session.searchTerm,
                options: session.options,
                status: session.status,
                startTime: session.startTime,
                endTime: session.endTime || null,
                result: session.result || null,
                error: session.error || null
            };

            res.json({
                success: true,
                session: sessionInfo
            });

        } catch (error) {
            logger.error('Get session status failed', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }

    async stopSession(req, res) {
        try {
            const { sessionId } = req.params;
            const session = this.activeSessions.get(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Sessão não encontrada'
                });
            }

            if (session.scraper && session.status === 'running') {
                await session.scraper.stopScraping();
                session.status = 'stopped';
                session.endTime = new Date();

                this.io.to(sessionId).emit('session-stopped', {
                    sessionId
                });
            }

            res.json({
                success: true,
                message: 'Sessão interrompida com sucesso'
            });

        } catch (error) {
            logger.error('Stop session failed', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }

    async listExports(req, res) {
        try {
            const exporters = require('../utils/exporters');
            const files = await exporters.listExportFiles();

            res.json({
                success: true,
                exports: files.map(file => ({
                    filename: file.filename,
                    size: file.size,
                    created: file.created,
                    modified: file.modified
                }))
            });

        } catch (error) {
            logger.error('List exports failed', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao listar arquivos de exportação'
            });
        }
    }

    async downloadExport(req, res) {
        try {
            const { filename } = req.params;
            const outputDir = settings.output.outputDir;
            const filepath = path.join(outputDir, filename);

            // Security check
            if (!filename.match(/^[a-zA-Z0-9_\-\.]+\.(json|csv)$/)) {
                return res.status(400).json({
                    success: false,
                    error: 'Nome de arquivo inválido'
                });
            }

            if (!await fs.pathExists(filepath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Arquivo não encontrado'
                });
            }

            res.download(filepath, filename);

        } catch (error) {
            logger.error('Download export failed', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao baixar arquivo'
            });
        }
    }

    async healthCheck(req, res) {
        try {
            const stats = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                activeSessions: this.activeSessions.size,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: require('../../package.json').version
            };

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            logger.error('Health check failed', error);
            res.status(500).json({
                success: false,
                error: 'Health check failed'
            });
        }
    }

    async start() {
        try {
            // Ensure public directory exists
            await fs.ensureDir(path.join(__dirname, '../../public'));
            
            this.server.listen(this.port, () => {
                logger.info(`Maps Business Finder Web Server started on port ${this.port}`);
                logger.info(`Access the web interface at: http://localhost:${this.port}`);
                
                // Clean up old sessions periodically
                setInterval(() => {
                    this.cleanupOldSessions();
                }, 60000); // Every minute
            });

        } catch (error) {
            logger.error('Failed to start web server', error);
            throw error;
        }
    }

    cleanupOldSessions() {
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour

        for (const [sessionId, session] of this.activeSessions) {
            const age = now - session.startTime.getTime();
            
            if (age > maxAge && session.status !== 'running') {
                this.activeSessions.delete(sessionId);
                logger.debug(`Cleaned up old session: ${sessionId}`);
            }
        }
    }

    async stop() {
        try {
            // Stop all active sessions
            for (const [sessionId, session] of this.activeSessions) {
                if (session.scraper && session.status === 'running') {
                    await session.scraper.stopScraping();
                }
            }

            // Close server
            this.server.close(() => {
                logger.info('Web server stopped');
            });

        } catch (error) {
            logger.error('Failed to stop web server', error);
        }
    }
}

// Create and export server instance
const webServer = new WebServer();

// Start server if this file is run directly
if (require.main === module) {
    webServer.start().catch(error => {
        logger.error('Failed to start web server', error);
        process.exit(1);
    });
}

module.exports = webServer;