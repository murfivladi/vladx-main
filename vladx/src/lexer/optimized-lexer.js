/**
 * OptimizedLexer — Оптимизированный лексер с кэшированием
 */

import { Lexer } from './lexer.js';
import { RegexCache } from './regex-cache.js';

export class OptimizedLexer extends Lexer {
    constructor(source, filename = '<anonymous>') {
        super(source, filename);
        this.regexCache = new RegexCache({ maxSize: 50 });
        this.charCache = new Map();
        this.lineCache = new Map();
    }

    /**
     * Быстрая проверка символа с кэшированием
     */
    isDigitFast(char) {
        const cacheKey = `digit_${char}`;
        if (this.charCache.has(cacheKey)) {
            return this.charCache.get(cacheKey);
        }

        const result = char >= '0' && char <= '9';
        this.charCache.set(cacheKey, result);
        return result;
    }

    /**
     * Быстрая проверка буквы
     */
    isAlphaFast(char) {
        const cacheKey = `alpha_${char}`;
        if (this.charCache.has(cacheKey)) {
            return this.charCache.get(cacheKey);
        }

        const result = this.isAlpha(char);
        this.charCache.set(cacheKey, result);
        return result;
    }

    /**
     * Кэшированное получение regex
     */
    getRegex(pattern, flags = '') {
        return this.regexCache.get(pattern, flags);
    }

    /**
     * Оптимизированный skipWhitespace
     */
    skipWhitespace() {
        const startLine = this.line;

        while (this.currentChar !== null && /\s/.test(this.currentChar)) {
            if (this.currentChar === '\n') {
                this.line++;
                this.column = 0;
            }
            this.advance();
        }
    }

    /**
     * Кэширование результатов токенизации
     */
    tokenizeCached() {
        const cacheKey = `${this.filename}_${this.source.length}_${this.source.substring(0, 100)}`;

        if (this.lineCache.has(cacheKey)) {
            return [...this.lineCache.get(cacheKey)];
        }

        const tokens = this.tokenize();

        if (this.lineCache.size < 10) {
            this.lineCache.set(cacheKey, [...tokens]);
        }

        return tokens;
    }

    /**
     * Получить статистику оптимизации
     */
    getOptimizationStats() {
        return {
            regexCache: this.regexCache.getStats(),
            charCacheSize: this.charCache.size,
            lineCacheSize: this.lineCache.size
        };
    }

    /**
     * Очистить кэши
     */
    clearCaches() {
        this.regexCache.clear();
        this.charCache.clear();
        this.lineCache.clear();
    }
}

export default OptimizedLexer;
