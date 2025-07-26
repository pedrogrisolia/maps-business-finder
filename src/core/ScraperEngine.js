const BrowserManager = require('./BrowserManager');
const DataExtractor = require('./DataExtractor');
const ScrollController = require('./ScrollController');
const ResultProcessor = require('./ResultProcessor');
const logger = require('../utils/logger');
const Validators = require('../utils/validators');
const exporters = require('../utils/exporters');
const settings = require('../config/settings.json');

class ScraperEngine {
    constructor() {
        this.browserManager = new BrowserManager();
        this.dataExtractor = new DataExtractor();
        this.scrollController = new ScrollController();
        this.resultProcessor = new ResultProcessor();
        
        this.currentSession = null;
        this.isRunning = false;
        this.progressCallback = null;
        
        this.sessionStats = {
            startTime: null,
            endTime: null,
            duration: 0,
            totalBusinesses: 0,
            scrollAttempts: 0,
            errors: [],
            warnings: []
        };
    }

    /**
     * Main scraping method - orchestrates the entire process
     */
    async scrapeBusinesses(searchTerm, options = {}) {
        try {
            // Validate input
            const validation = Validators.validateSearchTerm(searchTerm);
            if (!validation.isValid) {
                throw new Error(`Invalid search term: ${validation.errors.join(', ')}`);
            }

            // Initialize session
            this.currentSession = await this.initializeSession(validation.sanitized, options);
            this.isRunning = true;

            logger.startSession(this.currentSession.id, searchTerm);
            this.reportProgress('session_started', { sessionId: this.currentSession.id });

            // Step 1: Initialize browser
            this.reportProgress('initializing_browser', null, 5);
            const coordinates = options.coordinates || null;
            const browserResult = await this.browserManager.initialize(coordinates);
            if (!browserResult.success) {
                throw new Error(`Browser initialization failed: ${browserResult.error}`);
            }

            // Step 2: Multi-location and multi-zoom search strategy
            this.reportProgress('navigating', { searchTerm }, 15);
            
            // Mapear raio de busca para níveis de zoom
            const searchRadius = options.searchRadius || 10;
            const zoomLevels = this.getZoomLevelsForRadius(searchRadius);
            let allBusinesses = [];
            let totalScrollAttempts = 0;
            
            // Processar múltiplas localizações se disponíveis
            const locations = this.getSearchLocations(coordinates);
            const totalLocations = locations.length;
            
            for (let locIndex = 0; locIndex < totalLocations; locIndex++) {
                const location = locations[locIndex];
                const locationProgress = 15 + (locIndex * (60 / totalLocations)); // Distribuir progresso entre localizações
                
                logger.info(`Processing location ${locIndex + 1}/${totalLocations}: ${location.name || 'Default'}`);
                this.reportProgress('navigating', { 
                    searchTerm, 
                    location: location.name || 'Default',
                    locationIndex: locIndex + 1,
                    totalLocations: totalLocations,
                    searchRadius: searchRadius
                }, locationProgress);
                
                for (let i = 0; i < zoomLevels.length; i++) {
                    const zoom = zoomLevels[i];
                    const iterationProgress = locationProgress + (i * (50 / zoomLevels.length)); // Distribuir progresso entre zooms
                    
                    logger.info(`Starting search with zoom level ${zoom} (${i + 1}/${zoomLevels.length}) for location: ${location.name || 'Default'}`);
                    this.reportProgress('navigating', { 
                        searchTerm, 
                        zoomLevel: zoom, 
                        iteration: i + 1, 
                        totalIterations: zoomLevels.length,
                        location: location.name || 'Default',
                        locationIndex: locIndex + 1,
                        totalLocations: totalLocations,
                        searchRadius: searchRadius
                    }, iterationProgress);
                    
                    try {
                        // Navegar para a busca com o zoom atual e localização
                        const navigationResult = await this.navigateToSearch(validation.sanitized, location.coordinates, zoom);
                        if (!navigationResult.success) {
                            logger.warn(`Navigation failed for zoom ${zoom} at location ${location.name}, skipping...`);
                            continue;
                        }
                        
                        // Step 3: Initial data extraction
                        this.reportProgress('extracting_initial_data', { 
                            zoomLevel: zoom, 
                            iteration: i + 1,
                            location: location.name || 'Default'
                        }, iterationProgress + 2);
                        const initialData = await this.dataExtractor.extractBusinessData(this.browserManager.getPage());
                        logger.extraction(`Initial extraction: ${initialData.length} businesses found at ${location.name || 'Default'}`);
                        
                        // Step 4: Smart scrolling with real-time extraction
                        this.reportProgress('smart_scrolling', { 
                            initialCount: initialData.length,
                            zoomLevel: zoom,
                            iteration: i + 1,
                            location: location.name || 'Default'
                        }, iterationProgress + 4);
                        const scrollResult = await this.performSmartScrolling();
                        totalScrollAttempts += scrollResult.attempts || 0;
                        
                        // Step 5: Final data extraction
                        this.reportProgress('extracting_final_data', { 
                            zoomLevel: zoom,
                            iteration: i + 1,
                            location: location.name || 'Default'
                        }, iterationProgress + 8);
                        const finalData = await this.dataExtractor.extractBusinessData(this.browserManager.getPage());
                        
                        // Adicionar informações de localização aos resultados
                        const dataWithLocation = finalData.map(business => ({
                            ...business,
                            searchLocation: location.name || 'Default',
                            locationCoordinates: location.coordinates
                        }));
                        
                        allBusinesses = allBusinesses.concat(dataWithLocation);
                        
                        // Atualizar progresso com total de empresas encontradas
                        this.reportProgress('processing_results', { 
                            totalExtracted: allBusinesses.length,
                            zoomLevel: zoom,
                            iteration: i + 1,
                            businessesInThisZoom: finalData.length,
                            location: location.name || 'Default',
                            locationIndex: locIndex + 1,
                            totalLocations: totalLocations
                        }, iterationProgress + 10);
                        
                        logger.info(`Zoom ${zoom} completed at ${location.name || 'Default'}: ${finalData.length} businesses found (Total: ${allBusinesses.length})`);
                        
                        // Pequena pausa entre buscas para evitar sobrecarga
                        if (i < zoomLevels.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        
                    } catch (error) {
                        logger.warn(`Error during zoom ${zoom} search at ${location.name || 'Default'}:`, error.message);
                        continue; // Continuar com o próximo zoom mesmo se este falhar
                    }
                }
                
                // Pausa entre localizações
                if (locIndex < totalLocations - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
            
            // Step 6: Process and sort combined results
            this.reportProgress('processing_results', { totalExtracted: allBusinesses.length }, 85);
            
            if (allBusinesses.length > 0) {
                // Remover duplicatas baseado no nome e endereço
                const uniqueBusinesses = this.removeDuplicates(allBusinesses);
                logger.info(`Removed duplicates: ${allBusinesses.length} → ${uniqueBusinesses.length} businesses`);
                
                const processingResult = await this.resultProcessor.processResults(uniqueBusinesses, options);
                
                // Step 7: Export results
                this.reportProgress('exporting_results', null, 95);
                const exportResult = await this.exportResults(processingResult.results, searchTerm, options);
                
                // Complete session
                const sessionResult = await this.completeSession(processingResult.results, { attempts: totalScrollAttempts }, exportResult);
                this.reportProgress('completed', sessionResult, 100);
                
                logger.endSession(this.currentSession.id, processingResult.results);
                return sessionResult;
            } else {
                throw new Error('No businesses found across all zoom levels');
            }
            
        } catch (error) {
            this.sessionStats.errors.push(error.message);
            logger.error('Scraping failed', error, { sessionId: this.currentSession?.id });
            
            const errorResult = await this.handleScrapingError(error);
            this.reportProgress('error', errorResult, 0);
            
            return errorResult;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Initialize scraping session
     */
    async initializeSession(searchTerm, options) {
        const sessionId = `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.sessionStats = {
            startTime: new Date(),
            endTime: null,
            duration: 0,
            totalBusinesses: 0,
            scrollAttempts: 0,
            errors: [],
            warnings: []
        };

        const session = {
            id: sessionId,
            searchTerm,
            options: {
                removeDuplicates: true,
                minRating: null,
                minReviews: null,
                limit: null,
                exportFormats: ['json', 'csv'],
                ...options
            },
            startTime: this.sessionStats.startTime.toISOString()
        };

        logger.info('Session initialized', { sessionId, searchTerm, options: session.options });
        return session;
    }

    /**
     * Navigate to Google Maps search
     */
    async navigateToSearch(searchTerm, coordinates = null, zoom = 13) {
        try {
            let searchUrl;
            
            if (coordinates && coordinates.lat && coordinates.lon) {
                // Usar URL direta com coordenadas específicas e zoom personalizado
                searchUrl = `https://www.google.com/maps/@${coordinates.lat},${coordinates.lon},${zoom}z/search/${encodeURIComponent(searchTerm)}`;
                
                logger.info(`Navigating to search with coordinates: ${searchTerm} (zoom: ${zoom})`, { 
                    url: searchUrl, 
                    coordinates: { lat: coordinates.lat, lon: coordinates.lon },
                    zoom: zoom
                });
            } else {
                // URL padrão sem coordenadas usando o formato oficial
                const encodedTerm = encodeURIComponent(searchTerm);
                searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedTerm}`;
                logger.info(`Navigating to search: ${searchTerm}`, { url: searchUrl });
            }
            
            // Usar o BrowserManager para navegar
            const navigationResult = await this.browserManager.navigateToUrl(searchUrl);
            
            if (navigationResult.success) {
                const page = this.browserManager.getPage();
                if (page) {
                    await page.waitForTimeout(3000);
                }
            }
            return navigationResult;
            
        } catch (error) {
            logger.error('Navigation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Perform smart scrolling with continuous data extraction
     */
    async performSmartScrolling() {
        try {
            logger.scrolling('Starting smart scrolling process');

            let previousCount = 0;
            const scrollResult = await this.scrollController.smartScroll(
                this.browserManager.getPage(),
                (scrollProgress) => {
                    this.sessionStats.scrollAttempts = scrollProgress.scrollAttempts;
                    
                    // Report scrolling progress
                    const progressPercent = 30 + (scrollProgress.progress * 0.5); // 30-80% range
                    this.reportProgress('scrolling', {
                        attempt: scrollProgress.scrollAttempts,
                        maxAttempts: scrollProgress.maxAttempts,
                        endDetected: scrollProgress.endDetected,
                        heightChanged: scrollProgress.heightChanged
                    }, progressPercent);
                }
            );

            this.sessionStats.scrollAttempts = scrollResult.scrollAttempts;

            if (scrollResult.endDetected) {
                logger.scrolling('End of results detected during scrolling');
            } else if (scrollResult.maxAttemptsReached) {
                logger.scrolling('Maximum scroll attempts reached');
                this.sessionStats.warnings.push('Maximum scroll attempts reached without end detection');
            }

            return scrollResult;

        } catch (error) {
            logger.error('Smart scrolling failed', error);
            this.sessionStats.errors.push(`Scrolling error: ${error.message}`);
            
            return {
                success: false,
                error: error.message,
                scrollAttempts: this.sessionStats.scrollAttempts
            };
        }
    }

    /**
     * Get search locations from coordinates
     */
    getSearchLocations(coordinates) {
        if (!coordinates) {
            return [{ name: 'Default', coordinates: null }];
        }
        
        // Se for um array de endereços (múltiplas localizações)
        if (Array.isArray(coordinates)) {
            return coordinates.map((addr, index) => ({
                name: addr.address || `Localização ${index + 1}`,
                coordinates: { lat: addr.lat, lon: addr.lon }
            }));
        }
        
        // Se for um objeto único (compatibilidade com versão anterior)
        if (coordinates.lat && coordinates.lon) {
            return [{
                name: coordinates.address || 'Localização Selecionada',
                coordinates: { lat: coordinates.lat, lon: coordinates.lon }
            }];
        }
        
        return [{ name: 'Default', coordinates: null }];
    }

    /**
     * Get zoom levels based on search radius
     */
    getZoomLevelsForRadius(radius) {
        const zoomMappings = {
            2: [15],           // 2km: 2 níveis (muito local)
            5: [15, 14],           // 5km: 3 níveis (bairro)
            10: [15, 14, 13],      // 10km: 4 níveis (região)
            20: [15, 14, 13, 12],      // 20km: 5 níveis (cidade)
            50: [15, 14, 13, 12, 11],      // 50km: 6 níveis (metrópole)
            100: [15, 14, 13, 12, 11, 10]       // 100km: 7 níveis (estado)
        };
        
        return zoomMappings[radius] || [15, 14, 13]; // Default para 10km
    }

    /**
     * Remove duplicate businesses based on name and address
     */
    removeDuplicates(businesses) {
        const seen = new Set();
        return businesses.filter(business => {
            const key = `${business.name || ''}-${business.address || ''}`.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Export results in specified formats
     */
    async exportResults(results, searchTerm, options) {
        try {
            const exportFormats = options.exportFormats || settings.output.formats;
            logger.info(`Exporting results in ${exportFormats.length} formats`, { formats: exportFormats });

            const metadata = {
                sessionId: this.currentSession.id,
                searchTerm,
                totalResults: results.length,
                scrollAttempts: this.sessionStats.scrollAttempts,
                processingOptions: options,
                exportedAt: new Date().toISOString()
            };

            const exportResult = await exporters.exportToMultipleFormats(
                results,
                searchTerm,
                exportFormats,
                metadata
            );

            // Export session summary
            const sessionData = {
                sessionId: this.currentSession.id,
                searchTerm,
                startTime: this.sessionStats.startTime.toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - this.sessionStats.startTime.getTime(),
                results,
                scrollAttempts: this.sessionStats.scrollAttempts,
                endDetected: true, // Will be updated based on scroll result
                errors: this.sessionStats.errors,
                warnings: this.sessionStats.warnings,
                exportFormats,
                status: 'completed'
            };

            await exporters.exportSessionSummary(sessionData);

            return exportResult;

        } catch (error) {
            logger.error('Export failed', error);
            this.sessionStats.errors.push(`Export error: ${error.message}`);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Complete scraping session
     */
    async completeSession(results, scrollResult, exportResult) {
        this.sessionStats.endTime = new Date();
        this.sessionStats.duration = this.sessionStats.endTime - this.sessionStats.startTime;
        this.sessionStats.totalBusinesses = results.length;

        // Generate result summary
        const summary = this.resultProcessor.generateSummary(results);

        const sessionResult = {
            success: true,
            sessionId: this.currentSession.id,
            searchTerm: this.currentSession.searchTerm,
            results: {
                businesses: results,
                summary,
                total: results.length
            },
            scrolling: {
                attempts: scrollResult.scrollAttempts,
                endDetected: scrollResult.endDetected,
                success: scrollResult.success
            },
            export: exportResult,
            performance: {
                duration: this.sessionStats.duration,
                durationFormatted: this.formatDuration(this.sessionStats.duration),
                extractionStats: this.dataExtractor.getStats(),
                scrollStats: this.scrollController.getStats(),
                processingStats: this.resultProcessor.getStats()
            },
            session: {
                startTime: this.sessionStats.startTime.toISOString(),
                endTime: this.sessionStats.endTime.toISOString(),
                errors: this.sessionStats.errors,
                warnings: this.sessionStats.warnings
            }
        };

        logger.info('Session completed successfully', {
            sessionId: this.currentSession.id,
            duration: this.sessionStats.duration,
            totalBusinesses: results.length,
            scrollAttempts: scrollResult.scrollAttempts
        });

        return sessionResult;
    }

    /**
     * Handle scraping errors
     */
    async handleScrapingError(error) {
        this.sessionStats.endTime = new Date();
        this.sessionStats.duration = this.sessionStats.endTime - this.sessionStats.startTime;

        // Take screenshot for debugging if browser is available
        if (this.browserManager.isReady()) {
            try {
                await this.browserManager.takeScreenshot(`error_${this.currentSession?.id || 'unknown'}.png`);
            } catch (screenshotError) {
                logger.browser('Failed to take error screenshot', 'warn');
            }
        }

        const errorResult = {
            success: false,
            error: error.message,
            sessionId: this.currentSession?.id || 'unknown',
            searchTerm: this.currentSession?.searchTerm || 'unknown',
            results: {
                businesses: [],
                summary: {},
                total: 0
            },
            performance: {
                duration: this.sessionStats.duration,
                durationFormatted: this.formatDuration(this.sessionStats.duration),
                extractionStats: this.dataExtractor.getStats(),
                scrollStats: this.scrollController.getStats(),
                processingStats: this.resultProcessor.getStats()
            },
            session: {
                startTime: this.sessionStats.startTime?.toISOString() || null,
                endTime: this.sessionStats.endTime?.toISOString() || null,
                errors: [...this.sessionStats.errors, error.message],
                warnings: this.sessionStats.warnings
            }
        };

        return errorResult;
    }

    /**
     * Set progress callback for real-time updates
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Report progress to callback
     */
    reportProgress(stage, data = null, progress = null) {
        if (this.progressCallback) {
            try {
                this.progressCallback({
                    stage,
                    progress,
                    data,
                    sessionId: this.currentSession?.id,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                logger.warn('Progress callback failed', { error: error.message });
            }
        }

        // Also log progress
        const message = `Scraping progress: ${stage}${progress ? ` (${progress}%)` : ''}`;
        logger.progress(message, progress, { stage, sessionId: this.currentSession?.id });
    }

    /**
     * Get current session status
     */
    getSessionStatus() {
        return {
            isRunning: this.isRunning,
            currentSession: this.currentSession,
            sessionStats: this.sessionStats,
            browserReady: this.browserManager.isReady()
        };
    }

    /**
     * Stop current scraping session
     */
    async stopScraping() {
        if (this.isRunning) {
            logger.warn('Stopping scraping session', { sessionId: this.currentSession?.id });
            this.isRunning = false;
            this.sessionStats.warnings.push('Session stopped by user');
            await this.cleanup();
        }
    }

    /**
     * Restart browser if needed
     */
    async restartBrowser() {
        logger.browser('Restarting browser');
        return await this.browserManager.restart();
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.isRunning = false;
            await this.browserManager.cleanup();
            
            // Reset component stats if needed
            // this.dataExtractor.resetStats();
            // this.scrollController.resetStats();
            // this.resultProcessor.resetStats();

            logger.info('Cleanup completed', { sessionId: this.currentSession?.id });

        } catch (error) {
            logger.error('Cleanup failed', error);
        }
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    }

    /**
     * Get comprehensive scraper statistics
     */
    getScraperStats() {
        return {
            extraction: this.dataExtractor.getStats(),
            scrolling: this.scrollController.getStats(),
            processing: this.resultProcessor.getStats(),
            browser: this.browserManager.getSessionInfo(),
            session: this.sessionStats
        };
    }

    /**
     * Validate scraper configuration
     */
    validateConfiguration() {
        const issues = [];

        // Validate browser settings
        if (!settings.browser) {
            issues.push('Browser configuration missing');
        }

        // Validate navigation settings
        if (!settings.navigation || !settings.navigation.baseUrl) {
            issues.push('Navigation configuration incomplete');
        }

        // Validate scrolling settings
        if (!settings.scrolling) {
            issues.push('Scrolling configuration missing');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Test scraper components
     */
    async testComponents() {
        const testResults = {
            browser: false,
            navigation: false,
            extraction: false,
            scrolling: false,
            processing: false
        };

        try {
            // Test browser initialization
            const browserResult = await this.browserManager.initialize();
            testResults.browser = browserResult.success;

            if (testResults.browser) {
                // Test navigation
                const navResult = await this.navigateToSearch('test');
                testResults.navigation = navResult.success;

                if (testResults.navigation) {
                    // Test data extraction
                    const extractionData = await this.dataExtractor.extractBusinessData(this.browserManager.getPage());
                    testResults.extraction = extractionData.length >= 0;

                    // Test result processing
                    const processingResult = await this.resultProcessor.processResults([]);
                    testResults.processing = processingResult.success;
                }
            }

        } catch (error) {
            logger.error('Component test failed', error);
        } finally {
            await this.cleanup();
        }

        return testResults;
    }
}

module.exports = ScraperEngine;