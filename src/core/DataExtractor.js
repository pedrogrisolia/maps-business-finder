const logger = require('../utils/logger');
const Validators = require('../utils/validators');
const selectors = require('../config/selectors.json');

class DataExtractor {
    constructor() {
        this.selectors = selectors.businessData;
        this.extractionStats = {
            totalAttempts: 0,
            successfulExtractions: 0,
            fallbacksUsed: 0,
            validationFailures: 0
        };
    }

    /**
     * Extract all business data from current page using new XPath-based selectors
     */
    async extractBusinessData(page) {
        try {
            logger.extraction('Starting business data extraction with new XPath selectors');
            this.extractionStats.totalAttempts++;

            const pageValidation = await Validators.validatePageState(page);
            if (!pageValidation.isValid) {
                logger.extraction('Page validation failed', 'warn', { 
                    errors: pageValidation.errors,
                    warnings: pageValidation.warnings
                });
            }

            const extractedData = await this.extractWithNewSelectors(page);
            const validatedResults = this.validateAndCleanResults(extractedData);

            logger.extraction(`Extraction completed: ${validatedResults.length} valid businesses found`, 'info', {
                total: extractedData.length,
                valid: validatedResults.length,
                stats: this.extractionStats
            });

            this.extractionStats.successfulExtractions++;
            return validatedResults;

        } catch (error) {
            logger.error('Business data extraction failed', error);
            return [];
        }
    }

