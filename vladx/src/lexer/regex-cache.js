/**
 * RegexCache — Кэширование и оптимизация регулярных выражений
 */

export class RegexCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 100;
        this.compiledCount = 0;
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Получить или создать regex из кэша
     */
    get(pattern, flags = '') {
        const key = `${pattern}::${flags}`;

        if (this.cache.has(key)) {
            this.hitCount++;
            return this.cache.get(key);
        }

        this.missCount++;
        const regex = new RegExp(pattern, flags);

        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, regex);
        this.compiledCount++;

        return regex;
    }

    /**
     * Очистить кэш
     */
    clear() {
        this.cache.clear();
        this.compiledCount = 0;
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Evict самый старый regex
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            compiledCount: this.compiledCount,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(2) + '%' : '0%'
        };
    }
}

export default RegexCache;
