const logger = require('./logger');

class Validators {
    /**
     * Validate search term input
     */
    static validateSearchTerm(searchTerm) {
        const errors = [];

        if (!searchTerm || typeof searchTerm !== 'string') {
            errors.push('Search term must be a non-empty string');
        } else {
            const trimmed = searchTerm.trim();
            if (trimmed.length === 0) {
                errors.push('Search term cannot be empty or only whitespace');
            }
            if (trimmed.length > 200) {
                errors.push('Search term is too long (max 200 characters)');
            }
            if (!/^[\w\s\-àáâãéêíóôõúç]+$/i.test(trimmed)) {
                logger.validation('Search term contains special characters that may affect results');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: searchTerm ? searchTerm.trim() : ''
        };
    }

    /**
     * Validate business data extracted from page
     */
    static validateBusinessData(business) {
        const errors = [];
        const warnings = [];

        // Name validation
        if (!business.name || typeof business.name !== 'string') {
            errors.push('Business name is required and must be a string');
        } else if (business.name.trim().length === 0) {
            errors.push('Business name cannot be empty');
        }

        // Rating validation
        if (business.rating !== undefined && business.rating !== null) {
            if (typeof business.rating === 'string') {
                const numRating = parseFloat(business.rating.replace(',', '.'));
                if (isNaN(numRating)) {
                    warnings.push('Rating is not a valid number');
                } else if (numRating < 0 || numRating > 5) {
                    warnings.push('Rating outside expected range (0-5)');
                }
            } else if (typeof business.rating === 'number') {
                if (business.rating < 0 || business.rating > 5) {
                    warnings.push('Rating outside expected range (0-5)');
                }
            }
        }

        // Review count validation
        if (business.reviews !== undefined && business.reviews !== null) {
            if (typeof business.reviews === 'string') {
                const cleanReviews = business.reviews.replace(/\D/g, '');
                const numReviews = parseInt(cleanReviews);
                if (isNaN(numReviews)) {
                    warnings.push('Review count is not a valid number');
                } else if (numReviews < 0) {
                    warnings.push('Review count cannot be negative');
                }
            }
        }

        // Link validation
        if (business.link !== undefined && business.link !== null) {
            if (typeof business.link === 'string' && business.link.trim().length > 0) {
                try {
                    new URL(business.link);
                } catch (e) {
                    warnings.push('Link is not a valid URL');
                }
            }
        }

        // Address validation
        if (business.address !== undefined && business.address !== null) {
            if (typeof business.address === 'string' && business.address.trim().length > 0) {
                if (business.address.length < 5) {
                    warnings.push('Address seems too short');
                }
            }
        }

        // Validate that business has rating or reviews
        const hasRating = business.rating && business.rating > 0;
        const hasReviews = business.reviewCount && business.reviewCount > 0;
        const hasReviewsText = business.reviews && business.reviews.trim().length > 0;
        
        if (!hasRating && !hasReviews && !hasReviewsText) {
            errors.push('Business must have either rating or reviews to be included');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitized: this.sanitizeBusinessData(business)
        };
    }

    /**
     * Sanitize and normalize business data
     */
    static sanitizeBusinessData(business) {
        const sanitized = {};

        // Sanitize name
        if (business.name && typeof business.name === 'string') {
            sanitized.name = business.name.trim()
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s\-àáâãéêíóôõúç]/gi, '');
        }

        // Sanitize and normalize rating
        if (business.rating !== undefined && business.rating !== null) {
            if (typeof business.rating === 'string') {
                const numRating = parseFloat(business.rating.replace(',', '.'));
                if (!isNaN(numRating)) {
                    sanitized.rating = Math.round(numRating * 10) / 10;
                }
            } else if (typeof business.rating === 'number') {
                sanitized.rating = Math.round(business.rating * 10) / 10;
            }
        }

        // Sanitize and normalize review count
        if (business.reviews !== undefined && business.reviews !== null) {
            if (typeof business.reviews === 'string') {
                const cleanReviews = business.reviews.replace(/\D/g, '');
                const numReviews = parseInt(cleanReviews);
                if (!isNaN(numReviews)) {
                    sanitized.reviewCount = numReviews;
                }
                sanitized.reviewsText = business.reviews.trim();
            }
        }
        
        // Process reviewsText if it exists and reviews is empty
        if (!sanitized.reviewsText && business.reviewsText !== undefined && business.reviewsText !== null) {
            if (typeof business.reviewsText === 'string') {
                const cleanReviews = business.reviewsText.replace(/\D/g, '');
                const numReviews = parseInt(cleanReviews);
                if (!isNaN(numReviews)) {
                    sanitized.reviewCount = numReviews;
                }
                sanitized.reviewsText = business.reviewsText.trim();
            }
        }
        
        // Use reviewCount if it exists and no reviewCount was set yet
        if (!sanitized.reviewCount && business.reviewCount !== undefined && business.reviewCount !== null) {
            sanitized.reviewCount = business.reviewCount;
        }

