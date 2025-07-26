const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const loggingConfig = require('../config/logging.json');

class Logger {
    constructor() {
        this.ensureLogDirectory();
        this.logger = this.createLogger();
    }

    ensureLogDirectory() {
        const logDir = path.join(process.cwd(), 'logs');
        fs.ensureDirSync(logDir);
    }

    createLogger() {
        const { winston: config } = loggingConfig;
        
        const formats = [
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, timestamp, stack, category }) => {
                const categoryStr = category ? `[${category.toUpperCase()}]` : '';
                const stackStr = stack ? `\n${stack}` : '';
                return `${timestamp} [${level.toUpperCase()}] ${categoryStr} ${message}${stackStr}`;
            })
        ];

        if (config.format.colorize) {
            formats.unshift(winston.format.colorize());
        }

        const transports = [];

        // Console transport
        if (config.transports.console) {
            transports.push(new winston.transports.Console({
                level: config.transports.console.level,
                format: winston.format.combine(...formats)
            }));
        }

        // File transport
        if (config.transports.file) {
            transports.push(new winston.transports.File({
                level: config.transports.file.level,
                filename: config.transports.file.filename,
                maxsize: config.transports.file.maxsize,
                maxFiles: config.transports.file.maxFiles,
                format: winston.format.combine(
                    winston.format.uncolorize(),
                    ...formats
                )
            }));
        }

        // Error file transport
        if (config.transports.error) {
            transports.push(new winston.transports.File({
                level: 'error',
                filename: config.transports.error.filename,
                maxsize: config.transports.error.maxsize,
                maxFiles: config.transports.error.maxFiles,
                format: winston.format.combine(
                    winston.format.uncolorize(),
                    ...formats
                )
            }));
        }

        return winston.createLogger({
            level: config.level,
            transports
        });
    }

    // Category-specific logging methods
    browser(message, level = 'debug', meta = {}) {
        this.log(level, message, { category: 'browser', ...meta });
    }

    extraction(message, level = 'info', meta = {}) {
        this.log(level, message, { category: 'extraction', ...meta });
    }

    scrolling(message, level = 'info', meta = {}) {
        this.log(level, message, { category: 'scrolling', ...meta });
    }

    validation(message, level = 'warn', meta = {}) {
        this.log(level, message, { category: 'validation', ...meta });
    }

    performance(message, level = 'info', meta = {}) {
        this.log(level, message, { category: 'performance', ...meta });
    }

    // Generic logging methods
    log(level, message, meta = {}) {
        this.logger.log(level, message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, error = null, meta = {}) {
        if (error instanceof Error) {
            this.logger.error(message, { 
                stack: error.stack, 
                error: error.message,
                ...meta 
            });
        } else {
            this.logger.error(message, meta);
        }
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Progress logging for real-time updates
    progress(message, progress = null, meta = {}) {
        const progressStr = progress !== null ? ` (${progress}%)` : '';
        this.info(`${message}${progressStr}`, { 
            type: 'progress', 
            progress,
            ...meta 
        });
    }

    // Session logging
    startSession(sessionId, searchTerm) {
        this.info(`Starting scraping session: ${sessionId}`, {
            sessionId,
            searchTerm,
            type: 'session_start'
        });
    }

    endSession(sessionId, results) {
        this.info(`Completed scraping session: ${sessionId}`, {
            sessionId,
            businessCount: results.length,
            type: 'session_end'
        });
    }

    // Metrics logging
    metrics(metricName, value, unit = '', meta = {}) {
        this.performance(`${metricName}: ${value}${unit}`, {
            metric: metricName,
            value,
            unit,
            ...meta
        });
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;