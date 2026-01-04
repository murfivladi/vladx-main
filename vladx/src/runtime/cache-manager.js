/**
 * CacheManager — Управление кэшированием для повышения производительности
 */

export class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 300000; // 5 минут по умолчанию
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    /**
     * Получить значение из кэша
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Проверка TTL
        if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Установить значение в кэш
     */
    set(key, value) {
        // Проверка размера и LRU eviction
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            lastAccess: Date.now()
        });
    }

    /**
     * Удалить из кэша по ключу
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Очистить весь кэш
     */
    clear() {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    /**
     * Evict наименее используемый элемент (LRU)
     */
    evictLRU() {
        let lruKey = null;
        let lruTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.lastAccess < lruTime) {
                lruTime = entry.lastAccess;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.cache.delete(lruKey);
            this.stats.evictions++;
        }
    }

    /**
     * Получить статистику кэша
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }

    /**
     * Очистка устаревших записей
     */
    prune() {
        if (this.ttl <= 0) return;

        const now = Date.now();
        const keysToDelete = [];

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }
}

export default CacheManager;