        // Sanitize link
        if (business.link && typeof business.link === 'string') {
            sanitized.link = business.link.trim();
        }

        // Sanitize address
        if (business.address && typeof business.address === 'string') {
            let address = business.address.trim();
            
            // Remove caracteres especiais e símbolos desnecessários
            address = address
                .replace(/^[·\s]+/, '') // Remove pontos e espaços no início
                .replace(/[·\s]+$/, '') // Remove pontos e espaços no final
                .replace(/[^\w\s\-àáâãéêíóôõúç,\.]/gi, '') // Remove caracteres especiais exceto vírgulas e pontos
                .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
                .trim();
            
            // Remove endereços que são apenas números ou muito curtos
            if (address.length < 5 || /^\d+$/.test(address)) {
                address = 'Não disponível';
            }
            
            // Remove endereços que são apenas telefones
            if (/^\(\d{2}\)\s*\d{4,5}-\d{4}$/.test(address)) {
                address = 'Não disponível';
            }
            
            // Remove endereços que são apenas CEP
            if (/^\d{8}$/.test(address)) {
                address = 'Não disponível';
            }
            
            // Remove endereços que contêm apenas caracteres especiais
            if (/^[^\w]+$/.test(address)) {
                address = 'Não disponível';
            }
            
            sanitized.address = address;
        }

        // Preserve coordinates if they exist
        if (business.lat !== undefined && business.lng !== undefined) {
            if (typeof business.lat === 'number' && typeof business.lng === 'number') {
                // Validate coordinate ranges
                if (business.lat >= -90 && business.lat <= 90 && business.lng >= -180 && business.lng <= 180) {
                    sanitized.lat = business.lat;
                    sanitized.lng = business.lng;
                }
            }
        }

        // Add extraction metadata
        sanitized.extractedAt = new Date().toISOString();
        sanitized.source = 'Google Maps';

        return sanitized;
    }

    /**
     * Validate page state for scraping readiness
     */
    static async validatePageState(page) {
        const errors = [];
        const warnings = [];

        try {
            // Check if page is loaded
            const title = await page.title();
            if (!title.includes('Google Maps')) {
                errors.push('Page is not Google Maps');
            }

            // Check for required elements
            const requiredSelectors = [
                '[role="main"]',
                '.m6QErb'
            ];

            for (const selector of requiredSelectors) {
                const element = await page.$(selector);
                if (!element) {
                    warnings.push(`Required element not found: ${selector}`);
                }
            }

            // Check for business listings
            const businessListings = await page.$$('.qBF1Pd');
            if (businessListings.length === 0) {
                warnings.push('No business listings found on page');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                businessCount: businessListings.length
            };

        } catch (error) {
            logger.error('Page validation failed', error);
            return {
                isValid: false,
                errors: ['Failed to validate page state'],
                warnings: [],
                businessCount: 0
            };
        }
    }

    /**
     * Validate scraping results
     */
    static validateResults(results, searchTerm) {
        const errors = [];
        const warnings = [];
        const stats = {
            total: results.length,
            withRatings: 0,
            withReviews: 0,
            duplicates: 0,
            invalid: 0
        };

        const namesSeen = new Set();
        const validResults = [];

        for (const business of results) {
            const validation = this.validateBusinessData(business);
            
            if (!validation.isValid) {
                stats.invalid++;
                logger.validation(`Invalid business data: ${validation.errors.join(', ')}`, 'warn', {
                    business: business.name || 'unnamed'
                });
                continue;
            }

            // Check for duplicates
            if (namesSeen.has(validation.sanitized.name)) {
                stats.duplicates++;
                warnings.push(`Duplicate business found: ${validation.sanitized.name}`);
            } else {
                namesSeen.add(validation.sanitized.name);
                validResults.push(validation.sanitized);
            }

            // Count statistics
            if (validation.sanitized.rating) stats.withRatings++;
            if (validation.sanitized.reviewCount) stats.withReviews++;

            // Log warnings
            if (validation.warnings.length > 0) {
                logger.validation(`Business warnings: ${validation.warnings.join(', ')}`, 'warn', {
                    business: validation.sanitized.name
                });
            }
        }

        // Quality checks
        if (stats.total === 0) {
            errors.push('No businesses extracted');
        } else if (stats.withRatings / stats.total < 0.5) {
            warnings.push('Less than 50% of businesses have ratings');
        }

        if (stats.duplicates > stats.total * 0.1) {
            warnings.push(`High duplicate rate: ${stats.duplicates} duplicates`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            stats,
            validResults
        };
    }

    /**
     * Validate configuration objects
     */
    static validateConfig(config, requiredFields = []) {
        const errors = [];

        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { isValid: false, errors };
        }

        for (const field of requiredFields) {
            if (!(field in config)) {
                errors.push(`Missing required configuration field: ${field}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = Validators;