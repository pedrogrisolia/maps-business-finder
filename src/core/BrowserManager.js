const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const settings = require('../config/settings.json');

// Add stealth plugin
puppeteer.use(StealthPlugin());

class BrowserManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.sessionId = null;
        this.profilePath = path.resolve(settings.browser.profilePath);
    }

    /**
     * Initialize browser with validated anti-detection configuration
     */
    async initialize(coordinates = null) {
        try {
            logger.browser('Initializing browser with anti-detection setup');
            
            // Ensure Chrome profile directory exists
            await this.ensureProfileDirectory();

            // Launch browser with validated configuration
            this.browser = await puppeteer.launch(this.getBrowserOptions());

            // Create new page
            this.page = await this.browser.newPage();

            // Apply additional stealth measures with coordinates
            await this.applyStealthMeasures(coordinates);

            // Set viewport and user agent
            await this.configurePageSettings();

            // Verify stealth effectiveness
            const stealthVerification = await this.verifyStealthSetup();
            
            if (!stealthVerification.success) {
                logger.browser('Stealth verification failed, but proceeding', 'warn', stealthVerification);
            } else {
                logger.browser('Browser initialized successfully with stealth configuration');
            }

            this.sessionId = `session_${Date.now()}`;
            
            return {
                success: true,
                sessionId: this.sessionId,
                stealth: stealthVerification
            };

        } catch (error) {
            logger.error('Browser initialization failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get browser launch options with validated anti-detection configuration
     */
    getBrowserOptions() {
        const options = {
            headless: settings.browser.headless, // false for better stealth
            args: [
                ...settings.browser.args,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--disable-translate',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-geolocation', // Desabilitar geolocalização
                '--disable-location-services', // Desabilitar serviços de localização
                '--disable-location-history', // Desabilitar histórico de localização
                '--disable-web-security', // Desabilitar algumas restrições de segurança
                '--disable-features=VizDisplayCompositor' // Desabilitar compositor visual
            ],
            defaultViewport: null, // Use real viewport size
            ignoreDefaultArgs: ['--enable-automation']
        };

        // Use user profile if enabled and exists
        if (settings.browser.useUserProfile && fs.existsSync(this.profilePath)) {
            options.userDataDir = this.profilePath;
            logger.browser(`Using Chrome profile: ${this.profilePath}`);
        } else {
            logger.browser('Using temporary Chrome profile');
        }

        return options;
    }

    /**
     * Ensure Chrome profile directory exists
     */
    async ensureProfileDirectory() {
        try {
            if (settings.browser.useUserProfile) {
                await fs.ensureDir(this.profilePath);
                logger.browser(`Profile directory ensured: ${this.profilePath}`);
            }
        } catch (error) {
            logger.browser('Failed to ensure profile directory, using temporary profile', 'warn');
        }
    }

    /**
     * Apply additional stealth measures
     */
    async applyStealthMeasures(coordinates = null) {
        try {
            // Override webdriver property
            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                delete navigator.__proto__.webdriver;
            });

            // Override plugins length
            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
            });

            // Override chrome runtime
            await this.page.evaluateOnNewDocument(() => {
                window.chrome = {
                    runtime: {}
                };
            });

            // Override permissions
            await this.page.evaluateOnNewDocument(() => {
                const originalQuery = window.navigator.permissions.query;
                return window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            });

            // Simular geolocalização com coordenadas específicas ou bloquear
            await this.page.evaluateOnNewDocument((coords) => {
                if (navigator.geolocation) {
                    if (coords && coords.lat && coords.lon) {
                        // Simular as coordenadas fornecidas como geolocalização real
                        const mockPosition = {
                            coords: {
                                latitude: coords.lat,
                                longitude: coords.lon,
                                accuracy: 10,
                                altitude: null,
                                altitudeAccuracy: null,
                                heading: null,
                                speed: null
                            },
                            timestamp: Date.now()
                        };

                        navigator.geolocation.getCurrentPosition = function(success, error) {
                            if (success) {
                                success(mockPosition);
                            }
                        };
                        
                        navigator.geolocation.watchPosition = function(success, error) {
                            if (success) {
                                success(mockPosition);
                            }
                            // Retornar um ID de watch
                            return 1;
                        };
                        
                        console.log('Geolocation mocked with coordinates:', coords);
                    } else {
                        // Bloquear geolocalização se não houver coordenadas
                        navigator.geolocation.getCurrentPosition = function(success, error) {
                            if (error) {
                                error({ code: 1, message: 'Permission denied' });
                            }
                        };
                        
                        navigator.geolocation.watchPosition = function(success, error) {
                            if (error) {
                                error({ code: 1, message: 'Permission denied' });
                            }
                        };
                    }
                }
                
                // Bloquear requisições de localização que não sejam as nossas
                const originalFetch = window.fetch;
                window.fetch = function(url, options) {
                    if (typeof url === 'string' && (url.includes('geolocation') || url.includes('location'))) {
                        // Permitir apenas se for nossa localização mockada
                        if (coords && url.includes(`${coords.lat}`) && url.includes(`${coords.lon}`)) {
                            return originalFetch.apply(this, arguments);
                        }
                        return Promise.reject(new Error('Geolocation blocked'));
                    }
                    return originalFetch.apply(this, arguments);
                };
            }, coordinates);

            logger.browser('Additional stealth measures applied', 'info', { coordinates });

        } catch (error) {
            logger.browser('Failed to apply some stealth measures', 'warn', { error: error.message });
        }
    }

    /**
     * Configure page settings
     */
    async configurePageSettings() {
        try {
            // Set viewport
            if (settings.browser.defaultViewport) {
                await this.page.setViewport(settings.browser.defaultViewport);
            }

            // Set user agent
            if (settings.browser.userAgent) {
                await this.page.setUserAgent(settings.browser.userAgent);
            }

            // Set extra HTTP headers
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            });

            logger.browser('Page settings configured');

        } catch (error) {
            logger.browser('Failed to configure page settings', 'warn', { error: error.message });
        }
    }

    /**
     * Verify stealth setup effectiveness
     */
    async verifyStealthSetup() {
        try {
            const stealthCheck = await this.page.evaluate(() => {
                return {
                    webdriver: navigator.webdriver,
                    webdriverType: typeof navigator.webdriver,
                    plugins: navigator.plugins.length,
                    chrome: !!window.chrome,
                    userAgent: navigator.userAgent,
                    languages: navigator.languages,
                    platform: navigator.platform
                };
            });

            const issues = [];
            
            // Check webdriver property
            if (stealthCheck.webdriverType !== 'undefined') {
                issues.push(`webdriver property: ${stealthCheck.webdriver}`);
            }

            // Check plugins
            if (stealthCheck.plugins === 0) {
                issues.push('No plugins detected (suspicious)');
            }

            // Check chrome object
            if (!stealthCheck.chrome) {
                issues.push('Chrome runtime object missing');
            }

            const success = issues.length === 0;

            logger.browser(`Stealth verification: ${success ? 'PASSED' : 'FAILED'}`, success ? 'info' : 'warn', {
                webdriver: stealthCheck.webdriverType,
                plugins: stealthCheck.plugins,
                chrome: stealthCheck.chrome,
                issues
            });

            return {
                success,
                details: stealthCheck,
                issues
            };

        } catch (error) {
            logger.browser('Stealth verification failed', 'error', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Navigate to URL with optimal settings
     */
    async navigateToUrl(url) {
        try {
            logger.browser(`Navigating to: ${url}`);

            await this.page.goto(url, {
                waitUntil: settings.navigation.waitUntil,
                timeout: settings.navigation.timeout
            });

            // Additional stability delay
            await this.delay(settings.navigation.stabilityDelay);

            // Verify navigation success
            const title = await this.page.title();
            const success = title.includes('Google Maps');

            if (success) {
                logger.browser('Navigation successful', 'info', { title });
            } else {
                logger.browser('Navigation may have failed', 'warn', { title });
            }

            return {
                success,
                title,
                url: this.page.url()
            };

        } catch (error) {
            logger.error('Navigation failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Take screenshot for debugging
     */
    async takeScreenshot(filename, fullPage = false) {
        try {
            if (!this.page) {
                throw new Error('Page not available');
            }

            const screenshotPath = path.join('screenshots', filename);
            await fs.ensureDir(path.dirname(screenshotPath));

            await this.page.screenshot({
                path: screenshotPath,
                fullPage
            });

            logger.browser(`Screenshot taken: ${screenshotPath}`);
            return screenshotPath;

        } catch (error) {
            logger.browser('Screenshot failed', 'warn', { error: error.message });
            return null;
        }
    }

    /**
     * Get current page instance
     */
    getPage() {
        return this.page;
    }

    /**
     * Get browser instance
     */
    getBrowser() {
        return this.browser;
    }

    /**
     * Check if browser is ready
     */
    isReady() {
        return !!(this.browser && this.page && !this.browser.isClosed);
    }

    /**
     * Restart browser if needed
     */
    async restart() {
        try {
            logger.browser('Restarting browser');
            
            await this.cleanup();
            const result = await this.initialize();
            
            if (result.success) {
                logger.browser('Browser restarted successfully');
            }
            
            return result;

        } catch (error) {
            logger.error('Browser restart failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cleanup browser resources
     */
    async cleanup() {
        try {
            if (this.page && !this.page.isClosed()) {
                await this.page.close();
                this.page = null;
            }

            if (this.browser && this.browser.isConnected()) {
                await this.browser.close();
                this.browser = null;
            }

            logger.browser('Browser cleanup completed');

        } catch (error) {
            logger.browser('Browser cleanup failed', 'warn', { error: error.message });
        }
    }

    /**
     * Utility delay function
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get session information
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            isReady: this.isReady(),
            browserConnected: this.browser ? this.browser.isConnected() : false,
            pageAvailable: this.page ? !this.page.isClosed() : false
        };
    }
}

module.exports = BrowserManager;