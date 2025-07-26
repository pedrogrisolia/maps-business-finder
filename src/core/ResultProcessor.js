const logger = require('../utils/logger');
const Validators = require('../utils/validators');

class ResultProcessor {
    constructor() {
        this.processingStats = {
            totalProcessed: 0,
            sorted: 0,
            deduplicated: 0,
            filtered: 0,
            enriched: 0
        };
    }

    /**
     * Process and sort results using validated algorithm: rating * log(reviews + 1)
     */
    async processResults(rawResults, options = {}) {
        try {
            logger.info('Starting result processing', { count: rawResults.length });
            this.processingStats.totalProcessed = rawResults.length;

            let processedResults = [...rawResults];

            // Step 1: Validate and clean results
            processedResults = await this.validateResults(processedResults);

            // Step 2: Remove duplicates
            if (options.removeDuplicates !== false) {
                processedResults = await this.removeDuplicates(processedResults);
            }

            // Step 3: Enrich with composite scores
            processedResults = await this.enrichWithScores(processedResults);

            // Step 4: Sort by composite score
            processedResults = await this.sortByCompositeScore(processedResults);

            // Step 5: Apply filters if specified
            if (options.minRating || options.minReviews) {
                processedResults = await this.applyFilters(processedResults, options);
            }

            // Step 6: Limit results if specified
            if (options.limit && options.limit > 0) {
                processedResults = processedResults.slice(0, options.limit);
            }

            const finalResult = {
                success: true,
                results: processedResults,
                metadata: {
                    totalInput: rawResults.length,
                    totalOutput: processedResults.length,
                    processingStats: this.getStats(),
                    processedAt: new Date().toISOString()
                }
            };

            logger.info('Result processing completed', {
                input: rawResults.length,
                output: processedResults.length,
                stats: this.processingStats
            });

            return finalResult;

        } catch (error) {
            logger.error('Result processing failed', error);
            return {
                success: false,
                error: error.message,
                results: [],
                metadata: { processingStats: this.getStats() }
            };
        }
    }

    /**
     * Validate results and remove invalid entries
     */
    async validateResults(results) {
        const validResults = [];
        const filteredCount = 0;

        for (const business of results) {
            const validation = Validators.validateBusinessData(business);
            
            if (validation.isValid) {
                validResults.push(validation.sanitized);
            } else {
                logger.debug('Filtered out invalid business', {
                    name: business.name || 'unnamed',
                    errors: validation.errors
                });
            }
        }

        const filteredOut = results.length - validResults.length;
        logger.info(`Validation completed: ${validResults.length}/${results.length} valid (${filteredOut} filtered out)`);
        
        if (filteredOut > 0) {
            logger.info(`Filtered out ${filteredOut} businesses without ratings or reviews`);
        }
        
        return validResults;
    }

    /**
     * Remove duplicate businesses based on name similarity
     */
    async removeDuplicates(results) {
        const uniqueResults = [];
        const namesSeen = new Set();
        let duplicateCount = 0;

        for (const business of results) {
            const normalizedName = this.normalizeName(business.name);
            
            if (!namesSeen.has(normalizedName)) {
                namesSeen.add(normalizedName);
                uniqueResults.push(business);
            } else {
                duplicateCount++;
                logger.debug('Removed duplicate business', { name: business.name });
            }
        }

        this.processingStats.deduplicated = duplicateCount;
        logger.info(`Deduplication completed: removed ${duplicateCount} duplicates`);
        
        return uniqueResults;
    }

