/**
 * Environment — Улучшенное управление окружением
 */

import { CacheManager } from './cache-manager.js';
import { SecurityManager } from './security-manager.js';

export class EnvironmentEnhanced {
    constructor(options = {}) {
        this.name = options.name || process.env.NODE_ENV || 'development';
        this.isDevelopment = this.name === 'development';
        this.isProduction = this.name === 'production';
        this.isTest = this.name === 'test';

        this.cache = new CacheManager({
            maxSize: options.cacheSize || 1000,
            ttl: options.cacheTTL || 300000
        });

        this.security = new SecurityManager({
            enabled: options.securityEnabled !== false,
            allowedPaths: options.allowedPaths || [],
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024
        });

        this.config = options.config || {};
        this.variables = options.variables || {};
        this.plugins = new Map();
        this.middleware = [];
        this.hooks = new Map();
    }

    /**
     * Получить переменную окружения
     */
    get(key, defaultValue) {
        if (key in this.variables) {
            return this.variables[key];
        }

        if (key in process.env) {
            return process.env[key];
        }

        return defaultValue;
    }

    /**
     * Установить переменную окружения
     */
    set(key, value) {
        this.variables[key] = value;
        return this;
    }

    /**
     * Получить конфигурацию
     */
    getConfig(key, defaultValue) {
        return this.getNestedValue(this.config, key, defaultValue);
    }

    /**
     * Получить вложенное значение
     */
    getNestedValue(obj, path, defaultValue) {
        const keys = path.split('.');
        let result = obj;

        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return defaultValue;
            }
        }

        return result;
    }

    /**
     * Добавить плагин
     */
    use(plugin) {
        const name = plugin.name || `plugin_${this.plugins.size}`;
        this.plugins.set(name, plugin);

        if (plugin.install) {
            plugin.install(this);
        }

        return this;
    }

    /**
     * Добавить middleware
     */
    add(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Выполнить middleware
     */
    async executeMiddleware(context) {
        for (const middleware of this.middleware) {
            const result = await middleware(context, this);

            if (result === false) {
                break;
            }
        }

        return context;
    }

    /**
     * Добавить hook
     */
    on(event, callback) {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }

        this.hooks.get(event).push(callback);
        return this;
    }

    /**
     * Удалить hook
     */
    off(event, callback) {
        const hooks = this.hooks.get(event);
        if (hooks) {
            const index = hooks.indexOf(callback);
            if (index !== -1) {
                hooks.splice(index, 1);
            }
        }
        return this;
    }

    /**
     * Запустить hook
     */
    async emit(event, ...args) {
        const hooks = this.hooks.get(event);
        if (hooks) {
            for (const callback of hooks) {
                await callback(...args);
            }
        }
        return this;
    }

    /**
     * Проверить функцию
     */
    hasFeature(feature) {
        return this.getConfig(`features.${feature}`, false);
    }

    /**
     * Получить режим работы
     */
    getMode() {
        return this.name;
    }

    /**
     * Получить информацию о системе
     */
    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cpus: process.cpuUsage(),
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            env: process.env.NODE_ENV
        };
    }

    /**
     * Логирование
     */
    log(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);

        this.emit('log', { level, message, timestamp });
    }

    info(...args) {
        this.log('info', ...args);
    }

    warn(...args) {
        this.log('warn', ...args);
    }

    error(...args) {
        this.log('error', ...args);
    }

    debug(...args) {
        if (this.isDevelopment) {
            this.log('debug', ...args);
        }
    }

    /**
     * Измерение времени
     */
    time(label) {
        this.timers = this.timers || {};
        this.timers[label] = Date.now();
    }

    timeEnd(label) {
        if (!this.timers || !(label in this.timers)) {
            return 0;
        }

        const duration = Date.now() - this.timers[label];
        delete this.timers[label];

        this.info(`${label}: ${duration}ms`);
        return duration;
    }

    /**
     * Очистить ресурсы
     */
    async cleanup() {
        this.cache.clear();

        for (const [name, plugin] of this.plugins) {
            if (plugin.uninstall) {
                await plugin.uninstall(this);
            }
        }

        this.plugins.clear();
        this.middleware = [];
        this.hooks.clear();
    }

    /**
     * Получить статистику окружения
     */
    getStats() {
        return {
            name: this.name,
            cache: this.cache.getStats(),
            plugins: Array.from(this.plugins.keys()),
            middleware: this.middleware.length,
            hooks: Object.fromEntries(
                Array.from(this.hooks.entries()).map(([k, v]) => [k, v.length])
            ),
            system: this.getSystemInfo()
        };
    }
}

export default EnvironmentEnhanced;
