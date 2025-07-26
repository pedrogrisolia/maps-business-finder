#!/usr/bin/env node

const { Command } = require('commander');
const ScraperEngine = require('./core/ScraperEngine');
const logger = require('./utils/logger');
const exporters = require('./utils/exporters');
const path = require('path');

class CLI {
    constructor() {
        this.program = new Command();
        this.scraperEngine = new ScraperEngine();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('maps-business-finder')
            .description('Advanced Google Maps business scraper with real-time progress tracking')
            .version('1.0.0');

        // Main scrape command
        this.program
            .command('scrape')
            .description('Scrape businesses from Google Maps')
            .argument('<search-term>', 'Search term for businesses (e.g., "restaurante", "oficina mecânica")')
            .option('-r, --min-rating <rating>', 'Minimum rating filter (0-5)', parseFloat)
            .option('-c, --min-reviews <count>', 'Minimum review count filter', parseInt)
            .option('-l, --limit <number>', 'Limit number of results', parseInt)
            .option('--no-duplicates', 'Remove duplicate businesses', true)
            .option('-f, --formats <formats>', 'Export formats (json,csv)', 'json,csv')
            .option('-o, --output <directory>', 'Output directory', './results')
            .option('--headless', 'Run browser in headless mode', false)
            .option('--debug', 'Enable debug mode', false)
            .action(async (searchTerm, options) => {
                await this.handleScrapeCommand(searchTerm, options);
            });
    }

    async handleScrapeCommand(searchTerm, options) {
        try {
            console.log('🚀 Maps Business Finder - Starting Scrape');
            console.log('=' .repeat(50));
            console.log(`Search Term: "${searchTerm}"`);
            console.log(`Options: ${JSON.stringify(options, null, 2)}`);
            console.log('=' .repeat(50));

            // Setup progress reporting
            this.setupProgressReporting();

            // Configure scraper options
            const scraperOptions = {
                removeDuplicates: options.duplicates !== false,
                minRating: options.minRating || null,
                minReviews: options.minReviews || null,
                limit: options.limit || null,
                exportFormats: options.formats ? options.formats.split(',') : ['json', 'csv']
            };

            // Update settings if needed
            if (options.headless) {
                console.log('⚠️  Headless mode requested (may affect stealth effectiveness)');
            }

            if (options.debug) {
                logger.setLevel('debug');
                console.log('🔍 Debug mode enabled');
            }

            // Start scraping
            const startTime = Date.now();
            const result = await this.scraperEngine.scrapeBusinesses(searchTerm, scraperOptions);

            // Display results
            await this.displayResults(result, startTime);

            // Export results
            if (result.success && result.results && result.results.businesses && result.results.businesses.length > 0) {
                await this.exportResults(result.results.businesses, searchTerm, options);
            }

            console.log('✅ Scraping completed successfully!');

        } catch (error) {
            console.error('❌ Scraping failed:', error.message);
            logger.error('CLI scrape command failed', error);
            process.exit(1);
        }
    }

    setupProgressReporting() {
        this.scraperEngine.setProgressCallback((progress) => {
            this.displayProgress(progress);
        });
    }

    displayProgress(progress) {
        const { stage, progress: progressPercent, data } = progress;
        
        if (progressPercent !== null) {
            const progressBar = this.createProgressBar(progressPercent);
            process.stdout.write(`\r${stage}: ${progressBar} ${progressPercent}%`);
        } else {
            process.stdout.write(`\r${stage}`);
        }
    }

    createProgressBar(percent, width = 20) {
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    async displayResults(result, startTime) {
        const duration = Date.now() - startTime;
        
        console.log('\n' + '=' .repeat(50));
        console.log('📊 SCRAPING RESULTS');
        console.log('=' .repeat(50));
        
        if (result.success && result.results && result.results.businesses && result.results.businesses.length > 0) {
            console.log(`✅ Found ${result.results.businesses.length} businesses`);
            
            if (result.results.summary) {
                console.log(`📈 Average Rating: ${result.results.summary.avgRating}`);
                console.log(`📝 Average Reviews: ${result.results.summary.avgReviews}`);
                console.log(`🏆 Average Score: ${result.results.summary.avgCompositeScore}`);
                console.log(`📊 Tier Distribution: ${JSON.stringify(result.results.summary.tierDistribution)}`);
            }
            
            // Show top 5 results
            console.log('\n🏆 TOP 5 RESULTS:');
            result.results.businesses.slice(0, 5).forEach((business, index) => {
                console.log(`${index + 1}. ${business.name}`);
                console.log(`   Rating: ${business.rating} | Reviews: ${business.reviewCount || 0} | Score: ${business.compositeScore || 0}`);
            });
        } else {
            console.log('❌ No businesses found');
        }
        
        console.log(`\n⏱️  Duration: ${this.formatDuration(duration)}`);
        console.log('=' .repeat(50));
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }

    async exportResults(businesses, searchTerm, options) {
        try {
            const outputDir = options.output || './results';
            const formats = options.formats ? options.formats.split(',') : ['json', 'csv'];
            
            console.log(`\n💾 Exporting results to ${outputDir}...`);
            
            for (const format of formats) {
                if (format === 'json') {
                    await exporters.exportToJSON(businesses, searchTerm, outputDir);
                } else if (format === 'csv') {
                    await exporters.exportToCSV(businesses, searchTerm, outputDir);
                }
            }
            
            console.log('✅ Export completed successfully!');
            
        } catch (error) {
            console.error('❌ Export failed:', error.message);
            logger.error('Export failed', error);
        }
    }

    run() {
        this.program.parse();
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new CLI();
    cli.run();
}

module.exports = CLI;