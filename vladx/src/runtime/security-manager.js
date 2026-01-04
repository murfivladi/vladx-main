/**
 * SecurityManager — Управление безопасностью и песочницей
 */

import { join, resolve, normalize } from 'path';
import { existsSync, statSync } from 'fs';

export class SecurityManager {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.allowedPaths = options.allowedPaths || [];
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxExecutionTime = options.maxExecutionTime || 30000; // 30s
        this.maxMemory = options.maxMemory || 512 * 1024 * 1024; // 512MB
        this.allowedDomains = options.allowedDomains || [];
        this.blockedDomains = options.blockedDomains || [];
        this.prototypePollutionProtection = options.prototypePollutionProtection !== false;
    }

    /**
     * Проверка безопасности пути
     */
    checkPath(path, basePath = process.cwd()) {
        if (!this.enabled) return true;

        const resolvedPath = resolve(basePath, path);
        const normalizedPath = normalize(resolvedPath);

        // Проверка на path traversal
        if (normalizedPath.includes('..')) {
            throw new Error('Доступ к родительским директориям запрещен: ' + path);
        }

        // Проверка на разрешенные пути
        if (this.allowedPaths.length > 0) {
            const isAllowed = this.allowedPaths.some(allowedPath => {
                const resolvedAllowed = resolve(allowedPath);
                return normalizedPath.startsWith(resolvedAllowed);
            });

            if (!isAllowed) {
                throw new Error('Доступ к пути запрещен: ' + path);
            }
        }

        return true;
    }

    /**
     * Проверка размера файла
     */
    checkFileSize(filePath) {
        if (!this.enabled) return true;

        const stats = statSync(filePath);
        if (stats.size > this.maxFileSize) {
            throw new Error(`Размер файла превышает лимит: ${stats.size} > ${this.maxFileSize}`);
        }

        return true;
    }

    /**
     * Проверка безопасности URL
     */
    checkURL(url) {
        if (!this.enabled) return true;

        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;

            // Проверка заблокированных доменов
            if (this.blockedDomains.includes(domain)) {
                throw new Error('Домен заблокирован: ' + domain);
            }

            // Проверка разрешенных доменов
            if (this.allowedDomains.length > 0 && !this.allowedDomains.includes(domain)) {
                throw new Error('Доступ к домену запрещен: ' + domain);
            }

            // Проверка протокола
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(urlObj.protocol)) {
                throw new Error('Протокол не разрешен: ' + urlObj.protocol);
            }

            return true;
        } catch (e) {
            throw new Error('Неверный URL: ' + url);
        }
    }

    /**
     * Защита от prototype pollution
     */
    sanitizeObject(obj) {
        if (!this.prototypePollutionProtection) return obj;

        const sanitized = Array.isArray(obj) ? [] : {};

        for (const key in obj) {
            // Блокируем опасные ключи
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }

            const value = obj[key];

            if (value && typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Проверка и очистка JSON данных
     */
    sanitizeJSON(data) {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            return this.sanitizeObject(parsed);
        } catch (e) {
            throw new Error('Неверный JSON: ' + e.message);
        }
    }

    /**
     * Проверка глубины рекурсии
     */
    checkRecursionDepth(currentDepth, maxDepth = 1000) {
        if (currentDepth > maxDepth) {
            throw new Error(`Превышена глубина рекурсии: ${currentDepth} > ${maxDepth}`);
        }
        return true;
    }

    /**
     * Проверка использования памяти
     */
    checkMemoryUsage() {
        if (!this.enabled) return true;

        const usage = process.memoryUsage();
        if (usage.heapUsed > this.maxMemory) {
            throw new Error(`Превышен лимит памяти: ${usage.heapUsed} > ${this.maxMemory}`);
        }

        return true;
    }

    /**
     * Создание безопасной среды выполнения
     */
    createSandbox() {
        if (!this.enabled) return null;

        const sandbox = {
            console: {
                log: (...args) => console.log('[SANDBOX]', ...args),
                error: (...args) => console.error('[SANDBOX]', ...args),
                warn: (...args) => console.warn('[SANDBOX]', ...args)
            },
            setTimeout: setTimeout.bind(null),
            clearTimeout: clearTimeout.bind(null),
            setInterval: setInterval.bind(null),
            clearInterval: clearInterval.bind(null),
            Date,
            Math,
            JSON: {
                parse: (data) => this.sanitizeJSON(data),
                stringify: JSON.stringify.bind(JSON)
            },
            // Ограниченный доступ к процессу
            process: {
                cwd: process.cwd.bind(process),
                env: {}
            }
        };

        return sandbox;
    }

    /**
     * Валидация ввода
     */
    validateInput(input, schema) {
        const errors = [];

        if (schema.type) {
            const expectedType = schema.type;
            const actualType = Array.isArray(input) ? 'array' : typeof input;

            if (expectedType !== actualType) {
                errors.push(`Ожидается тип ${expectedType}, получен ${actualType}`);
            }
        }

        if (schema.min !== undefined && input < schema.min) {
            errors.push(`Значение должно быть >= ${schema.min}`);
        }

        if (schema.max !== undefined && input > schema.max) {
            errors.push(`Значение должно быть <= ${schema.max}`);
        }

        if (schema.minLength !== undefined && input.length < schema.minLength) {
            errors.push(`Длина должна быть >= ${schema.minLength}`);
        }

        if (schema.maxLength !== undefined && input.length > schema.maxLength) {
            errors.push(`Длина должна быть <= ${schema.maxLength}`);
        }

        if (schema.pattern && !schema.pattern.test(input)) {
            errors.push('Значение не соответствует паттерну');
        }

        if (errors.length > 0) {
            throw new Error('Ошибки валидации: ' + errors.join(', '));
        }

        return true;
    }

    /**
     * Очистка XSS уязвимостей
     */
    escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

export default SecurityManager;