    /**
     * Normalize business name for duplicate detection
     */
    normalizeName(name) {
        if (!name) return '';
        
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\b(ltda|me|eireli|s\.?a\.?|restaurante|lanchonete|bar|oficina)\b/g, '') // Remove common business suffixes
            .trim();
    }

    /**
     * Enrich results with composite scores and additional metrics
     */
    async enrichWithScores(results) {
        const enrichedResults = results.map(business => {
            const enriched = { ...business };

            // Calculate composite score using validated formula: rating * log(reviews + 1)
            enriched.compositeScore = this.calculateCompositeScore(business);

            // Add score breakdown for transparency
            enriched.scoreBreakdown = this.getScoreBreakdown(business);

            // Add ranking tier
            enriched.tier = this.getTier(enriched.compositeScore);

            // Add quality indicators
            enriched.qualityIndicators = this.getQualityIndicators(business);

            return enriched;
        });

        this.processingStats.enriched = enrichedResults.length;
        logger.info('Results enriched with composite scores');
        
        return enrichedResults;
    }

    /**
     * Calculate composite score using validated algorithm: rating * log(reviews + 1)
     */
    calculateCompositeScore(business) {
        try {
            // Parse rating (handle Portuguese format with comma)
            let rating = 0;
            if (business.rating) {
                rating = parseFloat(business.rating.toString().replace(',', '.'));
                if (isNaN(rating)) rating = 0;
            }

            // Parse review count (remove parentheses and other formatting)
            let reviewCount = 0;
            if (business.reviewCount) {
                reviewCount = business.reviewCount;
            } else if (business.reviewsText) {
                const match = business.reviewsText.match(/\d+/);
                reviewCount = match ? parseInt(match[0]) : 0;
            } else if (business.reviews) {
                const match = business.reviews.match(/\d+/);
                reviewCount = match ? parseInt(match[0]) : 0;
            }

            // Apply new formula: (rating * 2) * log(reviews + 1) - gives more weight to rating
            if (rating > 0) {
                const score = (Math.pow(rating, 4) * 0.1) * (Math.log(reviewCount * 0.1));
                return Math.round(score * 100) / 100; // Round to 2 decimal places
            }

            return 0;

        } catch (error) {
            logger.debug('Failed to calculate composite score', { 
                business: business.name,
                error: error.message 
            });
            return 0;
        }
    }

    /**
     * Get detailed score breakdown for transparency
     */
    getScoreBreakdown(business) {
        const rating = business.rating ? parseFloat(business.rating.toString().replace(',', '.')) : 0;
        const reviewCount = this.extractReviewCount(business);

        return {
            rating,
            reviewCount,
            logFactor: reviewCount > 0 ? Math.log(reviewCount + 1) : 0,
            formula: '(rating × 2) × log(reviews + 1)',
            hasRating: rating > 0,
            hasReviews: reviewCount > 0
        };
    }

    /**
     * Extract review count from various formats
     */
    extractReviewCount(business) {
        if (business.reviewCount) return business.reviewCount;
        
        const sources = [business.reviewsText, business.reviews];
        for (const source of sources) {
            if (source) {
                const match = source.match(/\d+/);
                if (match) return parseInt(match[0]);
            }
        }
        
        return 0;
    }

    /**
     * Determine tier based on composite score
     */
    getTier(score) {
        if (score >= 15) return 'Excelente';
        if (score >= 10) return 'Muito Bom';
        if (score >= 7) return 'Bom';
        if (score >= 4) return 'Médio';
        if (score > 0) return 'Básico';
        return 'Não Avaliado';
    }

    /**
     * Get quality indicators for business
     */
    getQualityIndicators(business) {
        const indicators = [];
        const rating = business.rating ? parseFloat(business.rating.toString().replace(',', '.')) : 0;
        const reviewCount = this.extractReviewCount(business);

        if (rating >= 4.5) indicators.push('Nota alta');
        if (reviewCount >= 100) indicators.push('Muitas avaliações');
        if (reviewCount === 0) indicators.push('Sem avaliações');
        if (rating === 0) indicators.push('Sem nota');

        return indicators;
    }

    /**
     * Sort results by composite score (descending)
     */
    async sortByCompositeScore(results) {
        const sortedResults = results.sort((a, b) => {
            // Primary sort: composite score (descending)
            if (b.compositeScore !== a.compositeScore) {
                return b.compositeScore - a.compositeScore;
            }

            // Secondary sort: rating (descending)
            const ratingA = parseFloat((a.rating || 0).toString().replace(',', '.'));
            const ratingB = parseFloat((b.rating || 0).toString().replace(',', '.'));
            if (ratingB !== ratingA) {
                return ratingB - ratingA;
            }

            // Tertiary sort: review count (descending)
            const reviewsA = this.extractReviewCount(a);
            const reviewsB = this.extractReviewCount(b);
            return reviewsB - reviewsA;
        });

        // Add ranking positions
        sortedResults.forEach((business, index) => {
            business.rank = index + 1;
        });

        this.processingStats.sorted = sortedResults.length;
        logger.info('Results sorted by composite score');
        
        return sortedResults;
    }

    /**
     * Apply filters to results
     */
    async applyFilters(results, filters) {
        let filteredResults = results;
        let originalCount = results.length;

        // Filter by minimum rating
        if (filters.minRating) {
            filteredResults = filteredResults.filter(business => {
                const rating = parseFloat((business.rating || 0).toString().replace(',', '.'));
                return rating >= filters.minRating;
            });
            logger.info(`Applied minimum rating filter (${filters.minRating}): ${filteredResults.length}/${originalCount} remaining`);
        }

        // Filter by minimum reviews
        if (filters.minReviews) {
            filteredResults = filteredResults.filter(business => {
                const reviewCount = this.extractReviewCount(business);
                return reviewCount >= filters.minReviews;
            });
            logger.info(`Applied minimum reviews filter (${filters.minReviews}): ${filteredResults.length}/${originalCount} remaining`);
        }

        // Filter by tier
        if (filters.minTier) {
            const tierOrder = ['Básico', 'Médio', 'Bom', 'Muito Bom', 'Excelente'];
            const minTierIndex = tierOrder.indexOf(filters.minTier);
            
            if (minTierIndex >= 0) {
                filteredResults = filteredResults.filter(business => {
                    const businessTierIndex = tierOrder.indexOf(business.tier);
                    return businessTierIndex >= minTierIndex;
                });
                logger.info(`Applied minimum tier filter (${filters.minTier}): ${filteredResults.length}/${originalCount} remaining`);
            }
        }

        this.processingStats.filtered = originalCount - filteredResults.length;
        return filteredResults;
    }

    /**
     * Generate summary statistics for processed results
     */
    generateSummary(results) {
        if (!results || results.length === 0) {
            return {
                total: 0,
                avgRating: 0,
                avgReviews: 0,
                avgCompositeScore: 0,
                tierDistribution: {},
                qualityMetrics: {}
            };
        }

        const ratings = results
            .map(b => parseFloat((b.rating || 0).toString().replace(',', '.')))
            .filter(r => r > 0);

        const reviewCounts = results
            .map(b => this.extractReviewCount(b))
            .filter(r => r > 0);

        const compositeScores = results
            .map(b => b.compositeScore || 0)
            .filter(s => s > 0);

        // Tier distribution
        const tierDistribution = {};
        results.forEach(business => {
            const tier = business.tier || 'Não Avaliado';
            tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
        });

        const summary = {
            total: results.length,
            avgRating: ratings.length > 0 ? 
                Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : 0,
            avgReviews: reviewCounts.length > 0 ? 
                Math.round(reviewCounts.reduce((sum, r) => sum + r, 0) / reviewCounts.length) : 0,
            avgCompositeScore: compositeScores.length > 0 ? 
                Math.round((compositeScores.reduce((sum, s) => sum + s, 0) / compositeScores.length) * 100) / 100 : 0,
            tierDistribution,
            qualityMetrics: {
                withRatings: ratings.length,
                withReviews: reviewCounts.length,
                highRated: ratings.filter(r => r >= 4.0).length,
                wellReviewed: reviewCounts.filter(r => r >= 20).length
            }
        };

        logger.info('Result summary generated', summary);
        return summary;
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return {
            ...this.processingStats,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset processing statistics
     */
    resetStats() {
        this.processingStats = {
            totalProcessed: 0,
            sorted: 0,
            deduplicated: 0,
            filtered: 0,
            enriched: 0
        };
    }

    /**
     * Export results in different formats for analysis
     */
    prepareForExport(results, format = 'detailed') {
        switch (format) {
            case 'simple':
                return results.map(business => ({
                    name: business.name,
                    rating: business.rating,
                    reviews: this.extractReviewCount(business),
                    reviewsText: business.reviewsText || '',
                    score: business.compositeScore,
                    rank: business.rank
                }));

            case 'analysis':
                return results.map(business => ({
                    ...business,
                    scoreBreakdown: business.scoreBreakdown,
                    qualityIndicators: business.qualityIndicators
                }));

            case 'detailed':
            default:
                return results;
        }
    }
}

module.exports = ResultProcessor;