    /**
     * Extract data using the new XPath-based selector system
     */
    async extractWithNewSelectors(page) {
        try {
            const results = await page.evaluate(() => {
                const results = [];
                
                // Base selector: Find all business result containers
                const baseXPath = "//a[@aria-label and starts-with(@href, 'http')]/ancestor::div[1]";
                const baseElements = document.evaluate(
                    baseXPath,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                for (let i = 0; i < baseElements.snapshotLength; i++) {
                    const baseElement = baseElements.snapshotItem(i);
                    
                    try {
                        // 1. Extract business name
                        const nameXPath = ".//a[@aria-label]/@aria-label";
                        const nameResult = document.evaluate(
                            nameXPath,
                            baseElement,
                            null,
                            XPathResult.STRING_TYPE,
                            null
                        );
                        const name = nameResult.stringValue?.trim();

                        if (!name) continue;

                        // 2. Extract rating
                        const ratingXPath = "string(.//span[@role='img']/span[1])";
                        const ratingResult = document.evaluate(
                            ratingXPath,
                            baseElement,
                            null,
                            XPathResult.STRING_TYPE,
                            null
                        );
                        const rating = ratingResult.stringValue?.trim();

                        // 3. Extract review count
                        const reviewsXPath = "string(.//span[@role='img']/span[last()])";
                        const reviewsResult = document.evaluate(
                            reviewsXPath,
                            baseElement,
                            null,
                            XPathResult.STRING_TYPE,
                            null
                        );
                        const reviews = reviewsResult.stringValue?.trim();

                        // 4. Extract link
                        const linkXPath = "./a[@aria-label]/@href";
                        const linkResult = document.evaluate(
                            linkXPath,
                            baseElement,
                            null,
                            XPathResult.STRING_TYPE,
                            null
                        );
                        const link = linkResult.stringValue?.trim();

                        // 5. Extract address
                        const addressXPath = "string((.//div[count(.//span[contains(text(), '·')]) > 0 and not(.//span[contains(text(), 'Abre')]) and not(.//span[contains(text(), 'Fechado')]) and not(.//span[contains(text(), 'Fecha')])]/span)[last()])";
                        const addressResult = document.evaluate(
                            addressXPath,
                            baseElement,
                            null,
                            XPathResult.STRING_TYPE,
                            null
                        );
                        let address = addressResult.stringValue?.trim() || '';

                        // Basic address sanitization at extraction level
                        if (address) {
                            address = address
                                .replace(/^[·\s]+/, '') // Remove pontos e espaços no início
                                .replace(/[·\s]+$/, '') // Remove pontos e espaços no final
                                .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
                                .trim();
                            
                            // Check if address is valid
                            if (address.length < 5 ||
                                /^\d+$/.test(address) ||
                                /^\(\d{2}\)\s*\d{4,5}-\d{4}$/.test(address) ||
                                /^\d{8}$/.test(address) ||
                                /^[^\w]+$/.test(address)) {
                                address = 'Não disponível';
                            }
                        }

                        // Only include businesses that have rating or reviews
                        const hasRating = rating && rating.trim().length > 0;
                        const hasReviews = reviews && reviews.trim().length > 0;
                        
                        if (hasRating || hasReviews) {
                            results.push({
                                name,
                                rating: rating || '',
                                reviews: reviews || '',
                                link: link || '',
                                address: address || 'Não disponível'
                            });
                        }

                    } catch (error) {
                        console.warn('Error extracting data from business element:', error);
                        continue;
                    }
                }

                console.log(`Extraction completed: ${results.length} businesses with ratings/reviews found`);
                return results;
            });

            // Extract coordinates for each business after page evaluation
            return results.map(business => {
                const coordinates = this.extractCoordinatesFromUrl(business.link);
                if (coordinates) {
                    business.lat = coordinates.lat;
                    business.lng = coordinates.lng;
                }
                return business;
            });

        } catch (error) {
            logger.extraction('New XPath extraction failed', 'error', { error: error.message });
            return [];
        }
    }

    /**
     * Validate and clean extracted results
     */
    validateAndCleanResults(rawResults) {
        const validResults = [];

        for (const business of rawResults) {
            const validation = Validators.validateBusinessData(business);
            
            if (validation.isValid) {
                validResults.push(validation.sanitized);
            } else {
                this.extractionStats.validationFailures++;
                logger.extraction('Business validation failed', 'debug', {
                    business: business.name || 'unnamed',
                    errors: validation.errors
                });
            }
        }

        return validResults;
    }

    /**
     * Extract coordinates from Google Maps URL
     * @param {string} url - Google Maps URL containing coordinates
     * @returns {Object|null} - {lat: number, lng: number} or null if not found
     */
    extractCoordinatesFromUrl(url) {
        if (!url) return null;

        try {
            // Multiple regex patterns for different Google Maps URL formats
            const patterns = [
                // Format: !3d-22.8348581!4d-43.278732
                { lat: /!3d(-?\d+\.?\d*)/, lng: /!4d(-?\d+\.?\d*)/ },
                // Format: 3d-22.8348581,4d-43.278732
                { lat: /3d(-?\d+\.?\d*)/, lng: /4d(-?\d+\.?\d*)/ },
                // Format: @-22.8348581,-43.278732,15z
                { lat: /@(-?\d+\.?\d*),(-?\d+\.?\d*)/, lng: /@(-?\d+\.?\d*),(-?\d+\.?\d*)/ }
            ];

            for (const pattern of patterns) {
                const latMatch = url.match(pattern.lat);
                const lngMatch = url.match(pattern.lng);

                if (latMatch && lngMatch) {
                    let lat, lng;
                    
                    // Handle @ pattern (both coordinates in one match)
                    if (pattern.lat.source.includes('@')) {
                        const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
                        if (coordMatch) {
                            lat = parseFloat(coordMatch[1]);
                            lng = parseFloat(coordMatch[2]);
                        }
                    } else {
                        lat = parseFloat(latMatch[1]);
                        lng = parseFloat(lngMatch[1]);
                    }

                    // Validate coordinate ranges
                    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        return { lat, lng };
                    }
                }
            }

            return null;
        } catch (error) {
            logger.extraction('Failed to extract coordinates from URL', 'debug', {
                url: url.substring(0, 100) + '...',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Get extraction statistics
     */
    getStats() {
        return {
            ...this.extractionStats,
            successRate: this.extractionStats.totalAttempts > 0
                ? (this.extractionStats.successfulExtractions / this.extractionStats.totalAttempts * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset extraction statistics
     */
    resetStats() {
        this.extractionStats = {
            totalAttempts: 0,
            successfulExtractions: 0,
            fallbacksUsed: 0,
            validationFailures: 0
        };
    }
}

module.exports = DataExtractor;