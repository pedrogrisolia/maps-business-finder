const fs = require('fs-extra');
const path = require('path');
const csvWriter = require('csv-writer');
const logger = require('./logger');
const settings = require('../config/settings.json');

class Exporters {
    constructor() {
        this.outputDir = settings.output.outputDir;
        this.ensureOutputDirectory();
    }

    ensureOutputDirectory() {
        try {
            fs.ensureDirSync(this.outputDir);
            logger.debug(`Output directory ensured: ${this.outputDir}`);
        } catch (error) {
            logger.error('Failed to create output directory', error);
            throw error;
        }
    }

    /**
     * Generate filename with timestamp
     */
    generateFilename(searchTerm, format, timestamp = null) {
        const now = timestamp || new Date();
        const dateStr = now.toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19); // Remove milliseconds and Z

        const sanitizedTerm = searchTerm
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
            .slice(0, 50); // Limit length

        return `${sanitizedTerm}_${dateStr}.${format}`;
    }

    /**
     * Export results to JSON format
     */
    async exportToJSON(results, searchTerm, metadata = {}) {
        try {
            const filename = this.generateFilename(searchTerm, 'json');
            const filepath = path.join(this.outputDir, filename);

            const exportData = {
                metadata: {
                    searchTerm,
                    exportedAt: new Date().toISOString(),
                    totalResults: results.length,
                    format: 'json',
                    version: '1.0.0',
                    ...metadata
                },
                businesses: results.map((business, index) => ({
                    id: index + 1,
                    ...business,
                    // Calculate composite score if rating and reviews are available
                    compositeScore: this.calculateCompositeScore(business)
                }))
            };

            await fs.writeJson(filepath, exportData, { spaces: 2 });
            
            logger.info(`Results exported to JSON: ${filename}`, {
                count: results.length,
                filepath
            });

            return {
                success: true,
                filepath,
                filename,
                count: results.length
            };

        } catch (error) {
            logger.error('JSON export failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Export results to CSV format
     */
    async exportToCSV(results, searchTerm, metadata = {}) {
        try {
            const filename = this.generateFilename(searchTerm, 'csv');
            const filepath = path.join(this.outputDir, filename);

            // Define CSV headers
            const headers = [
                { id: 'id', title: 'ID' },
                { id: 'name', title: 'Nome da Empresa' },
                { id: 'rating', title: 'Avaliação' },
                { id: 'reviewCount', title: 'Comentários' },
                { id: 'reviewsText', title: 'Comentários Texto' },
                { id: 'compositeScore', title: 'Pontuação' },
                { id: 'tier', title: 'Categoria' },
                { id: 'link', title: 'Link' },
                { id: 'address', title: 'Endereço' },
                { id: 'extractedAt', title: 'Extraído em' },
                { id: 'source', title: 'Fonte' }
            ];

            const writer = csvWriter.createObjectCsvWriter({
                path: filepath,
                header: headers,
                encoding: 'utf8'
            });

            // Prepare data for CSV
            const csvData = results.map((business, index) => ({
                id: index + 1,
                name: business.name || '',
                rating: business.rating || '',
                reviewCount: business.reviewCount || 0,
                reviewsText: business.reviewsText || '',
                compositeScore: this.calculateCompositeScore(business),
                tier: business.tier || '',
                link: business.link || '',
                address: business.address || '',
                extractedAt: business.extractedAt || new Date().toISOString(),
                source: business.source || 'Google Maps'
            }));

            await writer.writeRecords(csvData);

            logger.info(`Results exported to CSV: ${filename}`, {
                count: results.length,
                filepath
            });

            return {
                success: true,
                filepath,
                filename,
                count: results.length
            };

        } catch (error) {
            logger.error('CSV export failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Export to multiple formats
     */
    async exportToMultipleFormats(results, searchTerm, formats = null, metadata = {}) {
        const exportFormats = formats || settings.output.formats;
        const exportResults = {};

        logger.info(`Exporting to ${exportFormats.length} formats: ${exportFormats.join(', ')}`);

        for (const format of exportFormats) {
            try {
                let result;
                switch (format.toLowerCase()) {
                    case 'json':
                        result = await this.exportToJSON(results, searchTerm, metadata);
                        break;
                    case 'csv':
                        result = await this.exportToCSV(results, searchTerm, metadata);
                        break;
                    default:
                        logger.warn(`Unsupported export format: ${format}`);
                        continue;
                }

                exportResults[format] = result;

            } catch (error) {
                logger.error(`Export failed for format ${format}`, error);
                exportResults[format] = {
                    success: false,
                    error: error.message
                };
            }
        }

        return exportResults;
    }

    /**
     * Calculate composite score for business ranking
     * Using the validated formula: rating * log(reviews + 1)
     */
    calculateCompositeScore(business) {
        try {
            const rating = business.rating ? parseFloat(business.rating.toString().replace(',', '.')) : 0;
            const reviewCount = business.reviewCount || 0;

            if (rating > 0) {
                return Math.round((Math.pow(rating, 4) * 0.1) * (Math.log(reviewCount + 1)) * 100) / 100;
            }

            return 0;
        } catch (error) {
            logger.debug('Failed to calculate composite score', { business: business.name });
            return 0;
        }
    }

    /**
     * Export session summary with metadata
     */
    async exportSessionSummary(sessionData) {
        try {
            const filename = `session_summary_${Date.now()}.json`;
            const filepath = path.join(this.outputDir, filename);

            const summaryData = {
                session: {
                    id: sessionData.sessionId,
                    searchTerm: sessionData.searchTerm,
                    startTime: sessionData.startTime,
                    endTime: sessionData.endTime,
                    duration: sessionData.duration,
                    status: sessionData.status
                },
                results: {
                    totalBusinesses: sessionData.results.length,
                    withRatings: sessionData.results.filter(b => b.rating).length,
                    withReviews: sessionData.results.filter(b => b.reviewCount > 0).length,
                    averageRating: this.calculateAverageRating(sessionData.results),
                    topBusiness: sessionData.results[0] || null
                },
                technical: {
                    scrollAttempts: sessionData.scrollAttempts,
                    endDetected: sessionData.endDetected,
                    errors: sessionData.errors || [],
                    warnings: sessionData.warnings || []
                },
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    formats: sessionData.exportFormats || [],
                    outputDirectory: this.outputDir
                }
            };

            await fs.writeJson(filepath, summaryData, { spaces: 2 });

            logger.info(`Session summary exported: ${filename}`);

            return {
                success: true,
                filepath,
                filename
            };

        } catch (error) {
            logger.error('Session summary export failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate average rating from results
     */
    calculateAverageRating(results) {
        const ratingsWithValues = results
            .filter(b => b.rating)
            .map(b => parseFloat(b.rating.toString().replace(',', '.')))
            .filter(r => !isNaN(r));

        if (ratingsWithValues.length === 0) return 0;

        const sum = ratingsWithValues.reduce((acc, rating) => acc + rating, 0);
        return Math.round((sum / ratingsWithValues.length) * 10) / 10;
    }

    /**
     * List all export files
     */
    async listExportFiles() {
        try {
            const files = await fs.readdir(this.outputDir);
            const exportFiles = [];

            for (const file of files) {
                const filepath = path.join(this.outputDir, file);
                const stats = await fs.stat(filepath);
                
                if (stats.isFile() && (file.endsWith('.json') || file.endsWith('.csv'))) {
                    exportFiles.push({
                        filename: file,
                        filepath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            return exportFiles.sort((a, b) => b.modified - a.modified);

        } catch (error) {
            logger.error('Failed to list export files', error);
            return [];
        }
    }

    /**
     * Clean old export files
     */
    async cleanOldExports(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        try {
            const files = await this.listExportFiles();
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                const age = now - file.modified.getTime();
                if (age > maxAge) {
                    await fs.remove(file.filepath);
                    deletedCount++;
                    logger.debug(`Deleted old export file: ${file.filename}`);
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleaned ${deletedCount} old export files`);
            }

            return deletedCount;

        } catch (error) {
            logger.error('Failed to clean old exports', error);
            return 0;
        }
    }
}

module.exports = new Exporters();