/**
 * Logging — Система логирования
 */

import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class Logging {
    constructor(options = {}) {
        this.level = options.level || 'info'; // debug, info, warn, error
        this.format = options.format || 'text'; // text, json
        this.file = options.file || null;
        this.console = options.console !== false;
        this.colors = options.colors !== false;
        this.timestamp = options.timestamp !== false;

        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        this.colorsMap = {
            debug: '\x1b[36m', // cyan
            info: '\x1b[32m',  // green
            warn: '\x1b[33m',  // yellow
            error: '\x1b[31m', // red
            reset: '\x1b[0m'
        };

        this.logBuffer = [];
        this.maxBufferSize = options.maxBufferSize || 1000;
    }

    /**
     * Логирование
     */
    log(level, message, context) {
        context = context || {};
        if (this.levels[level] < this.levels[this.level]) {
            return;
        }

        const logEntry = {
            level,
            message,
            context,
            timestamp: this.timestamp ? new Date().toISOString() : undefined
        };

        this.logBuffer.push(logEntry);

        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }

        const formatted = this.formatLogEntry(logEntry);

        if (this.console) {
            console.log(formatted);
        }

        if (this.file) {
            this.writeToFile(formatted);
        }
    }

    /**
     * Format log entry
     */
    formatLogEntry(entry) {
        if (this.format === 'json') {
            return JSON.stringify(entry);
        }

        let output = '';

        // Timestamp
        if (entry.timestamp) {
            output += `[${entry.timestamp}] `;
        }

        // Level
        const levelUpper = entry.level.toUpperCase();
        if (this.colors) {
            output += `${this.colorsMap[entry.level]}${levelUpper}${this.colorsMap.reset} `;
        } else {
            output += `${levelUpper} `;
        }

        // Message
        output += entry.message;

        // Context
        if (Object.keys(entry.context).length > 0) {
            output += ` ${JSON.stringify(entry.context)}`;
        }

        return output;
    }

    /**
     * Записать в файл
     */
    writeToFile(formatted) {
        try {
            if (!existsSync(this.file)) {
                mkdirSync(dirname(this.file), { recursive: true });
            }
            appendFileSync(this.file, formatted + '\n', 'utf-8');
        } catch (error) {
            console.error('Ошибка записи лога:', error);
        }
    }

    /**
     * Debug
     */
    debug(message, context) {
        this.log('debug', message, context);
    }

    /**
     * Info
     */
    info(message, context) {
        this.log('info', message, context);
    }

    /**
     * Warn
     */
    warn(message, context) {
        this.log('warn', message, context);
    }

    /**
     * Error
     */
    error(message, context) {
        this.log('error', message, context);
    }

    /**
     * Создать child logger с контекстом
     */
    child(context) {
        const child = new Logging({
            level: this.level,
            format: this.format,
            file: this.file,
            console: this.console,
            colors: this.colors,
            timestamp: this.timestamp
        });

        child.defaultContext = { ...this.defaultContext, ...context };

        const originalLog = child.log.bind(child);
        child.log = (level, message, context) => {
            originalLog(level, message, { ...this.defaultContext, ...context });
        };

        return child;
    }

    /**
     * Создать logger с уровнем
     */
    withLevel(level) {
        const logger = new Logging({
            level,
            format: this.format,
            file: this.file,
            console: this.console,
            colors: this.colors,
            timestamp: this.timestamp
        });

        return logger;
    }

    /**
     * Установить уровень логирования
     */
    setLevel(level) {
        this.level = level;
        return this;
    }

    /**
     * Получить буфер логов
     */
    getLogs() {
        return [...this.logBuffer];
    }

    /**
     * Очистить буфер логов
     */
    clearLogs() {
        this.logBuffer = [];
        return this;
    }

    /**
     * Экспорт логов
     */
    exportLogs(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logBuffer, null, 2);
        } else {
            return this.logBuffer.map(entry => this.formatLogEntry(entry)).join('\n');
        }
    }

    /**
     * Фильтр логов по уровню
     */
    filterLogs(level) {
        const minLevel = this.levels[level];
        return this.logBuffer.filter(entry => this.levels[entry.level] >= minLevel);
    }

    /**
     * Фильтр логов по времени
     */
    filterLogsByTime(startTime, endTime) {
        return this.logBuffer.filter(entry => {
            if (!entry.timestamp) return true;
            const time = new Date(entry.timestamp).getTime();
            return time >= startTime.getTime() && time <= endTime.getTime();
        });
    }

    /**
     * Создать logger с метриками
     */
    static withMetrics(logger) {
        const metrics = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        };

        const originalLog = logger.log.bind(logger);
        logger.log = (level, message, context) => {
            metrics[level]++;
            originalLog(level, message, context);
        };

        logger.getMetrics = () => metrics;

        return logger;
    }

    /**
     * Создать logger с ротацией файлов
     */
    static withFileRotation(logger, options = {}) {
        const maxSize = options.maxSize || 1024 * 1024; // 1MB
        const maxFiles = options.maxFiles || 5;

        const checkAndRotate = () => {
            if (!logger.file) return;

            try {
                const stats = require('fs').statSync(logger.file);
                if (stats.size > maxSize) {
                    // Ротация файлов
                    for (let i = maxFiles - 1; i >= 1; i--) {
                        const oldFile = i === 1 ? logger.file : `${logger.file}.${i - 1}`;
                        const newFile = `${logger.file}.${i}`;

                        try {
                            require('fs').renameSync(oldFile, newFile);
                        } catch (e) {}
                    }

                    // Создать новый файл
                    require('fs').writeFileSync(logger.file, '', 'utf-8');
                }
            } catch (e) {}
        };

        // Перехватить writeToFile
        const originalWrite = logger.writeToFile.bind(logger);
        logger.writeToFile = (formatted) => {
            checkAndRotate();
            originalWrite(formatted);
        };

        return logger;
    }

    /**
     * Создать logger с цветным выводом
     */
    static withColors(logger) {
        logger.colors = true;
        return logger;
    }

    /**
     * Создать logger без цветов
     */
    static withoutColors(logger) {
        logger.colors = false;
        return logger;
    }
}

export default Logging;
