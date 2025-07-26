const logger = require('../utils/logger');
const settings = require('../config/settings.json');
const selectors = require('../config/selectors.json');

class ScrollController {
    constructor() {
        this.scrollSettings = settings.scrolling;
        this.endDetectionConfig = selectors.navigation.endMessage;
        this.scrollStats = {
            totalScrolls: 0,
            successfulScrolls: 0,
            heightChanges: 0,
            endDetections: 0,
            fallbacksUsed: 0
        };
    }

    /**
     * Perform smart scrolling with Portuguese end detection
     */
    async smartScroll(page, progressCallback = null) {
        try {
            logger.scrolling('Starting smart scroll with end detection');
            
            // Find scrollable container
            const container = await this.findScrollableContainer(page);
            if (!container) {
                throw new Error('No scrollable container found');
            }

            let scrollAttempts = 0;
            let endDetected = false;
            let previousHeight = 0;
            let noChangeCount = 0;
            const maxAttempts = this.scrollSettings.maxScrollAttempts;

            // Initial height measurement
            previousHeight = await this.getScrollHeight(page, container);
            logger.scrolling(`Initial scroll height: ${previousHeight}px`);

            while (scrollAttempts < maxAttempts && !endDetected) {
                scrollAttempts++;
                this.scrollStats.totalScrolls++;

                logger.scrolling(`Scroll attempt ${scrollAttempts}/${maxAttempts}`);

                // Perform scroll
                const scrollResult = await this.performScroll(page, container, scrollAttempts);
                if (scrollResult.success) {
                    this.scrollStats.successfulScrolls++;
                }

                // Wait for content to load
                await this.delay(this.scrollSettings.scrollDelay);

                // Check for end message (Portuguese)
                endDetected = await this.detectEndMessage(page);
                
                if (endDetected) {
                    logger.scrolling('✓ End of results detected!');
                    this.scrollStats.endDetections++;
                    break;
                }

                // Check height changes
                const currentHeight = await this.getScrollHeight(page, container);
                const heightChanged = currentHeight > previousHeight;

                if (heightChanged) {
                    this.scrollStats.heightChanges++;
                    noChangeCount = 0;
                    logger.scrolling(`Height increased: ${previousHeight} → ${currentHeight}`);
                } else {
                    noChangeCount++;
                    logger.scrolling(`No height change (${noChangeCount} consecutive)`);
                }

                // Handle no new content scenario
                if (noChangeCount >= this.scrollSettings.aggressiveScrollThreshold) {
                    logger.scrolling('No new content loading, trying aggressive scroll');
                    const aggressiveResult = await this.performAggressiveScroll(page, container);
                    
                    if (aggressiveResult.endDetected) {
                        endDetected = true;
                        this.scrollStats.fallbacksUsed++;
                        break;
                    }
                    
                    // If still no end detected after aggressive scroll, likely at end
                    if (noChangeCount >= this.scrollSettings.aggressiveScrollThreshold + 2) {
                        logger.scrolling('Likely reached end without explicit message');
                        break;
                    }
                }

                previousHeight = currentHeight;

                // Report progress
                if (progressCallback) {
                    const progress = Math.min((scrollAttempts / maxAttempts) * 100, 95);
                    progressCallback({
                        type: 'scroll_progress',
                        scrollAttempts,
                        maxAttempts,
                        progress,
                        endDetected,
                        heightChanged
                    });
                }
            }

            const result = {
                success: true,
                endDetected,
                scrollAttempts,
                maxAttemptsReached: scrollAttempts >= maxAttempts,
                stats: this.getStats()
            };

            logger.scrolling('Smart scroll completed', 'info', result);
            return result;

        } catch (error) {
            logger.error('Smart scroll failed', error);
            return {
                success: false,
                error: error.message,
                scrollAttempts: this.scrollStats.totalScrolls,
                stats: this.getStats()
            };
        }
    }

    /**
     * Find scrollable container using validated selectors
     */
    async findScrollableContainer(page) {
        const containerSelectors = [
            selectors.navigation.scrollContainer.primary,
            ...selectors.navigation.scrollContainer.fallbacks
        ];

        for (const selector of containerSelectors) {
            try {
                const container = await page.$(selector);
                if (container) {
                    // Verify it's actually scrollable
                    const isScrollable = await page.evaluate((el) => {
                        return el.scrollHeight > el.clientHeight;
                    }, container);

                    if (isScrollable) {
                        logger.scrolling(`Found scrollable container: ${selector}`);
                        return container;
                    }
                }
            } catch (error) {
                logger.scrolling(`Container selector failed: ${selector}`, 'debug');
            }
        }

        logger.scrolling('No scrollable container found', 'warn');
        return null;
    }

    /**
     * Perform single scroll action using mouse wheel (bypasses Google's scroll blocking)
     */
    async performScroll(page, container, attempt) {
        try {
            // Get container center position for mouse wheel
            const containerBox = await container.boundingBox();
            if (!containerBox) {
                throw new Error('Could not get container position');
            }

            const centerX = containerBox.x + containerBox.width / 2;
            const centerY = containerBox.y + containerBox.height / 2;

            // Move mouse to container center
            await page.mouse.move(centerX, centerY);
            await this.delay(500);

            // Simulate mouse wheel scroll
            const scrollAmount = this.scrollSettings.scrollAmount;
            await page.mouse.wheel({ deltaY: scrollAmount });

            logger.scrolling(`Mouse wheel scrolled ${scrollAmount}px (attempt ${attempt})`);
            
            return {
                success: true,
                scrollAmount,
                method: 'mouse_wheel'
            };

        } catch (error) {
            logger.scrolling('Mouse wheel scroll failed', 'warn', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Perform aggressive scroll to bottom
     */
    async performAggressiveScroll(page, container) {
        try {
            logger.scrolling('Performing aggressive scroll to bottom');

            // Scroll to absolute bottom
            await page.evaluate((el) => {
                el.scrollTop = el.scrollHeight;
            }, container);

            // Wait longer for content to load
            await this.delay(this.scrollSettings.scrollDelay * 2);

            // Check for end message
            const endDetected = await this.detectEndMessage(page);

            logger.scrolling(`Aggressive scroll result: end detected = ${endDetected}`);

            return {
                success: true,
                endDetected
            };

        } catch (error) {
            logger.scrolling('Aggressive scroll failed', 'warn', { error: error.message });
            return {
                success: false,
                endDetected: false
            };
        }
    }

    /**
     * Detect Portuguese end message using multiple methods
     */
    async detectEndMessage(page) {
        try {
            // Method 1: XPath search (most reliable)
            const xpathResult = await this.detectEndWithXPath(page);
            if (xpathResult.detected) {
                logger.scrolling(`End detected via XPath: "${xpathResult.message}"`);
                return true;
            }

            // Method 2: CSS selector approach
            const cssResult = await this.detectEndWithCSS(page);
            if (cssResult.detected) {
                logger.scrolling(`End detected via CSS: "${cssResult.message}"`);
                return true;
            }

            // Method 3: Text search fallback
            const textResult = await this.detectEndWithTextSearch(page);
            if (textResult.detected) {
                logger.scrolling(`End detected via text search: "${textResult.message}"`);
                return true;
            }

            return false;

        } catch (error) {
            logger.scrolling('End detection failed', 'warn', { error: error.message });
            return false;
        }
    }

    /**
     * Detect end message using XPath (primary method)
     */
    async detectEndWithXPath(page) {
        try {
            const result = await page.evaluate((xpath) => {
                const xpathResult = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );

                if (xpathResult.singleNodeValue) {
                    return {
                        detected: true,
                        message: xpathResult.singleNodeValue.textContent?.trim() || ''
                    };
                }

                return { detected: false, message: '' };
            }, this.endDetectionConfig.xpath);

            return result;

        } catch (error) {
            logger.scrolling('XPath end detection failed', 'debug');
            return { detected: false, message: '' };
        }
    }

    /**
     * Detect end message using CSS selectors
     */
    async detectEndWithCSS(page) {
        try {
            for (const selector of this.endDetectionConfig.cssSelectors) {
                const result = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    
                    for (const element of elements) {
                        const text = element.textContent?.trim() || '';
                        if (text.includes('final da lista') || text.includes('chegou ao final')) {
                            return {
                                detected: true,
                                message: text
                            };
                        }
                    }

                    return { detected: false, message: '' };
                }, selector);

                if (result.detected) {
                    return result;
                }
            }

            return { detected: false, message: '' };

        } catch (error) {
            logger.scrolling('CSS end detection failed', 'debug');
            return { detected: false, message: '' };
        }
    }

    /**
     * Detect end message using text search
     */
    async detectEndWithTextSearch(page) {
        try {
            const result = await page.evaluate((patterns) => {
                const allElements = document.querySelectorAll('span, p, div');
                
                for (const element of allElements) {
                    const text = element.textContent?.trim() || '';
                    
                    for (const pattern of patterns) {
                        if (text.includes(pattern)) {
                            return {
                                detected: true,
                                message: text
                            };
                        }
                    }
                }

                return { detected: false, message: '' };
            }, this.endDetectionConfig.textPatterns);

            return result;

        } catch (error) {
            logger.scrolling('Text search end detection failed', 'debug');
            return { detected: false, message: '' };
        }
    }

    /**
     * Get current scroll height
     */
    async getScrollHeight(page, container) {
        try {
            return await page.evaluate((el) => el.scrollHeight, container);
        } catch (error) {
            logger.scrolling('Failed to get scroll height', 'debug');
            return 0;
        }
    }

    /**
     * Get current scroll position
     */
    async getScrollPosition(page, container) {
        try {
            return await page.evaluate((el) => ({
                scrollTop: el.scrollTop,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight
            }), container);
        } catch (error) {
            logger.scrolling('Failed to get scroll position', 'debug');
            return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
        }
    }

    /**
     * Check if scrolled to bottom
     */
    async isScrolledToBottom(page, container) {
        try {
            return await page.evaluate((el) => {
                return el.scrollTop + el.clientHeight >= el.scrollHeight - 10; // 10px tolerance
            }, container);
        } catch (error) {
            logger.scrolling('Failed to check if scrolled to bottom', 'debug');
            return false;
        }
    }

    /**
     * Scroll to specific position
     */
    async scrollToPosition(page, container, position) {
        try {
            await page.evaluate((el, pos) => {
                el.scrollTop = pos;
            }, container, position);

            logger.scrolling(`Scrolled to position: ${position}`);
            return true;

        } catch (error) {
            logger.scrolling('Failed to scroll to position', 'warn');
            return false;
        }
    }

    /**
     * Reset scroll position to top
     */
    async scrollToTop(page, container) {
        return await this.scrollToPosition(page, container, 0);
    }

    /**
     * Get scroll statistics
     */
    getStats() {
        const successRate = this.scrollStats.totalScrolls > 0 
            ? (this.scrollStats.successfulScrolls / this.scrollStats.totalScrolls * 100).toFixed(2) + '%'
            : '0%';

        return {
            ...this.scrollStats,
            successRate,
            avgHeightChanges: this.scrollStats.totalScrolls > 0 
                ? (this.scrollStats.heightChanges / this.scrollStats.totalScrolls).toFixed(2)
                : '0'
        };
    }

    /**
     * Reset scroll statistics
     */
    resetStats() {
        this.scrollStats = {
            totalScrolls: 0,
            successfulScrolls: 0,
            heightChanges: 0,
            endDetections: 0,
            fallbacksUsed: 0
        };
    }

    /**
     * Utility delay function
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Configure scroll behavior
     */
    setScrollConfig(config) {
        if (config.scrollAmount) this.scrollSettings.scrollAmount = config.scrollAmount;
        if (config.scrollDelay) this.scrollSettings.scrollDelay = config.scrollDelay;
        if (config.maxScrollAttempts) this.scrollSettings.maxScrollAttempts = config.maxScrollAttempts;
        
        logger.scrolling('Scroll configuration updated', 'debug', config);
    }
}

module.exports = ScrollController;